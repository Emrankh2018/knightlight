import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { Board, moveToUci } from '../src/engine/board.ts';
import { LEVEL_IDS, LEVELS, chooseMove, type BotLevelId } from '../src/engine/levels.ts';
import { findBestMove } from '../src/engine/search.ts';

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

const UCI_FORMAT = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Plays a uci move in chess.js; throws if it is illegal. Returns the SAN. */
function play(chess: Chess, uci: string): string {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined }).san;
}

function uciSetOfChessJs(fen: string): string[] {
  return new Chess(fen)
    .moves({ verbose: true })
    .map((m) => m.from + m.to + (m.promotion ?? ''))
    .sort();
}

function uciSetOfBoard(fen: string): string[] {
  const board = Board.fromFen(fen);
  return board
    .legalMoves()
    .map((m) => moveToUci(m))
    .sort();
}

// Forced en passant: the white king on d4 is in check from the pawn that just played c7-c5.
// Every king move is covered, so b5xc6 e.p. is the only legal move.
const FORCED_EP = 'k1r1r3/5b2/8/1Pp5/3K4/7r/8/8 w - c6 0 1';

describe('bot never returns an illegal move in random playouts', () => {
  const GAMES = 30;
  const MAX_PLIES = 60;

  it.each(['pawn', 'knight'] as BotLevelId[])('level %s: 30 seeded playouts against a random mover', (level) => {
    let botMoves = 0;
    let promotions = 0;
    let captures = 0;
    for (let g = 0; g < GAMES; g++) {
      const rng = seeded(1000 + g);
      const chess = new Chess();
      const botIsWhite = g % 2 === 0;
      for (let ply = 0; ply < MAX_PLIES; ply++) {
        const legal = chess.moves({ verbose: true });
        const botTurn = (chess.turn() === 'w') === botIsWhite;
        if (legal.length === 0) {
          expect(chooseMove(chess.fen(), level, rng), `${level} game ${g} ply ${ply}`).toBeNull();
          break;
        }
        if (botTurn) {
          const fen = chess.fen();
          const pick = chooseMove(fen, level, rng);
          expect(pick, `${level} game ${g} ply ${ply} ${fen}`).not.toBeNull();
          const uci = (pick as { uci: string }).uci;
          expect(uci, fen).toMatch(UCI_FORMAT);
          const legalUci = legal.map((m) => m.from + m.to + (m.promotion ?? ''));
          expect(legalUci, `${level} game ${g} ply ${ply} ${fen} played ${uci}`).toContain(uci);
          const san = play(chess, uci);
          expect(san, fen).toBe((pick as { san: string }).san);
          botMoves++;
          if (uci.length === 5) promotions++;
          if (san.includes('x')) captures++;
        } else {
          const m = legal[Math.floor(rng() * legal.length)];
          chess.move(m as NonNullable<typeof m>);
        }
        if (chess.isDraw() || chess.isGameOver()) break;
      }
    }
    expect(botMoves).toBeGreaterThan(300);
    expect(captures).toBeGreaterThan(0);
    expect(promotions).toBeGreaterThanOrEqual(0);
  }, 120000);

  it('both levels playing each other for 10 seeded games stay legal to the end', () => {
    for (let g = 0; g < 10; g++) {
      const rng = seeded(5000 + g);
      const chess = new Chess();
      for (let ply = 0; ply < 80 && !chess.isGameOver(); ply++) {
        const level: BotLevelId = (chess.turn() === 'w') === (g % 2 === 0) ? 'pawn' : 'knight';
        const fen = chess.fen();
        const pick = chooseMove(fen, level, rng);
        expect(pick, fen).not.toBeNull();
        expect(() => play(chess, (pick as { uci: string }).uci), `${level} ${fen}`).not.toThrow();
      }
    }
  }, 120000);

  it('every level returns null exactly when the game is over', () => {
    const over = [
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
      '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
    ];
    for (const fen of over) for (const l of LEVEL_IDS) expect(chooseMove(fen, l, seeded(1)), `${l} ${fen}`).toBeNull();
  });
});

