import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board, { type PromotionPiece } from '../components/Board';
import Button from '../components/Button';
import LoadBox from '../components/LoadBox';
import MoveList from '../components/MoveList';
import { usePresentEffects } from '../components/lesson/shared';
import SoundToggle from '../components/SoundToggle';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import { getOpeningIndex } from '../lib/data';
import { buildPgn, findOpening, isTypingTarget, playOnLine, replay, START_FEN, type LineState, type MoveInput } from '../lib/explorer';
import type { OpeningIndex } from '../lib/openings';
import { playMoveSound } from '../lib/sound';
import { loadNotes, MAX_NOTES_CHARS, saveNotes } from '../lib/teacher-notes';

const NORMAL_BOARD = 'var(--kl-normal-board)';
const PRESENT_BOARD = 'var(--kl-teacher-board)';
const MAX_BOOK_MOVES_PRESENT = 4;


type Copy = 'fen' | 'pgn' | 'failed' | null;

export default function Teacher() {
  const data = useLoad(getOpeningIndex);
  return <Analysis index={data.status === 'ready' ? data.data : null} openingsFailed={data.status === 'error'} />;
}

function Analysis({ index, openingsFailed }: { index: OpeningIndex | null; openingsFailed: boolean }) {
  const t = m().analysis;
  const o = m().openings;
  const [line, setLine] = useState<LineState>({ startFen: START_FEN, sans: [], cursor: 0 });
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState<Copy>(null);
  const [notes, setNotes] = useState(loadNotes);
  const [present, setPresent] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const wasPresent = useRef(false);

  usePresentEffects(present);

  const plies = useMemo(() => replay(line.startFen, line.sans), [line.startFen, line.sans]);
  const shown = useMemo(() => plies.slice(0, line.cursor), [plies, line.cursor]);
  const last = shown[shown.length - 1];
  const fen = last ? last.fen : line.startFen;
  const turn = useMemo(() => new Chess(fen).turn(), [fen]);
  const found = useMemo(() => (index ? findOpening(index, line, shown, fen) : null), [index, line, shown, fen]);
  const continuations = useMemo(() => (index ? index.continuations(fen) : []), [index, fen]);

  useEffect(() => {
    if (wasPresent.current && !present) heading.current?.focus();
    wasPresent.current = present;
  }, [present]);

  /** Every change of position goes through here. */
  const commit = useCallback((next: LineState) => {
    setLine(next);
    setCopied(null);
  }, [setLine, setCopied]);

  const playMove = (move: MoveInput): boolean => {
    const res = playOnLine(line, fen, move);
    if (!res) return false;
    commit(res.line);
    playMoveSound(res.san);
    return true;
  };

  const onBoardMove = (from: string, to: string, promotion?: PromotionPiece): boolean => playMove(promotion ? { from, to, promotion } : { from, to });

  const undo = useCallback(() => {
    if (line.cursor > 0) commit({ ...line, cursor: line.cursor - 1 });
  }, [line, commit]);

  const redo = useCallback(() => {
    const next = plies[line.cursor];
    if (!next) return;
    commit({ ...line, cursor: line.cursor + 1 });
    playMoveSound(next.san);
  }, [line, plies, commit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (present) setPresent(false);
        return;
      }
      if (e.shiftKey || isTypingTarget(e.target)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        undo();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        redo();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setPresent((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, present]);

  const copy = async (kind: 'fen' | 'pgn'): Promise<void> => {
    try {
      await navigator.clipboard.writeText(kind === 'fen' ? fen : buildPgn(line.startFen, line.sans.slice(0, line.cursor)));
      setCopied(kind);
    } catch {
      setCopied('failed');
    }
  };

  const big = present;

  const board = (
    <Board
      fen={fen}
      orientation={flipped ? 'black' : 'white'}
      interactive
      keyMarks
      size={present ? PRESENT_BOARD : NORMAL_BOARD}
      onMove={onBoardMove}
      lastMove={last ? { from: last.from, to: last.to, san: last.san } : undefined}
      ariaLabel={t.boardLabel}
    />
  );

  const openingName = found?.opening?.name;
  const openingInfo = (
    <section aria-labelledby="an-opening">
      <h2 id="an-opening" className="sr-only">{o.currentOpening}</h2>
      <p role="status" aria-live="polite" className={`${big ? 'text-3xl' : 'text-xl'} font-extrabold leading-tight`}>
        {openingName ?? (shown.length === 0 ? o.startPosition : o.noOpening)}
      </p>
      {found?.opening ? (
        <p className="mt-1 text-xl font-bold">
          {found.ply < line.cursor ? fmt(o.ecoNamedAt, { eco: found.opening.eco, n: Math.ceil(found.ply / 2) }) : fmt(o.ecoCode, { eco: found.opening.eco })}
        </p>
      ) : null}
      <p className="mt-1 text-xl font-bold">{turn === 'w' ? o.whiteToMove : o.blackToMove}</p>
      {openingsFailed ? <p className="text-base text-muted">{t.openingUnavailable}</p> : null}
    </section>
  );

  const bookMoves = (
    <section aria-labelledby="an-next">
      <h2 id="an-next" className="text-lg font-bold">{o.nextMoves}</h2>
      {continuations.length === 0 ? (
        <p className="mt-1 text-lg">{o.noContinuations}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {(present ? continuations.slice(0, MAX_BOOK_MOVES_PRESENT) : continuations).map((c) => {
            const result = c.name ? fmt(o.leadsTo, { name: c.name }) : o.noName;
            return (
              <li key={c.uci}>
                <button
                  type="button"
                  aria-label={fmt(o.continuationLabel, { san: c.san, result })}
                  onClick={() => playMove({ from: c.uci.slice(0, 2), to: c.uci.slice(2, 4), promotion: c.uci.slice(4, 5) || undefined })}
                  title={result}
                  className="min-h-10 min-w-11 rounded-control border-2 border-line bg-bg px-2 text-base font-extrabold hover:border-amber"
                >
                  {c.san}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const btn = 'min-h-10 px-3 text-base';
  const buttons = (
    <>
      <Button variant="secondary" className={btn} onClick={undo} aria-disabled={line.cursor === 0}>{o.undo}</Button>
      <Button variant="secondary" className={btn} onClick={redo} aria-disabled={line.cursor >= plies.length}>{o.redo}</Button>
      <Button variant="secondary" className={btn} onClick={() => commit({ startFen: START_FEN, sans: [], cursor: 0 })}>{o.reset}</Button>
      <Button variant="secondary" className={btn} onClick={() => setFlipped((f) => !f)}>{o.flip}</Button>
    </>
  );

  const notesBox = (
    <section aria-labelledby="an-notes">
      <h2 id="an-notes" className={present ? 'sr-only' : 'text-xl font-bold'}>{t.notesTitle}</h2>
      <label htmlFor="an-notes-text" className="sr-only">{t.notesLabel}</label>
      <textarea
        id="an-notes-text"
        value={notes}
        rows={present ? 2 : 3}
        maxLength={MAX_NOTES_CHARS}
        placeholder={t.notesPlaceholder}
        onChange={(e) => {
          setNotes(e.target.value);
          saveNotes(e.target.value);
        }}
        className="mt-1 w-full rounded-lg border-2 border-line bg-bg p-2 text-lg"
      />
    </section>
  );

  const presentToggle = (
    <Button variant={present ? 'primary' : 'secondary'} aria-pressed={present} onClick={() => setPresent((p) => !p)}>
      {present ? t.exitPresent : t.present}
    </Button>
  );

  if (present) {
    return (
      <div
        role="region"
        aria-label={t.presentRegion}
        className="fixed inset-0 z-40 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-6 overflow-auto bg-bg p-4 portrait:grid-cols-1 portrait:justify-items-center"
      >
        <div>{board}</div>
        <div className="w-full max-w-3xl space-y-2 overflow-y-auto rounded-2xl landscape:max-h-[calc(100dvh-2rem)] portrait:max-h-[calc(100dvh_-_var(--kl-teacher-board)_-_3.5rem)] border-2 border-line bg-surface p-4">
          <h1 ref={heading} tabIndex={-1} className="sr-only focus:outline-none">{t.title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            {presentToggle}
            <SoundToggle className="hover:bg-line" />
            <p className="text-base text-muted">{t.presentHelp}</p>
          </div>
          {openingInfo}
          <div className="flex flex-wrap gap-2">{buttons}</div>
          {bookMoves}
          {notesBox}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[min(var(--kl-main-h),46%)_minmax(0,1fr)] xl:grid-cols-[min(var(--kl-main-h),52%)_minmax(0,1fr)] lg:items-start">
        <div>{board}</div>
        <div className="flex min-h-0 flex-col gap-2 rounded-2xl border-2 border-line bg-surface p-3 lg:max-h-full lg:overflow-hidden">
          <div className="flex flex-wrap items-baseline gap-x-4">
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold focus:outline-none">{t.title}</h1>
            {openingInfo}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {buttons}
            <Button variant="secondary" className={btn} onClick={() => void copy('fen')}>{t.copyFen}</Button>
            <Button variant="secondary" className={btn} onClick={() => void copy('pgn')} disabled={line.cursor === 0 && line.startFen === START_FEN}>{t.copyPgn}</Button>
            {presentToggle}
            <span role="status" className="text-sm font-bold">
              {copied === 'fen' ? t.copiedFen : copied === 'pgn' ? t.copiedPgn : copied === 'failed' ? t.copyFailed : ''}
            </span>
          </div>
          <div className="grid min-h-0 gap-3 lg:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <section aria-labelledby="an-moves">
                <h2 id="an-moves" className="sr-only">{o.movesHeading}</h2>
                <MoveList plies={plies} cursor={line.cursor} onJump={(cursor) => commit({ ...line, cursor })} />
              </section>
              {notesBox}
            </div>
            <div className="min-w-0 space-y-2">
              {bookMoves}
              <LoadBox showShareNote={false} onLoad={(startFen, sans) => commit({ startFen, sans, cursor: sans.length })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
