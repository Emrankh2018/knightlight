import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Chess, type Move, type PieceSymbol } from 'chess.js';
import { Chessboard, type Arrow as BoardArrow, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard';
import { fmt, m } from '../i18n';
import { describePosition } from '../lib/describe';
import type { Arrow, Highlight } from '../lib/content/types';
import { BOARD_THEMES, useSettings } from '../store/settings';

export type PromotionPiece = Exclude<PieceSymbol, 'p' | 'k'>;
type Tone = Arrow['color'];

/** Translucent brand colors for the G/R/Y/B annotation letters. */
const TONES: Record<Tone, string> = {
  G: 'rgba(59, 178, 115, 0.8)',
  R: 'rgba(228, 87, 46, 0.8)',
  Y: 'rgba(242, 165, 65, 0.85)',
  B: 'rgba(31, 92, 93, 0.8)',
};
const FILL: Record<Tone, string> = {
  G: 'rgba(59, 178, 115, 0.45)',
  R: 'rgba(228, 87, 46, 0.45)',
  Y: 'rgba(242, 165, 65, 0.5)',
  B: 'rgba(31, 92, 93, 0.4)',
};
const LAST_MOVE_FILL = 'rgba(242, 165, 65, 0.4)';
const SELECTED_FILL = 'rgba(242, 165, 65, 0.7)';
const DOT = 'radial-gradient(circle, rgba(15, 61, 62, 0.45) 22%, transparent 24%)';
const RING = 'radial-gradient(circle, transparent 60%, rgba(15, 61, 62, 0.45) 62%)';
const FILES = 'abcdefgh';

export interface BoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  /**
   * Called with a move that is legal in chess.js for `fen`. Return true to accept it
   * (the caller then updates `fen`), false to reject it (the piece snaps back).
   */
  onMove?: (from: string, to: string, promotion?: PromotionPiece) => boolean;
  /** Pick the promotion piece. Without it, pawns promote to a queen. May resolve later; the drop is then rejected and `onMove` fires on resolution. */
  promotion?: (from: string, to: string) => PromotionPiece | null | Promise<PromotionPiece | null>;
  arrows?: readonly Arrow[];
  highlights?: readonly Highlight[];
  lastMove?: { from: string; to: string; san?: string };
  interactive?: boolean;
  /** Maximum width in px. By default the board fills its container (max height about 85vh). */
  size?: number;
  ariaLabel: string;
}

function safeChess(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

function moveSquare(square: string, dFile: number, dRank: number): string {
  const f = Math.min(7, Math.max(0, FILES.indexOf(square.charAt(0)) + dFile));
  const r = Math.min(8, Math.max(1, Number(square.charAt(1)) + dRank));
  return `${FILES.charAt(f)}${r}`;
}

export default function Board({
  fen,
  orientation = 'white',
  onMove,
  promotion,
  arrows = [],
  highlights = [],
  lastMove,
  interactive = false,
  size,
  ariaLabel,
}: BoardProps) {
  const boardTheme = useSettings((s) => s.boardTheme);
  const colors = BOARD_THEMES[boardTheme];
  const chess = useMemo(() => safeChess(fen), [fen]);
  const [sel, setSel] = useState<{ fen: string; square: string } | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const selected = sel && sel.fen === fen ? sel.square : null;

  const targets = useMemo<Move[]>(() => (chess && selected ? chess.moves({ square: selected as Move['from'], verbose: true }) : []), [chess, selected]);

  const tryMove = (from: string, to: string): boolean => {
    if (!chess || !onMove) return false;
    const candidates = chess.moves({ square: from as Move['from'], verbose: true }).filter((mv) => mv.to === to);
    if (candidates.length === 0) return false;
    const needsPromotion = candidates.some((mv) => mv.promotion !== undefined);
    if (!needsPromotion) return onMove(from, to);
    const chosen = promotion ? promotion(from, to) : 'q';
    if (chosen instanceof Promise) {
      void chosen.then((piece) => {
        if (piece) onMove(from, to, piece);
      });
      return false;
    }
    return chosen ? onMove(from, to, chosen) : false;
  };

  const clickSquare = (square: string, hasOwnPiece: boolean): void => {
    if (!interactive || !chess) return;
    if (selected && targets.some((t) => t.to === square)) {
      tryMove(selected, square);
      setSel(null);
      return;
    }
    if (hasOwnPiece && square !== selected) setSel({ fen, square });
    else setSel(null);
  };

  const ownPieceAt = (square: string): boolean => {
    if (!chess) return false;
    const p = chess.get(square as Move['from']);
    return p !== undefined && p !== null && p.color === chess.turn();
  };

  const onSquareClick = ({ square }: SquareHandlerArgs): void => {
    setCursor(square);
    clickSquare(square, ownPieceAt(square));
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    setSel(null);
    if (!interactive || !targetSquare || targetSquare === sourceSquare) return false;
    return tryMove(sourceSquare, targetSquare);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (!interactive) return;
    const flip = orientation === 'black' ? -1 : 1;
    const here = cursor ?? (orientation === 'white' ? 'e2' : 'e7');
    let next: string;
    switch (e.key) {
      case 'ArrowRight':
        next = moveSquare(here, flip, 0);
        break;
      case 'ArrowLeft':
        next = moveSquare(here, -flip, 0);
        break;
      case 'ArrowUp':
        next = moveSquare(here, 0, flip);
        break;
      case 'ArrowDown':
        next = moveSquare(here, 0, -flip);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        setCursor(here);
        clickSquare(here, ownPieceAt(here));
        return;
      case 'Escape':
        setSel(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    setCursor(next);
  };

  const squareStyles = useMemo(() => {
    const out: Record<string, CSSProperties> = {};
    const add = (sq: string, css: CSSProperties): void => {
      out[sq] = { ...out[sq], ...css };
    };
    if (lastMove) {
      add(lastMove.from, { backgroundColor: LAST_MOVE_FILL });
      add(lastMove.to, { backgroundColor: LAST_MOVE_FILL });
    }
    for (const h of highlights) add(h.square, { backgroundColor: FILL[h.color] });
    if (selected) add(selected, { backgroundColor: SELECTED_FILL });
    for (const t of targets) add(t.to, { backgroundImage: t.captured ? RING : DOT });
    if (cursor && interactive) add(cursor, { boxShadow: 'inset 0 0 0 4px #F2A541' });
    return out;
  }, [lastMove, highlights, selected, targets, cursor, interactive]);

  const boardArrows: BoardArrow[] = arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: TONES[a.color] }));
  const summary = useMemo(() => describePosition(fen), [fen]);
  const reduceMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      role="application"
      aria-label={`${ariaLabel}. ${summary}`}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={onKeyDown}
      onBlur={() => setCursor(null)}
      className="mx-auto rounded-md focus-visible:outline-offset-4"
      style={{ width: `min(100%, ${size ? `${size}px` : '85vh'})` }}
    >
      <Chessboard
        options={{
          id: 'kl-board',
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          allowDrawingArrows: false,
          showAnimations: !reduceMotion,
          animationDurationInMs: 200,
          arrows: boardArrows,
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
          squareStyles,
          canDragPiece: ({ piece }) => interactive && chess !== null && piece.pieceType.startsWith(chess.turn()),
          onPieceDrag: ({ square }) => {
            if (interactive && square) setSel({ fen, square });
          },
          onPieceDrop,
          onSquareClick,
        }}
      />
      <div role="status" aria-live="polite" className="sr-only">
        {lastMove?.san ? fmt(m().board.lastMove, { san: lastMove.san }) : ''}
      </div>
    </div>
  );
}
