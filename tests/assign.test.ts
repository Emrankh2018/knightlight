import { describe, expect, it } from 'vitest';
import { assignPath, assignUrl, findPuzzleSet, parseAssign, targetPath } from '../src/lib/assign';
import type { PuzzleLevel } from '../src/lib/puzzle-types';

const parse = (q: string) => parseAssign(new URLSearchParams(q));

const levels: PuzzleLevel[] = [
  { id: 'beginner', min: 0, max: 1000, buckets: [{ theme: 'fork', count: 5, file: 'beginner/fork.json' }, { theme: 'pin', count: 0, file: 'beginner/pin.json' }] },
];

describe('parseAssign', () => {
  it('parses a puzzles link', () => {
    expect(parse('type=puzzles&level=beginner&theme=fork')).toEqual({ ok: true, assignment: { type: 'puzzles', level: 'beginner', theme: 'fork' } });
  });

  it('defaults the theme to mixed', () => {
    expect(parse('type=puzzles&level=mid-advanced')).toEqual({ ok: true, assignment: { type: 'puzzles', level: 'mid-advanced', theme: 'mixed' } });
  });

  it('parses a lesson link', () => {
    expect(parse('type=lesson&id=tactics-basics/knight-fork')).toEqual({ ok: true, assignment: { type: 'lesson', course: 'tactics-basics', lesson: 'knight-fork' } });
  });

  it('reports what is wrong', () => {
    expect(parse('')).toEqual({ ok: false, reason: 'missing' });
    expect(parse('type=video')).toEqual({ ok: false, reason: 'type' });
    expect(parse('type=puzzles')).toEqual({ ok: false, reason: 'level' });
    expect(parse('type=puzzles&level=beginner&theme=')).toEqual({ ok: false, reason: 'theme' });
    expect(parse('type=lesson')).toEqual({ ok: false, reason: 'lesson' });
  });

  it('rejects ids that could escape a path or inject markup', () => {
    for (const bad of ['../x/y', 'a/b/c', '/a', 'a/', 'a//b', 'A/b', '<script>/x', 'a/b c', 'a/..', 'a%2Fb']) {
      expect(parse(`type=lesson&id=${encodeURIComponent(bad)}`)).toEqual({ ok: false, reason: 'lesson' });
    }
    expect(parse('type=puzzles&level=%3Cb%3E')).toEqual({ ok: false, reason: 'level' });
    expect(parse('type=puzzles&level=beginner&theme=a%2Fb')).toEqual({ ok: false, reason: 'theme' });
    expect(parse(`type=puzzles&level=${'a'.repeat(41)}`)).toEqual({ ok: false, reason: 'level' });
  });
});

describe('findPuzzleSet', () => {
  it('finds an existing non-empty set', () => {
    expect(findPuzzleSet(levels, 'beginner', 'fork')?.bucket.file).toBe('beginner/fork.json');
  });

  it('returns null for unknown or empty sets', () => {
    expect(findPuzzleSet(levels, 'beginner', 'skewer')).toBeNull();
    expect(findPuzzleSet(levels, 'beginner', 'pin')).toBeNull();
    expect(findPuzzleSet(levels, 'master', 'fork')).toBeNull();
    expect(findPuzzleSet(levels, '__proto__', 'fork')).toBeNull();
  });
});

describe('links', () => {
  it('round-trips through parseAssign', () => {
    for (const a of [
      { type: 'puzzles', level: 'beginner', theme: 'fork' },
      { type: 'lesson', course: 'tactics-basics', lesson: 'knight-fork' },
    ] as const) {
      const query = assignPath(a).split('?')[1] ?? '';
      expect(parse(query)).toEqual({ ok: true, assignment: a });
    }
  });

  it('builds the trainer paths', () => {
    expect(targetPath({ type: 'puzzles', level: 'beginner', theme: 'fork' })).toBe('/puzzles?level=beginner&theme=fork');
    expect(targetPath({ type: 'lesson', course: 'tactics-basics', lesson: 'knight-fork' })).toBe('/learn/tactics-basics/knight-fork');
  });

  it('builds a full URL and drops an existing hash', () => {
    const a = { type: 'lesson', course: 'c', lesson: 'l' } as const;
    expect(assignUrl(a, 'http://localhost:5173/knightlight/#/students')).toBe('http://localhost:5173/knightlight/#/assign?type=lesson&id=c%2Fl');
  });
});
