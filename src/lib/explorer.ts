import { Chess } from 'chess.js';
import type { LookupResult, Opening, OpeningIndex } from './openings';

/** Most moves that go into the link (and are read back from one). The board itself has no limit. */
export const MAX_PLIES = 80;
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MAX_INPUT_CHARS = 20000;

const SAN_SHAPE = /^([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O(-O)?)$/;

export interface Ply {
  san: string;
  uci: string;
  from: string;
  to: string;
  /** Position after this move. */
  fen: string;
}

export function stripCheck(san: string): string {
  return san.replace(/[+#]+$/, '');
}

/** Plays SAN moves from `startFen`, stopping at the first illegal one. */
export function replay(startFen: string, sans: readonly string[]): Ply[] {
  let chess: Chess;
  try {
    chess = new Chess(startFen);
  } catch {
    return [];
  }
  const out: Ply[] = [];
  for (const san of sans) {
    try {
      const mv = chess.move(san);
      out.push({ san: mv.san, uci: `${mv.from}${mv.to}${mv.promotion ?? ''}`, from: mv.from, to: mv.to, fen: chess.fen() });
    } catch {
      break;
    }
  }
  return out;
}

/** Turns "1. e4 e5 2. Nf3" into ["e4", "e5", "Nf3"]. */
export function sansOfPgn(pgn: string): string[] {
  return pgn
    .replace(/\d+\s*\.(\.\.)?/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map(stripCheck);
}

/**
 * Reads the `moves` link parameter ("e4,e5,Nf3"): keeps only well-formed SAN
 * tokens, stops at the first bad one, caps the length, then keeps only the
 * legal prefix. Never throws.
 */
export function sanitizeMoves(raw: string | null): string[] {
  if (!raw) return [];
  const tokens: string[] = [];
  for (const part of raw.slice(0, 1000).split(/[,\s]+/)) {
    if (part === '') continue;
    const token = stripCheck(part);
    if (token.length > 8 || !SAN_SHAPE.test(token) || tokens.length >= MAX_PLIES) break;
    tokens.push(token);
  }
  return replay(START_FEN, tokens).map((p) => stripCheck(p.san));
}

export type LoadResult = { ok: true; startFen: string; sans: string[] } | { ok: false; reason: 'empty' | 'tooLong' | 'invalid' };

function tryFen(text: string): string | null {
  const fields = text.split(/\s+/);
  if (fields.length < 4 || fields.length > 6 || !text.includes('/')) return null;
  const full = [...fields, ...['0', '1'].slice(fields.length - 4)].join(' ');
  try {
    return new Chess(full).fen();
  } catch {
    return null;
  }
}

/** Parses pasted text as a FEN position or a PGN game. */
export function parseLoadInput(input: string): LoadResult {
  const text = input.trim();
  if (text === '') return { ok: false, reason: 'empty' };
  if (text.length > MAX_INPUT_CHARS) return { ok: false, reason: 'tooLong' };
  const fen = tryFen(text.replace(/\s+/g, ' '));
  if (fen !== null) return { ok: true, startFen: fen, sans: [] };
  try {
    const chess = new Chess();
    chess.loadPgn(text);
    const sans = chess.history();
    if (sans.length === 0) return { ok: false, reason: 'invalid' };
    const header = chess.getHeaders().FEN;
    return { ok: true, startFen: header ? new Chess(header).fen() : START_FEN, sans };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** PGN text for a line (with SetUp/FEN headers when it does not start from the normal position). */
export function buildPgn(startFen: string, sans: readonly string[]): string {
  const chess = new Chess(startFen);
  for (const san of sans) chess.move(san);
  return chess.pgn();
}

/** Lowercase "nf3" / "bc4" / "o-o" to proper SAN; other words are returned unchanged. */
export function normalizeSanWord(word: string): string {
  const w = stripCheck(word.replace(/^\d+\.+/, ''));
  if (/^o-o(-o)?$/i.test(w)) return w.toUpperCase();
  // "bxc3" stays a pawn capture; "bc4" and "bdxe5" are bishop moves.
  if (/^[nrqk][a-h1-8x]/.test(w) || /^b[a-h][1-8]/.test(w) || /^b[a-h1-8][a-h]/.test(w) || /^b[a-h1-8]x[a-h][1-8]/.test(w)) return `${w.charAt(0).toUpperCase()}${w.slice(1)}`;
  return w;
}

export interface SearchIndex {
  readonly openings: readonly Opening[];
  readonly names: readonly string[];
  readonly lines: readonly (readonly string[])[];
}

export function buildSearchIndex(openings: readonly Opening[]): SearchIndex {
  return {
    openings,
    names: openings.map((o) => o.name.toLowerCase()),
    lines: openings.map((o) => sansOfPgn(o.pgn)),
  };
}

/**
 * Every word must match: a word of the name, the start of the ECO code, or a
 * move of the line. When the whole query is a move sequence ("e4 c5 Nf3"),
 * openings that start with exactly that sequence come first.
 */
export function searchOpenings(ix: SearchIndex, query: string): Opening[] {
  const words = query.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const sanWords = words.map(normalizeSanWord);
  const isSan = sanWords.map((w) => SAN_SHAPE.test(w));
  const lower = words.map((w) => w.toLowerCase());
  const exact: Opening[] = [];
  const rest: Opening[] = [];
  const sequence = isSan.every(Boolean);
  ix.openings.forEach((o, i) => {
    const line = ix.lines[i] ?? [];
    const name = ix.names[i] ?? '';
    const eco = o.eco.toLowerCase();
    if (sequence && sanWords.length <= line.length && sanWords.every((w, k) => line[k] === w)) {
      exact.push(o);
      return;
    }
    const all = lower.every((w, k) => name.includes(w) || eco.startsWith(w) || (isSan[k] === true && line.includes(sanWords[k] ?? '')));
    if (all) rest.push(o);
  });
  return [...exact, ...rest];
}

/** Name filter used inside the ECO lists: every word must appear in the name or code. */
export function filterByName(openings: readonly Opening[], filter: string): Opening[] {
  const words = filter.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [...openings];
  return openings.filter((o) => {
    const name = o.name.toLowerCase();
    const eco = o.eco.toLowerCase();
    return words.every((w) => name.includes(w) || eco.startsWith(w));
  });
}

/** A line on the board: where it starts, the moves, and how many of them are shown. */
export interface LineState {
  startFen: string;
  sans: string[];
  /** Number of moves currently shown on the board. */
  cursor: number;
}

export type MoveInput = string | { from: string; to: string; promotion?: string };

/**
 * Plays `move` at the cursor of `line`. Playing the move that is already next keeps the
 * rest of the line (so Redo still works); any other move cuts the line there.
 * Returns null when the move is illegal.
 */
export function playOnLine(line: LineState, fen: string, move: MoveInput): { line: LineState; san: string } | null {
  let san: string;
  try {
    san = new Chess(fen).move(move).san;
  } catch {
    return null;
  }
  const upcoming = line.sans[line.cursor];
  const sans = upcoming !== undefined && stripCheck(upcoming) === stripCheck(san) ? line.sans : [...line.sans.slice(0, line.cursor), san];
  return { line: { ...line, sans, cursor: line.cursor + 1 }, san };
}

/** The named opening for the shown position. `ply` is the move at which the name was last given. */
export function findOpening(
  index: OpeningIndex,
  line: LineState,
  shown: readonly Ply[],
  fen: string,
): LookupResult {
  if (line.startFen === START_FEN) return index.lookup(shown.map((p) => p.uci));
  return { opening: index.lookupFen(fen), ply: line.cursor };
}

/** True when keyboard shortcuts must not fire: typing in a field, or focus is on the board. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.closest('[role="application"]') !== null;
}
