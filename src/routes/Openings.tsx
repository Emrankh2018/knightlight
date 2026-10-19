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
  filterByName,
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

const BOARD_WIDTH = 'max(16rem, min(100%, calc(100dvh - 11rem)))';
const PAGE = 40;
const ECO_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-extrabold">{t.title}</h1>
        <p className="mt-1 text-lg text-muted">{t.intro}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
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

        <div className="space-y-4 rounded-2xl border-2 border-line bg-surface p-4">
          <section aria-labelledby="op-current">
            <h2 id="op-current" className="text-sm font-bold uppercase tracking-wide text-muted">{t.currentOpening}</h2>
            <p role="status" aria-live="polite" className="text-3xl font-extrabold leading-tight">{openingName ?? (shown.length === 0 ? t.startPosition : t.noOpening)}</p>
            {found.opening ? (
              <p className="mt-1 text-xl font-bold text-fg">
                {found.ply < line.cursor
                  ? fmt(t.ecoNamedAt, { eco: found.opening.eco, n: Math.ceil(found.ply / 2) })
                  : fmt(t.ecoCode, { eco: found.opening.eco })}
              </p>
            ) : null}
            <p className="mt-1 text-xl font-bold text-fg">{turn === 'w' ? t.whiteToMove : t.blackToMove}</p>
          </section>

          <section aria-labelledby="op-moves">
            <h2 id="op-moves" className="text-xl font-bold">{t.movesHeading}</h2>
            <MoveList plies={plies} cursor={line.cursor} onJump={(cursor) => commit({ ...line, cursor })} />
          </section>

          <section aria-labelledby="op-next">
            <h2 id="op-next" ref={nextHeading} tabIndex={-1} className="text-xl font-bold focus:outline-none">{t.nextMoves}</h2>
            <p className="text-base text-muted">{t.nextMovesHelp}</p>
            {continuations.length === 0 ? (
              <p className="mt-2 text-lg">{t.noContinuations}</p>
            ) : (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {continuations.map((c) => {
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
                        className="flex min-h-12 w-full flex-col items-start rounded-xl border-2 border-line bg-bg px-3 py-2 text-start hover:border-amber"
                      >
                        <span className="text-xl font-extrabold">{c.san}</span>
                        <span className="text-base text-muted">{result}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={undo} aria-disabled={line.cursor === 0}>{t.undo}</Button>
            <Button variant="secondary" onClick={redo} aria-disabled={line.cursor >= plies.length}>{t.redo}</Button>
            <Button variant="secondary" onClick={() => commit({ startFen: START_FEN, sans: [], cursor: 0 })}>{t.reset}</Button>
            <Button variant="secondary" onClick={() => setFlipped((f) => !f)}>{t.flip}</Button>
            <Button variant="secondary" onClick={() => void copyPgn()} disabled={line.cursor === 0 && standard}>{t.copyPgn}</Button>
          </div>
          <p role="status" className="min-h-6 text-base font-bold">
            {copyState === 'copied' ? t.copied : copyState === 'failed' ? t.copyFailed : ''}
          </p>
          {line.cursor > MAX_PLIES ? <p className="text-base text-muted">{fmt(t.linkTrimmed, { max: MAX_PLIES })}</p> : null}
          <p className="text-base text-muted">{t.keyboardHelp}</p>

          <LoadBox
            onLoad={(startFen, sans) => commit({ startFen, sans, cursor: sans.length })}
          />
        </div>
      </div>

      <div className="pt-4">
        <FindSection searchIndex={searchIndex} onPick={(o) => loadSans(sansOfPgn(o.pgn))} />
      </div>
    </div>
  );
}

function FindSection({ searchIndex, onPick }: { searchIndex: SearchIndex; onPick: (o: Opening) => void }) {
  const t = m().openings;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const deferred = useDeferredValue(query);
  const results = useMemo(() => searchOpenings(searchIndex, deferred), [searchIndex, deferred]);
  const groups = useMemo(
    () => ECO_LETTERS.map((letter) => ({ letter, items: searchIndex.openings.filter((o) => o.eco.startsWith(letter)) })),
    [searchIndex],
  );
  return (
    <div className="space-y-8">
      <section aria-labelledby="op-find" className="space-y-3">
        <h2 id="op-find" className="text-2xl font-extrabold">{t.findTitle}</h2>
        <label htmlFor="op-search" className="block text-lg font-bold">{t.searchLabel}</label>
        <input
          id="op-search"
          type="search"
          value={query}
          placeholder={t.searchPlaceholder}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-12 w-full max-w-xl rounded-xl border-2 border-line bg-surface px-4 text-lg"
        />
        {deferred.trim() !== '' ? (
          <div>
            <p role="status" className="mb-2 text-lg font-bold">
              {results.length === 0 ? t.noResults : fmt(t.resultsCount, { count: results.length })}
            </p>
            <OpeningRows key={deferred} items={results} onPick={onPick} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="op-browse" className="space-y-3">
        <h2 id="op-browse" className="text-2xl font-extrabold">{t.browseTitle}</h2>
        <label htmlFor="op-filter" className="block text-lg font-bold">{t.filterLabel}</label>
        <input
          id="op-filter"
          type="search"
          value={filter}
          autoComplete="off"
          onChange={(e) => setFilter(e.target.value)}
          className="min-h-12 w-full max-w-xl rounded-xl border-2 border-line bg-surface px-4 text-lg"
        />
        <div className="space-y-2">
          {groups.map((g) => (
            <EcoGroup key={g.letter} letter={g.letter} items={g.items} filter={filter} onPick={onPick} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EcoGroup({ letter, items, filter, onPick }: { letter: string; items: Opening[]; filter: string; onPick: (o: Opening) => void }) {
  const t = m().openings;
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => (open ? filterByName(items, filter) : []), [open, items, filter]);
  return (
    <details
      className="rounded-xl border-2 border-line bg-surface px-3 py-2"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="min-h-12 cursor-pointer py-3 text-xl font-bold">
        {t.ecoGroups[letter] ?? letter}
        <span className="ms-2 text-base font-normal text-muted">{fmt(t.openingsCount, { count: items.length })}</span>
      </summary>
      {open ? (
        <div className="pt-2">
          {filtered.length === 0 ? <p className="text-lg">{t.emptyGroup}</p> : <OpeningRows key={filter} items={filtered} onPick={onPick} />}
        </div>
      ) : null}
    </details>
  );
}

/** Paginated list: renders PAGE rows at a time so 3,865 openings stay fast. */
function OpeningRows({ items, onPick }: { items: readonly Opening[]; onPick: (o: Opening) => void }) {
  const t = m().openings;
  const [limit, setLimit] = useState(PAGE);
  const visible = items.slice(0, limit);
  return (
    <div>
      <ul className="divide-y divide-line">
        {visible.map((o) => (
          <li key={`${o.eco}-${o.uci}`}>
            <button
              type="button"
              aria-label={fmt(t.loadLine, { name: o.name })}
              onClick={() => onPick(o)}
              className="flex min-h-12 w-full flex-wrap items-baseline gap-x-3 px-2 py-2 text-start hover:bg-line/60"
            >
              <span className="rounded bg-ink px-2 text-base font-bold text-cream">{o.eco}</span>
              <span className="text-lg font-bold">{o.name}</span>
              <span className="text-base text-muted">{o.pgn}</span>
            </button>
          </li>
        ))}
      </ul>
      {items.length > limit ? (
        <Button variant="ghost" className="mt-2" onClick={() => setLimit((l) => l + PAGE)}>
          {fmt(t.showMoreLeft, { count: items.length - limit })}
        </Button>
      ) : null}
    </div>
  );
}
