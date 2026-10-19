import { Chess, type Square } from 'chess.js';
import type { Side } from '../content/types.ts';

/** Lower-cases a UCI string and keeps at most one promotion letter. */
export function normalizeUci(uci: string): string {
  return uci.trim().toLowerCase().slice(0, 5);
}

export interface PlayedMove {
  uci: string;
  san: string;
  /** FEN after the move. */
  fen: string;
  checkmate: boolean;
}

/** Plays a UCI move on `fen`. Returns null when the move is illegal or the FEN is invalid. */
export function playUci(fen: string, uci: string): PlayedMove | null {
  const u = normalizeUci(uci);
  if (u.length < 4) return null;
  try {
    const chess = new Chess(fen);
    const promotion = u.length === 5 ? u.slice(4) : undefined;
    const mv = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion });
    return { uci: u, san: mv.san, fen: chess.fen(), checkmate: chess.isCheckmate() };
  } catch {
    return null;
  }
}

/** The side to move in a FEN. */
export function turnOf(fen: string): Side {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

export function otherSide(side: Side): Side {
  return side === 'white' ? 'black' : 'white';
}

/** The piece letter (p, n, b, r, q, k) standing on the from-square of `uci` in `fen`, or null. */
export function pieceOnFrom(fen: string, uci: string): string | null {
  try {
    return new Chess(fen).get(normalizeUci(uci).slice(0, 2) as Square)?.type ?? null;
  } catch {
    return null;
  }
}
