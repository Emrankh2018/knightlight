/**
 * Puzzle data shipped under public/data/puzzles/ (built from the Lichess
 * puzzle database, CC0, by scripts/build-puzzles.ts).
 *
 * Semantics:
 * - `fen` is the position BEFORE the opponent's move.
 * - `moves[0]` is the opponent's move and is auto-played.
 * - The solver then plays `moves[1]`, `moves[3]`, ...; the opponent's replies
 *   are `moves[2]`, `moves[4]`, ... (so `moves.length` is always even).
 * - Moves are UCI (e.g. "e2e4", "e7e8q").
 */
export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  /** Lichess GameUrl of the source game. */
  url: string;
}

export interface PuzzleBucket {
  /** A main theme, or "mixed". */
  theme: string;
  count: number;
  /** Path relative to the puzzles directory, e.g. "beginner/fork.json". */
  file: string;
}

export interface PuzzleLevel {
  id: string;
  /** Inclusive rating range. */
  min: number;
  max: number;
  buckets: PuzzleBucket[];
}

export interface PuzzleIndex {
  version: 1;
  source: string;
  /** ISO date (YYYY-MM-DD). */
  generated: string;
  filters: {
    minPopularity: number;
    minNbPlays: number;
    maxRatingDeviation: number;
    perThemeLevel: number;
    perMixedLevel: number;
    seed: number;
  };
  levels: PuzzleLevel[];
}
