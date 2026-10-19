import { describe, expect, it } from 'vitest';
import { liveStreak, rankStudents, statsFor, type StudentStats } from '../src/lib/leaderboard';
import { nameProblem, sanitizeName } from '../src/lib/students';

const row = (id: string, over: Partial<StudentStats>): StudentStats => ({
  id, name: id, avatar: '🦊', level: 1, xp: 0, streak: 0, puzzles: 0, lessons: 0, achievements: 0, ...over,
});

describe('rankStudents', () => {
  const rows = [
    row('a', { xp: 100, streak: 5, puzzles: 1 }),
    row('b', { xp: 300, streak: 1, puzzles: 9 }),
    row('c', { xp: 200, streak: 9, puzzles: 4 }),
  ];

  it('sorts by each key, highest first', () => {
    expect(rankStudents(rows, 'xp').map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(rankStudents(rows, 'streak').map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(rankStudents(rows, 'puzzles').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('shares a rank on ties and breaks them by XP then name', () => {
    const tied = [row('z', { streak: 3, xp: 10 }), row('x', { streak: 3, xp: 50 }), row('y', { streak: 1 })];
    const ranked = rankStudents(tied, 'streak');
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([['x', 1], ['z', 1], ['y', 3]]);
  });

  it('does not change the input and handles an empty list', () => {
    const copy = [...rows];
    rankStudents(rows, 'xp');
    expect(rows).toEqual(copy);
    expect(rankStudents([], 'xp')).toEqual([]);
  });
});

describe('statsFor and liveStreak', () => {
  const progress = {
    xp: 250,
    streak: { current: 4, lastDay: '2026-03-09' },
    puzzles: { solved: { p1: 1, p2: 1 } },
    completedLessons: { 'c/l': 1 },
    achievements: ['first-lesson', 'not-a-real-one'],
  };

  it('summarises a profile', () => {
    expect(statsFor({ id: 'i', name: 'Sam', avatar: '🐼' }, progress, '2026-03-10')).toEqual({
      id: 'i', name: 'Sam', avatar: '🐼', level: 2, xp: 250, streak: 4, puzzles: 2, lessons: 1, achievements: 1,
    });
  });

  it('drops a streak once a whole day was missed', () => {
    expect(liveStreak({ current: 4, lastDay: '2026-03-10' }, '2026-03-10')).toBe(4);
    expect(liveStreak({ current: 4, lastDay: '2026-03-09' }, '2026-03-10')).toBe(4);
    expect(liveStreak({ current: 4, lastDay: '2026-03-08' }, '2026-03-10')).toBe(0);
  });
});

describe('student names', () => {
  it('sanitises control characters and whitespace', () => {
    expect(sanitizeName('  Ana\u0000​   Maria\n ')).toBe('Ana Maria');
  });

  it('flags empty, too long and duplicate names', () => {
    const others = [{ id: '1', name: 'Sam' }, { id: '2', name: 'Lee' }];
    expect(nameProblem('   ', others)).toBe('empty');
    expect(nameProblem('x'.repeat(31), others)).toBe('tooLong');
    expect(nameProblem('x'.repeat(30), others)).toBeNull();
    expect(nameProblem(' sam ', others)).toBe('duplicate');
    expect(nameProblem('SAM', others, '1')).toBeNull();
    expect(nameProblem('Kim', others)).toBeNull();
  });
});
