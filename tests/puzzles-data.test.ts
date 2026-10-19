import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Puzzle, PuzzleIndex } from '../src/lib/puzzle-types';

const dir = 'public/data/puzzles';
const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8')) as PuzzleIndex;
const MAIN_THEMES = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'fork',
  'pin',
  'skewer',
  'hangingPiece',
  'discoveredAttack',
  'deflection',
  'attraction',
  'backRankMate',
  'endgame',
  'sacrifice',
  'trappedPiece',
];
const MATE_THEMES =['mateIn1', 'mateIn2', 'mateIn3', 'mate'];

function readBucket(file: string): Puzzle[] {
  return JSON.parse(readFileSync(join(dir, file), 'utf8')) as Puzzle[];
}

function filesUnder(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(root, e.name)) : [join(root, e.name)],
  );
}

describe('puzzle index', () => {
  it('has the expected header and levels', () => {
    expect(index.version).toBe(1);
    expect(index.source).toContain('CC0');
    expect(index.generated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(index.levels.map((l) => l.id)).toEqual(['beginner', 'intermediate', 'mid-advanced', 'advanced', 'master']);
    for (const level of index.levels) expect(level.buckets.length).toBeGreaterThan(0);
  });

  it('uses the kid-friendly rating bands', () => {
    expect(index.levels.map((l) => [l.min, l.max])).toEqual([
      [0, 699],
      [700, 1199],
      [1200, 1599],
      [1600, 1999],
      [2000, 4000],
    ]);
  });

  it('gives every beginner theme at least 40 puzzles', () => {
    const beginner = index.levels.find((l) => l.id === 'beginner');
    expect(beginner?.buckets.length).toBeGreaterThanOrEqual(15);
    for (const b of beginner?.buckets ?? []) expect(b.count, b.file).toBeGreaterThanOrEqual(40);
  });

  it.each(index.levels.map((l) => l.id))('%s mixed bucket is varied and large enough', (id) => {
    const bucket = index.levels.find((l) => l.id === id)?.buckets.find((b) => b.theme === 'mixed');
    expect(bucket, `${id} has a mixed bucket`).toBeDefined();
    const puzzles = readBucket(`${id}/mixed.json`);
    expect(puzzles.length).toBeGreaterThanOrEqual(250);
    for (const theme of MAIN_THEMES) {
      const share = puzzles.filter((p) => p.themes.includes(theme)).length / puzzles.length;
      expect(share, `${id} mixed: ${theme}`).toBeLessThanOrEqual(0.4);
    }
  });

  it('records the effective beginner filters', () => {
    expect(index.filters.beginner.minPopularity).toBeLessThan(index.filters.minPopularity);
    expect(index.filters.beginner.minNbPlays).toBeLessThan(index.filters.minNbPlays);
    expect(index.filters.beginner.maxRatingDeviation).toBeGreaterThan(index.filters.maxRatingDeviation);
  });

  it('total shipped size is under 25 MB', () => {
    const total = filesUnder(dir).reduce((sum, f) => sum + statSync(f).size, 0);
    expect(total).toBeLessThan(25 * 1024 * 1024);
  });
});

describe.each(index.levels.map((l) => [l.id, l] as const))('level %s', (_id, level) => {
  it.each(level.buckets.map((b) => [b.file, b] as const))('%s is consistent and every puzzle is valid', (_file, bucket) => {
    const puzzles = readBucket(bucket.file);
    expect(puzzles.length).toBe(bucket.count);
    expect(puzzles.length).toBeGreaterThan(0);

    let previousRating = -Infinity;
    const ids = new Set<string>();
    for (const p of puzzles) {
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);

      expect(p.rating).toBeGreaterThanOrEqual(level.min);
      expect(p.rating).toBeLessThanOrEqual(level.max);
      expect(p.rating).toBeGreaterThanOrEqual(previousRating);
      previousRating = p.rating;

      expect(p.moves.length).toBeGreaterThanOrEqual(2);
      expect(p.moves.length % 2).toBe(0);

      const chess = new Chess(p.fen);
      for (const uci of p.moves) {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
      }
      if (p.themes.some((t) => MATE_THEMES.includes(t))) {
        expect(chess.isCheckmate(), `puzzle ${p.id} should end in checkmate`).toBe(true);
      }
      if (bucket.theme !== 'mixed') expect(p.themes).toContain(bucket.theme);
    }
  });
});
