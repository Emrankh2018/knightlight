/** Pure helpers for the Review page: which SRS items are due, how a result is graded, and the puzzle id lookup. */
import type { Course, LineDrillStep } from './content/types.ts';
import type { Puzzle, PuzzleIndex } from './puzzle-types.ts';
import { DataError } from './data-error.ts';
import { start } from './puzzles.ts';
import { dueItems, type SrsGrade, type SrsItem } from './srs.ts';

/** Due items the Review page can run (puzzles and drilled lines), in `dueItems` order. */
export function reviewQueue(items: readonly SrsItem[], today: string): SrsItem[] {
  return dueItems(
    items.filter((i) => i.kind === 'puzzle' || i.kind === 'line'),
    today,
  );
}

/** Splits a line ref `<course>/<stepId>`. Null when either part is missing. */
export function parseLineRef(ref: string): { course: string; stepId: string } | null {
  const at = ref.indexOf('/');
  if (at <= 0 || at === ref.length - 1) return null;
  return { course: ref.slice(0, at), stepId: ref.slice(at + 1) };
}

/** The line-drill step with this id, or null when the course no longer has it. */
export function findLineStep(course: Course, stepId: string): LineDrillStep | null {
  for (const chapter of course.chapterList) {
    for (const lesson of chapter.lessons) {
      for (const step of lesson.steps) {
        if (step.id === stepId && step.type === 'line-drill') return step;
      }
    }
  }
  return null;
}

export interface ReviewResult {
  /** The puzzle was solved or the line finished (not just shown). */
  solved: boolean;
  hint: boolean;
  /** Wrong moves tried. */
  mistakes: number;
}

/** A clean result grows the interval, help (a hint only) grows it slowly, and any miss resets it to one day. */
export function gradeFor(r: ReviewResult): SrsGrade {
  if (!r.solved || r.mistakes > 0) return 'again';
  return r.hint ? 'hard' : 'good';
}

export interface PuzzleLookup {
  /** Finds the puzzles with these ids, scanning index chunks only until every id is found. Unknown ids are `missing`. */
  resolve: (ids: readonly string[]) => Promise<{ found: Map<string, Puzzle>; missing: string[]; failed: boolean }>;
}

/**
 * Lazy id -> bucket lookup. Buckets are scanned in index order only for ids not seen before;
 * every id seen while scanning is remembered, as are ids proven absent (only when no chunk failed to load).
 */
export function createPuzzleLookup(index: PuzzleIndex, loadChunk: (file: string) => Promise<Puzzle[]>): PuzzleLookup {
  const bucketOf = new Map<string, string>();
  const absent = new Set<string>();
  const files = index.levels.flatMap((l) => l.buckets.map((b) => b.file));
  const scanned = new Set<string>();

  return {
    async resolve(ids) {
      const found = new Map<string, Puzzle>();
      let failed = false;
      const want = new Set(ids.filter((id) => !absent.has(id)));

      for (const id of [...want]) {
        const file = bucketOf.get(id);
        if (file === undefined) continue;
        try {
          const hit = (await loadChunk(file)).find((p) => p.id === id);
          if (hit) {
            found.set(id, hit);
            want.delete(id);
          }
        } catch {
          failed = true;
          want.delete(id);
        }
      }

      for (const file of files) {
        if (want.size === 0) break;
        if (scanned.has(file)) continue;
        let chunk: Puzzle[];
        try {
          chunk = await loadChunk(file);
        } catch {
          failed = true;
          continue;
        }
        scanned.add(file);
        for (const p of chunk) {
          bucketOf.set(p.id, file);
          if (want.has(p.id)) {
            found.set(p.id, p);
            want.delete(p.id);
          }
        }
      }

      const missing = ids.filter((id) => !found.has(id));
      if (!failed) for (const id of missing) absent.add(id);
      return { found, missing, failed };
    },
  };
}

export type LineEntry = { kind: 'line'; item: SrsItem; course: Course; step: LineDrillStep };
export type Entry = { kind: 'puzzle'; item: SrsItem; puzzle: Puzzle } | LineEntry;

export interface Prepared {
  entries: Entry[];
  /** Ids of items that no longer exist (or are corrupt); the caller removes them from the queue. */
  dropIds: string[];
  /** Items that could not be loaded right now; kept for next time. */
  skipped: number;
}

export interface PrepareDeps {
  /** Resolves puzzle ids; rejects when the puzzle index itself cannot be loaded. */
  resolvePuzzles: PuzzleLookup['resolve'];
  loadCourse: (slug: string) => Promise<Course>;
}

/** A course that is gone for good: removed from the site (HTTP 404) or no longer a valid course. */
function isGone(err: unknown): boolean {
  return err instanceof DataError && (err.kind === 'notfound' || err.kind === 'shape');
}

/** Whether `start` accepts this puzzle. */
function playable(puzzle: Puzzle): boolean {
  try {
    start(puzzle);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads what each due item points at, without side effects. Items that are gone for good or corrupt
 * go to `dropIds`; items that only failed to load (offline, server error) are counted as `skipped`.
 */
export async function prepareReview(items: readonly SrsItem[], deps: PrepareDeps): Promise<Prepared> {
  const puzzleIds = items.filter((i) => i.kind === 'puzzle').map((i) => i.ref);
  const found = new Map<string, Puzzle>();
  const unloaded = new Set<string>();
  if (puzzleIds.length > 0) {
    try {
      const res = await deps.resolvePuzzles(puzzleIds);
      for (const [id, p] of res.found) found.set(id, p);
      if (res.failed) for (const id of res.missing) unloaded.add(id);
    } catch {
      for (const id of puzzleIds) unloaded.add(id);
    }
  }

  const slugs = [...new Set(items.flatMap((i) => (i.kind === 'line' ? (parseLineRef(i.ref)?.course ?? []) : [])))];
  const loaded = await Promise.allSettled(slugs.map((s) => deps.loadCourse(s)));
  const courses = new Map<string, Course | 'gone' | 'error'>();
  slugs.forEach((slug, n) => {
    const r = loaded[n];
    if (r?.status === 'fulfilled') courses.set(slug, r.value);
    else courses.set(slug, r !== undefined && isGone(r.reason) ? 'gone' : 'error');
  });

  const entries: Entry[] = [];
  const dropIds: string[] = [];
  let skipped = 0;
  for (const item of items) {
    if (item.kind === 'puzzle') {
      const puzzle = found.get(item.ref);
      if (puzzle) {
        if (playable(puzzle)) entries.push({ kind: 'puzzle', item, puzzle });
        else dropIds.push(item.id);
      } else if (unloaded.has(item.ref)) skipped += 1;
      else dropIds.push(item.id);
    } else {
      const ref = parseLineRef(item.ref);
      const course = ref ? courses.get(ref.course) : undefined;
      if (!ref || course === 'gone') dropIds.push(item.id);
      else if (course === undefined || course === 'error') skipped += 1;
      else {
        const step = findLineStep(course, ref.stepId);
        if (step) entries.push({ kind: 'line', item, course, step });
        else dropIds.push(item.id);
      }
    }
  }
  return { entries, dropIds, skipped };
}
