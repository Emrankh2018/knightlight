import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { epdOf, OpeningIndex } from '../src/lib/openings';
import type { Opening, OpeningsFile, PositionsFile } from '../src/lib/openings';

const dir = 'public/data/openings';
const openingsFile = JSON.parse(readFileSync(`${dir}/openings.json`, 'utf8')) as OpeningsFile;
const positionsFile = JSON.parse(readFileSync(`${dir}/positions.json`, 'utf8')) as PositionsFile;
const real = new OpeningIndex(openingsFile, positionsFile);

function uciOf(san: string): string[] {
  const chess = new Chess();
  return san
    .split(' ')
    .filter(Boolean)
    .map((s) => {
      const m = chess.move(s);
      return `${m.from}${m.to}${m.promotion ?? ''}`;
    });
}

function epdAfter(san: string, fen?: string): string {
  const chess = new Chess(fen);
  for (const s of san.split(' ').filter(Boolean)) chess.move(s);
  return epdOf(chess.fen());
}

/** A tiny hand-made index so ordering, naming and limit rules are tested exactly. */
function tiny(): OpeningIndex {
  const openings: Opening[] = [
    { eco: 'B00', name: 'King Pawn', pgn: '1. e4', uci: 'e2e4' },
    { eco: 'B20', name: 'Sicilian Defense', pgn: '1. e4 c5', uci: 'e2e4 c7c5' },
    { eco: 'B21', name: 'Sicilian Defense: Smith-Morra', pgn: '1. e4 c5 2. d4', uci: 'e2e4 c7c5 d2d4' },
    { eco: 'C20', name: 'Center Game', pgn: '1. e4 e5', uci: 'e2e4 e7e5' },
    { eco: 'D00', name: 'Sicilian-like Queen Pawn', pgn: '1. d4 c5', uci: 'd2d4 c7c5' },
  ];
  const e4 = epdAfter('e4');
  const e4c5 = epdAfter('e4 c5');
  const e4e5 = epdAfter('e4 e5');
  const e4c5d4 = epdAfter('e4 c5 d4');
  const start = epdAfter('');
  const positions: PositionsFile = {
    [start]: { n: [['e4', 'e2e4', e4], ['d4', 'd2d4', epdAfter('d4')]] },
    [e4]: {
      o: 0,
      n: [
        ['c5', 'c7c5', e4c5],
        ['e5', 'e7e5', e4e5],
        ['a6', 'a7a6', epdAfter('e4 a6')],
      ],
    },
    [e4c5]: { o: 1, n: [['d4', 'd2d4', e4c5d4]] },
    [e4c5d4]: { o: 2, n: [] },
    [e4e5]: { o: 3, n: [] },
    [epdAfter('d4 c5')]: { o: 4, n: [] },
  };
  return new OpeningIndex({ version: 1, source: 'test', openings }, positions);
}

