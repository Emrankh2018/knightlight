import { ACHIEVEMENTS } from './achievements.ts';
import { safeDiffDays } from './date.ts';
import { levelFor } from './xp.ts';

export interface StudentStats {
  id: string;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  /** Daily streak that is still alive today (0 once a full day was missed). */
  streak: number;
  puzzles: number;
  lessons: number;
  achievements: number;
}

export type SortKey = 'xp' | 'streak' | 'puzzles';
export const SORT_KEYS: readonly SortKey[] = ['xp', 'streak', 'puzzles'];

interface ProgressLike {
  xp: number;
  streak: { current: number; lastDay?: string };
  puzzles: { solved: Record<string, unknown> };
  completedLessons: Record<string, unknown>;
  achievements: readonly string[];
}

interface ProfileLike {
  id: string;
  name: string;
  avatar: string;
}

const KNOWN_ACHIEVEMENTS = new Set(ACHIEVEMENTS.map((a) => a.id));

/** A streak only counts while the last activity was today or yesterday. */
export function liveStreak(streak: { current: number; lastDay?: string }, today: string): number {
  if (streak.lastDay === undefined) return streak.current;
  const gap = safeDiffDays(today, streak.lastDay);
  return gap !== null && gap <= 1 ? streak.current : 0;
}

export function statsFor(profile: ProfileLike, progress: ProgressLike, today: string): StudentStats {
  return {
    id: profile.id,
    name: profile.name,
    avatar: profile.avatar,
    level: levelFor(progress.xp).level,
    xp: progress.xp,
    streak: liveStreak(progress.streak, today),
    puzzles: Object.keys(progress.puzzles.solved).length,
    lessons: Object.keys(progress.completedLessons).length,
    achievements: progress.achievements.filter((id) => KNOWN_ACHIEVEMENTS.has(id)).length,
  };
}

export interface Ranked extends StudentStats {
  /** 1-based; students with the same value on the sort key share a rank. */
  rank: number;
}

/** Highest first. Ties are broken by XP, then name, then id so the order is stable. */
export function rankStudents(rows: readonly StudentStats[], key: SortKey): Ranked[] {
  const sorted = [...rows].sort(
    (a, b) => b[key] - a[key] || b.xp - a.xp || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  let rank = 0;
  return sorted.map((row, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev[key] !== row[key]) rank = i + 1;
    return { ...row, rank };
  });
}
