import { describe, expect, it, vi } from 'vitest';
import type { Course } from '../src/lib/content/types';
import type { Puzzle, PuzzleIndex } from '../src/lib/puzzle-types';
import { DataError } from '../src/lib/data-error';
import { createPuzzleLookup, findLineStep, gradeFor, parseLineRef, prepareReview, reviewQueue, type PrepareDeps } from '../src/lib/review';
import { newItem, review, type SrsItem } from '../src/lib/srs';

const TODAY = '2026-03-10';

const puzzle = (id: string): Puzzle => ({ id, fen: '', moves: ['a2a3', 'a7a6'], rating: 1000, themes: [], url: '' });

describe('reviewQueue', () => {
  const at = (id: string, kind: SrsItem['kind'], due: string, lapses = 0): SrsItem => ({ ...newItem(id, kind, id, due), due, lapses });

  it('keeps only due puzzles and lines, earliest first', () => {
    const items = [at('puzzle:b', 'puzzle', '2026-03-10'), at('line:c/x', 'line', '2026-03-08'), at('puzzle:future', 'puzzle', '2026-03-11'), at('step:s', 'step', '2026-03-01')];
    expect(reviewQueue(items, TODAY).map((i) => i.id)).toEqual(['line:c/x', 'puzzle:b']);
  });

  it('puts the item with more lapses first on the same day', () => {
    const items = [at('puzzle:a', 'puzzle', TODAY, 0), at('puzzle:b', 'puzzle', TODAY, 3)];
    expect(reviewQueue(items, TODAY).map((i) => i.id)).toEqual(['puzzle:b', 'puzzle:a']);
  });

  it('is empty when nothing is due', () => {
    expect(reviewQueue([at('puzzle:a', 'puzzle', '2026-04-01')], TODAY)).toEqual([]);
  });
});

describe('gradeFor and the SRS interval', () => {
  it('maps results to grades', () => {
    expect(gradeFor({ solved: true, hint: false, mistakes: 0 })).toBe('good');
    expect(gradeFor({ solved: true, hint: true, mistakes: 0 })).toBe('hard');
    expect(gradeFor({ solved: true, hint: false, mistakes: 2 })).toBe('again');
    expect(gradeFor({ solved: false, hint: true, mistakes: 0 })).toBe('again');
  });

  it('grows the interval on success and resets it to one day on failure', () => {
    let item = newItem('puzzle:p', 'puzzle', 'p', TODAY);
    item = review(item, gradeFor({ solved: true, hint: false, mistakes: 0 }), TODAY);
    item = review(item, gradeFor({ solved: true, hint: false, mistakes: 0 }), TODAY);
    expect(item.interval).toBe(3);
    const failed = review(item, gradeFor({ solved: false, hint: true, mistakes: 0 }), TODAY);
    expect(failed.interval).toBe(1);
    expect(failed.due).toBe('2026-03-11');
  });
});

describe('parseLineRef and findLineStep', () => {
  it('splits at the first slash', () => {
    expect(parseLineRef('italian-game/line-1')).toEqual({ course: 'italian-game', stepId: 'line-1' });
    expect(parseLineRef('c/a/b')).toEqual({ course: 'c', stepId: 'a/b' });
    expect(parseLineRef('nope')).toBeNull();
    expect(parseLineRef('/x')).toBeNull();
    expect(parseLineRef('x/')).toBeNull();
  });

  it('finds a line-drill step only', () => {
    const step = (id: string, type: string) => ({ id, type });
    const course = { chapterList: [{ lessons: [{ steps: [step('e1', 'explain'), step('d1', 'line-drill')] }] }] } as unknown as Course;
    expect(findLineStep(course, 'd1')?.id).toBe('d1');
    expect(findLineStep(course, 'e1')).toBeNull();
    expect(findLineStep(course, 'gone')).toBeNull();
  });
});