describe('epdOf', () => {
  it('drops the clocks and keeps four fields', () => {
    expect(epdOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 12 34')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
    );
  });

  it('removes an en-passant square that no pawn can actually capture on', () => {
    const noCapture = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(epdOf(noCapture)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -');
    expect(epdOf(noCapture)).toBe(epdOf(noCapture.replace(' e3 ', ' - ')));
  });

  it('keeps an en-passant square when the capture is legal', () => {
    const capture = 'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3';
    expect(epdOf(capture).endsWith(' e3')).toBe(true);
  });

  it('drops an en-passant square when the capture is pinned and so illegal', () => {
    // Horizontal e.p. pin: black king a4, black pawn d4, white pawn e4 (just moved), white rook h4.
    // Taking d4xe3 removes both pawns from the rank and would expose the king.
    const pinned = '8/8/8/8/k2pP2R/8/8/4K3 b - e3 0 1';
    const chess = new Chess(pinned);
    const legalEp = chess.moves({ verbose: true }).some((m) => m.flags.includes('e'));
    expect(legalEp).toBe(false);
    expect(epdOf(pinned).endsWith(' -')).toBe(true);
  });

  it('does not throw on garbage input', () => {
    expect(() => epdOf('')).not.toThrow();
    expect(() => epdOf('not a fen at all e3')).not.toThrow();
    expect(() => epdOf('8/8/8/8/8/8/8/8 w - e3 0 1')).not.toThrow();
  });
});

describe('lookup with bad input', () => {
  it('stops at an illegal move in the middle and keeps the deepest earlier opening', () => {
    // 1.e4 e5 2.Nf3 Nc6 then an illegal "e1e5" (king through own pawn / not a king move), then moves that would be legal.
    const ucis = [...uciOf('e4 e5 Nf3 Nc6'), 'e1e5', ...uciOf('e4 e5 Nf3 Nc6 Bc4').slice(4)];
    const result = real.lookup(ucis);
    const prefix = real.lookup(uciOf('e4 e5 Nf3 Nc6'));
    expect(prefix.ply).toBeGreaterThan(0);
    expect(result).toEqual(prefix);
  });

  it('does not resume after an illegal move even if a later move would be legal', () => {
    const good = uciOf('e4 e5 Nf3 Nc6 Bc4');
    const withBreak = [...good.slice(0, 3), 'a1a5', ...good.slice(3)];
    expect(real.lookup(withBreak).ply).toBeLessThanOrEqual(3);
    expect(real.lookup(withBreak).opening?.name).not.toBe('Italian Game');
  });

  it('returns no opening when the very first move is illegal', () => {
    expect(real.lookup(['e2e5', ...uciOf('e4 e5')])).toEqual({ ply: 0 });
    expect(real.lookup(['e7e5'])).toEqual({ ply: 0 }); // black cannot move first
  });

  it('survives malformed uci strings of every kind', () => {
    for (const bad of ['', 'e', 'zz', 'zzzz', '0000', 'e2e4e4', 'E2E4', 'e2e4x', 'e7e8q']) {
      expect(() => real.lookup([bad]), bad).not.toThrow();
    }
    expect(real.lookup([''])).toEqual({ ply: 0 });
    expect(real.lookup(['e2e4', '']).opening?.name).toBe(real.lookup(['e2e4']).opening?.name);
  });

  it('ignores a promotion letter on a non-promotion move', () => {
    // chess.js accepts "e2e4q" as e2e4. Either accepting or rejecting is fine, but it must be consistent and not throw.
    const withLetter = real.lookup(['e2e4q']);
    expect([0, 1]).toContain(withLetter.ply);
  });

  it('reports the ply of the deepest named opening, not the length of the input', () => {
    const ucis = uciOf('e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3');
    const result = real.lookup(ucis);
    expect(result.ply).toBeGreaterThanOrEqual(5);
    expect(result.ply).toBeLessThan(ucis.length + 1);
    expect(result.opening?.name).toBeTruthy();
  });

  it('is pure: calling lookup twice gives the same answer and does not mutate the input', () => {
    const ucis = uciOf('e4 c5 Nf3 d6');
    const copy = [...ucis];
    expect(real.lookup(ucis)).toEqual(real.lookup(ucis));
    expect(ucis).toEqual(copy);
  });

  it('handles a very long move list without throwing', () => {
    const chess = new Chess();
    const ucis: string[] = [];
    for (let i = 0; i < 80 && !chess.isGameOver(); i++) {
      const m = chess.moves({ verbose: true })[0];
      if (!m) break;
      chess.move(m);
      ucis.push(m.from + m.to + (m.promotion ?? ''));
    }
    expect(() => real.lookup(ucis)).not.toThrow();
  });
});

describe('lookupFen', () => {
  it('finds an opening whether the en-passant field says e3 or -', () => {
    const withEp = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const withoutEp = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(real.lookupFen(withEp)).toBeDefined();
    expect(real.lookupFen(withEp)).toEqual(real.lookupFen(withoutEp));
    expect(real.lookupFen(withoutEp)?.pgn).toBe('1. e4');
  });

  it('is independent of the move counters', () => {
    const a = real.lookupFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    const b = real.lookupFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 17 40');
    expect(a).toEqual(b);
  });

  it('keeps positions with a live en-passant right distinct from the same board without it', () => {
    const idx = tiny();
    // Build a one-entry index keyed by a position where e.p. is genuinely capturable.
    const epFen = 'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3';
    const noEpFen = epFen.replace(' e3 ', ' - ');
    const opening: Opening = { eco: 'X00', name: 'EP Test', pgn: '1. e4', uci: 'e2e4' };
    const withEp = new OpeningIndex({ version: 1, source: 't', openings: [opening] }, { [epdOf(epFen)]: { o: 0, n: [] } });
    expect(withEp.lookupFen(epFen)?.name).toBe('EP Test');
    expect(withEp.lookupFen(noEpFen)).toBeUndefined();
    expect(idx.lookupFen(epFen)).toBeUndefined();
  });

  it('returns undefined for unknown, empty and garbage positions without throwing', () => {
    for (const fen of ['', 'garbage', '8/8/8/8/8/8/8/K6k w - - 0 1', '8/8/8/8/8/8/8/8 w - e3 0 1']) {
      expect(() => real.lookupFen(fen), fen).not.toThrow();
      expect(real.lookupFen(fen), fen).toBeUndefined();
    }
  });

  it('returns the opening that ends exactly at the position, not a later one', () => {
    const chess = new Chess();
    for (const m of 'e4 e5 Nf3 Nc6 Bc4 Bc5'.split(' ')) chess.move(m);
    const fenAfterBc5 = chess.fen();
    const direct = real.lookupFen(fenAfterBc5);
    const viaLookup = real.lookup(uciOf('e4 e5 Nf3 Nc6 Bc4 Bc5'));
    expect(direct?.name).toBe(viaLookup.opening?.name);
  });

  it('matches the position reached through lookup at the same ply (en passant included)', () => {
    // 1.e4 a6 2.e5 d5: white pawn e5 can capture d6 e.p.
    const san = 'e4 a6 e5 d5';
    const chess = new Chess();
    for (const m of san.split(' ')) chess.move(m);
    expect(chess.fen().split(' ')[3]).toBe('d6');
    const fromFen = real.lookupFen(chess.fen());
    const fromMoves = real.lookup(uciOf(san));
    if (fromFen) expect(fromMoves.opening).toEqual(fromFen);
    expect(real.continuations(chess.fen()).every((c) => c.san.length > 0)).toBe(true);
  });
});

describe('continuations', () => {
  it('omits the name key entirely when the resulting position has no opening', () => {
    const idx = tiny();
    const list = idx.continuations(new Chess().fen());
    expect(list).toStrictEqual([
      { san: 'e4', uci: 'e2e4', name: 'King Pawn' },
      { san: 'd4', uci: 'd2d4' },
    ]);
    expect('name' in (list[1] as object)).toBe(false);
  });

  it('names each continuation by the opening at the resulting position, in stored order', () => {
    const idx = tiny();
    const chess = new Chess();
    chess.move('e4');
    expect(idx.continuations(chess.fen())).toStrictEqual([
      { san: 'c5', uci: 'c7c5', name: 'Sicilian Defense' },
      { san: 'e5', uci: 'e7e5', name: 'Center Game' },
      { san: 'a6', uci: 'a7a6' },
    ]);
  });

  it('is empty for a leaf, an unknown position and garbage', () => {
    const idx = tiny();
    const chess = new Chess();
    for (const m of ['e4', 'c5', 'd4']) chess.move(m);
    expect(idx.continuations(chess.fen())).toEqual([]);
    expect(idx.continuations('8/8/8/8/8/8/8/K6k w - - 0 1')).toEqual([]);
    expect(idx.continuations('nonsense')).toEqual([]);
  });

  it('ignores the move counters and a non-capturable en-passant field', () => {
    const idx = tiny();
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(idx.continuations(start.replace('0 1', '30 60'))).toEqual(idx.continuations(start));
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(idx.continuations(afterE4)).toEqual(idx.continuations(afterE4.replace(' e3 ', ' - ')));
    expect(idx.continuations(afterE4)).toHaveLength(3);
  });

  it('in the real data, every continuation is a legal move whose uci and san agree', () => {
    const fens = [
      new Chess().fen(),
      ...['e4', 'e4 e5', 'e4 c5', 'd4 d5', 'd4 Nf6 c4', 'c4', 'Nf3'].map((s) => {
        const c = new Chess();
        for (const m of s.split(' ')) c.move(m);
        return c.fen();
      }),
    ];
    for (const fen of fens) {
      const list = real.continuations(fen);
      expect(list.length, fen).toBeGreaterThan(0);
      for (const c of list) {
        const chess = new Chess(fen);
        const m = chess.move({ from: c.uci.slice(0, 2), to: c.uci.slice(2, 4), promotion: c.uci.slice(4) || undefined });
        expect(m.san, `${fen} ${c.uci}`).toBe(c.san);
        if (c.name !== undefined) expect(real.lookupFen(chess.fen())?.name).toBe(c.name);
        else expect(real.lookupFen(chess.fen())).toBeUndefined();
      }
    }
  });

  it('in the real data, continuations of the start position carry names for the main first moves', () => {
    const named = new Map(real.continuations(new Chess().fen()).map((c) => [c.san, c.name]));
    expect(named.get('e4')).toBeTruthy();
    expect(named.get('d4')).toBeTruthy();
    expect(named.get('c4')).toBe('English Opening');
  });
});

describe('search', () => {
  it('returns nothing for empty, blank and non-positive-limit queries', () => {
    expect(real.search('', 10)).toEqual([]);
    expect(real.search('   \t\n', 10)).toEqual([]);
    expect(real.search('e4', 0)).toEqual([]);
    expect(real.search('e4', -3)).toEqual([]);
    expect(real.search('e4', Number.NaN)).toEqual([]);
  });

  it('returns nothing, without throwing, for garbage queries', () => {
    for (const q of ['zzzzqqq', 'e9 e10', '!!!', '1.', '...', '(((', '[', '\\', '.*', '%', 'ñ ü', '\u0000', 'x'.repeat(5000)]) {
      expect(() => real.search(q, 10), q.slice(0, 20)).not.toThrow();
    }
    expect(real.search('zzzzqqq', 10)).toEqual([]);
    expect(real.search('e9 e10', 10)).toEqual([]);
    expect(real.search('.*', 10)).toEqual([]); // regex characters are literal text
    expect(real.search('(((', 10)).toEqual([]);
  });

  it('never returns more than the limit and never repeats an opening', () => {
    for (const q of ['e4', 'Sicilian', 'C', 'B', 'a', 'Defense', '1.e4 e5', 'D']) {
      for (const limit of [1, 2, 7, 50]) {
        const r = real.search(q, limit);
        expect(r.length, `${q} limit ${limit}`).toBeLessThanOrEqual(limit);
        expect(new Set(r).size, `${q} duplicates`).toBe(r.length);
      }
    }
  });

  it('a larger limit returns a superset in the same order (limit only truncates)', () => {
    const small = real.search('Sicilian', 5);
    const big = real.search('Sicilian', 40);
    expect(big.slice(0, 5)).toEqual(small);
    expect(big.length).toBeGreaterThan(5);
  });

  it('orders ECO matches, then name matches, then move matches, without duplicates', () => {
    const idx = tiny();
    // "B20" is an ECO prefix. "b2" is not a valid ECO query (needs two digits) so it is treated as name/move text.
    expect(idx.search('B2', 10).map((o) => o.eco)).toEqual(['B20', 'B21']);
    // "sicilian" hits two Sicilian Defense lines and the Sicilian-like Queen Pawn by name; none by ECO.
    expect(idx.search('sicilian', 10).map((o) => o.eco)).toEqual(['B20', 'B21', 'D00']);
    // "e4 c5" has no name hit and matches the lines that start with e4 c5.
    expect(idx.search('e4 c5', 10).map((o) => o.eco)).toEqual(['B20', 'B21']);
  });

  it('matches move sequences only as a prefix of the line', () => {
    const idx = tiny();
    expect(idx.search('c5', 10)).toEqual([]); // no line starts with 1...c5; D00 starts d4
    expect(idx.search('d4 c5', 10).map((o) => o.eco)).toEqual(['D00']);
    expect(idx.search('e4 c5 d4 Nf6', 10)).toEqual([]);
  });

  it('is case-insensitive for names and ECO codes', () => {
    const idx = tiny();
    expect(idx.search('SICILIAN DEFENSE', 10).map((o) => o.eco)).toEqual(['B20', 'B21']);
    expect(idx.search('b20', 10).map((o) => o.eco)).toEqual(['B20']);
    expect(idx.search('B20', 10).map((o) => o.eco)).toEqual(['B20']);
  });

  it('trims surrounding whitespace and collapses internal whitespace in move queries', () => {
    const idx = tiny();
    expect(idx.search('   e4    c5   ', 10).map((o) => o.eco)).toEqual(['B20', 'B21']);
    expect(idx.search('1.e4 c5', 10).map((o) => o.eco)).toEqual(['B20', 'B21']);
    expect(idx.search('1. e4 c5 2. d4', 10).map((o) => o.eco)).toEqual(['B21']);
  });

  it('ignores check and mate marks in a move query', () => {
    const idx = tiny();
    expect(idx.search('e4+ c5#', 10).map((o) => o.eco)).toEqual(['B20', 'B21']);
  });

  it('finds real openings by apostrophe names and by castling in the line', () => {
    expect(real.search("queen's gambit", 5).length).toBe(5);
    expect(real.search("queen's gambit", 5).every((o) => o.name.toLowerCase().includes("queen's gambit"))).toBe(true);
    const castling = real.search('e4 e5 Nf3 Nc6 Bc4 Bc5 O-O', 200);
    expect(castling.length).toBeGreaterThan(0);
    expect(castling.every((o) => o.pgn.includes('O-O'))).toBe(true);
  });

  it('every real result for a move query really starts with those moves', () => {
    const results = real.search('d4 Nf6 c4 g6', 300);
    expect(results.length).toBeGreaterThan(5);
    expect(results.every((o) => o.pgn.startsWith('1. d4 Nf6 2. c4 g6'))).toBe(true);
  });

  it('a one-letter ECO prefix returns only that letter family first', () => {
    const results = real.search('E', 15);
    expect(results.length).toBe(15);
    expect(results.every((o) => o.eco.startsWith('E'))).toBe(true);
  });
});
