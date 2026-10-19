import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import type { PuzzleIndex } from '../src/lib/puzzle-types';
import { TACTIC_THEMES } from '../src/lib/tactics';

const index = JSON.parse(readFileSync('public/data/puzzles/index.json', 'utf8')) as PuzzleIndex;

describe('tactics hub themes', () => {
  it('has no duplicate themes', () => {
    expect(new Set(TACTIC_THEMES).size).toBe(TACTIC_THEMES.length);
  });

  it('every card theme exists in the puzzle index', () => {
    const themes = new Set(index.levels.flatMap((l) => l.buckets.map((b) => b.theme)));
    for (const t of TACTIC_THEMES) expect(themes.has(t), t).toBe(true);
  });

  it('every card theme has beginner puzzles or is handled by the empty state', () => {
    const beginner = index.levels.find((l) => l.id === 'beginner');
    expect(beginner).toBeDefined();
    for (const t of TACTIC_THEMES) {
      expect(beginner?.buckets.some((b) => b.theme === t), t).toBe(true);
    }
  });

  it('every card has a name and explanation', () => {
    for (const t of TACTIC_THEMES) {
      expect(en.tactics.cards[t].name.length).toBeGreaterThan(0);
      expect(en.tactics.cards[t].blurb.length).toBeGreaterThan(0);
    }
  });
});