describe('createPuzzleLookup', () => {
  const index = {
    levels: [
      { id: 'beginner', min: 0, max: 1, buckets: [{ theme: 'mixed', count: 2, file: 'b/mixed.json' }, { theme: 'fork', count: 1, file: 'b/fork.json' }] },
      { id: 'master', min: 1, max: 2, buckets: [{ theme: 'mixed', count: 1, file: 'm/mixed.json' }] },
    ],
  } as unknown as PuzzleIndex;
  const files: Record<string, Puzzle[]> = {
    'b/mixed.json': [puzzle('a'), puzzle('b')],
    'b/fork.json': [puzzle('c')],
    'm/mixed.json': [puzzle('d')],
  };
  const loader = () => vi.fn((file: string) => (files[file] ? Promise.resolve(files[file]) : Promise.reject(new Error('offline'))));

  it('stops scanning once every id is found', async () => {
    const load = loader();
    const res = await createPuzzleLookup(index, load).resolve(['b']);
    expect([...res.found.keys()]).toEqual(['b']);
    expect(res.missing).toEqual([]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reuses what it learned and reports unknown ids as missing without rescanning', async () => {
    const load = loader();
    const lookup = createPuzzleLookup(index, load);
    expect((await lookup.resolve(['d'])).found.get('d')?.id).toBe('d');
    const calls = load.mock.calls.length;
    expect((await lookup.resolve(['a'])).found.get('a')?.id).toBe('a');
    expect(load.mock.calls.slice(calls)).toEqual([['b/mixed.json']]);
    const res = await lookup.resolve(['zzz']);
    expect(res.missing).toEqual(['zzz']);
    expect(res.failed).toBe(false);
    const after = load.mock.calls.length;
    await lookup.resolve(['zzz']);
    expect(load.mock.calls.length).toBe(after);
  });

  it('flags a failed chunk and does not remember absence', async () => {
    let offline = true;
    const load = vi.fn((file: string) => (offline && file === 'b/fork.json' ? Promise.reject(new Error('offline')) : Promise.resolve(files[file] ?? [])));
    const lookup = createPuzzleLookup(index, load);
    const first = await lookup.resolve(['c']);
    expect(first.failed).toBe(true);
    expect(first.missing).toEqual(['c']);
    offline = false;
    const second = await lookup.resolve(['c']);
    expect(second.failed).toBe(false);
    expect(second.found.get('c')?.id).toBe('c');
  });
});

describe('prepareReview', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const good: Puzzle = { id: 'good', fen: START, moves: ['e2e4', 'e7e5'], rating: 1000, themes: [], url: '' };
  const corrupt: Puzzle = { id: 'bad', fen: START, moves: ['e2e5', 'e7e5'], rating: 1000, themes: [], url: '' };
  const course = { slug: 'c', title: 'C', chapterList: [{ lessons: [{ steps: [{ id: 'd1', type: 'line-drill' }] }] }] } as unknown as Course;
  const puzzleItem = (ref: string): SrsItem => newItem(`puzzle:${ref}`, 'puzzle', ref, TODAY);
  const lineItem = (ref: string): SrsItem => newItem(`line:${ref}`, 'line', ref, TODAY);

  const deps = (over: Partial<PrepareDeps> = {}): PrepareDeps => ({
    resolvePuzzles: (ids) => {
      const found = new Map<string, Puzzle>();
      for (const p of [good, corrupt]) if (ids.includes(p.id)) found.set(p.id, p);
      return Promise.resolve({ found, missing: ids.filter((id) => !found.has(id)), failed: false });
    },
    loadCourse: () => Promise.resolve(course),
    ...over,
  });

  it('drops a line whose course answers 404 and keeps one that failed for another reason', async () => {
    const load = vi.fn((slug: string) =>
      Promise.reject(slug === 'gone' ? new DataError('notfound', slug, 'HTTP 404', 404) : new DataError('network', slug, 'HTTP 500', 500)),
    );
    const items = [lineItem('gone/d1'), lineItem('flaky/d1')];
    const res = await prepareReview(items, deps({ loadCourse: load }));
    expect(res.dropIds).toEqual(['line:gone/d1']);
    expect(res.skipped).toBe(1);
    expect(res.entries).toEqual([]);
  });

  it('skips lines on a plain network failure', async () => {
    const res = await prepareReview([lineItem('c/d1')], deps({ loadCourse: () => Promise.reject(new TypeError('offline')) }));
    expect(res.dropIds).toEqual([]);
    expect(res.skipped).toBe(1);
  });

  it('drops a line step the course no longer has', async () => {
    const res = await prepareReview([lineItem('c/removed')], deps());
    expect(res.dropIds).toEqual(['line:c/removed']);
  });

  it('still runs lines when the puzzle index cannot be loaded', async () => {
    const res = await prepareReview([puzzleItem('good'), lineItem('c/d1')], deps({ resolvePuzzles: () => Promise.reject(new DataError('network', 'index', 'offline')) }));
    expect(res.entries.map((e) => e.kind)).toEqual(['line']);
    expect(res.skipped).toBe(1);
    expect(res.dropIds).toEqual([]);
  });

  it('skips puzzles whose chunk failed but drops unknown ones', async () => {
    const resolvePuzzles: PrepareDeps['resolvePuzzles'] = () => Promise.resolve({ found: new Map(), missing: ['a', 'b'], failed: true });
    const failed = await prepareReview([puzzleItem('a')], deps({ resolvePuzzles }));
    expect(failed.skipped).toBe(1);
    const unknown = await prepareReview([puzzleItem('zzz')], deps());
    expect(unknown.dropIds).toEqual(['puzzle:zzz']);
  });

  it('drops puzzles that start() rejects and runs the rest', async () => {
    const res = await prepareReview([puzzleItem('bad'), puzzleItem('good')], deps());
    expect(res.dropIds).toEqual(['puzzle:bad']);
    expect(res.entries.map((e) => e.item.ref)).toEqual(['good']);
  });
});
