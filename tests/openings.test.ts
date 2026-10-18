import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { epdOf, OpeningIndex } from '../src/lib/openings';
import type { OpeningsFile, PositionsFile } from '../src/lib/openings';

const dir = 'public/data/openings';
const openingsFile = JSON.parse(readFileSync(`${dir}/openings.json`, 'utf8')) as OpeningsFile;
const positionsFile = JSON.parse(readFileSync(`${dir}/positions.json`, 'utf8')) as PositionsFile;
const index = new OpeningIndex(openingsFile, positionsFile);

/** SAN text such as "e4 e5 Nf3" to UCI moves. */
function uciOf(san: string): string[] {
  const chess = new Chess();
  return san.split(' ').map((s) => {
    const m = chess.move(s);
    return `${m.from}${m.to}${m.promotion ?? ''}`;
  });
}

// Expected names were taken from the Lichess TSV files (exact strings).
const CASES: [string, string, string][] = [
  ['Italian Game', 'e4 e5 Nf3 Nc6 Bc4', 'Italian Game'],
  ['Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5', 'Ruy Lopez'],
  ['Scotch Game', 'e4 e5 Nf3 Nc6 d4', 'Scotch Game'],
  ['Sicilian', 'e4 c5', 'Sicilian Defense'],
  ['Sicilian Najdorf', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian Defense: Najdorf Variation'],
  ['Sicilian Alapin', 'e4 c5 c3', 'Sicilian Defense: Alapin Variation'],
  ['French', 'e4 e6', 'French Defense'],
  ['Caro-Kann', 'e4 c6', 'Caro-Kann Defense'],
  ['Scandinavian', 'e4 d5', 'Scandinavian Defense'],
  ['QGA', 'd4 d5 c4 dxc4', "Queen's Gambit Accepted"],
  ['QGD', 'd4 d5 c4 e6', "Queen's Gambit Declined"],
  ['London', 'd4 Nf6 Nf3 g6 Bf4', 'London System'],
  ["King's Indian", 'd4 Nf6 c4 g6 Nc3', "King's Indian Defense"],
  ['English', 'c4', 'English Opening'],
  ['Vienna', 'e4 e5 Nc3', 'Vienna Game'],
  ["King's Gambit", 'e4 e5 f4', "King's Gambit"],
  ['Englund', 'd4 e5', 'Englund Gambit'],
  ['Petrov', 'e4 e5 Nf3 Nf6', "Petrov's Defense"],
  ['Pirc', 'e4 d6', 'Pirc Defense'],
  ['Dutch', 'd4 f5', 'Dutch Defense'],
  ['Slav', 'd4 d5 c4 c6', 'Slav Defense'],
];

describe('opening data', () => {
  it('has the generated shape', () => {
    expect(openingsFile.version).toBe(1);
    expect(openingsFile.source).toContain('CC0');
    expect(openingsFile.openings.length).toBeGreaterThan(3000);
    const sorted = [...openingsFile.openings].sort((a, b) =>
      a.eco === b.eco ? (a.pgn < b.pgn ? -1 : a.pgn > b.pgn ? 1 : 0) : a.eco < b.eco ? -1 : 1,
    );
    expect(openingsFile.openings).toEqual(sorted);
  });

  it('has a uci line that replays to the same number of plies as the pgn', () => {
    for (const o of openingsFile.openings.slice(0, 200)) {
      const chess = new Chess();
      for (const uci of o.uci.split(' ')) {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
      }
      expect(chess.history().length).toBe(o.uci.split(' ').length);
    }
  });
});

describe('lookup', () => {
  it.each(CASES)('%s resolves to its TSV name', (_label, san, expected) => {
    const result = index.lookup(uciOf(san));
    expect(result.opening?.name).toBe(expected);
    expect(result.ply).toBe(san.split(' ').length);
  });

  it('returns the deepest named opening when the game leaves the book', () => {
    const result = index.lookup(uciOf('e4 e5 Nf3 Nc6 Bc4 a6 a3 h6'));
    expect(result.opening?.name).toBe('Italian Game');
    expect(result.ply).toBe(5);
  });

  it('returns no opening for an unnamed start', () => {
    expect(index.lookup([])).toEqual({ ply: 0 });
  });

  it('lookupFen finds the opening at a position', () => {
    const chess = new Chess();
    for (const m of 'e4 e6'.split(' ')) chess.move(m);
    expect(index.lookupFen(chess.fen())?.name).toBe('French Defense');
  });

  it('resolves a transposition to the same position and opening', () => {
    const a = new Chess();
    const b = new Chess();
    for (const m of 'd4 d5 c4 e6'.split(' ')) a.move(m);
    for (const m of 'c4 e6 d4 d5'.split(' ')) b.move(m);
    expect(epdOf(a.fen())).toBe(epdOf(b.fen()));
    const viaA = index.lookup(uciOf('d4 d5 c4 e6'));
    const viaB = index.lookup(uciOf('c4 e6 d4 d5'));
    expect(viaB.opening?.name).toBe("Queen's Gambit Declined");
    expect(viaB.opening).toEqual(viaA.opening);
    expect(viaB.ply).toBe(4);
  });
});

describe('continuations', () => {
  it('include e4 and d4 from the start position', () => {
    const start = index.continuations(new Chess().fen());
    const sans = start.map((c) => c.san);
    expect(sans).toContain('e4');
    expect(sans).toContain('d4');
    expect(start.find((c) => c.san === 'e4')?.uci).toBe('e2e4');
  });

  it('name the opening reached by a continuation', () => {
    const chess = new Chess();
    chess.move('e4');
    const reply = index.continuations(chess.fen()).find((c) => c.san === 'e6');
    expect(reply?.name).toBe('French Defense');
  });

  it('are empty for an unknown position', () => {
    expect(index.continuations('8/8/8/8/8/8/8/K6k w - - 0 1')).toEqual([]);
  });
});

describe('search', () => {
  it('finds by ECO prefix', () => {
    const results = index.search('B90', 50);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((o) => o.eco.startsWith('B90'))).toBe(true);
    const c5 = index.search('C5', 20);
    expect(c5.length).toBe(20);
    expect(c5.every((o) => o.eco.startsWith('C5'))).toBe(true);
  });

  it('finds by name substring, case-insensitively', () => {
    const results = index.search('najdorf', 10);
    expect(results.length).toBe(10);
    expect(results.every((o) => o.name.toLowerCase().includes('najdorf'))).toBe(true);
  });

  it('finds by move sequence, with or without move numbers', () => {
    for (const q of ['e4 e5 Nf3', '1.e4 e5 2.Nf3', '1. e4 e5 2. Nf3']) {
      const results = index.search(q, 500);
      expect(results.length).toBeGreaterThan(5);
      expect(results.every((o) => o.pgn.startsWith('1. e4 e5 2. Nf3'))).toBe(true);
    }
  });

  it('respects the limit and an empty query', () => {
    expect(index.search('e4', 3).length).toBe(3);
    expect(index.search('  ', 3)).toEqual([]);
  });
});
