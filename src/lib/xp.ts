import { safeDiffDays } from './date.ts';

export const XP_RULES = {
  step: { clean: 10, hint: 5 },
  puzzle: { clean: 20, hint: 10 },
  line: { clean: 30, mistakes: 15 },
  game: { win: 20, draw: 10, loss: 5 },
  lessonBonus: 25,
  streakBonus: 5,
} as const;

export type GameResult = 'win' | 'draw' | 'loss';

export type XpEvent =
  | { type: 'step'; hint: boolean }
  | { type: 'puzzle'; hint: boolean }
  | { type: 'line'; clean: boolean }
  | { type: 'game'; result: GameResult }
  | { type: 'lesson' }
  | { type: 'streak' };

export function xpFor(event: XpEvent): number {
  switch (event.type) {
    case 'step':
      return event.hint ? XP_RULES.step.hint : XP_RULES.step.clean;
    case 'puzzle':
      return event.hint ? XP_RULES.puzzle.hint : XP_RULES.puzzle.clean;
    case 'line':
      return event.clean ? XP_RULES.line.clean : XP_RULES.line.mistakes;
    case 'game':
      return XP_RULES.game[event.result];
    case 'lesson':
      return XP_RULES.lessonBonus;
    case 'streak':
      return XP_RULES.streakBonus;
  }
}

/** Total XP needed to reach `level` (level 1 = 0, 2 = 100, 3 = 300, ...). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return (100 * n * (n - 1)) / 2;
}

export interface LevelInfo {
  level: number;
  /** XP earned since the current level began. */
  intoLevel: number;
  /** XP span of the current level (so progress = intoLevel / forNext). */
  forNext: number;
}

/** Upper bound so absurd (imported or corrupt) totals cannot stall the level search. */
export const MAX_XP = 1e9;

export function levelFor(totalXp: number): LevelInfo {
  const xp = Number.isFinite(totalXp) ? Math.min(MAX_XP, Math.max(0, Math.floor(totalXp))) : 0;
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2));
  while (xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return { level, intoLevel: xp - xpForLevel(level), forNext: xpForLevel(level + 1) - xpForLevel(level) };
}

export interface StreakState {
  current: number;
  best: number;
  /** Local calendar day (YYYY-MM-DD) of the last activity. */
  lastDay?: string;
}

/** Records activity on `today`. Same day: unchanged. Next day: +1. Longer gap (or first ever): 1. */
export function updateStreak(state: StreakState, today: string): StreakState {
  const gap = state.lastDay === undefined ? null : safeDiffDays(today, state.lastDay);
  if (gap === null) {
    // No previous day, or a damaged one: start counting again from today.
    return { current: 1, best: Math.max(state.best, 1), lastDay: today };
  }
  if (gap <= 0) return { ...state }; // same day (or clock moved backwards): unchanged
  const current = gap === 1 ? state.current + 1 : 1;
  return { current, best: Math.max(state.best, current), lastDay: today };
}
