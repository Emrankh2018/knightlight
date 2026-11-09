import { Chess, type PieceSymbol } from 'chess.js';

const NAMES: Record<PieceSymbol, string> = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
const ORDER: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p'];

/** Short text summary of a position for screen readers. */
export function describePosition(fen: string, kingless = false): string {
  let chess: Chess;
  try {
    chess = new Chess(fen, { skipValidation: kingless });
  } catch {
    return 'Invalid position.';
  }
  const lists: Record<'w' | 'b', Map<PieceSymbol, string[]>> = { w: new Map(), b: new Map() };
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const bucket = lists[sq.color];
      bucket.set(sq.type, [...(bucket.get(sq.type) ?? []), sq.square]);
    }
  }
  const side = (c: 'w' | 'b'): string =>
    ORDER.flatMap((t) => {
      const squares = lists[c].get(t);
      return squares && squares.length > 0 ? [`${NAMES[t]}${squares.length > 1 ? 's' : ''} ${squares.join(', ')}`] : [];
    }).join(', ');
  const turn = chess.turn() === 'w' ? 'White' : 'Black';
  return `${turn} to move. White: ${side('w')}. Black: ${side('b')}.`;
}
