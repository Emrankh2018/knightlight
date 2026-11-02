import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { START_FEN } from '../src/lib/explorer';
import { availableCastling, draftFromFen, placePiece, positionFen, validatePosition, type PositionDraft, type PositionProblem } from '../src/lib/position-editor';

const empty = (): PositionDraft => ({ ...draftFromFen(START_FEN), pieces: {}, castling: '' });
const kings = (): PositionDraft => ({ ...empty(), pieces: { e1: 'wK', e8: 'bK' } });

describe('position setup drafts', () => {
  it('round-trips the initial pieces, turn, castling and counters', () => {
    const draft = draftFromFen(START_FEN);
    expect(Object.keys(draft.pieces)).toHaveLength(32);
    expect(draft.pieces).toMatchObject({ a1: 'wR', e1: 'wK', d8: 'bQ', h7: 'bP' });
    expect(positionFen(draft)).toBe(START_FEN);
    expect(validatePosition(draft)).toEqual({ ok: true, fen: START_FEN });
  });

  it('allows an empty draft and free piece replacement without legal chess moves', () => {
    const original = empty();
    const placed = placePiece(original, 'd4', 'wQ');
    const moved = placePiece(placed, 'd7', 'wQ', 'd4');
    const replaced = placePiece(moved, 'd7', 'bN');
    expect(original.pieces).toEqual({});
    expect(moved.pieces).toEqual({ d7: 'wQ' });
    expect(replaced.pieces).toEqual({ d7: 'bN' });
    expect(placePiece(replaced, 'd7', null).pieces).toEqual({});
    expect(validatePosition(original)).toEqual({ ok: false, problem: 'kings' });
  });

  it('relocates a same-colour king instead of creating another one', () => {
    const draft = placePiece(kings(), 'c3', 'wK');
    expect(draft.pieces).toEqual({ c3: 'wK', e8: 'bK' });
    expect(validatePosition(draft).ok).toBe(true);
  });

  it('leaves the draft untouched for a non-board target', () => {
    const draft = kings();
    expect(placePiece(draft, 'i9', 'wQ')).toBe(draft);
  });

  it('clears obsolete en-passant and halfmove state when a piece changes', () => {
    const draft = { ...kings(), enPassant: 'd6', halfmove: 17, fullmove: 35 };
    const changed = placePiece(draft, 'c4', 'wP');
    expect(changed).toMatchObject({ enPassant: '-', halfmove: 0, fullmove: 35 });
    expect(draft).toMatchObject({ enPassant: 'd6', halfmove: 17 });
  });
});

describe('position setup castling', () => {
  it('only offers rights for a king and matching rook on their home squares', () => {
    expect(availableCastling(kings().pieces)).toEqual([]);
    expect(availableCastling({ ...kings().pieces, h1: 'wR', a8: 'bR' })).toEqual(['K', 'q']);
    expect(availableCastling({ e1: 'wK', h1: 'bR', e8: 'bK', a8: 'wR' })).toEqual([]);
  });

  it('removes rights when a rook moves and does not silently restore them', () => {
    const initial = draftFromFen(START_FEN);
    const moved = placePiece(initial, 'h3', 'wR', 'h1');
    const returned = placePiece(moved, 'h1', 'wR', 'h3');
    expect(moved.castling).toBe('Qkq');
    expect(returned.castling).toBe('Qkq');
    expect(positionFen(returned).split(' ')[2]).toBe('Qkq');
  });

  it('cannot serialize a claimed castling right without the matching pieces', () => {
    expect(positionFen({ ...kings(), castling: 'KQkq' }).split(' ')[2]).toBe('-');
    const castle = { ...kings(), pieces: { ...kings().pieces, h1: 'wR' as const }, castling: 'K' };
    const result = validatePosition(castle);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('valid castling setup rejected');
    expect(new Chess(result.fen).moves()).toContain('O-O');
  });
});

describe('position setup validation', () => {
  const invalidPositions: { pieces: PositionDraft['pieces']; problem: PositionProblem }[] = [
    { pieces: { e1: 'wK' }, problem: 'kings' },
    { pieces: { e1: 'wK', a1: 'wK', e8: 'bK' }, problem: 'kings' },
    { pieces: { e1: 'wK', e2: 'bK' }, problem: 'adjacentKings' },
    { pieces: { e1: 'wK', f2: 'bK' }, problem: 'adjacentKings' },
    { pieces: { e1: 'wK', e8: 'bK', a8: 'wP' }, problem: 'pawns' },
    { pieces: { e1: 'wK', e8: 'bK', a1: 'bP' }, problem: 'pawns' },
  ];
  it.each(invalidPositions)('rejects a $problem position without requiring the draft to be legal while editing', ({ pieces, problem }) => {
    expect(validatePosition({ ...empty(), pieces })).toEqual({ ok: false, problem });
  });

  it('rejects check against the king belonging to the side that just moved', () => {
    const draft: PositionDraft = { ...empty(), pieces: { a1: 'wK', e1: 'wR', e8: 'bK' } };
    expect(validatePosition(draft)).toEqual({ ok: false, problem: 'opponentInCheck' });
    const allowed = validatePosition({ ...draft, turn: 'b' });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) throw new Error('side-to-move check rejected');
    expect(new Chess(allowed.fen).inCheck()).toBe(true);
  });

  it('allows checkmate and stalemate teaching positions', () => {
    const mate = validatePosition(draftFromFen('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1'));
    const stale = validatePosition(draftFromFen('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1'));
    expect(mate.ok).toBe(true);
    expect(stale.ok).toBe(true);
    if (!mate.ok || !stale.ok) throw new Error('teaching end position rejected');
    expect(new Chess(mate.fen).isCheckmate()).toBe(true);
    expect(new Chess(stale.fen).isStalemate()).toBe(true);
  });

  it('retains a custom black-to-move start and its move number', () => {
    const fen = '4k3/8/8/8/3N4/8/8/4K3 b - - 0 35';
    expect(validatePosition(draftFromFen(fen))).toEqual({ ok: true, fen });
  });

  it('returns an invalid-position result when counters cannot form a FEN', () => {
    expect(validatePosition({ ...kings(), fullmove: 0 })).toEqual({ ok: false, problem: 'invalid' });
  });
});
