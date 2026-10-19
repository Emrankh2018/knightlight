/**
 * Bot search: negamax alpha-beta with iterative deepening, check extensions,
 * quiescence search, MVV-LVA + killer move ordering, and a material + piece-square
 * evaluation. Pure TypeScript (no DOM) so it runs in a Web Worker and in tests.
 * chess.js is only used up front to validate the FEN and at the end to format SAN.
 */
import { Chess } from 'chess.js';
import { positionKey } from './position-key.ts';
import {
  BISHOP,
  Board,
  FLAG_CAPTURE,
  FLAG_EP,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  moveFrom,
  movePromo,
  moveTo,
  moveToUci,
  type Move,
} from './board.ts';

export interface SearchOptions {
  /** Maximum iterative-deepening depth in plies (>= 1). */
  depth: number;
  /** Time budget in ms. The last fully completed iteration is used. */
  timeMs: number;
  /** 0..1. Moves within `randomness * 100` centipawns of the best are all candidates. */
  randomness: number;
  /** 0..1. Probability of playing a random legal move instead of searching. */
  blunderChance: number;
  rng: () => number;
  /** Node limit across the whole search (default 2,000,000). */
  maxNodes?: number;
  /** Position keys (see `positionKey`) already seen in the game. Used with `avoidRepeats`. */
  history?: readonly string[];
  /** When clearly winning, prefer a move that does not repeat a position in `history`. */
  avoidRepeats?: boolean;
}

export interface SearchResult {
  uci: string;
  san: string;
  /** Centipawns from the mover's point of view (mate scores are +/- (MATE - ply)). */
  score: number;
  /** Depth of the last completed iteration (0 for a random blunder pick). */
  depth: number;
}

export const MATE = 30000;
const MATE_BOUND = MATE - 200;
const INF = 32000;
const MAX_PLY = 64;
const MAX_DEPTH = 10;
/** Centipawns from which the mover counts as clearly winning (and so should not shuffle). */
const WINNING = 200;
const DEFAULT_TIME_MS = 1000;

export const PIECE_VALUES = [0, 100, 320, 330, 500, 900, 0] as const;

/* ---------- evaluation ---------- */

function buildPst(): { mid: Int16Array[]; endKing: Int16Array } {
  const mid: Int16Array[] = [];
  for (let t = 0; t <= 6; t++) mid.push(new Int16Array(128));
  const endKing = new Int16Array(128);
  const pawnRank = [0, 0, 5, 10, 20, 35, 60, 0];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const s = rank * 16 + file;
      const central = Math.min(file, 7 - file) + Math.min(rank, 7 - rank); // 0..6
      const centerFile = file === 3 || file === 4;
      (mid[PAWN] as Int16Array)[s] = (pawnRank[rank] as number) + (centerFile && rank < 5 ? 8 : 0);
      (mid[KNIGHT] as Int16Array)[s] = central * 8 - 20;
      (mid[BISHOP] as Int16Array)[s] = central * 4 - 8;
      (mid[ROOK] as Int16Array)[s] = (rank === 6 ? 10 : 0) + (centerFile ? 3 : 0);
      (mid[QUEEN] as Int16Array)[s] = central * 2 - 4;
      (mid[KING] as Int16Array)[s] =
        rank === 0 ? (file === 1 || file === 2 || file === 6 ? 25 : 5) : -15 * rank;
      endKing[s] = central * 10 - 20;
    }
  }
  return { mid, endKing };
}

const PST = buildPst();
const ENDGAME_MATERIAL = 2400;

/** Static evaluation in centipawns from the side-to-move's point of view. */
export function evaluate(board: Board): number {
  const b = board.sq;
  let score = 0;
  let nonPawn = 0;
  let pawns = 0;
  let minors = 0;
  let kingWhite = 0;
  let kingBlack = 0;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) {
      s += 7;
      continue;
    }
    const piece = b[s] as number;
    if (piece === 0) continue;
    const type = Math.abs(piece);
    if (type === KING) {
      if (piece > 0) kingWhite = s;
      else kingBlack = s;
      continue;
    }
    const value = PIECE_VALUES[type] as number;
    if (type === PAWN) pawns++;
    else {
      nonPawn += value;
      if (type === KNIGHT || type === BISHOP) minors++;
      else minors += 2;
    }
    const table = PST.mid[type] as Int16Array;
    if (piece > 0) score += value + (table[s] as number);
    else score -= value + (table[s ^ 0x70] as number);
  }
  if (pawns === 0 && minors <= 1) return 0; // bare kings or a lone minor piece: dead draw
  if (nonPawn < ENDGAME_MATERIAL) {
    score += (PST.endKing[kingWhite] as number) - (PST.endKing[kingBlack ^ 0x70] as number);
  } else {
    const mid = PST.mid[KING] as Int16Array;
    score += (mid[kingWhite] as number) - (mid[kingBlack ^ 0x70] as number);
  }
  return board.side === 1 ? score : -score;
}

