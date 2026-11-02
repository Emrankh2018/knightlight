import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { fmt, m } from '../../i18n';
import { BOARD_THEMES, effectiveBoardTheme, useIsDark, useSettings } from '../../store/settings';

const FILES = 'abcdefgh';
const SQUARES = Array.from({ length: 64 }, (_, i) => `${FILES[i % 8]}${8 - Math.floor(i / 8)}`);

export interface SelectionPiece { glyph: string; name: string; color?: 'w' | 'b' }

/** A square-selection board, rather than a full-chess move input. One tab stop, with spatial arrow navigation. */
export default function SelectionBoard({ label, pieces, treasures = [], exit, hint, onSelect, disabled = false, initialSquare = 'a1', orientation = 'white' }: {
  label: string;
  pieces: Readonly<Record<string, SelectionPiece>>;
  treasures?: readonly string[];
  exit?: string;
  hint?: string | null;
  onSelect: (square: string) => void;
  disabled?: boolean;
  initialSquare?: string;
  orientation?: 'white' | 'black';
}) {
  const [cursor, setCursor] = useState(initialSquare);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const theme = useSettings((s) => s.boardTheme);
  const dark = useIsDark();
  const colors = BOARD_THEMES[effectiveBoardTheme(theme, dark)];
  useEffect(() => { buttons.current.get(initialSquare)?.focus(); }, [initialSquare]);
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, square: string): void => {
    const shifts: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const shift = shifts[event.key];
    if (!shift) return;
    event.preventDefault();
    const direction = orientation === 'white' ? 1 : -1;
    const file = Math.min(7, Math.max(0, FILES.indexOf(square[0] ?? '') + shift[0] * direction));
    const rank = Math.min(8, Math.max(1, Number(square[1]) + shift[1] * direction));
    const next = `${FILES[file]}${rank}`;
    setCursor(next);
    buttons.current.get(next)?.focus();
  };
  const squares = orientation === 'white' ? SQUARES : [...SQUARES].reverse();
  return <div><div role="group" aria-label={label} dir="ltr" className="kl-selection-board kl-board-frame">{squares.map((square, i) => {
    const light = (i % 8 + Math.floor(i / 8)) % 2 === 0;
    const piece = pieces[square];
    const gem = treasures.includes(square);
    const flag = square === exit;
    const description = [piece?.name, gem ? m().games.treasure : '', flag ? m().games.exit : '', square === hint ? m().games.targetMark : ''].filter(Boolean).join(', ') || m().games.empty;
    return <button key={square} type="button" ref={(el) => { if (el) buttons.current.set(square, el); else buttons.current.delete(square); }} tabIndex={cursor === square ? 0 : -1} aria-label={fmt(m().games.square, { square, piece: description })} aria-disabled={disabled} onFocus={() => setCursor(square)} onKeyDown={(event) => onKey(event, square)} onClick={() => { if (!disabled) onSelect(square); }} className={`kl-game-square ${square === hint ? 'kl-game-square-hint' : ''}`} style={{ backgroundColor: light ? colors.light : colors.dark, color: light ? colors.onLight : colors.onDark }}>
      <span className="kl-game-coordinate" aria-hidden="true">{square}</span>
      {piece ? <span className={`kl-game-piece ${piece.color === 'b' ? 'kl-game-piece-black' : ''}`} aria-hidden="true">{piece.glyph}</span> : null}
      {gem ? <span className="kl-game-gem" aria-hidden="true">{m().games.symbols.treasure}</span> : null}
      {flag ? <span className="kl-game-flag" aria-hidden="true">{m().games.symbols.exit}</span> : null}
    </button>;
  })}</div><p className="mt-3 text-sm text-muted">{m().games.keyboard}</p></div>;
}
