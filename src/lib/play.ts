import { Chess } from 'chess.js';
import { positionKey } from '../engine/position-key.ts';
import { XP_RULES, type GameResult } from './xp.ts';

export type Color = 'w' | 'b';
export type ColorChoice = Color | 'random';

/** One played half-move. */
export interface PlayedMove {
  from: string;
  to: string;
  promotion?: string;
  san: string;
}

export type EndReason = 'checkmate' | 'stalemate' | 'insufficient' | 'threefold' | 'fiftyMoves' | 'resign' | 'time';

export interface GameOver {
  reason: EndReason;
  /** Winning side, or null for a draw. */
  winner: Color | null;
}

export const MAX_HINTS = 3;

export function resolveColor(choice: ColorChoice, rng: () => number = Math.random): Color {
  return choice === 'random' ? (rng() < 0.5 ? 'w' : 'b') : choice;
}

/** Replays `moves` from the start position. Throws if a move is illegal. */
export function replay(moves: readonly PlayedMove[]): Chess {
  const chess = new Chess();
  for (const mv of moves) chess.move({ from: mv.from, to: mv.to, ...(mv.promotion ? { promotion: mv.promotion } : {}) });
  return chess;
}

/** Position keys of the start position and after every move: what the bot needs to avoid repeating. */
export function positionKeys(moves: readonly PlayedMove[]): string[] {
  const chess = new Chess();
  const keys = [positionKey(chess.fen())];
  for (const mv of moves) {
    chess.move({ from: mv.from, to: mv.to, ...(mv.promotion ? { promotion: mv.promotion } : {}) });
    keys.push(positionKey(chess.fen()));
  }
  return keys;
}

/** Why the game is over on the board itself, or null while it continues. */
export function boardResult(chess: Chess): GameOver | null {
  if (chess.isCheckmate()) return { reason: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' };
  if (chess.isStalemate()) return { reason: 'stalemate', winner: null };
  if (chess.isInsufficientMaterial()) return { reason: 'insufficient', winner: null };
  if (chess.isThreefoldRepetition()) return { reason: 'threefold', winner: null };
  if (chess.isDrawByFiftyMoves()) return { reason: 'fiftyMoves', winner: null };
  return null;
}

/** How many half-moves Undo takes back: the player's last move and the bot's reply to it. 0 when nothing can be taken back. */
export function undoCount(moves: readonly PlayedMove[], player: Color): number {
  if (moves.length === 0) return 0;
  const lastIsPlayers = (moves.length % 2 === 1) === (player === 'w');
  if (lastIsPlayers) return 1;
  return moves.length >= 2 ? 2 : 0;
}

export function resultFor(over: GameOver, player: Color): GameResult {
  return over.winner === null ? 'draw' : over.winner === player ? 'win' : 'loss';
}

/** A game that ends off the board by the clock must have had this many player moves to be worth XP. Resigning is never worth XP, so neither can be farmed. */
export const MIN_PLAYER_MOVES_FOR_XP = 10;

export function playerMoveCount(moves: readonly PlayedMove[], player: Color): number {
  return Math.floor((moves.length + (player === 'w' ? 1 : 0)) / 2);
}

export interface GameCredit {
  /** What to record on the profile, or null when the game earns nothing. */
  record: GameResult | null;
  xp: number;
  /** A win that does not count as one because Undo or hints were used. */
  assistedWin: boolean;
}

/** XP and record for a finished game. Resigning earns nothing; a clock loss earns XP only after enough moves; a win helped by Undo or hints is recorded as a draw. */
export function creditFor(over: GameOver, player: Color, moves: readonly PlayedMove[], assisted: boolean): GameCredit {
  if (over.reason === 'resign') return { record: null, xp: 0, assistedWin: false };
  if (over.reason === 'time' && playerMoveCount(moves, player) < MIN_PLAYER_MOVES_FOR_XP) return { record: null, xp: 0, assistedWin: false };
  const result = resultFor(over, player);
  const assistedWin = assisted && result === 'win';
  const record: GameResult = assistedWin ? 'draw' : result;
  return { record, xp: XP_RULES.game[record], assistedWin };
}

/** `moves` plus the move from-to (with optional promotion), or null if it is not legal there. */
export function playOn(moves: readonly PlayedMove[], from: string, to: string, promotion?: string): PlayedMove[] | null {
  try {
    const chess = replay(moves);
    const made = chess.move({ from, to, ...(promotion ? { promotion } : {}) });
    return [...moves, { from: made.from, to: made.to, san: made.san, ...(made.promotion ? { promotion: made.promotion } : {}) }];
  } catch {
    return null;
  }
}

/** Splits a UCI move such as e7e8q. */
export function splitUci(uci: string): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci.slice(4, 5) } : {}) };
}
