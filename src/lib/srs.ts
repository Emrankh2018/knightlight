/** Simplified SM-2 spaced repetition. Pure functions over plain data. */
import { addDays } from './date.ts';

export type SrsKind = 'line' | 'puzzle' | 'step';
export type SrsGrade = 'again' | 'hard' | 'good' | 'easy';

export interface SrsItem {
  id: string;
  kind: SrsKind;
  /** Course/lesson/step id or puzzle id the item points at. */
  ref: string;
  ease: number;
  /** Days until the next review. */
  interval: number;
  reps: number;
  /** Local calendar day, YYYY-MM-DD. */
  due: string;
  lapses: number;
}

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;

const roundEase = (e: number): number => Math.max(MIN_EASE, Math.round(e * 100) / 100);

export function newItem(id: string, kind: SrsKind, ref: string, today: string): SrsItem {
  return { id, kind, ref, ease: DEFAULT_EASE, interval: 0, reps: 0, due: today, lapses: 0 };
}

/** Interval a "good" answer gives, where `reps` already counts this review. */
function goodInterval(interval: number, ease: number, reps: number): number {
  if (reps <= 1) return 1;
  if (reps === 2) return 3;
  return Math.max(1, Math.round(interval * ease));
}

/** Returns the updated item; the input is not mutated. */
export function review(item: SrsItem, grade: SrsGrade, today: string): SrsItem {
  let { ease, interval, reps, lapses } = item;
  switch (grade) {
    case 'again':
      reps = 0;
      interval = 1;
      ease = roundEase(ease - 0.2);
      lapses += 1;
      break;
    case 'hard':
      interval = Math.max(interval + 1, Math.round(interval * 1.2));
      ease = roundEase(ease - 0.15);
      reps += 1;
      break;
    case 'good':
      reps += 1;
      interval = goodInterval(interval, ease, reps);
      break;
    case 'easy': {
      reps += 1;
      const good = goodInterval(interval, ease, reps);
      interval = Math.max(good + 1, Math.round(good * 1.3));
      ease = roundEase(ease + 0.15);
      break;
    }
  }
  return { ...item, ease, interval, reps, lapses, due: addDays(today, interval) };
}

/** Items due on or before `today`: earliest due first, then most lapses first. */
export function dueItems(items: readonly SrsItem[], today: string): SrsItem[] {
  return items
    .filter((i) => i.due <= today)
    .sort((a, b) => {
      if (a.due !== b.due) return a.due < b.due ? -1 : 1;
      if (a.lapses !== b.lapses) return b.lapses - a.lapses;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
