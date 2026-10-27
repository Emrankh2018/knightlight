import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import Board, { type PromotionPiece } from '../components/Board';
import Button from '../components/Button';
import LoadBox from '../components/LoadBox';
import MoveList from '../components/MoveList';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import { getOpeningIndex } from '../lib/data';
import {
  buildPgn,
  buildSearchIndex,
  findOpening,
  isTypingTarget,
  type LineState,
  MAX_PLIES,
  type MoveInput,
  playOnLine,
  replay,
  sanitizeMoves,
  sansOfPgn,
  searchOpenings,
  START_FEN,
  stripCheck,
  type SearchIndex,
} from '../lib/explorer';
import type { Opening, OpeningIndex } from '../lib/openings';
import { playMoveSound } from '../lib/sound';

const BOARD_WIDTH = 'var(--kl-normal-board)';
const MAX_SEARCH_RESULTS = 5;

export default function Openings() {
  const data = useLoad(getOpeningIndex);
  if (data.status === 'loading') return <p className="text-xl text-muted">{m().common.loading}</p>;
  if (data.status === 'error') return <p role="alert" className="text-xl font-bold text-coral">{m().openings.loadError}</p>;
  return <Explorer index={data.data} />;
}

function Explorer({ index }: { index: OpeningIndex }) {
  const t = m().openings;
  const [params, setParams] = useSearchParams();
  const [line, setLine] = useState<LineState>(() => {
    const sans = sanitizeMoves(params.get('moves'));
    return { startFen: START_FEN, sans, cursor: sans.length };
  });
  const [flipped, setFlipped] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const boardWrap = useRef<HTMLDivElement>(null);
  const nextHeading = useRef<HTMLHeadingElement>(null);
  /** `moves` as last seen in the address, and as last written by this page. A change that this page did not write is a new link. */
  const [seenMoves, setSeenMoves] = useState(() => params.get('moves'));
  const [writtenMoves, setWrittenMoves] = useState(() => params.get('moves'));
  const urlMoves = params.get('moves');
  if (urlMoves !== seenMoves) {
    setSeenMoves(urlMoves);
    if (urlMoves !== writtenMoves) {
      setWrittenMoves(urlMoves);
      const sans = sanitizeMoves(urlMoves);
      setLine({ startFen: START_FEN, sans, cursor: sans.length });
    }
  }

  const plies = useMemo(() => replay(line.startFen, line.sans), [line.startFen, line.sans]);
  const shown = useMemo(() => plies.slice(0, line.cursor), [plies, line.cursor]);
  const last = shown[shown.length - 1];
  const fen = last ? last.fen : line.startFen;
  const standard = line.startFen === START_FEN;

  const found = useMemo(() => findOpening(index, line, shown, fen), [index, line, shown, fen]);
  const continuations = useMemo(() => index.continuations(fen), [index, fen]);
  const searchIndex = useMemo(() => buildSearchIndex(index.openings), [index]);

  const commit = useCallback(
    (next: LineState) => {
      setLine(next);
      setCopyState('idle');
      const p = new URLSearchParams(params);
      if (next.startFen === START_FEN && next.cursor > 0) {
        p.set('moves', next.sans.slice(0, Math.min(next.cursor, MAX_PLIES)).map(stripCheck).join(','));
      } else {
        p.delete('moves');
      }
      setWrittenMoves(p.get('moves'));
      setParams(p, { replace: true });
    },
    [params, setParams],
  );

  const playMove = (move: MoveInput): boolean => {
    const res = playOnLine(line, fen, move);
    if (!res) return false;
    commit(res.line);
    playMoveSound(res.san);
    return true;
  };

  const onBoardMove = (from: string, to: string, promotion?: PromotionPiece): boolean =>
    playMove(promotion ? { from, to, promotion } : { from, to });

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
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || isTypingTarget(e.target)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        undo();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const loadSans = (sans: string[]): void => {
    const valid = replay(START_FEN, sans).map((p) => p.san);
    commit({ startFen: START_FEN, sans: valid, cursor: valid.length });
    boardWrap.current?.scrollIntoView({ block: 'start' });
  };

  const copyPgn = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(buildPgn(line.startFen, line.sans.slice(0, line.cursor)));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const turn = new Chess(fen).turn();
  const openingName = found.opening?.name;

  const book = continuations;
  const btn = 'min-h-10 px-3 text-base';

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[min(var(--kl-main-h),46%)_minmax(0,1fr)] xl:grid-cols-[min(var(--kl-main-h),52%)_minmax(0,1fr)] lg:items-start">
      <div ref={boardWrap}>
        <Board
          fen={fen}
          orientation={flipped ? 'black' : 'white'}
          interactive
          size={BOARD_WIDTH}
          onMove={onBoardMove}
          lastMove={last ? { from: last.from, to: last.to, san: last.san } : undefined}
          ariaLabel={t.boardLabel}
        />
      </div>

      <div className="grid min-h-0 content-start gap-3 rounded-2xl border-2 border-line bg-surface p-3 lg:max-h-full lg:overflow-hidden lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <section aria-labelledby="op-current">
            <h2 id="op-current" className="sr-only">{t.currentOpening}</h2>
            <p role="status" aria-live="polite" className="text-2xl font-extrabold leading-tight">{openingName ?? (shown.length === 0 ? t.startPosition : t.noOpening)}</p>
            <p className="text-lg font-bold text-fg">
              {found.opening
                ? `${found.ply < line.cursor ? fmt(t.ecoNamedAt, { eco: found.opening.eco, n: Math.ceil(found.ply / 2) }) : fmt(t.ecoCode, { eco: found.opening.eco })} · `
                : ''}
              {turn === 'w' ? t.whiteToMove : t.blackToMove}
            </p>
          </section>

          <section aria-labelledby="op-moves">
            <h2 id="op-moves" className="sr-only">{t.movesHeading}</h2>
            <MoveList plies={plies} cursor={line.cursor} onJump={(cursor) => commit({ ...line, cursor })} />
          </section>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className={btn} onClick={undo} aria-disabled={line.cursor === 0}>{t.undo}</Button>
            <Button variant="secondary" className={btn} onClick={redo} aria-disabled={line.cursor >= plies.length}>{t.redo}</Button>
            <Button variant="secondary" className={btn} onClick={() => commit({ startFen: START_FEN, sans: [], cursor: 0 })}>{t.reset}</Button>
            <Button variant="secondary" className={btn} onClick={() => setFlipped((f) => !f)}>{t.flip}</Button>
            <Button variant="secondary" className={btn} onClick={() => void copyPgn()} disabled={line.cursor === 0 && standard}>{t.copyPgn}</Button>
          </div>
          <p role="status" className="min-h-5 text-sm font-bold">
            {copyState === 'copied' ? t.copied : copyState === 'failed' ? t.copyFailed : ''}
          </p>
          {line.cursor > MAX_PLIES ? <p className="text-sm text-muted">{fmt(t.linkTrimmed, { max: MAX_PLIES })}</p> : null}
          <FindSection searchIndex={searchIndex} onPick={(o) => loadSans(sansOfPgn(o.pgn))} />
        </div>

        <div className="min-w-0 space-y-2">
          <section aria-labelledby="op-next">
            <h2 id="op-next" ref={nextHeading} tabIndex={-1} className="text-lg font-bold focus:outline-none">{t.nextMoves}</h2>
            {book.length === 0 ? (
              <p className="mt-1 text-base">{t.noContinuations}</p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-2">
                {book.map((c) => {
                  const result = c.name ? fmt(t.leadsTo, { name: c.name }) : t.noName;
                  return (
                    <li key={c.uci}>
                      <button
                        type="button"
                        aria-label={fmt(t.continuationLabel, { san: c.san, result })}
                        onClick={() => {
                          playMove({ from: c.uci.slice(0, 2), to: c.uci.slice(2, 4), promotion: c.uci.slice(4, 5) || undefined });
                          nextHeading.current?.focus();
                        }}
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
          <LoadBox onLoad={(startFen, sans) => commit({ startFen, sans, cursor: sans.length })} />
        </div>
      </div>
    </div>
  );
}

/** Search by name: shows only the best few matches, so the page never needs a long list. */
function FindSection({ searchIndex, onPick }: { searchIndex: SearchIndex; onPick: (o: Opening) => void }) {
  const t = m().openings;
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const results = useMemo(() => searchOpenings(searchIndex, deferred).slice(0, MAX_SEARCH_RESULTS), [searchIndex, deferred]);
  return (
    <section aria-labelledby="op-find" className="space-y-1">
      <h2 id="op-find" className="sr-only">{t.findTitle}</h2>
      <label htmlFor="op-search" className="block text-base font-bold">{t.searchLabel}</label>
      <input
        id="op-search"
        type="search"
        value={query}
        placeholder={t.searchPlaceholder}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        className="min-h-10 w-full rounded-control border-2 border-line bg-bg px-3 text-base"
      />
      {deferred.trim() !== '' ? (
        <div>
          <p role="status" className="text-sm font-bold">
            {results.length === 0 ? t.noResults : t.findTitle}
          </p>
          <ul className="divide-y divide-line">
            {results.map((o) => (
              <li key={`${o.eco}-${o.uci}`}>
                <button
                  type="button"
                  aria-label={fmt(t.loadLine, { name: o.name })}
                  onClick={() => onPick(o)}
                  className="flex min-h-10 w-full items-baseline gap-2 px-2 py-1 text-start hover:bg-line/60"
                >
                  <span className="rounded bg-ink px-1.5 text-sm font-bold text-cream">{o.eco}</span>
                  <span className="text-base font-bold">{o.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
