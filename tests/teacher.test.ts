import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toggleArrow, toggleHighlight, toneOfModifiers } from '../src/lib/annotations';
import { findOpening, playOnLine, replay, START_FEN, type LineState } from '../src/lib/explorer';
import { OpeningIndex, type OpeningsFile, type PositionsFile } from '../src/lib/openings';
import { loadNotes, MAX_NOTES_CHARS, saveNotes } from '../src/lib/teacher-notes';

const empty: LineState = { startFen: START_FEN, sans: [], cursor: 0 };

describe('toggleArrow / toggleHighlight', () => {
  it('adds, removes and recolors', () => {
    const a = toggleArrow([], { from: 'e2', to: 'e4', color: 'G' });
    expect(a).toEqual([{ from: 'e2', to: 'e4', color: 'G' }]);
    expect(toggleArrow(a, { from: 'e2', to: 'e4', color: 'G' })).toEqual([]);
    expect(toggleArrow(a, { from: 'e2', to: 'e4', color: 'R' })).toEqual([{ from: 'e2', to: 'e4', color: 'R' }]);
    expect(toggleArrow(a, { from: 'e4', to: 'e2', color: 'G' })).toHaveLength(2);
  });
  it('toggles a square', () => {
    const h = toggleHighlight([], { square: 'd4', color: 'G' });
    expect(h).toHaveLength(1);
    expect(toggleHighlight(h, { square: 'd4', color: 'G' })).toEqual([]);
    expect(toggleHighlight(h, { square: 'd4', color: 'R' })).toEqual([{ square: 'd4', color: 'R' }]);
  });
  it('picks a tone from the modifier keys', () => {
    expect(toneOfModifiers({ shiftKey: false, altKey: false, ctrlKey: false })).toBe('G');
    expect(toneOfModifiers({ shiftKey: true, altKey: false, ctrlKey: false })).toBe('R');
    expect(toneOfModifiers({ shiftKey: false, altKey: true, ctrlKey: false })).toBe('Y');
  });
});

describe('playOnLine', () => {
  it('appends a legal move and rejects an illegal one', () => {
    const res = playOnLine(empty, START_FEN, { from: 'e2', to: 'e4' });
    expect(res?.san).toBe('e4');
    expect(res?.line).toMatchObject({ sans: ['e4'], cursor: 1 });
    expect(playOnLine(empty, START_FEN, { from: 'e2', to: 'e5' })).toBeNull();
    expect(playOnLine(empty, START_FEN, 'Qh5')).toBeNull();
  });
  it('keeps the rest of the line when the next move is replayed, and cuts it otherwise', () => {
    const line: LineState = { startFen: START_FEN, sans: ['e4', 'e5', 'Nf3'], cursor: 1 };
    const fen = replay(START_FEN, ['e4'])[0]?.fen ?? '';
    expect(playOnLine(line, fen, 'e5')?.line.sans).toEqual(['e4', 'e5', 'Nf3']);
    expect(playOnLine(line, fen, 'c5')?.line.sans).toEqual(['e4', 'c5']);
  });
});

describe('findOpening', () => {
  const dir = 'public/data/openings';
  const index = new OpeningIndex(
    JSON.parse(readFileSync(`${dir}/openings.json`, 'utf8')) as OpeningsFile,
    JSON.parse(readFileSync(`${dir}/positions.json`, 'utf8')) as PositionsFile,
  );
  it('names the Italian Game from a standard start', () => {
    const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'];
    const plies = replay(START_FEN, sans);
    const line: LineState = { startFen: START_FEN, sans, cursor: 5 };
    const found = findOpening(index, line, plies, plies[4]?.fen ?? '');
    expect(found.opening?.name).toContain('Italian Game');
  });
  it('looks the position up when the line starts from a loaded FEN', () => {
    const plies = replay(START_FEN, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    const fen = plies[4]?.fen ?? '';
    const line: LineState = { startFen: fen, sans: [], cursor: 0 };
    expect(findOpening(index, line, [], fen).opening?.name).toContain('Italian Game');
  });
});

describe('teacher notes', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('round-trips through sessionStorage and caps the length', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    expect(loadNotes()).toBe('');
    saveNotes('ask about the fork');
    expect(loadNotes()).toBe('ask about the fork');
    saveNotes('x'.repeat(MAX_NOTES_CHARS + 50));
    expect(loadNotes()).toHaveLength(MAX_NOTES_CHARS);
  });
  it('never throws when storage is blocked', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked });
    expect(loadNotes()).toBe('');
    expect(() => saveNotes('a')).not.toThrow();
  });
});
