import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { defaultPieces } from 'react-chessboard';
import { fmt, m } from '../i18n';
import { START_FEN } from '../lib/explorer';
import { availableCastling, CASTLING_RIGHTS, draftFromFen, placePiece, SETUP_PIECES, validatePosition, type PositionDraft, type PositionProblem, type SetupPiece } from '../lib/position-editor';
import { BOARD_THEMES, effectiveBoardTheme, useIsDark, useSettings } from '../store/settings';
import Button from './Button';
import Modal from './Modal';

interface Props {
  fen: string;
  orientation: 'white' | 'black';
  onApply: (fen: string) => void;
  onClose: () => void;
}

export default function PositionEditor({ fen, orientation, onApply, onClose }: Props) {
  const t = m().positionEditor;
  const [draft, setDraft] = useState(() => draftFromFen(fen));
  const [tool, setTool] = useState<SetupPiece | null>('wK');
  const [flipped, setFlipped] = useState(orientation === 'black');
  const [cursor, setCursor] = useState(orientation === 'black' ? 'h1' : 'a8');
  const [problem, setProblem] = useState<PositionProblem | null>(null);
  const drag = useRef<{ piece: SetupPiece; source?: string } | null>(null);
  const firstSquare = useRef<HTMLButtonElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const theme = useSettings((s) => s.boardTheme);
  const colors = BOARD_THEMES[effectiveBoardTheme(theme, useIsDark())];
  const files = flipped ? 'hgfedcba' : 'abcdefgh';
  const ranks = flipped ? '12345678' : '87654321';
  const squares = [...ranks].flatMap((rank) => [...files].map((file) => `${file}${rank}`));
  const pieceName = (piece: SetupPiece): string => fmt(t.piece, { color: piece[0] === 'w' ? t.white : t.black, piece: m().puzzles.pieces[piece[1]?.toLowerCase() ?? ''] ?? '' });
  const update = (next: PositionDraft): void => { setDraft(next); setProblem(null); };
  const paint = (square: string): void => update(placePiece(draft, square, tool));

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, square: string): void => {
    const index = squares.indexOf(square);
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -8 : event.key === 'ArrowDown' ? 8 : 0;
    if (step !== 0) {
      event.preventDefault();
      const next = squares[Math.max(0, Math.min(63, index + step))];
      if (next) { setCursor(next); board.current?.querySelector<HTMLButtonElement>(`[data-setup-square="${next}"]`)?.focus(); }
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      update(placePiece(draft, square, null));
    }
  };

  const startDrag = (event: DragEvent, piece: SetupPiece, source?: string): void => {
    drag.current = { piece, source };
    event.dataTransfer.effectAllowed = source ? 'move' : 'copy';
    event.dataTransfer.setData('text/plain', piece);
  };
  const drop = (event: DragEvent, square?: string): void => {
    event.preventDefault();
    event.stopPropagation();
    const item = drag.current;
    drag.current = null;
    if (!item) return;
    if (square) update(placePiece(draft, square, item.piece, item.source));
    else if (item.source) update(placePiece(draft, item.source, null));
  };
  const available = availableCastling(draft.pieces);

  return (
    <Modal title={t.title} description={t.help} initialFocus={firstSquare} onClose={onClose} wide>
      <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_18rem]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event)}>
        <div className="min-w-0 space-y-3">
          <div ref={board} role="group" aria-label={t.boardLabel} dir="ltr" className="mx-auto grid grid-cols-8 overflow-hidden rounded border-2 border-ink" style={{ width: 'min(100%, max(16rem, calc(100dvh - 15rem)))' }}>
            {squares.map((square) => {
              const piece = draft.pieces[square];
              const dark = ((square.charCodeAt(0) - 97) + Number(square[1])) % 2 === 1;
              const label = fmt(t.square, { square, piece: piece ? pieceName(piece) : t.empty });
              return (
                <button key={square} ref={square === squares[0] ? firstSquare : undefined} type="button" data-setup-square={square} aria-label={label} tabIndex={cursor === square ? 0 : -1}
                  draggable={piece !== undefined} onDragStart={(event) => piece && startDrag(event, piece, square)} onDragEnd={() => { drag.current = null; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, square)}
                  onClick={() => paint(square)} onContextMenu={(event) => { event.preventDefault(); update(placePiece(draft, square, null)); }} onKeyDown={(event) => onKey(event, square)} onFocus={() => setCursor(square)}
                  className="relative aspect-square min-w-0 focus-visible:z-10 focus-visible:outline-offset-[-4px]" style={{ backgroundColor: dark ? colors.dark : colors.light, color: dark ? colors.onDark : colors.onLight, outlineColor: dark ? colors.onDark : colors.onLight }}>
                  {piece ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 p-0.5">{defaultPieces[piece]?.()}</span> : null}
                  <span aria-hidden="true" className="pointer-events-none absolute bottom-0 start-0.5 text-[0.6rem] font-extrabold leading-none">{square}</span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted">{t.keys}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => update({ ...draftFromFen(START_FEN), pieces: {}, castling: '' })}>{t.clear}</Button>
            <Button variant="secondary" onClick={() => update(draftFromFen(START_FEN))}>{t.starting}</Button>
            <Button variant="secondary" onClick={() => setFlipped((value) => !value)}>{m().openings.flip}</Button>
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <fieldset>
            <legend className="mb-2 text-lg font-bold">{t.pieces}</legend>
            <div className="grid grid-cols-6 gap-1">
              {SETUP_PIECES.map((piece) => (
                <button key={piece} type="button" aria-label={pieceName(piece)} title={pieceName(piece)} aria-pressed={tool === piece} draggable onDragStart={(event) => startDrag(event, piece)} onDragEnd={() => { drag.current = null; }} onClick={() => setTool(piece)}
                  className="aspect-square min-h-11 min-w-11 rounded-control border-2 border-edge bg-cream p-0.5 aria-pressed:border-ink aria-pressed:bg-lamp aria-pressed:ring-2 aria-pressed:ring-amber">
                  <span aria-hidden="true" className="pointer-events-none block">{defaultPieces[piece]?.()}</span>
                </button>
              ))}
            </div>
            <Button variant="secondary" className="mt-2 w-full" aria-pressed={tool === null} onClick={() => setTool(null)}>{t.erase}</Button>
            <p role="status" className="mt-2 text-sm font-bold">{fmt(t.selected, { tool: tool ? pieceName(tool) : t.erase })}</p>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-lg font-bold">{t.turn}</legend>
            <div className="flex gap-2">
              <Button variant="secondary" aria-pressed={draft.turn === 'w'} onClick={() => update({ ...draft, turn: 'w', enPassant: '-' })}>{t.white}</Button>
              <Button variant="secondary" aria-pressed={draft.turn === 'b'} onClick={() => update({ ...draft, turn: 'b', enPassant: '-' })}>{t.black}</Button>
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-lg font-bold">{t.castling}</legend>
            <p className="text-sm text-muted">{t.castlingHelp}</p>
            <div className="grid grid-cols-2 gap-x-2">
              {CASTLING_RIGHTS.map((right) => (
                <label key={right} className="flex min-h-11 items-center gap-2 text-sm font-bold has-disabled:opacity-50">
                  <input type="checkbox" disabled={!available.includes(right)} checked={draft.castling.includes(right) && available.includes(right)} onChange={(event) => update({ ...draft, castling: CASTLING_RIGHTS.filter((value) => value === right ? event.target.checked : draft.castling.includes(value)).join('') })} className="size-5 accent-ink" />
                  {t.castlingRights[right]}
                </label>
              ))}
            </div>
          </fieldset>
          {problem ? <p role="alert" className="rounded-lg border-2 border-error p-2 text-base font-bold text-error">{t.problems[problem]}</p> : null}
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <Button onClick={() => { const result = validatePosition(draft); if (result.ok) onApply(result.fen); else setProblem(result.problem); }}>{t.apply}</Button>
            <Button variant="secondary" onClick={onClose}>{m().common.cancel}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
