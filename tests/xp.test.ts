import { describe, expect, it } from 'vitest';
import { XP_RULES, levelFor, updateStreak, xpFor, xpForLevel } from '../src/lib/xp.ts';

describe('xpFor', () => {
  it('awards step, puzzle and line XP with hint/mistake reductions', () => {
    expect(xpFor({ type: 'step', hint: false })).toBe(10);
    expect(xpFor({ type: 'step', hint: true })).toBe(5);
    expect(xpFor({ type: 'puzzle', hint: false })).toBe(20);
    expect(xpFor({ type: 'puzzle', hint: true })).toBe(10);
    expect(xpFor({ type: 'line', clean: true })).toBe(30);
    expect(xpFor({ type: 'line', clean: false })).toBe(15);
  });

  it('awards lesson and streak bonuses', () => {
    expect(xpFor({ type: 'lesson' })).toBe(25);
    expect(xpFor({ type: 'streak' })).toBe(5);
    expect(XP_RULES.lessonBonus).toBe(25);
  });
});

describe('levelFor', () => {
  it('has thresholds exactly at 0 / 100 / 300 / 600', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 100, 300, 600]);
    expect(levelFor(0)).toEqual({ level: 1, intoLevel: 0, forNext: 100 });
    expect(levelFor(99)).toEqual({ level: 1, intoLevel: 99, forNext: 100 });
    expect(levelFor(100)).toEqual({ level: 2, intoLevel: 0, forNext: 200 });
    expect(levelFor(299)).toEqual({ level: 2, intoLevel: 199, forNext: 200 });
    expect(levelFor(300)).toEqual({ level: 3, intoLevel: 0, forNext: 300 });
    expect(levelFor(599).level).toBe(3);
    expect(levelFor(600).level).toBe(4);
  });

  it('is exact for every threshold up to level 200', () => {
    for (let n = 1; n <= 200; n++) {
      expect(levelFor(xpForLevel(n)).level).toBe(n);
      if (n > 1) expect(levelFor(xpForLevel(n) - 1).level).toBe(n - 1);
    }
  });

  it('clamps bad input to level 1', () => {
    expect(levelFor(-50).level).toBe(1);
    expect(levelFor(Number.NaN).level).toBe(1);
  });
});

describe('updateStreak', () => {
  it('starts at 1 on first activity', () => {
    expect(updateStreak({ current: 0, best: 0 }, '2026-03-10')).toEqual({ current: 1, best: 1, lastDay: '2026-03-10' });
  });

  it('leaves the state unchanged on the same day', () => {
    const state = { current: 4, best: 9, lastDay: '2026-03-10' };
    expect(updateStreak(state, '2026-03-10')).toEqual(state);
  });

  it('increments on the next day and updates best', () => {
    expect(updateStreak({ current: 4, best: 9, lastDay: '2026-03-10' }, '2026-03-11')).toEqual({
      current: 5,
      best: 9,
      lastDay: '2026-03-11',
    });
    expect(updateStreak({ current: 9, best: 9, lastDay: '2026-03-10' }, '2026-03-11')).toEqual({
      current: 10,
      best: 10,
      lastDay: '2026-03-11',
    });
  });

  it('resets to 1 after a gap of more than one day, keeping best', () => {
    expect(updateStreak({ current: 6, best: 6, lastDay: '2026-03-10' }, '2026-03-12')).toEqual({
      current: 1,
      best: 6,
      lastDay: '2026-03-12',
    });
    expect(updateStreak({ current: 6, best: 6, lastDay: '2026-03-10' }, '2026-06-01').current).toBe(1);
  });

  it('continues across month and year boundaries', () => {
    expect(updateStreak({ current: 2, best: 2, lastDay: '2026-01-31' }, '2026-02-01').current).toBe(3);
    expect(updateStreak({ current: 2, best: 2, lastDay: '2026-12-31' }, '2027-01-01').current).toBe(3);
    expect(updateStreak({ current: 2, best: 2, lastDay: '2028-02-28' }, '2028-02-29').current).toBe(3);
    expect(updateStreak({ current: 2, best: 2, lastDay: '2028-02-29' }, '2028-03-01').current).toBe(3);
    expect(updateStreak({ current: 2, best: 2, lastDay: '2027-02-28' }, '2027-03-01').current).toBe(3);
  });

  it('treats a backwards clock as unchanged', () => {
    const state = { current: 3, best: 3, lastDay: '2026-03-10' };
    expect(updateStreak(state, '2026-03-08')).toEqual(state);
  });
});
