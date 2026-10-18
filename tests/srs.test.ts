import { describe, expect, it } from 'vitest';
import { addDays, diffDays, todayLocal } from '../src/lib/date.ts';
import { dueItems, newItem, review, type SrsItem } from '../src/lib/srs.ts';

const TODAY = '2026-03-10';

describe('date helpers', () => {
  it('formats local dates with padding', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayLocal(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-10', 0)).toBe('2026-03-10');
  });

  it('diffs calendar days regardless of DST transitions', () => {
    expect(diffDays('2026-03-30', '2026-03-29')).toBe(1); // EU spring-forward day
    expect(diffDays('2026-11-02', '2026-11-01')).toBe(1); // US fall-back day
    expect(diffDays('2026-03-08', '2026-03-07')).toBe(1);
    expect(diffDays('2027-01-01', '2026-01-01')).toBe(365);
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(-365);
    expect(diffDays('2026-05-05', '2026-05-05')).toBe(0);
  });

  it('rejects malformed or impossible days', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
    expect(() => diffDays('26-1-1', '2026-01-01')).toThrow();
  });
});

describe('srs', () => {
  it('creates a new item due today with default ease', () => {
    const item = newItem('i1', 'puzzle', 'p-1', TODAY);
    expect(item).toMatchObject({ ease: 2.5, interval: 0, reps: 0, due: TODAY, lapses: 0, kind: 'puzzle', ref: 'p-1' });
  });

  it('good: 1 day, then 3 days, then interval x ease', () => {
    let item = newItem('i', 'line', 'r', TODAY);
    item = review(item, 'good', TODAY);
    expect([item.reps, item.interval, item.due]).toEqual([1, 1, '2026-03-11']);
    item = review(item, 'good', item.due);
    expect([item.reps, item.interval, item.due]).toEqual([2, 3, '2026-03-14']);
    item = review(item, 'good', item.due);
    expect([item.reps, item.interval]).toEqual([3, 8]); // round(3 * 2.5) = 8
    item = review(item, 'good', item.due);
    expect(item.interval).toBe(20); // 8 * 2.5
    expect(item.ease).toBe(2.5);
  });

  it('interval grows monotonically under repeated good reviews', () => {
    let item = newItem('i', 'step', 'r', TODAY);
    let last = 0;
    let day = TODAY;
    for (let n = 0; n < 8; n++) {
      item = review(item, 'good', day);
      expect(item.interval).toBeGreaterThan(last);
      last = item.interval;
      day = item.due;
    }
  });

  it('again: resets reps, interval 1, ease -0.2, lapse + 1, due tomorrow', () => {
    let item = newItem('i', 'line', 'r', TODAY);
    item = review(review(review(item, 'good', TODAY), 'good', TODAY), 'good', TODAY);
    const lapsed = review(item, 'again', TODAY);
    expect(lapsed).toMatchObject({ reps: 0, interval: 1, ease: 2.3, lapses: 1, due: '2026-03-11' });
    // After a lapse the ladder starts again at 1 day.
    expect(review(lapsed, 'good', TODAY).interval).toBe(1);
  });

  it('hard: interval x1.2 but at least +1 day, ease -0.15', () => {
    const base: SrsItem = { ...newItem('i', 'line', 'r', TODAY), interval: 10, reps: 4 };
    const hard = review(base, 'hard', TODAY);
    expect(hard.interval).toBe(12);
    expect(hard.ease).toBe(2.35);
    expect(hard.reps).toBe(5);
    expect(hard.due).toBe('2026-03-22');
    const small = review({ ...base, interval: 1 }, 'hard', TODAY);
    expect(small.interval).toBe(2); // round(1.2) = 1, bumped to +1 day
    expect(review(newItem('n', 'step', 'r', TODAY), 'hard', TODAY).interval).toBe(1);
  });

  it('easy: good interval x1.3, ease +0.15, always longer than good', () => {
    const base: SrsItem = { ...newItem('i', 'line', 'r', TODAY), interval: 8, reps: 3 };
    const good = review(base, 'good', TODAY);
    const easy = review(base, 'easy', TODAY);
    expect(good.interval).toBe(20);
    expect(easy.interval).toBe(26); // round(20 * 1.3)
    expect(easy.ease).toBe(2.65);
    const first = review(newItem('n', 'step', 'r', TODAY), 'easy', TODAY);
    expect(first.interval).toBeGreaterThan(review(newItem('n', 'step', 'r', TODAY), 'good', TODAY).interval);
  });

  it('never lets ease drop below 1.3', () => {
    let item = newItem('i', 'puzzle', 'r', TODAY);
    for (let n = 0; n < 20; n++) item = review(item, n % 2 ? 'hard' : 'again', TODAY);
    expect(item.ease).toBe(1.3);
    expect(review(item, 'again', TODAY).ease).toBe(1.3);
    expect(review(item, 'hard', TODAY).ease).toBe(1.3);
  });

  it('does not mutate its input', () => {
    const item = newItem('i', 'puzzle', 'r', TODAY);
    const copy = { ...item };
    review(item, 'good', TODAY);
    expect(item).toEqual(copy);
  });

  it('dueItems filters to due, sorts by due date then lapses descending', () => {
    const mk = (id: string, due: string, lapses: number): SrsItem => ({ ...newItem(id, 'puzzle', id, TODAY), due, lapses });
    const items = [
      mk('future', '2026-03-11', 9),
      mk('today-0', '2026-03-10', 0),
      mk('old-0', '2026-03-01', 0),
      mk('today-3', '2026-03-10', 3),
      mk('old-2', '2026-03-01', 2),
    ];
    expect(dueItems(items, TODAY).map((i) => i.id)).toEqual(['old-2', 'old-0', 'today-3', 'today-0']);
    expect(dueItems(items, '2026-02-01')).toEqual([]);
  });
});
