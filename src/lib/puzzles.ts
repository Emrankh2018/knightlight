/** Pure puzzle solve-state machine (see puzzle-types.ts for the move semantics). */
import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { Puzzle } from './puzzle-types.ts';

export type Colour = 'white' | 'black';

export interface PuzzleState {
  puzzle: Puzzle;
  /** Current position. */
  fen: string;
  /** Index into puzzle.moves of the move the solver must play next. */
  index: number;
  solver: Colour;
  /** Board orientation: the solver's side at the bottom. */
  orientation: Colour;
  /** The most recent move played on the board (for highlighting). */
  lastMove?: { from: string; to: string; san: string };
}

export type TryResult =
  | { kind: 'wrong' }
  | { kind: 'continue'; state: PuzzleState; reply: string }
  | { kind: 'solved'; state: PuzzleState };

export interface PlayedMove {
  fen: string;
  from: string;
  to: string;
  san: string;
  checkmate: boolean;
}

/** Plays a UCI move on `fen`. Returns null when it is illegal. */
export function playUci(fen: string, uci: string): PlayedMove | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  const game = new Chess(fen);
  let mv: Move;
  try {
    mv = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length === 5 ? { promotion: uci.slice(4) as PieceSymbol } : {}) });
  } catch {
    return null;
  }
  return { fen: game.fen(), from: mv.from, to: mv.to, san: mv.san, checkmate: game.isCheckmate() };
}

/** Auto-plays moves[0] and returns the position the solver faces. */
export function start(puzzle: Puzzle): PuzzleState {
  if (puzzle.moves.length < 2 || puzzle.moves.length % 2 !== 0) throw new Error(`Puzzle ${puzzle.id} has an invalid move list`);
  const first = puzzle.moves[0];
  const played = first === undefined ? null : playUci(puzzle.fen, first);
  if (!played) throw new Error(`Puzzle ${puzzle.id} has an illegal first move`);
  const solver: Colour = new Chess(played.fen).turn() === 'w' ? 'white' : 'black';
  return {
    puzzle,
    fen: played.fen,
    index: 1,
    solver,
    orientation: solver,
    lastMove: { from: played.from, to: played.to, san: played.san },
  };
}

/**
 * Checks a solver move (UCI; a missing promotion piece means a queen).
 * The stored move is always accepted; a checkmating move is accepted at any solver move and ends the puzzle.
 */
export function tryMove(state: PuzzleState, uci: string): TryResult {
  const moves = state.puzzle.moves;
  const expected = moves[state.index];
  if (expected === undefined) return { kind: 'wrong' };
  const played = playUci(state.fen, uci);
  if (!played) return { kind: 'wrong' };
  const isFinal = state.index >= moves.length - 1;
  const matchesStored = uci.slice(0, 4) === expected.slice(0, 4) && (uci.slice(4) || 'q') === (expected.slice(4) || 'q');
  const matchesPlain = uci === expected;
  if (!matchesStored && !matchesPlain && !played.checkmate) return { kind: 'wrong' };
  const after: PuzzleState = { ...state, fen: played.fen, lastMove: { from: played.from, to: played.to, san: played.san } };
  if (isFinal || played.checkmate) return { kind: 'solved', state: { ...after, index: moves.length } };
  const replyUci = moves[state.index + 1];
  const reply = replyUci === undefined ? null : playUci(played.fen, replyUci);
  if (!reply) return { kind: 'wrong' };
  return {
    kind: 'continue',
    reply: replyUci as string,
    state: { ...after, fen: reply.fen, index: state.index + 2, lastMove: { from: reply.from, to: reply.to, san: reply.san } },
  };
}

export interface Hint {
  level: 1 | 2 | 3;
  /** Square of the piece to move (all levels). */
  from: string;
  /** Target square (levels 2 and 3). */
  to?: string;
  /** Piece type to move, for the text hint. */
  piece: PieceSymbol;
}

/** Hint ladder: 1 = which piece, 2 = plus its target square, 3 = the whole move. */
export function hint(state: PuzzleState, level: 1 | 2 | 3): Hint | null {
  const uci = state.puzzle.moves[state.index];
  if (uci === undefined) return null;
  const from = uci.slice(0, 2);
  const piece = new Chess(state.fen).get(from as Move['from']);
  if (!piece) return null;
  return level === 1 ? { level, from, piece: piece.type } : { level, from, to: uci.slice(2, 4), piece: piece.type };
}

/** The remaining moves (solver and opponent) from the current state, in order. */
export function remainingMoves(state: PuzzleState): string[] {
  return state.puzzle.moves.slice(state.index);
}

/** Seeded Fisher-Yates shuffle (mulberry32); same seed, same order. Does not mutate the input. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let a = seed >>> 0;
  const rand = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
