import { readFileSync } from 'node:fs';
import { Chess, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';
import {
  CASTLE_QUESTS, DETECTIVE_CASES, GAME_IDS, KNIGHT_LEVELS,
  knightMoves, knightTrailHint, shortestKnightPath, shortestKnightTrail, tryDetectiveCapture,
} from '../src/lib/games';
import type { Puzzle, PuzzleIndex } from '../src/lib/puzzle-types';
import { start, tryMove } from '../src/lib/puzzles';

const squares = Array.from({ length: 64 }, (_, i) => `${'abcdefgh'[i % 8]}${Math.floor(i / 8) + 1}`);

/** Independent geometry reference: no production move or path helper is used here. */
function neighbours(square: string): string[] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return squares.filter((candidate) => {
    const dx = Math.abs(candidate.charCodeAt(0) - 97 - file);
    const dy = Math.abs(Number(candidate[1]) - 1 - rank);
    return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
  });
}

function distances(from: string): Map<string, number> {
  const found = new Map([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    const at = queue[i];
    if (at === undefined) throw new Error('missing queue entry');
    for (const next of neighbours(at)) {
      if (found.has(next)) continue;
      found.set(next, (found.get(at) ?? 0) + 1);
      queue.push(next);
    }
  }
  return found;
}

/** BFS over square + remaining treasure, rather than the production route algorithm. */
function trailDistance(from: string, remaining: readonly string[], exit: string): number {
  const initial = remaining.filter((s) => s !== from).sort();
  const queue = [{ square: from, remaining: initial, distance: 0 }];
  const visited = new Set([`${from}:${initial.join(',')}`]);
  for (let i = 0; i < queue.length; i += 1) {
    const state = queue[i];
    if (state === undefined) throw new Error('missing route state');
    if (state.remaining.length === 0 && state.square === exit) return state.distance;
    for (const next of neighbours(state.square)) {
      const left = state.remaining.filter((s) => s !== next);
      const key = `${next}:${left.join(',')}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ square: next, remaining: left, distance: state.distance + 1 });
    }
  }
  throw new Error('unreachable route');
}

const readBucket = (file: string): Puzzle[] => JSON.parse(readFileSync(`public/data/puzzles/${file}`, 'utf8')) as Puzzle[];

describe('knight movement and paths', () => {
  it('has exactly the three requested game identities', () => {
    expect(GAME_IDS).toEqual(['castle', 'knight', 'detective']);
  });

  it('enumerates exactly the legal L-shaped jumps from every square without wrapping', () => {
    for (const square of squares) {
      expect([...knightMoves(square)].sort(), square).toEqual(neighbours(square).sort());
      expect(new Set(knightMoves(square)).size).toBe(knightMoves(square).length);
    }
    expect(knightMoves('a1').sort()).toEqual(['b3', 'c2']);
    expect(knightMoves('h8').sort()).toEqual(['f7', 'g6']);
  });

  it('returns shortest legal paths for all 4096 square pairs, including staying put', () => {
    for (const from of squares) {
      const expected = distances(from);
      for (const to of squares) {
        const path = shortestKnightPath(from, to);
        expect(path[0], `${from}-${to}`).toBe(from);
        expect(path.at(-1), `${from}-${to}`).toBe(to);
        expect(path.length - 1, `${from}-${to}`).toBe(expected.get(to));
        for (let i = 1; i < path.length; i += 1) {
          expect(neighbours(path[i - 1] ?? ''), `${from}-${to}`).toContain(path[i]);
        }
      }
    }
  });

  it('rejects non-board input without generating squares or throwing', () => {
    for (const invalid of ['', 'a0', 'a9', 'i1', 'A1', 'a10', '__proto__']) {
      expect(knightMoves(invalid)).toEqual([]);
      expect(shortestKnightPath(invalid, 'a1')).toEqual([]);
      expect(shortestKnightPath('a1', invalid)).toEqual([]);
      expect(knightTrailHint(invalid, ['c2'], 'd4')).toBeNull();
      expect(knightTrailHint('a1', [invalid], 'd4')).toBeNull();
      expect(knightTrailHint('a1', ['c2'], invalid)).toBeNull();
    }
  });

  it('handles treasures already collected, repeated targets, and the bounded search limit', () => {
    expect(shortestKnightTrail('a1', ['a1'], 'a1')).toEqual(['a1']);
    expect(knightTrailHint('a1', ['a1'], 'a1')).toBeNull();
    const repeated = shortestKnightTrail('a1', ['c2', 'c2'], 'd4');
    expect(repeated).toEqual(['a1', 'c2', 'd4']);
    expect(shortestKnightTrail('a1', ['b3', 'c2', 'd4', 'e5'], 'h8')).toEqual([]);
    const targets = ['h8', 'b3'];
    shortestKnightTrail('a1', targets, 'a1');
    expect(targets).toEqual(['h8', 'b3']);
  });
});

describe('every treasure trail', () => {
  it('ships distinct, complete levels with independently verified optimal par', () => {
    expect(KNIGHT_LEVELS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(KNIGHT_LEVELS.map((level) => level.id)).size).toBe(KNIGHT_LEVELS.length);
    for (const level of KNIGHT_LEVELS) {
      expect(squares).toContain(level.start);
      expect(squares).toContain(level.exit);
      expect(level.treasures.length).toBeGreaterThan(0);
      expect(new Set(level.treasures).size).toBe(level.treasures.length);
      for (const treasure of level.treasures) expect(squares).toContain(treasure);
      expect(level.par, level.id).toBe(trailDistance(level.start, level.treasures, level.exit));
      expect(level.par).toBeGreaterThan(0);
    }
  });

  it('gives legal hints which collect every treasure and reach the exit at par', () => {
    for (const level of KNIGHT_LEVELS) {
      let at = level.start;
      let remaining = [...level.treasures];
      for (let move = 0; move < level.par; move += 1) {
        const next = knightTrailHint(at, remaining, level.exit);
        expect(next, `${level.id}, move ${move}`).not.toBeNull();
        if (next === null) throw new Error('incomplete treasure hint');
        expect(neighbours(at)).toContain(next);
        const before = trailDistance(at, remaining, level.exit);
        remaining = remaining.filter((square) => square !== next);
        expect(trailDistance(next, remaining, level.exit)).toBe(before - 1);
        at = next;
      }
      expect(remaining, level.id).toEqual([]);
      expect(at, level.id).toBe(level.exit);
      expect(knightTrailHint(at, remaining, level.exit)).toBeNull();
    }
  });

  it('finds an optimal recovery hint from every square for every authored treasure set', () => {
    for (const level of KNIGHT_LEVELS) {
      for (const at of squares) {
        const remaining = level.treasures.filter((square) => square !== at);
        const before = trailDistance(at, remaining, level.exit);
        const next = knightTrailHint(at, remaining, level.exit);
        if (before === 0) expect(next).toBeNull();
        else {
          expect(next).not.toBeNull();
          if (next === null) throw new Error('missing recovery hint');
          expect(neighbours(at)).toContain(next);
          expect(trailDistance(next, remaining, level.exit)).toBe(before - 1);
        }
      }
    }
  });
});

describe('every Castle Quest puzzle', () => {
  const index = JSON.parse(readFileSync('public/data/puzzles/index.json', 'utf8')) as PuzzleIndex;

  it('provides captures, checkmates and forks in five-room adventures', () => {
    expect(CASTLE_QUESTS.map((quest) => quest.id)).toEqual(['captures', 'mates', 'forks']);
    for (const quest of CASTLE_QUESTS) {
      expect(quest.count).toBe(5);
      const bucket = index.levels.find((level) => level.id === quest.level)?.buckets.find((entry) => entry.theme === quest.theme);
      expect(bucket).toBeDefined();
      if (!bucket) throw new Error('missing quest bucket');
      const puzzles = readBucket(bucket.file);
      expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBeGreaterThanOrEqual(quest.count);
      for (const puzzle of puzzles) {
        let state = start(puzzle);
        let finished = false;
        for (let i = 1; i < puzzle.moves.length && !finished; i += 2) {
          const move = puzzle.moves[i];
          if (!move) throw new Error('missing source move');
          const result = tryMove(state, move);
          expect(result.kind, `${quest.id}: ${puzzle.id} ${move}`).not.toBe('wrong');
          if (result.kind === 'wrong') throw new Error('source solution rejected');
          state = result.state;
          finished = result.kind === 'solved';
        }
        expect(finished, puzzle.id).toBe(true);
        if (quest.theme === 'mateIn1') expect(new Chess(state.fen).isCheckmate(), puzzle.id).toBe(true);
      }
    }
  });
});

describe('every Chess Detective case', () => {
  const source = readBucket('beginner/hangingPiece.json');

  it('uses exact existing source positions with one unprotected capturable enemy target', () => {
    expect(DETECTIVE_CASES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(DETECTIVE_CASES.map((entry) => entry.id)).size).toBe(DETECTIVE_CASES.length);
    expect(new Set(DETECTIVE_CASES.map((entry) => new Chess(entry.fen).turn()))).toEqual(new Set(['w', 'b']));
    for (const entry of DETECTIVE_CASES) {
      const puzzle = source.find((candidate) => candidate.id === entry.sourceId);
      expect(puzzle, entry.id).toBeDefined();
      if (!puzzle) throw new Error('detective source missing');
      expect(entry.fen, entry.id).toBe(start(puzzle).fen);
      const board = new Chess(entry.fen);
      const opposing = board.turn() === 'w' ? 'b' : 'w';
      const targets = new Set(board.moves({ verbose: true }).filter((move) => {
        const piece = board.get(move.to);
        return move.isCapture() && !move.isEnPassant() && piece?.color === opposing && piece.type !== 'k' && !board.isAttacked(move.to, opposing);
      }).map((move) => move.to));
      expect([...targets], entry.id).toEqual([entry.target]);
      expect(entry.to).toBe(entry.target);
      const move = board.move({ from: entry.from, to: entry.to });
      expect(move.isCapture()).toBe(true);
      expect(board.moves({ verbose: true }).filter((reply) => reply.isCapture() && reply.to === entry.to), entry.id).toEqual([]);
    }
  });

  it('accepts every legal safe capture of the clue and rejects every other legal move', () => {
    for (const entry of DETECTIVE_CASES) {
      const board = new Chess(entry.fen);
      let accepted = 0;
      for (const move of board.moves({ verbose: true })) {
        const after = new Chess(entry.fen);
        after.move({ from: move.from, to: move.to, promotion: move.promotion });
        const valid = move.isCapture() && move.to === entry.target && !after.moves({ verbose: true }).some((reply) => reply.isCapture() && reply.to === entry.target);
        const promotion = move.promotion !== 'p' && move.promotion !== 'k' ? move.promotion : undefined;
        expect(tryDetectiveCapture(entry, move.from, move.to, promotion), `${entry.id} ${move.san}`).toBe(valid ? after.fen() : null);
        if (valid) accepted += 1;
      }
      expect(accepted, entry.id).toBeGreaterThan(0);
      for (const square of ['a0', 'i9', '__proto__']) {
        expect(tryDetectiveCapture(entry, square, entry.target)).toBeNull();
        expect(tryDetectiveCapture(entry, entry.from, square)).toBeNull();
      }
      expect(board.get(entry.target as Square)?.color).not.toBe(board.turn());
    }
  });
});