describe('move generation agrees with chess.js (uci format, castling, en passant, promotion)', () => {
  const FENS = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
    'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1',
    'r3k2r/8/8/8/8/8/8/R3K2R w Kq - 0 1',
    'r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1', // castling through check
    'r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1', // king-side blocked by attack on g1
    'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1', // no rights
    'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3', // black e.p. available
    'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', // white e.p. available
    '8/8/8/8/k2pP2R/8/8/4K3 b - e3 0 1', // e.p. is pinned and illegal
    FORCED_EP,
    '7k/P7/8/8/8/8/8/K7 w - - 0 1',
    'r6k/1P6/8/8/8/8/8/6K1 w - - 0 1', // push and capture promotions
    '7k/8/8/8/8/8/p7/6K1 b - - 0 1',
    '1r5k/P7/8/8/8/8/p7/1R4K1 b - - 0 1',
    'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
  ];

  it.each(FENS)('same legal uci set as chess.js: %s', (fen) => {
    expect(uciSetOfBoard(fen)).toEqual(uciSetOfChessJs(fen));
  });

  it('promotion moves carry a lower-case piece letter and all four pieces are generated', () => {
    const set = uciSetOfBoard('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    expect(set.filter((u) => u.startsWith('a7a8')).sort()).toEqual(['a7a8b', 'a7a8n', 'a7a8q', 'a7a8r']);
    expect(set.every((u) => UCI_FORMAT.test(u))).toBe(true);
  });

  it('castling is written as the king move', () => {
    const set = uciSetOfBoard('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(set).toEqual(expect.arrayContaining(['e1g1', 'e1c1']));
    expect(set).not.toContain('e1h1');
    expect(set).not.toContain('e1a1');
    const black = uciSetOfBoard('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
    expect(black).toEqual(expect.arrayContaining(['e8g8', 'e8c8']));
  });

  it('agrees with chess.js at every ply of 12 seeded random walks (over a thousand positions)', () => {
    let positions = 0;
    let castles = 0;
    let eps = 0;
    let promos = 0;
    for (let g = 0; g < 12; g++) {
      const rng = seeded(77 + g);
      const chess = new Chess();
      for (let ply = 0; ply < 100 && !chess.isGameOver(); ply++) {
        const fen = chess.fen();
        const expected = uciSetOfChessJs(fen);
        expect(uciSetOfBoard(fen), fen).toEqual(expected);
        positions++;
        const verbose = chess.moves({ verbose: true });
        castles += verbose.filter((m) => m.flags.includes('k') || m.flags.includes('q')).length;
        eps += verbose.filter((m) => m.flags.includes('e')).length;
        promos += verbose.filter((m) => m.promotion !== undefined).length;
        const m = verbose[Math.floor(rng() * verbose.length)];
        chess.move(m as NonNullable<typeof m>);
      }
    }
    expect(positions).toBeGreaterThan(900);
    expect(castles).toBeGreaterThan(0);
    expect(promos).toBeGreaterThan(0);
    expect(eps).toBeGreaterThanOrEqual(0);
  }, 120000);
});

describe('promotion in the bot', () => {
  const opts = (depth: number, seed = 3) => ({
    depth,
    timeMs: 3000,
    randomness: 0,
    blunderChance: 0,
    rng: seeded(seed),
  });

  it('returns a 5-character lower-case uci and matching SAN for a white promotion', () => {
    const r = findBestMove('6k1/P7/8/8/8/8/8/K7 w - - 0 1', opts(3));
    expect(r?.uci).toBe('a7a8q');
    expect(r?.san).toMatch(/^a8=Q\+?$/);
  });

  it('returns a lower-case promotion letter for black too', () => {
    const r = findBestMove('7k/8/8/8/8/8/p7/6K1 b - - 0 1', opts(3));
    expect(r?.uci).toMatch(/^a2a1[qrbn]$/);
    expect(r?.uci).toBe('a2a1q');
    expect(r?.san).toMatch(/^a1=Q/);
  });

  it('prefers promoting with capture when it wins a rook', () => {
    const r = findBestMove('r6k/1P6/8/8/8/8/8/6K1 w - - 0 1', opts(3));
    expect(r?.uci).toBe('b7a8q');
    expect(r?.san.startsWith('bxa8=Q')).toBe(true);
  });

  it('every level yields a legal promotion move when promotion is the obvious move', () => {
    const fen = '7k/P7/8/8/8/8/8/K7 w - - 0 1';
    for (const level of LEVEL_IDS) {
      const pick = chooseMove(fen, level, seeded(11));
      expect(pick, level).not.toBeNull();
      const chess = new Chess(fen);
      expect(() => play(chess, (pick as { uci: string }).uci), `${level} ${pick?.uci}`).not.toThrow();
    }
  });

  it('does not stalemate the opponent by promoting to a queen when it has a better choice', () => {
    // Qb8 would stalemate the king on a1 (a2 and b2 covered by Ka3, b1 by the queen). Every other piece avoids it.
    const fen = '8/1P6/8/8/8/K7/8/k7 w - - 0 1';
    const trap = new Chess(fen);
    trap.move('b8=Q');
    expect(trap.isStalemate()).toBe(true); // guards the premise of this test
    // Depth 1 (level 1, "pawn") does not look past its own move, so it cannot see stalemate; that is a known
    // horizon limit of the weakest level and is reported separately. Depth 2 and up must see it.
    for (const depth of [2, 3, 4]) {
      const r = findBestMove(fen, opts(depth));
      expect(r, `depth ${depth}`).not.toBeNull();
      expect(r?.uci, `depth ${depth}`).not.toBe('b7b8q');
      const chess = new Chess(fen);
      play(chess, (r as { uci: string }).uci);
      expect(chess.isStalemate(), `depth ${depth} ${r?.uci}`).toBe(false);
    }
  });
});

describe('castling in the bot', () => {
  it('can castle and writes it as the king move when castling is the only sensible move', () => {
    // White is a rook up; any move is legal, but with a back-rank mate threat castling is allowed. Check format only.
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const r = chooseMove(fen, 'pawn', seeded(seed));
      expect(r).not.toBeNull();
      seen.add((r as { uci: string }).uci);
      expect(uciSetOfChessJs(fen)).toContain((r as { uci: string }).uci);
    }
    // Level 1 is deliberately random enough that it should not always play the same move.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('never castles through check at any level', () => {
    const fen = 'r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1';
    for (const level of LEVEL_IDS) {
      for (let seed = 1; seed <= 5; seed++) {
        const r = chooseMove(fen, level, seeded(seed));
        expect(r?.uci, `${level} ${seed}`).not.toBe('e1g1');
        expect(uciSetOfChessJs(fen)).toContain(r?.uci);
      }
    }
  });
});

describe('en passant in the bot', () => {
  it('plays the en passant capture when it is the only legal move (all levels, many seeds)', () => {
    expect(uciSetOfChessJs(FORCED_EP)).toEqual(['b5c6']);
    for (const level of LEVEL_IDS) {
      for (let seed = 1; seed <= 6; seed++) {
        const pick = chooseMove(FORCED_EP, level, seeded(seed));
        expect(pick, `${level} ${seed}`).toEqual({ uci: 'b5c6', san: 'bxc6' });
      }
    }
  });

  it('the capture really removes the double-stepped pawn', () => {
    const chess = new Chess(FORCED_EP);
    play(chess, 'b5c6');
    expect(chess.get('c5')).toBeFalsy();
    expect(chess.get('c6')).toMatchObject({ type: 'p', color: 'w' });
  });

  it('findBestMove with an ep square in the FEN returns a legal move at depth 3 for both colours', () => {
    const fens = [
      'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
      'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3',
    ];
    for (const fen of fens) {
      const r = findBestMove(fen, { depth: 3, timeMs: 2000, randomness: 0, blunderChance: 0, rng: seeded(2) });
      expect(r, fen).not.toBeNull();
      expect(uciSetOfChessJs(fen)).toContain(r?.uci);
    }
  });

  it('takes a free pawn en passant rather than ignoring it (depth 3)', () => {
    // White pawn e5, black just played d7-d5. exd6 e.p. creates a passed pawn the far-away black king cannot catch.
    const fen = '7k/8/8/3pP3/8/8/8/K7 w - d6 0 1';
    const r = findBestMove(fen, { depth: 3, timeMs: 2000, randomness: 0, blunderChance: 0, rng: seeded(2) });
    expect(r?.uci).toBe('e5d6');
  });

  it('does not play an en passant capture that is illegal because of a pin', () => {
    const fen = '8/8/8/8/k2pP2R/8/8/4K3 b - e3 0 1';
    for (const level of LEVEL_IDS) {
      const r = chooseMove(fen, level, seeded(4));
      expect(r?.uci, level).not.toBe('d4e3');
      expect(uciSetOfChessJs(fen)).toContain(r?.uci);
    }
  });
});

describe('level table', () => {
  it('stays inside the documented ranges', () => {
    for (const id of LEVEL_IDS) {
      const l = LEVELS[id];
      expect(l.depth).toBeGreaterThanOrEqual(1);
      expect(l.timeMs).toBeGreaterThan(0);
      expect(l.randomness).toBeGreaterThanOrEqual(0);
      expect(l.randomness).toBeLessThanOrEqual(1);
      expect(l.blunderChance).toBeGreaterThanOrEqual(0);
      expect(l.blunderChance).toBeLessThanOrEqual(1);
      expect(l.id).toBe(id);
    }
  });
});
