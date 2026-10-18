/**
 * Local-calendar day strings ("YYYY-MM-DD"). All arithmetic is done on calendar
 * dates via UTC day numbers, never on local-time milliseconds, so DST shifts
 * (23h / 25h days) cannot change a result.
 */

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

function formatUtc(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

function parseDay(day: string): Date {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Invalid day string: ${day}`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (formatUtc(date) !== day) throw new Error(`Invalid calendar day: ${day}`);
  return date;
}

/** Today's date in the user's local calendar. */
export function todayLocal(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}

/** Adds (or subtracts) whole calendar days. */
export function addDays(day: string, n: number): string {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + n);
  return formatUtc(date);
}

/** Whole calendar days from `b` to `a` (a - b). Positive when `a` is later. */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / MS_PER_DAY);
}
