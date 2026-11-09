import { Chess, SQUARES, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

const BOSS_START = '3q4/8/8/8/3R4/2N2N2/1P2PP2/7R w - - 0 1';
const BOSS_MOVE_LIMIT = 40;
const BLACK_HOME = SQUARES.filter((square) => square.charAt(1) >= '5');
const GUARD_HOME = BLACK_HOME.filter((square) => square.charAt(1) !== '8');
const QUEEN_SPAWNS: readonly Square[] = ['d8', 'a7', 'h7', ...BLACK_HOME];
const BOSS_CAPTURE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 8, k: 0 };

export interface BossState {
  fen: string;
  turn: Color;
  queen: Square;
  lives: number;
  event: 'returned' | 'guarded' | null;
  result: 'team' | 'boss' | 'draw' | null;
  lastMove?: Move;
  visits: Readonly<Record<string, number>>;
}

function positionKey(fen: string, queen: Square, lives: number): string {
  return `${fen.split(' ').slice(0, 4).join(' ')} ${queen} ${lives}`;
}

function place(chess: Chess, type: 'q' | 'p', candidates: readonly Square[]): Square {
  // The team starts with seven pieces. Its pawns may promote but it cannot fill the home half.
  const square = candidates.find((candidate) => !chess.get(candidate));
  if (!square || !chess.put({ color: 'b', type }, square)) throw new Error('No open boss spawn square');
  return square;
}

export function startBoss(): BossState {
  const queen = 'd8';
  const lives = 3;
  return {
    fen: BOSS_START,
    turn: 'w',
    queen,
    lives,
    event: null,
    result: null,
    visits: { [positionKey(BOSS_START, queen, lives)]: 1 },
  };
}

export function playBossMove(state: BossState, from: string, to: string): BossState | null {
  if (state.result) return null;
  const chess = new Chess(state.fen, { skipValidation: true });
  let move: Move;
  try {
    move = chess.move({ from, to, promotion: 'q' });
  } catch {
    return null;
  }

  let { queen, lives } = state;
  let event = state.turn === 'b' ? state.event : null;
  if (move.color === 'w' && move.to === queen && move.captured === 'q') {
    lives -= 1;
    if (lives > 0) {
      queen = place(chess, 'q', QUEEN_SPAWNS);
      event = 'returned';
      if (lives === 1) {
        place(chess, 'p', ['c7', ...GUARD_HOME]);
        place(chess, 'p', ['f7', ...GUARD_HOME]);
        event = 'guarded';
      }
    }
  } else if (move.color === 'b' && move.from === queen) {
    queen = move.to;
  }

  const fen = chess.fen();
  const key = positionKey(fen, queen, lives);
  const count = (state.visits[key] ?? 0) + 1;
  let result: BossState['result'] = null;
  if (lives === 0) result = 'team';
  else if (move.color === 'b' && move.captured && !chess.board().some((row) => row.some((piece) => piece?.color === 'w'))) result = 'boss';
  else if (count >= 3 || chess.moveNumber() > BOSS_MOVE_LIMIT || chess.moves().length === 0) result = 'draw';

  return { fen, turn: chess.turn(), queen, lives, event, result, lastMove: move, visits: { ...state.visits, [key]: count } };
}

/** A classroom-strength boss values captures and safety with a little variety in its choices. */
export function chooseBossMove(state: BossState, rng = Math.random): Move | null {
  if (state.result || state.turn !== 'b') return null;
  const chess = new Chess(state.fen, { skipValidation: true });
  const team = chess.board().flat().flatMap((piece) => piece?.color === 'w' ? [piece.square] : []);
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const move of chess.moves({ verbose: true })) {
    if (move.promotion && move.promotion !== 'q') continue;
    chess.move(move);
    const queen = move.from === state.queen ? move.to : state.queen;
    const key = positionKey(chess.fen(), queen, state.lives);
    const capture = move.captured ? 1 + BOSS_CAPTURE_VALUE[move.captured] / 2 : 0;
    const threats = team.filter((square) => square !== move.to && chess.attackers(square, 'b').includes(queen)).length;
    const risk = chess.isAttacked(queen, 'w') ? (state.lives === 1 ? 1.4 : 0.6) : 0;
    const score = capture + threats * 0.7 - risk - (state.visits[key] ?? 0) * 2 + rng() * 1.8;
    chess.undo();
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}
