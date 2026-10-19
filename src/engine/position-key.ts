/** Identity of a position for repetition checks: placement, side to move, castling and en passant (no move counters). */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}
