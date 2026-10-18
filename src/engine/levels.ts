import { findBestMove } from './search.ts';

/** Kid-friendly level ids, weakest to strongest. Display names live in the UI/i18n layer. */
export const LEVEL_IDS = ['pawn', 'knight', 'bishop', 'rook', 'queen'] as const;
export type BotLevelId = (typeof LEVEL_IDS)[number];

export interface BotLevel {
  id: BotLevelId;
  /** 1..5 */
  level: number;
  depth: number;
  timeMs: number;
  /** 0..1, scaled to a centipawn window of randomness * 100. */
  randomness: number;
  blunderChance: number;
}

export const LEVELS: Record<BotLevelId, BotLevel> = {
  pawn: { id: 'pawn', level: 1, depth: 1, timeMs: 500, randomness: 0.5, blunderChance: 0.35 },
  knight: { id: 'knight', level: 2, depth: 2, timeMs: 800, randomness: 0.8, blunderChance: 0.15 },
  bishop: { id: 'bishop', level: 3, depth: 3, timeMs: 1200, randomness: 0.3, blunderChance: 0.05 },
  rook: { id: 'rook', level: 4, depth: 4, timeMs: 2000, randomness: 0.1, blunderChance: 0 },
  queen: { id: 'queen', level: 5, depth: 5, timeMs: 2500, randomness: 0, blunderChance: 0 },
};

export interface BotMove {
  uci: string;
  san: string;
}

/**
 * Picks a move for `fen` at the given level. Returns null if the side to move has
 * no legal move (checkmate or stalemate).
 */
export function chooseMove(fen: string, level: BotLevelId, rng: () => number = Math.random): BotMove | null {
  const cfg = LEVELS[level];
  const result = findBestMove(fen, {
    depth: cfg.depth,
    timeMs: cfg.timeMs,
    randomness: cfg.randomness,
    blunderChance: cfg.blunderChance,
    rng,
  });
  return result === null ? null : { uci: result.uci, san: result.san };
}
