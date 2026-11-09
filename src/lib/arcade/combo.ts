import { Chess, type Color, type Move, type Square } from 'chess.js';

const START_FEN = 'r1b2n2/p1p1p1p1/8/8/8/8/P1P1P1P1/R1B2N2 w - - 0 1';
export const COMBO_TARGET = 5;
const MAX_CHAIN = 3;
const QUIET_MOVE_LIMIT = 60;
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface ComboGame {
  fen: string;
  captures: Readonly<Record<Color, number>>;
  chain: { from: Square; count: number } | null;
  outcome: Color | 'draw' | null;
  lastMove?: Pick<Move, 'from' | 'to' | 'san'>;
}

export function startComboGame(): ComboGame {
  return { fen: START_FEN, captures: { w: 0, b: 0 }, chain: null, outcome: null };
}

export function comboTurn(game: ComboGame): Color {
  return game.fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

function chessAt(fen: string): Chess {
  // These in-app positions intentionally have no kings.
  return new Chess(fen, { skipValidation: true });
}

function withTurn(fen: string, turn: Color): string {
  const fields = fen.split(' ');
  fields[1] = turn;
  fields[3] = '-';
  return fields.join(' ');
}

export function allowsComboMove(game: ComboGame, move: Move): boolean {
  return game.outcome === null && (!game.chain || (game.chain.from === move.from && move.captured !== undefined));
}

function availableMoves(game: ComboGame): Move[] {
  if (game.outcome) return [];
  const chess = chessAt(game.fen);
  const moves = game.chain ? chess.moves({ square: game.chain.from, verbose: true }) : chess.moves({ verbose: true });
  return moves.filter((move) => allowsComboMove(game, move) && (!move.promotion || move.promotion === 'q'));
}

function nextTurn(game: ComboGame, fen: string): ComboGame {
  const draw = Number(fen.split(' ')[4]) >= QUIET_MOVE_LIMIT || chessAt(fen).moves().length === 0;
  return { ...game, fen, chain: null, outcome: draw ? 'draw' : null };
}

function applyMove(game: ComboGame, move: Move): ComboGame {
  const { color, from, to, san, after } = move;
  const next = { ...game, lastMove: { from, to, san } };
  if (!move.captured) return nextTurn(next, after);

  const count = game.captures[color] + 1;
  const captures = { ...game.captures, [color]: count };
  if (count === COMBO_TARGET) return { ...next, fen: after, captures, chain: null, outcome: color };

  const chainCount = (game.chain?.count ?? 0) + 1;
  if (chainCount < MAX_CHAIN) {
    const fen = withTurn(after, color);
    const canContinue = chessAt(fen).moves({ square: to, verbose: true }).some((reply) => reply.captured !== undefined);
    if (canContinue) return { ...next, fen, captures, chain: { from: to, count: chainCount } };
  }
  return nextTurn({ ...next, captures }, after);
}

export function playComboMove(game: ComboGame, from: string, to: string): ComboGame | null {
  const move = availableMoves(game).find((candidate) => candidate.from === from && candidate.to === to);
  return move ? applyMove(game, move) : null;
}

export function endComboTurn(game: ComboGame): ComboGame {
  if (!game.chain || game.outcome) return game;
  return nextTurn(game, withTurn(game.fen, comboTurn(game) === 'w' ? 'b' : 'w'));
}

export function computerComboMove(game: ComboGame, rng: () => number = Math.random): ComboGame {
  const moves = availableMoves(game);
  let best = game;
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyMove(game, move);
    if (next.outcome === move.color) return next;
    const capture = move.captured ? 8 + PIECE_VALUE[move.captured] : 0;
    const reply = next.chain ? [] : availableMoves(next);
    const danger = reply.reduce((most, candidate) => candidate.captured ? Math.max(most, PIECE_VALUE[candidate.captured]) : most, 0);
    const center = 7 - Math.abs(move.to.charCodeAt(0) - 100.5) - Math.abs(Number(move.to[1]) - 4.5);
    const score = capture + (next.chain ? 3 : 0) + (move.promotion ? 5 : 0) - danger + center * 0.25 + rng() * 2;
    if (score > bestScore) {
      best = next;
      bestScore = score;
    }
  }
  return best;
}
