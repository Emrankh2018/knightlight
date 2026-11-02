import { Chess, type Color, type Square } from 'chess.js';

export const SETUP_PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as const;
export type SetupPiece = typeof SETUP_PIECES[number];
export const CASTLING_RIGHTS = ['K', 'Q', 'k', 'q'] as const;
export type CastlingRight = typeof CASTLING_RIGHTS[number];

export interface PositionDraft {
  pieces: Record<string, SetupPiece>;
  turn: Color;
  castling: string;
  enPassant: string;
  halfmove: number;
  fullmove: number;
}

export type PositionProblem = 'kings' | 'pawns' | 'adjacentKings' | 'opponentInCheck' | 'invalid';
export type PositionResult = { ok: true; fen: string } | { ok: false; problem: PositionProblem };

/** Drafts deliberately allow incomplete positions; chess rules apply only when using the position. */
export function draftFromFen(fen: string): PositionDraft {
  const chess = new Chess(fen);
  const pieces: Record<string, SetupPiece> = {};
  for (const rank of chess.board()) {
    for (const piece of rank) {
      if (piece) pieces[piece.square] = `${piece.color}${piece.type.toUpperCase()}` as SetupPiece;
    }
  }
  const fields = fen.split(' ');
  return { pieces, turn: chess.turn(), castling: fields[2] === '-' ? '' : fields[2] ?? '', enPassant: fields[3] ?? '-', halfmove: Number(fields[4]), fullmove: Number(fields[5]) };
}

export function availableCastling(pieces: Readonly<Record<string, SetupPiece>>): CastlingRight[] {
  return CASTLING_RIGHTS.filter((right) => {
    const white = right === right.toUpperCase();
    const rank = white ? '1' : '8';
    const color = white ? 'w' : 'b';
    const rookFile = right.toLowerCase() === 'k' ? 'h' : 'a';
    return pieces[`e${rank}`] === `${color}K` && pieces[`${rookFile}${rank}`] === `${color}R`;
  });
}

/** Placement is free; placing a king relocates the existing king of that color. */
export function placePiece(draft: PositionDraft, square: string, piece: SetupPiece | null, source?: string): PositionDraft {
  if (!/^[a-h][1-8]$/.test(square)) return draft;
  const pieces = { ...draft.pieces };
  if (source) delete pieces[source];
  if (piece?.endsWith('K')) {
    for (const [at, existing] of Object.entries(pieces)) if (existing === piece) delete pieces[at];
  }
  if (piece) pieces[square] = piece;
  else delete pieces[square];
  const available = availableCastling(pieces);
  return { ...draft, pieces, castling: CASTLING_RIGHTS.filter((right) => draft.castling.includes(right) && available.includes(right)).join(''), enPassant: '-', halfmove: 0 };
}

export function positionFen(draft: PositionDraft): string {
  const ranks: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (const file of 'abcdefgh') {
      const piece = draft.pieces[`${file}${rank}`];
      if (!piece) empty++;
      else {
        if (empty > 0) row += empty;
        empty = 0;
        row += piece[0] === 'w' ? piece[1] : piece[1]?.toLowerCase();
      }
    }
    if (empty > 0) row += empty;
    ranks.push(row);
  }
  const available = availableCastling(draft.pieces);
  const castling = CASTLING_RIGHTS.filter((right) => draft.castling.includes(right) && available.includes(right)).join('') || '-';
  return `${ranks.join('/')} ${draft.turn} ${castling} ${draft.enPassant} ${draft.halfmove} ${draft.fullmove}`;
}

export function validatePosition(draft: PositionDraft): PositionResult {
  const entries = Object.entries(draft.pieces);
  const white = entries.filter(([, p]) => p === 'wK');
  const black = entries.filter(([, p]) => p === 'bK');
  if (white.length !== 1 || black.length !== 1) return { ok: false, problem: 'kings' };
  if (entries.some(([square, piece]) => piece.endsWith('P') && (square[1] === '1' || square[1] === '8'))) return { ok: false, problem: 'pawns' };
  const whiteSquare = white[0]?.[0] ?? '';
  const blackSquare = black[0]?.[0] ?? '';
  if (Math.abs(whiteSquare.charCodeAt(0) - blackSquare.charCodeAt(0)) <= 1 && Math.abs(Number(whiteSquare[1]) - Number(blackSquare[1])) <= 1) return { ok: false, problem: 'adjacentKings' };
  try {
    const chess = new Chess(positionFen(draft));
    const opponentKing = (draft.turn === 'w' ? blackSquare : whiteSquare) as Square;
    if (chess.isAttacked(opponentKing, draft.turn)) return { ok: false, problem: 'opponentInCheck' };
    return { ok: true, fen: chess.fen() };
  } catch {
    return { ok: false, problem: 'invalid' };
  }
}
