import { LEVEL_IDS, type BotLevelId } from './level-ids.ts';
import { findBestMove } from './search.ts';

export { LEVEL_IDS, type BotLevelId };

export interface BotLevel {
  id: BotLevelId;
  /** 1..5 */
  level: number;
  depth: number;
  timeMs: number;
  /** 0..1, scaled to a centipawn window of randomness * 100. */
  randomness: number;
  blunderChance: number;
  /** When clearly winning, avoid moves that repeat an earlier position. */
  avoidRepeats: boolean;
}

export const LEVELS: Record<BotLevelId, BotLevel> = {
  pawn: { id: 'pawn', level: 1, depth: 1, timeMs: 500, randomness: 0.5, blunderChance: 0.35, avoidRepeats: false },
  knight: { id: 'knight', level: 2, depth: 2, timeMs: 800, randomness: 0.8, blunderChance: 0.15, avoidRepeats: false },
  bishop: { id: 'bishop', level: 3, depth: 3, timeMs: 1200, randomness: 0.3, blunderChance: 0.05, avoidRepeats: true },
  rook: { id: 'rook', level: 4, depth: 4, timeMs: 2000, randomness: 0.1, blunderChance: 0, avoidRepeats: true },
  queen: { id: 'queen', level: 5, depth: 5, timeMs: 2500, randomness: 0, blunderChance: 0, avoidRepeats: true },
};

export interface BotMove {
  uci: string;
  san: string;
}

/**
 * Picks a move for `fen` at the given level. Returns null if the side to move has
 * no legal move (checkmate or stalemate). `history` holds the position keys already seen in the game.
 */
export function chooseMove(fen: string, level: BotLevelId, rng: () => number = Math.random, history: readonly string[] = []): BotMove | null {
  const cfg = LEVELS[level] as BotLevel | undefined;
  if (!cfg) throw new Error(`Unknown bot level: ${String(level)}`);
  const result = findBestMove(fen, {
    depth: cfg.depth,
    timeMs: cfg.timeMs,
    randomness: cfg.randomness,
    blunderChance: cfg.blunderChance,
    rng,
    avoidRepeats: cfg.avoidRepeats,
    history,
  });
  return result === null ? null : { uci: result.uci, san: result.san };
}
