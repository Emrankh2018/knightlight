import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, evaluateAchievements, type Stats } from '../src/lib/achievements.ts';

const empty: Stats = {
  lessonsCompleted: 0,
  puzzlesSolved: 0,
  bestStreak: 0,
  linesDrilled: 0,
  totalXp: 0,
  botWins: {},
  perfectLessons: 0,
};

describe('achievements', () => {
  it('has about a dozen unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(12);
  });

  it('unlocks nothing for empty stats', () => {
    expect(evaluateAchievements(empty, [])).toEqual([]);
  });

  it('unlocks at exact thresholds', () => {
    expect(evaluateAchievements({ ...empty, lessonsCompleted: 1 }, [])).toEqual(['first-lesson']);
    expect(evaluateAchievements({ ...empty, lessonsCompleted: 9 }, [])).toEqual(['first-lesson']);
    expect(evaluateAchievements({ ...empty, lessonsCompleted: 10 }, [])).toEqual(['first-lesson', 'ten-lessons']);
    expect(evaluateAchievements({ ...empty, bestStreak: 7 }, [])).toEqual(['streak-3', 'streak-7']);
    expect(evaluateAchievements({ ...empty, totalXp: 499 }, [])).toEqual([]);
    expect(evaluateAchievements({ ...empty, totalXp: 500 }, [])).toEqual(['xp-500']);
    expect(evaluateAchievements({ ...empty, perfectLessons: 1 }, [])).toEqual(['perfect-lesson']);
  });

  it('counts bot wins per level', () => {
    expect(evaluateAchievements({ ...empty, botWins: { pawn: 1 } }, [])).toEqual(['first-bot-win']);
    expect(evaluateAchievements({ ...empty, botWins: { queen: 1 } }, [])).toEqual(['first-bot-win', 'beat-queen-bot']);
    expect(evaluateAchievements({ ...empty, botWins: { pawn: 0, queen: 0 } }, [])).toEqual([]);
  });

  it('never re-unlocks something already unlocked', () => {
    const stats: Stats = { ...empty, lessonsCompleted: 12, puzzlesSolved: 30, linesDrilled: 3 };
    const first = evaluateAchievements(stats, []);
    expect(first).toEqual(['first-lesson', 'ten-lessons', 'first-puzzle', 'puzzles-25', 'first-line']);
    expect(evaluateAchievements(stats, first)).toEqual([]);
    expect(evaluateAchievements({ ...stats, puzzlesSolved: 100 }, first)).toEqual(['puzzles-100']);
  });

  it('unlocks every achievement with maxed stats, exactly once', () => {
    const max: Stats = {
      lessonsCompleted: 99,
      puzzlesSolved: 999,
      bestStreak: 99,
      linesDrilled: 99,
      totalXp: 99999,
      botWins: { queen: 3 },
      perfectLessons: 9,
    };
    const all = evaluateAchievements(max, []);
    expect(all).toEqual(ACHIEVEMENTS.map((a) => a.id));
    expect(evaluateAchievements(max, all)).toEqual([]);
  });
});
