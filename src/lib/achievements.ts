import type { BotLevelId } from '../engine/levels.ts';

export interface Stats {
  lessonsCompleted: number;
  puzzlesSolved: number;
  bestStreak: number;
  linesDrilled: number;
  totalXp: number;
  /** Bot wins per level id. */
  botWins: Partial<Record<BotLevelId, number>>;
  perfectLessons: number;
}

export interface Achievement {
  id: string;
  test: (stats: Stats) => boolean;
}

const totalWins = (s: Stats): number => Object.values(s.botWins).reduce<number>((a, n) => a + (n ?? 0), 0);

/** Display text lives in i18n keyed by id. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-lesson', test: (s) => s.lessonsCompleted >= 1 },
  { id: 'ten-lessons', test: (s) => s.lessonsCompleted >= 10 },
  { id: 'first-puzzle', test: (s) => s.puzzlesSolved >= 1 },
  { id: 'puzzles-25', test: (s) => s.puzzlesSolved >= 25 },
  { id: 'puzzles-100', test: (s) => s.puzzlesSolved >= 100 },
  { id: 'streak-3', test: (s) => s.bestStreak >= 3 },
  { id: 'streak-7', test: (s) => s.bestStreak >= 7 },
  { id: 'streak-30', test: (s) => s.bestStreak >= 30 },
  { id: 'first-line', test: (s) => s.linesDrilled >= 1 },
  { id: 'lines-10', test: (s) => s.linesDrilled >= 10 },
  { id: 'perfect-lesson', test: (s) => s.perfectLessons >= 1 },
  { id: 'xp-500', test: (s) => s.totalXp >= 500 },
  { id: 'first-bot-win', test: (s) => totalWins(s) >= 1 },
  { id: 'beat-queen-bot', test: (s) => (s.botWins.queen ?? 0) >= 1 },
];

/** Returns ids newly unlocked by `stats` that are not in `alreadyUnlocked`. */
export function evaluateAchievements(stats: Stats, alreadyUnlocked: readonly string[]): string[] {
  const have = new Set(alreadyUnlocked);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(stats)).map((a) => a.id);
}
