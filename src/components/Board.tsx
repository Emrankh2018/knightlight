import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type Ref } from 'react';
import { Chess, type Move, type PieceSymbol } from 'chess.js';
import { Chessboard, type Arrow as BoardArrow, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard';
import { fmt, m } from '../i18n';
import { toneOfModifiers } from '../lib/annotations';
import { describePosition } from '../lib/describe';
import type { Arrow, Highlight } from '../lib/content/types';
import { BOARD_THEMES, effectiveBoardTheme, useIsDark, useSettings } from '../store/settings';

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
const CHECK_GLOW = 'radial-gradient(circle, rgba(228, 87, 46, 0.95) 0%, rgba(228, 87, 46, 0.55) 45%, rgba(228, 87, 46, 0) 72%)';
const FILES = 'abcdefgh';
/** Size and weight only: the colour comes from the palette (at least 4.5:1 on each square colour). */
const NOTATION: CSSProperties = { fontSize: '0.8rem', fontWeight: 800 };

/** react-chessboard makes every piece and square tabbable; the wrapper must be the only tab stop. */
function removeInnerTabStops(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>('[tabindex="0"]')) {
    if (el !== root) el.tabIndex = -1;
  }
}

/** Coach drawing tools: right-drag draws an arrow, right-click marks a square; in marking mode the left button does the same. Keys: H marks the cursor square, A starts and finishes an arrow. */
export interface BoardAnnotate {
  /** Marking mode: clicks and drags mark the board instead of moving pieces. */
  marking: boolean;
  onArrow: (from: string, to: string, tone: Tone) => void;
  onSquare: (square: string, tone: Tone) => void;
}

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
  annotate?: BoardAnnotate;
  /** Board width: a number of px (capped by the container) or a CSS length such as `min(100%, calc(100dvh - 8rem))`. Default: fills the container (max about 85vh). */
  size?: number | string;
  /** Ref to the focusable board element, so callers can move focus to it. */
  ref?: Ref<HTMLDivElement>;
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
  annotate,
  size,
  ref,
  ariaLabel,
}: BoardProps) {
  const inner = useRef<HTMLDivElement>(null);
  const boardTheme = useSettings((s) => s.boardTheme);
  const dark = useIsDark();
  const colors = BOARD_THEMES[effectiveBoardTheme(boardTheme, dark)];
  const chess = useMemo(() => safeChess(fen), [fen]);
  const [sel, setSel] = useState<{ fen: string; square: string } | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [arrowFrom, setArrowFrom] = useState<string | null>(null);
  const drag = useRef<{ square: string; button: number } | null>(null);
  /** Pieces can be moved unless the board is in marking mode. */
  const canMove = interactive && !annotate?.marking;
  /** Where the keyboard cursor starts: the first piece of the side to move, scanning from the player's own back rank. */
  const startSquare = useMemo(() => {
    if (!chess) return 'e2';
    const rows = chess.board();
    const ordered = orientation === 'white' ? [...rows].reverse() : rows;
    for (const row of ordered) {
      for (const cell of row) {
        if (cell && cell.color === chess.turn()) return cell.square;
      }
    }
    return 'e2';
  }, [chess, orientation]);
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
    if (!canMove || !chess) return;
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
    if (!canMove || !targetSquare || targetSquare === sourceSquare) return false;
    return tryMove(sourceSquare, targetSquare);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (!interactive) return;
    const flip = orientation === 'black' ? -1 : 1;
    const here = cursor ?? startSquare;
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
        if (annotate?.marking) annotate.onSquare(here, 'G');
        else clickSquare(here, ownPieceAt(here));
        return;
      case 'h':
      case 'H':
        if (!annotate || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        setCursor(here);
        annotate.onSquare(here, e.shiftKey ? 'R' : 'G');
        return;
      case 'a':
      case 'A':
        if (!annotate || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        setCursor(here);
        if (arrowFrom === null) setArrowFrom(here);
        else {
          if (arrowFrom !== here) annotate.onArrow(arrowFrom, here, e.shiftKey ? 'R' : 'G');
          setArrowFrom(null);
        }
        return;
      case 'Escape':
        setSel(null);
        setArrowFrom(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    setCursor(next);
  };

  useEffect(() => {
    const root = inner.current;
    if (!root) return;
    removeInnerTabStops(root);
    const observer = new MutationObserver(() => removeInnerTabStops(root));
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex'] });
    return () => observer.disconnect();
  }, []);

  const squareStyles = useMemo(() => {
    const out: Record<string, CSSProperties> = {};
    const add = (sq: string, css: CSSProperties): void => {
      out[sq] = { ...out[sq], ...css };
    };
    if (chess?.inCheck()) {
      for (const row of chess.board()) {
        for (const cell of row) {
          if (cell && cell.type === 'k' && cell.color === chess.turn()) add(cell.square, { backgroundImage: CHECK_GLOW });
        }
      }
    }
    if (lastMove) {
      add(lastMove.from, { backgroundColor: LAST_MOVE_FILL });
      add(lastMove.to, { backgroundColor: LAST_MOVE_FILL });
    }
    for (const h of highlights) add(h.square, { backgroundColor: FILL[h.color] });
    if (selected) add(selected, { backgroundColor: SELECTED_FILL });
    for (const t of targets) add(t.to, { backgroundImage: t.captured ? RING : DOT });
    if (arrowFrom) add(arrowFrom, { boxShadow: 'inset 0 0 0 4px #3BB273' });
    if (cursor && interactive) add(cursor, { boxShadow: 'inset 0 0 0 3px #0F3D3E, inset 0 0 0 6px #FFFFFF' });
    return out;
  }, [chess, lastMove, highlights, selected, targets, cursor, interactive, arrowFrom]);

  const onSquareMouseDown = ({ square }: SquareHandlerArgs, e: MouseEvent): void => {
    drag.current = annotate && (e.button === 2 || (annotate.marking && e.button === 0)) ? { square, button: e.button } : null;
  };

  const onSquareMouseUp = ({ square }: SquareHandlerArgs, e: MouseEvent): void => {
    const start = drag.current;
    drag.current = null;
    if (!annotate || !start || start.button !== e.button) return;
    const tone = toneOfModifiers(e);
    if (start.square === square) annotate.onSquare(square, tone);
    else annotate.onArrow(start.square, square, tone);
  };

  const boardArrows: BoardArrow[] = arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: TONES[a.color] }));
  const summary = useMemo(() => describePosition(fen), [fen]);
  const reduceMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      ref={ref}
      dir="ltr"
      role="application"
      aria-label={`${ariaLabel}. ${summary}`}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={onKeyDown}
      onBlur={() => {
        setCursor(null);
        setArrowFrom(null);
      }}
      onContextMenu={annotate ? (e) => e.preventDefault() : undefined}
      className="mx-auto rounded-md focus-visible:outline-offset-[14px]"
      style={{ width: typeof size === 'string' ? size : `min(100%, ${size ? `${size}px` : '85vh'})` }}
    >
      <div ref={inner} className="kl-board-frame">
      <Chessboard
        options={{
          id: 'kl-board',
          position: fen,
          boardOrientation: orientation,
          allowDragging: canMove,
          allowDrawingArrows: false,
          showAnimations: !reduceMotion,
          animationDurationInMs: 200,
          arrows: boardArrows,
          lightSquareStyle: { backgroundColor: colors.light },
          darkSquareStyle: { backgroundColor: colors.dark },
          squareStyles,
          lightSquareNotationStyle: { ...NOTATION, color: colors.onLight },
          darkSquareNotationStyle: { ...NOTATION, color: colors.onDark },
          alphaNotationStyle: NOTATION,
          numericNotationStyle: NOTATION,
          canDragPiece: ({ piece }) => canMove && chess !== null && piece.pieceType.startsWith(chess.turn()),
          onPieceDrag: ({ square }) => {
            if (canMove && square) setSel({ fen, square });
          },
          onPieceDrop,
          onSquareClick,
          onSquareMouseDown,
          onSquareMouseUp,
        }}
      />
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {lastMove?.san ? fmt(m().board.lastMove, { san: lastMove.san }) : ''}
      </div>
    </div>
  );
}
