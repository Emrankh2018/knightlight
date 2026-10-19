import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildPgn,
  buildSearchIndex,
  filterByName,
  MAX_PLIES,
  normalizeSanWord,
  parseLoadInput,
  replay,
  sanitizeMoves,
  sansOfPgn,
  searchOpenings,
  START_FEN,
} from '../src/lib/explorer';
import type { OpeningsFile } from '../src/lib/openings';

const file = JSON.parse(readFileSync('public/data/openings/openings.json', 'utf8')) as OpeningsFile;
const ix = buildSearchIndex(file.openings);

describe('sanitizeMoves', () => {
  it('accepts a legal line', () => {
    expect(sanitizeMoves('e4,e5,Nf3')).toEqual(['e4', 'e5', 'Nf3']);
  });
  it('handles null, empty and junk', () => {
    expect(sanitizeMoves(null)).toEqual([]);
    expect(sanitizeMoves('')).toEqual([]);
    expect(sanitizeMoves('<script>,alert(1)')).toEqual([]);
  });
  it('keeps only the legal prefix', () => {
    expect(sanitizeMoves('e4,e5,Qh7,Nf3')).toEqual(['e4', 'e5']);
  });
  it('strips check marks and caps length', () => {
    expect(sanitizeMoves('e4,f5,Qh5+')).toEqual(['e4', 'f5', 'Qh5']);
    const long = Array.from({ length: 500 }, (_, i) => (i % 4 < 2 ? 'Nf3' : 'Ng1')).join(',');
    expect(sanitizeMoves(long).length).toBeLessThanOrEqual(MAX_PLIES);
  });
});

describe('replay and PGN', () => {
  it('stops at an illegal move', () => {
    expect(replay(START_FEN, ['e4', 'e4', 'e5']).map((p) => p.san)).toEqual(['e4']);
  });
  it('gives UCI including castling and promotion squares', () => {
    expect(replay(START_FEN, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']).at(-1)?.uci).toBe('e1g1');
  });
  it('splits opening movetext', () => {
    expect(sansOfPgn('1. e4 e5 2. Nf3+')).toEqual(['e4', 'e5', 'Nf3']);
  });
  it('builds a PGN with the moves', () => {
    expect(buildPgn(START_FEN, ['e4', 'e5'])).toContain('1. e4 e5');
  });
});

describe('parseLoadInput', () => {
  it('rejects empty and oversized text', () => {
    expect(parseLoadInput('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseLoadInput('x'.repeat(30000))).toEqual({ ok: false, reason: 'tooLong' });
  });
  it('loads a FEN, also with missing counters', () => {
    const res = parseLoadInput('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3');
    expect(res.ok).toBe(true);
  });
  it('loads a PGN', () => {
    const res = parseLoadInput('1. e4 e5 2. Nf3 Nc6');
    expect(res).toEqual({ ok: true, startFen: START_FEN, sans: ['e4', 'e5', 'Nf3', 'Nc6'] });
  });
  it('rejects nonsense and illegal moves', () => {
    expect(parseLoadInput('hello world')).toMatchObject({ ok: false, reason: 'invalid' });
    expect(parseLoadInput('1. e5')).toMatchObject({ ok: false, reason: 'invalid' });
    expect(parseLoadInput('8/8/8/8/8/8/8/8 w - - 0 1')).toMatchObject({ ok: false, reason: 'invalid' });
  });
});

describe('searchOpenings', () => {
  it('finds by name, all words required', () => {
    const res = searchOpenings(ix, 'sicilian najdorf');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((o) => /sicilian/i.test(o.name) && /najdorf/i.test(o.name))).toBe(true);
  });
  it('finds by ECO prefix', () => {
    const res = searchOpenings(ix, 'b90');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((o) => o.eco.startsWith('B90'))).toBe(true);
  });
  it('puts exact move-sequence prefixes first', () => {
    const res = searchOpenings(ix, 'e4 e5 Nf3 Nc6 Bc4');
    expect(res[0]).toBeDefined();
    expect(sansOfPgn(res[0]?.pgn ?? '').slice(0, 5)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    expect(res.some((o) => o.name === 'Italian Game')).toBe(true);
  });
  it('accepts numbered and lowercase moves', () => {
    expect(searchOpenings(ix, '1.e4 e5 2.nf3').length).toBeGreaterThan(0);
    expect(normalizeSanWord('nf3')).toBe('Nf3');
    expect(normalizeSanWord('bc4')).toBe('Bc4');
    expect(normalizeSanWord('b4')).toBe('b4');
    expect(normalizeSanWord('o-o')).toBe('O-O');
    expect(normalizeSanWord('bxc3')).toBe('bxc3');
    expect(normalizeSanWord('bxc6')).toBe('bxc6');
    expect(normalizeSanWord('bb5')).toBe('Bb5');
    expect(normalizeSanWord('bdxe5')).toBe('Bdxe5');
  });
  it('returns nothing for empty or unmatched queries', () => {
    expect(searchOpenings(ix, '   ')).toEqual([]);
    expect(searchOpenings(ix, 'zzzzqqq')).toEqual([]);
  });
  it('filterByName ANDs words and keeps all for an empty filter', () => {
    const list = file.openings.filter((o) => o.eco.startsWith('B'));
    expect(filterByName(list, '')).toHaveLength(list.length);
    expect(filterByName(list, 'sicilian dragon').every((o) => /sicilian/i.test(o.name) && /dragon/i.test(o.name))).toBe(true);
  });
});