/* ---------- search ---------- */

class Searcher {
  nodes = 0;
  aborted = false;
  private readonly deadline: number;
  private readonly maxNodes: number;
  private readonly killers: number[][] = [];

  constructor(
    private readonly board: Board,
    timeMs: number,
    maxNodes: number,
  ) {
    this.deadline = performance.now() + timeMs;
    this.maxNodes = maxNodes;
    for (let i = 0; i <= MAX_PLY + 1; i++) this.killers.push([0, 0]);
  }

  private checkAbort(): void {
    if ((this.nodes & 1023) === 0 && (performance.now() >= this.deadline || this.nodes >= this.maxNodes)) {
      this.aborted = true;
    }
  }

  /** Orders moves in place: hash/PV move, captures by MVV-LVA, killers, then the rest. */
  orderMoves(moves: Move[], ply: number, first: Move): void {
    const b = this.board.sq;
    const killers = this.killers[ply] as number[];
    const scores = new Map<Move, number>();
    for (const m of moves) {
      let s = 0;
      if (m === first) {
        s = 1_000_000;
      } else if (m & FLAG_CAPTURE) {
        const victim = m & FLAG_EP ? PAWN : Math.abs(b[moveTo(m)] as number);
        const attacker = Math.abs(b[moveFrom(m)] as number);
        s = 10_000 + (PIECE_VALUES[victim] as number) * 10 - attacker;
      } else if (movePromo(m)) {
        s = 9_000;
      } else if (m === killers[0]) {
        s = 8_000;
      } else if (m === killers[1]) {
        s = 7_000;
      }
      scores.set(m, s);
    }
    moves.sort((x, y) => (scores.get(y) as number) - (scores.get(x) as number));
  }

  private quiesce(alphaIn: number, beta: number, ply: number): number {
    this.nodes++;
    this.checkAbort();
    if (this.aborted) return 0;
    const standPat = evaluate(this.board);
    if (ply >= MAX_PLY) return standPat;
    if (standPat >= beta) return standPat;
    let alpha = alphaIn;
    if (standPat > alpha) alpha = standPat;
    const moves = this.board.generate(true);
    this.orderMoves(moves, ply, 0);
    for (const m of moves) {
      if (!this.board.makeMove(m)) continue;
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      this.board.unmakeMove(m);
      if (this.aborted) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  search(depthIn: number, alphaIn: number, beta: number, ply: number): number {
    this.nodes++;
    this.checkAbort();
    if (this.aborted) return 0;
    const board = this.board;
    const inCheck = board.inCheck();
    let depth = depthIn;
    if (inCheck && ply < MAX_PLY - 8) depth++;
    if (depth <= 0) return this.quiesce(alphaIn, beta, ply);
    if (ply > 0 && board.halfmove >= 100) return 0;

    let alpha = alphaIn;
    const moves = board.generate(false);
    this.orderMoves(moves, ply, 0);
    let legal = 0;
    for (const m of moves) {
      if (!board.makeMove(m)) continue;
      legal++;
      const score = -this.search(depth - 1, -beta, -alpha, ply + 1);
      board.unmakeMove(m);
      if (this.aborted) return 0;
      if (score >= beta) {
        if (!(m & FLAG_CAPTURE)) {
          const k = this.killers[ply] as number[];
          if (k[0] !== m) {
            k[1] = k[0] as number;
            k[0] = m;
          }
        }
        return score;
      }
      if (score > alpha) alpha = score;
    }
    if (legal === 0) return inCheck ? -MATE + ply : 0;
    return alpha;
  }

  /**
   * Searches the root once to `depth`. Returns scored moves (exact scores only for
   * moves inside the randomness window of the best), or null if aborted.
   */
  searchRoot(
    rootMoves: Move[],
    depth: number,
    window: number,
  ): { move: Move; score: number }[] | null {
    const board = this.board;
    const scored: { move: Move; score: number }[] = [];
    let best = -INF;
    for (const m of rootMoves) {
      board.makeMove(m);
      const alpha = Math.max(-INF, best - window - (window > 0 ? 1 : 0));
      const score = -this.search(depth - 1, -INF, -alpha, 1);
      board.unmakeMove(m);
      if (this.aborted) return null;
      if (score > alpha || scored.length === 0) {
        scored.push({ move: m, score });
        if (score > best) best = score;
      }
    }
    return scored.filter((e) => e.score >= best - window);
  }
}

/* ---------- public API ---------- */

function toSan(fen: string, m: Move): string {
  const chess = new Chess(fen);
  const promo = movePromo(m);
  const uci = moveToUci(m);
  const result = chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(promo ? { promotion: uci.slice(4) } : {}),
  });
  return result.san;
}

