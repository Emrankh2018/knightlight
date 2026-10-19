import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Puzzle, PuzzleIndex } from '../src/lib/puzzle-types';
import { hint, playUci, remainingMoves, shuffle, start, tryMove, type PuzzleState } from '../src/lib/puzzles';

const dir = 'public/data/puzzles';
const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8')) as PuzzleIndex;
const readBucket = (file: string): Puzzle[] => JSON.parse(readFileSync(join(dir, file), 'utf8')) as Puzzle[];

function make(fen: string, moves: string[]): Puzzle {
  return { id: 'T', fen, moves, rating: 1000, themes: [], url: '' };
}

/** Plays the stored solution; returns the final result kind. */
function replay(puzzle: Puzzle): string {
  let state: PuzzleState = start(puzzle);
  for (;;) {
    const uci = puzzle.moves[state.index];
    if (uci === undefined) return 'ran-out';
    const res = tryMove(state, uci);
    if (res.kind !== 'continue') return res.kind;
    state = res.state;
  }
}

describe('start', () => {
  it('auto-plays moves[0] and gives the solver the bottom of the board', () => {
    const p = make('6k1/p4ppp/8/8/8/8/8/3RR1K1 b - - 0 1', ['a7a6', 'e1e8']);
    const s = start(p);
    expect(s.solver).toBe('white');
    expect(s.orientation).toBe('white');
    expect(s.index).toBe(1);
    expect(s.lastMove).toMatchObject({ from: 'a7', to: 'a6' });
    expect(new Chess(s.fen).turn()).toBe('w');
  });

  it('orients to black when black is the solver', () => {
    const p = make('4k3/8/8/8/8/8/P7/4K3 w - - 0 1', ['a2a3', 'e8d8']);
    expect(start(p).orientation).toBe('black');
  });

  it('throws on an illegal first move', () => {
    expect(() => start(make('4k3/8/8/8/8/8/8/4K3 w - - 0 1', ['a1a2']))).toThrow();
  });
});

describe('start validation', () => {
  it('rejects odd-length and too-short move lists', () => {
    const fen = '6k1/p4ppp/8/8/8/8/8/3RR1K1 b - - 0 1';
    expect(() => start(make(fen, ['a7a6', 'e1e8', 'g8f8']))).toThrow();
    expect(() => start(make(fen, ['a7a6']))).toThrow();
    expect(() => start(make(fen, []))).toThrow();
  });
});

describe('tryMove', () => {
  const real = readBucket('beginner/mateIn2.json')[0] as Puzzle;

  it('solves a real mate-in-2 with a reply in between', () => {
    expect(real.moves.length).toBe(4);
    const s0 = start(real);
    const r1 = tryMove(s0, real.moves[1] as string);
    expect(r1.kind).toBe('continue');
    if (r1.kind !== 'continue') return;
    expect(r1.reply).toBe(real.moves[2]);
    expect(r1.state.index).toBe(3);
    expect(tryMove(r1.state, real.moves[3] as string).kind).toBe('solved');
  });

  it('rejects a wrong move and leaves the state usable', () => {
    const s0 = start(real);
    const legal = new Chess(s0.fen).moves({ verbose: true }).find((mv) => mv.from + mv.to + (mv.promotion ?? '') !== real.moves[1]);
    expect(legal).toBeDefined();
    const bad = (legal?.from ?? '') + (legal?.to ?? '') + (legal?.promotion ?? '');
    expect(tryMove(s0, bad).kind).toBe('wrong');
    expect(tryMove(s0, 'a1a1').kind).toBe('wrong');
    expect(tryMove(s0, 'nonsense').kind).toBe('wrong');
    expect(tryMove(s0, real.moves[1] as string).kind).toBe('continue');
  });

  it('accepts a different checkmate on the final solver move', () => {
    const p = make('6k1/p4ppp/8/8/8/8/8/3RR1K1 b - - 0 1', ['a7a6', 'e1e8']);
    expect(tryMove(start(p), 'e1e8').kind).toBe('solved');
    expect(tryMove(start(p), 'd1d8').kind).toBe('solved');
    expect(tryMove(start(p), 'e1e7').kind).toBe('wrong');
  });

  it('does not accept a non-mating deviation on the final move', () => {
    const p = make('6k1/p4ppp/8/8/8/8/8/3RR1K1 b - - 0 1', ['a7a6', 'e1e8']);
    expect(tryMove(start(p), 'd1d7').kind).toBe('wrong');
  });

  it('accepts an alternate checkmate on an early solver move', () => {
    const p = make('6k1/p4ppp/8/8/8/8/8/3RR1K1 b - - 0 1', ['a7a6', 'e1e2', 'g8f8', 'e2e8']);
    const res = tryMove(start(p), 'e1e8');
    expect(res.kind).toBe('solved');
    if (res.kind === 'solved') expect(remainingMoves(res.state)).toEqual([]);
    expect(tryMove(start(p), 'e1e2').kind).toBe('continue');
    expect(tryMove(start(p), 'd1d7').kind).toBe('wrong');
  });

  it('plays castling and en passant', () => {
    const castle = make('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', ['a8a7', 'e1g1']);
    expect(tryMove(start(castle), 'e1g1').kind).toBe('solved');
    const castleThenMore = make('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', ['a8a7', 'e1c1', 'h8h7', 'a1a7']);
    const c = tryMove(start(castleThenMore), 'e1c1');
    expect(c.kind).toBe('continue');
    const ep = make('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1', ['e2e4', 'd4e3']);
    const res = tryMove(start(ep), 'd4e3');
    expect(res.kind).toBe('solved');
    if (res.kind === 'solved') expect(res.state.fen.split(' ')[0]).toBe('4k3/8/8/8/8/4p3/8/4K3');
  });

  it('handles promotions', () => {
    const p = make('7k/P7/8/8/8/8/8/K7 b - - 0 1', ['h8g8', 'a7a8q']);
    expect(tryMove(start(p), 'a7a8q').kind).toBe('solved');
    expect(tryMove(start(p), 'a7a8n').kind).toBe('wrong');
    expect(tryMove(start(p), 'a7a8').kind).toBe('wrong');
  });

  it('accepts an underpromotion only when it is the stored one', () => {
    const p = make('7k/P7/8/8/8/8/8/K7 b - - 0 1', ['h8g8', 'a7a8n']);
    expect(tryMove(start(p), 'a7a8n').kind).toBe('solved');
    expect(tryMove(start(p), 'a7a8q').kind).toBe('wrong');
  });

  it('answers wrong once the puzzle is over', () => {
    const p = make('6k1/p4ppp/8/8/8/8/8/3RR1K1 b - - 0 1', ['a7a6', 'e1e8']);
    const res = tryMove(start(p), 'e1e8');
    if (res.kind !== 'solved') throw new Error('expected solved');
    expect(tryMove(res.state, 'e1e8').kind).toBe('wrong');
  });
});

