import { DataError, type DataErrorKind } from './data-error.ts';
import type { Course, CourseMeta } from './content/types.ts';
import { loadOpeningIndex, type OpeningIndex } from './openings.ts';
import type { Puzzle, PuzzleIndex } from './puzzle-types.ts';

export { DataError, type DataErrorKind };

export interface CatalogCounts {
  chapters: number;
  lessons: number;
  steps: number;
}

export type CatalogEntry = CourseMeta & { counts: CatalogCounts };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function dataUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  return `${base}/data/${path}`;
}

const cache = new Map<string, Promise<unknown>>();

function cached<T>(url: string, check: (json: unknown) => string | null): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit as Promise<T>;
  const load = async (): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err: unknown) {
      throw new DataError('network', url, err instanceof Error ? err.message : 'request failed');
    }
    if (!res.ok) throw new DataError(res.status === 404 ? 'notfound' : 'network', url, `HTTP ${res.status}`, res.status);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new DataError('shape', url, 'not valid JSON');
    }
    const problem = check(json);
    if (problem !== null) throw new DataError('shape', url, problem);
    return json as T;
  };
  const promise = load().catch((err: unknown) => {
    cache.delete(url);
    throw err;
  });
  cache.set(url, promise);
  return promise;
}

function checkCatalog(json: unknown): string | null {
  if (!Array.isArray(json)) return 'expected an array';
  for (const e of json as unknown[]) {
    if (!isRecord(e) || typeof e.slug !== 'string' || typeof e.title !== 'string' || !Array.isArray(e.chapters) || !isRecord(e.counts)) {
      return 'bad catalog entry';
    }
  }
  return null;
}

export function loadCatalog(): Promise<CatalogEntry[]> {
  return cached<CatalogEntry[]>(dataUrl('courses/index.json'), checkCatalog);
}

export function loadCourse(slug: string): Promise<Course> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return Promise.reject(new DataError('shape', slug, 'invalid course slug'));
  }
  return cached<Course>(dataUrl(`courses/${slug}.json`), (json) => {
    if (!isRecord(json) || json.slug !== slug || typeof json.title !== 'string' || !Array.isArray(json.chapterList)) {
      return 'not a course';
    }
    return null;
  });
}

export function loadPuzzleIndex(): Promise<PuzzleIndex> {
  return cached<PuzzleIndex>(dataUrl('puzzles/index.json'), (json) => {
    if (!isRecord(json) || json.version !== 1 || !Array.isArray(json.levels)) return 'not a puzzle index';
    return null;
  });
}

/** `file` is a bucket path relative to the puzzles directory, e.g. "beginner/fork.json". */
export function loadPuzzleChunk(file: string): Promise<Puzzle[]> {
  if (file.includes('..') || file.startsWith('/')) {
    return Promise.reject(new DataError('shape', file, 'invalid puzzle file path'));
  }
  return cached<Puzzle[]>(dataUrl(`puzzles/${file}`), (json) => {
    if (!Array.isArray(json)) return 'expected an array';
    for (const p of json as unknown[]) {
      if (!isRecord(p) || typeof p.id !== 'string' || typeof p.fen !== 'string' || !Array.isArray(p.moves)) {
        return 'bad puzzle entry';
      }
    }
    return null;
  });
}

export function getOpeningIndex(): Promise<OpeningIndex> {
  return loadOpeningIndex(dataUrl('openings'));
}