/** Position key reached by playing `m` in `fen`. */
function keyAfter(fen: string, m: Move): string {
  const chess = new Chess(fen);
  const uci = moveToUci(m);
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(movePromo(m) ? { promotion: uci.slice(4) } : {}) });
  return positionKey(chess.fen());
}

function isMateIn1(board: Board, m: Move): boolean {
  if (!board.makeMove(m)) return false;
  const mate = board.inCheck() && !board.hasLegalMove();
  board.unmakeMove(m);
  return mate;
}

function pickRandomMove(moves: Move[], rng: () => number): Move {
  // Mild preference for captures so random play still looks like chess.
  const weights = moves.map((m) => (m & FLAG_CAPTURE ? 3 : 1));
  const total = weights.reduce((a, w) => a + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < moves.length; i++) {
    roll -= weights[i] as number;
    if (roll < 0) return moves[i] as Move;
  }
  return moves[moves.length - 1] as Move;
}

/**
 * Finds a move for the side to move in `fen`.
 *
 * Returns `null` when the side to move has no legal move (checkmate or stalemate).
 * Throws if the FEN is invalid. The `rng` is consumed deterministically, so a seeded
 * rng gives reproducible choices.
 */
export function findBestMove(fen: string, opts: SearchOptions): SearchResult | null {
  new Chess(fen); // validates the FEN (throws on illegal positions)
  const board = Board.fromFen(fen);
  const legal = board.legalMoves();
  if (legal.length === 0) return null;
  const finish = (m: Move, score: number, depth: number): SearchResult => ({
    uci: moveToUci(m),
    san: toSan(fen, m),
    score,
    depth,
  });

  // Always take a mate in one, whatever the level.
  for (const m of legal) {
    if (isMateIn1(board, m)) return finish(m, MATE - 1, 1);
  }

  if (opts.blunderChance > 0 && opts.rng() < opts.blunderChance) {
    const m = pickRandomMove(legal, opts.rng);
    board.makeMove(m);
    const score = -evaluate(board);
    board.unmakeMove(m);
    return finish(m, score, 0);
  }

  const maxDepth = Number.isFinite(opts.depth) ? Math.min(MAX_DEPTH, Math.max(1, Math.floor(opts.depth))) : opts.depth > 0 ? MAX_DEPTH : 1;
  const timeMs = Number.isNaN(opts.timeMs) ? DEFAULT_TIME_MS : Math.max(0, opts.timeMs);
  const window = (Number.isFinite(opts.randomness) ? Math.max(0, Math.min(1, opts.randomness)) : 0) * 100;
  const rng = opts.rng;

  const run = (candidates: Move[]): { chosen: { move: Move; score: number }; reached: number } => {
    const searcher = new Searcher(board, timeMs, opts.maxNodes ?? 2_000_000);
    let rootMoves = candidates.slice();
    searcher.orderMoves(rootMoves, 0, 0);
    let result: { move: Move; score: number }[] = [];
    let reached = 0;
    for (let d = 1; d <= maxDepth; d++) {
      const scored = searcher.searchRoot(rootMoves, d, window);
      if (scored === null) {
        if (d === 1) {
          // Time ran out before depth 1 finished: fall back to the best-ordered move.
          result = [{ move: rootMoves[0] as Move, score: 0 }];
          reached = 0;
        }
        break;
      }
      result = scored;
      reached = d;
      const top = scored.reduce((a, e) => (e.score > a.score ? e : a), scored[0] as { move: Move; score: number });
      // Search the previous best first next iteration.
      rootMoves = [top.move, ...rootMoves.filter((m) => m !== top.move)];
      if (Math.abs(top.score) >= MATE_BOUND) break; // forced mate found, deeper search can't improve it
    }
    const best = result.reduce((a, e) => (e.score > a.score ? e : a), result[0] as { move: Move; score: number });
    // Never trade a won/lost mate score for a "nearby" alternative.
    const pool = Math.abs(best.score) >= MATE_BOUND ? [best] : result;
    return { chosen: pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] as { move: Move; score: number }, reached };
  };

  let { chosen, reached } = run(legal);

  if (opts.avoidRepeats && opts.history && opts.history.length > 0 && chosen.score >= WINNING && chosen.score < MATE_BOUND) {
    const seen = new Set(opts.history);
    const repeats = (m: Move): boolean => seen.has(keyAfter(fen, m));
    if (repeats(chosen.move)) {
      const fresh = legal.filter((m) => !repeats(m));
      if (fresh.length > 0) {
        const alt = run(fresh);
        // Keep the winning edge: only switch if the alternative is still clearly better for us.
        if (alt.chosen.score >= WINNING / 2) {
          chosen = alt.chosen;
          reached = alt.reached;
        }
      }
    }
  }
  return finish(chosen.move, chosen.score, reached);
}