describe('hints', () => {
  const p = make('6k1/p4ppp/8/8/8/8/8/3RR1K1 b - - 0 1', ['a7a6', 'e1e8']);
  const s = start(p);

  it('climbs piece, target square, then move', () => {
    expect(hint(s, 1)).toEqual({ level: 1, from: 'e1', piece: 'r' });
    expect(hint(s, 2)).toEqual({ level: 2, from: 'e1', to: 'e8', piece: 'r' });
    expect(hint(s, 3)).toEqual({ level: 3, from: 'e1', to: 'e8', piece: 'r' });
  });

  it('returns null once solved', () => {
    const res = tryMove(s, 'e1e8');
    if (res.kind !== 'solved') throw new Error('expected solved');
    expect(hint(res.state, 1)).toBeNull();
    expect(remainingMoves(res.state)).toEqual([]);
  });

  it('lists the remaining moves', () => {
    expect(remainingMoves(s)).toEqual(['e1e8']);
  });
});

describe('playUci', () => {
  it('returns null for illegal or malformed moves', () => {
    const fen = new Chess().fen();
    expect(playUci(fen, 'e2e5')).toBeNull();
    expect(playUci(fen, 'zz')).toBeNull();
    expect(playUci(fen, 'e2e4')?.san).toBe('e4');
  });
});

describe('shuffle', () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  it('is deterministic per seed and a permutation', () => {
    expect(shuffle(items, 7)).toEqual(shuffle(items, 7));
    expect(shuffle(items, 7)).not.toEqual(shuffle(items, 8));
    expect([...shuffle(items, 7)].sort((a, b) => a - b)).toEqual(items);
  });
  it('does not mutate the input', () => {
    const copy = [...items];
    shuffle(items, 3);
    expect(items).toEqual(copy);
  });
});

describe('every shipped puzzle', () => {
  it('can be replayed with its own moves and ends solved', () => {
    const seen = new Set<string>();
    const failures: string[] = [];
    for (const level of index.levels) {
      for (const bucket of level.buckets) {
        for (const puzzle of readBucket(bucket.file)) {
          if (seen.has(puzzle.id)) continue;
          seen.add(puzzle.id);
          let result: string;
          try {
            result = replay(puzzle);
          } catch {
            result = 'threw';
          }
          if (result !== 'solved') failures.push(`${puzzle.id}: ${result}`);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(1000);
    expect(failures).toEqual([]);
  }, 120_000);
});
