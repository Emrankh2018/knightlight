/** Assign links: parse, sanitise, validate and build `#/assign?...` URLs. Pure, no I/O. */
import type { PuzzleBucket, PuzzleLevel } from './puzzle-types.ts';

export type Assignment =
  | { type: 'puzzles'; level: string; theme: string }
  | { type: 'lesson'; course: string; lesson: string };

export type ParseFailure = 'missing' | 'type' | 'level' | 'theme' | 'lesson';

export type ParsedAssign = { ok: true; assignment: Assignment } | { ok: false; reason: ParseFailure };

/** Level and theme ids from the puzzle index (letters, digits and dashes only). */
const ID_RE = /^[A-Za-z0-9-]{1,40}$/;
/** Course slugs follow the same rule as `loadCourse`. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const LESSON_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export const DEFAULT_THEME = 'mixed';

/** Syntax-only check of the query string. Whether the ids exist is checked by the `find*` helpers. */
export function parseAssign(params: URLSearchParams): ParsedAssign {
  const type = params.get('type');
  if (type === null) return { ok: false, reason: 'missing' };
  if (type === 'puzzles') {
    const level = params.get('level');
    if (level === null || !ID_RE.test(level)) return { ok: false, reason: 'level' };
    const theme = params.get('theme') ?? DEFAULT_THEME;
    if (!ID_RE.test(theme)) return { ok: false, reason: 'theme' };
    return { ok: true, assignment: { type: 'puzzles', level, theme } };
  }
  if (type === 'lesson') {
    const parts = (params.get('id') ?? '').split('/');
    const [course, lesson] = parts;
    if (parts.length !== 2 || course === undefined || lesson === undefined || !SLUG_RE.test(course) || !LESSON_RE.test(lesson)) {
      return { ok: false, reason: 'lesson' };
    }
    return { ok: true, assignment: { type: 'lesson', course, lesson } };
  }
  return { ok: false, reason: 'type' };
}

/** The puzzle level and theme bucket named by a puzzles assignment, or null when the index has no such set. */
export function findPuzzleSet(
  levels: readonly PuzzleLevel[],
  level: string,
  theme: string,
): { level: PuzzleLevel; bucket: PuzzleBucket } | null {
  const l = levels.find((x) => x.id === level);
  const bucket = l?.buckets.find((b) => b.theme === theme);
  return l && bucket && bucket.count > 0 ? { level: l, bucket } : null;
}

/** Router path (no hash) for an assignment's trainer. */
export function targetPath(a: Assignment): string {
  if (a.type === 'puzzles') {
    return `/puzzles?${new URLSearchParams({ level: a.level, theme: a.theme }).toString()}`;
  }
  return `/learn/${encodeURIComponent(a.course)}/${encodeURIComponent(a.lesson)}`;
}

/** Router path (no hash) for the Assign page itself. */
export function assignPath(a: Assignment): string {
  const q =
    a.type === 'puzzles'
      ? new URLSearchParams({ type: 'puzzles', level: a.level, theme: a.theme })
      : new URLSearchParams({ type: 'lesson', id: `${a.course}/${a.lesson}` });
  return `/assign?${q.toString()}`;
}

/** Full shareable URL. `pageHref` is the current page address; any hash is dropped. */
export function assignUrl(a: Assignment, pageHref: string): string {
  const base = pageHref.split('#')[0] ?? pageHref;
  return `${base}#${assignPath(a)}`;
}
