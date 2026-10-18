import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { Board } from '../src/engine/board.ts';
import { moveSync, NoLegalMoveError } from '../src/engine/client.ts';
import { LEVEL_IDS, LEVELS, chooseMove } from '../src/engine/levels.ts';
import { findBestMove, type SearchOptions } from '../src/engine/search.ts';

/** Small deterministic PRNG (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const strong = (depth: number, seed = 1): SearchOptions => ({
  depth,
  timeMs: 5000,
  randomness: 0,
  blunderChance: 0,
  rng: seeded(seed),
});

const BACK_RANK_MATE = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
const HANGING_QUEEN = '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1';
const QUEEN_TRAP = '4k3/8/8/4p3/8/3Q4/8/4K3 w - - 0 1';
const CHECKMATED = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
const STALEMATED = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
const MIDDLEGAME = 'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9';

describe('move generation (perft)', () => {
  const cases: [string, number, number][] = [
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 3, 8902],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 2, 2039],
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4, 43238],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3, 9467],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
  ];
  it.each(cases)('%s depth %i = %i', (fen, depth, nodes) => {
    expect(Board.fromFen(fen).perft(depth)).toBe(nodes);
  });
});

describe('findBestMove', () => {
  it('finds a back-rank mate in 1', () => {
    const r = findBestMove(BACK_RANK_MATE, strong(2));
    expect(r?.uci).toBe('d1d8');
    expect(r?.san).toBe('Rd8#');
  });

  it('captures a hanging queen', () => {
    const r = findBestMove(HANGING_QUEEN, strong(2));
    expect(r?.uci).toBe('d1d5');
    expect(r?.san).toBe('Rxd5');
  });

  it.each([2, 3])('does not hang its queen at depth %i', (depth) => {
    const r = findBestMove(QUEEN_TRAP, strong(depth));
    expect(r).not.toBeNull();
    expect(r?.uci).not.toBe('d3d4');
    // Whatever it plays, the queen must not be capturable for free by the e5 pawn.
    const chess = new Chess(QUEEN_TRAP);
    chess.move(r?.uci.slice(0, 2) === 'd3' ? { from: 'd3', to: r.uci.slice(2, 4) } : { from: 'e1', to: r?.uci.slice(2, 4) ?? '' });
    const replies = chess.moves({ verbose: true }).filter((m) => m.captured === 'q');
    expect(replies).toHaveLength(0);
  });

  it('prefers the faster mate', () => {
    // Mate in 1 is available as well as slower wins; score must be a mate-in-1 score.
    const r = findBestMove(BACK_RANK_MATE, strong(4));
    expect(r?.score).toBeGreaterThan(29000);
  });

  it('plays promotions with correct SAN', () => {
    const r = findBestMove('8/P6k/8/8/8/8/8/K7 w - - 0 1', strong(1));
    expect(r?.uci).toBe('a7a8q');
    expect(r?.san.startsWith('a8=Q')).toBe(true);
  });

  const positions = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
    MIDDLEGAME,
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1',
    'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
  ];
  it.each(positions)('returns a legal move at every level for %s', (fen) => {
    for (const level of LEVEL_IDS) {
      const cfg = { ...LEVELS[level], timeMs: 300 };
      const r = findBestMove(fen, { ...cfg, rng: seeded(7) });
      expect(r).not.toBeNull();
      const chess = new Chess(fen);
      const move = chess.move({
        from: r?.uci.slice(0, 2) ?? '',
        to: r?.uci.slice(2, 4) ?? '',
        promotion: r?.uci.slice(4) || undefined,
      });
      expect(move.san).toBe(r?.san);
    }
  });

  it('returns null (does not throw) when the side to move is checkmated or stalemated', () => {
    expect(findBestMove(CHECKMATED, strong(2))).toBeNull();
    expect(findBestMove(STALEMATED, strong(2))).toBeNull();
    expect(chooseMove(CHECKMATED, 'queen')).toBeNull();
  });

  it('moveSync throws NoLegalMoveError at game end', () => {
    expect(() => moveSync(CHECKMATED, 'pawn')).toThrow(NoLegalMoveError);
    expect(() => moveSync(STALEMATED, 'pawn')).toThrow(NoLegalMoveError);
  });

  it('throws on an invalid FEN', () => {
    expect(() => findBestMove('not a fen', strong(1))).toThrow();
  });

  it('respects the time budget', () => {
    const t0 = performance.now();
    const r = findBestMove(MIDDLEGAME, { ...strong(12), timeMs: 200 });
    const elapsed = performance.now() - t0;
    expect(r).not.toBeNull();
    expect(elapsed).toBeLessThan(1500);
  });

  it('respects the node limit', () => {
    const r = findBestMove(MIDDLEGAME, { ...strong(12), maxNodes: 5000 });
    expect(r).not.toBeNull();
    expect(r?.depth).toBeLessThan(12);
  });

  it('finishes depth 3 on a middlegame position quickly', () => {
    const t0 = performance.now();
    findBestMove(MIDDLEGAME, strong(3));
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe('level 1 (pawn)', () => {
  it('still finds mate in 1 every time', () => {
    const rng = seeded(99);
    for (let i = 0; i < 50; i++) {
      const r = chooseMove(BACK_RANK_MATE, 'pawn', rng);
      expect(r?.uci).toBe('d1d8');
    }
  });

  it('sometimes deviates from the best move, but mostly plays it (fixed seed)', () => {
    const rng = seeded(2024);
    const best = findBestMove(HANGING_QUEEN, strong(1))?.uci;
    expect(best).toBe('d1d5');
    let deviations = 0;
    const trials = 300;
    for (let i = 0; i < trials; i++) {
      if (chooseMove(HANGING_QUEEN, 'pawn', rng)?.uci !== best) deviations++;
    }
    const rate = deviations / trials;
    // blunderChance is 0.35; some random picks happen to be the capture itself.
    expect(rate).toBeGreaterThan(0.1);
    expect(rate).toBeLessThan(0.45);
  });

  it('is deterministic for a given seed', () => {
    const a = chooseMove(MIDDLEGAME, 'knight', seeded(5));
    const b = chooseMove(MIDDLEGAME, 'knight', seeded(5));
    expect(a).toEqual(b);
  });
});

describe('levels', () => {
  it('has five increasing levels with the specified depths', () => {
    expect(LEVEL_IDS).toEqual(['pawn', 'knight', 'bishop', 'rook', 'queen']);
    expect(LEVEL_IDS.map((id) => LEVELS[id].depth)).toEqual([1, 2, 3, 4, 5]);
    expect(LEVEL_IDS.map((id) => LEVELS[id].blunderChance)).toEqual([0.35, 0.15, 0.05, 0, 0]);
    expect(LEVELS.queen.timeMs).toBe(2500);
  });
});
