import { Chess } from 'chess.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Well-known opening lines (SAN) for course thumbnails. Anything not listed shows a position from COVER_FEN or the start. */
const COVER_LINE: Record<string, string> = {
  'italian-game': 'e4 e5 Nf3 Nc6 Bc4',
  'london-system': 'd4 d5 Bf4',
  'queens-gambit': 'd4 d5 c4',
  'ruy-lopez': 'e4 e5 Nf3 Nc6 Bb5',
  'sicilian-defence': 'e4 c5',
};

/** Back-rank mate in one (Ra8#): a standard textbook position. */
const COVER_FEN: Record<string, string> = {
  'checkmate-patterns': '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
};

/** FEN for a course thumbnail. Always legal: a bad line falls back to the start position. */
export function coverFen(slug: string): string {
  const fen = COVER_FEN[slug];
  if (fen) return fen;
  const line = COVER_LINE[slug];
  if (!line) return START;
  try {
    const chess = new Chess();
    for (const san of line.split(' ')) chess.move(san);
    return chess.fen();
  } catch {
    return START;
  }
}
