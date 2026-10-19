import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Board, { type PromotionPiece } from '../components/Board';
import Button from '../components/Button';
import { Feedback, isButtonTarget, useKeys } from '../components/lesson/shared';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import type { Arrow, Highlight } from '../lib/content/types';
import { loadPuzzleChunk, loadPuzzleIndex } from '../lib/data';
import type { Puzzle, PuzzleBucket, PuzzleLevel } from '../lib/puzzle-types';
import { hint as hintFor, playUci, remainingMoves, shuffle, start, tryMove, type PuzzleState } from '../lib/puzzles';
import { xpFor } from '../lib/xp';
import { useProgress } from '../store/progress';
import { useUi } from '../store/ui';

const MOVE_DELAY_MS = 500;
const SOLUTION_DELAY_MS = 900;

/** Board widths. Class Mode: sized by --kl-class-board (landscape: as tall as the screen allows, at most 60% of its width; portrait: full width). Normal: fits the viewport below the site header. */
const CLASS_BOARD = 'var(--kl-class-board)';
const NORMAL_BOARD = 'max(16rem, min(100%, calc(100dvh - 8rem)))';

function themeLabel(theme: string): string {
  if (theme === 'mixed') return m().puzzles.mixed;
  const humanised = theme.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return m().puzzles.themes[theme] ?? humanised.charAt(0).toUpperCase() + humanised.slice(1);
}

/** Lichess tags that describe length or strength of play rather than the idea, so students never see them. */
const HIDDEN_THEMES: ReadonlySet<string> = new Set(['short', 'long', 'veryLong', 'oneMove', 'crushing', 'advantage', 'master', 'masterVsMaster', 'superGM', 'collinearMove']);

function levelLabel(id: string): string {
  return m().puzzles.levels[id] ?? id;
}

/** Locale-aware list such as "a, b and c". */
function listOf(items: string[]): string {
  return new Intl.ListFormat(m().lang, { style: 'long', type: 'conjunction' }).format(items);
}

export default function Puzzles() {
  const [params, setParams] = useSearchParams();
  const index = useLoad(loadPuzzleIndex);
  const levelId = params.get('level');
  const theme = params.get('theme') ?? 'mixed';

  if (index.status === 'loading') return <p className="text-xl text-muted">{m().common.loading}</p>;
  if (index.status === 'error') return <p role="alert" className="text-xl font-bold text-coral">{m().puzzles.loadError}</p>;

  const levels = index.data.levels;
  const level = levels.find((l) => l.id === levelId);
  const bucket = level?.buckets.find((b) => b.theme === theme);
  if (level && bucket) return <Trainer key={bucket.file} level={level} bucket={bucket} />;

  const initialLevel = level?.id ?? levels[0]?.id ?? '';
  return (
    <Picker
      key={initialLevel}
      levels={levels}
      initialLevel={initialLevel}
      unknown={levelId !== null}
      onPick={(l, t) => setParams({ level: l, theme: t })}
    />
  );
}

function Picker({ levels, initialLevel, unknown, onPick }: { levels: PuzzleLevel[]; initialLevel: string; unknown: boolean; onPick: (level: string, theme: string) => void }) {
  const [chosen, setChosen] = useState(initialLevel);
  const level = levels.find((l) => l.id === chosen);
  const buckets = level ? [...level.buckets].sort((a, b) => (a.theme === 'mixed' ? -1 : b.theme === 'mixed' ? 1 : 0)) : [];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">{m().puzzles.title}</h1>
      {unknown ? <Feedback tone="bad">{m().puzzles.unknownSet}</Feedback> : null}
      <section aria-labelledby="pz-levels" className="space-y-3">
        <h2 id="pz-levels" className="text-xl font-bold">{m().puzzles.pickLevel}</h2>
        <div className="flex flex-wrap gap-3">
          {levels.map((l) => (
            <Button key={l.id} variant={l.id === chosen ? 'primary' : 'secondary'} aria-pressed={l.id === chosen} onClick={() => setChosen(l.id)}>
              <span className="flex flex-col items-center leading-tight">
                <span>{levelLabel(l.id)}</span>
                <span className="text-sm font-normal">{fmt(m().puzzles.ratingRange, { min: l.min, max: l.max })}</span>
              </span>
            </Button>
          ))}
        </div>
      </section>
      <section aria-labelledby="pz-themes" className="space-y-3">
        <h2 id="pz-themes" className="text-xl font-bold">{m().puzzles.pickTheme}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buckets.map((b) => (
            <li key={b.file}>
              <button
                type="button"
                aria-label={fmt(m().puzzles.themeCount, { theme: themeLabel(b.theme), count: b.count })}
                onClick={() => onPick(chosen, b.theme)}
                className="flex min-h-14 w-full items-center justify-between rounded-2xl border-2 border-ink/60 bg-surface px-4 py-3 text-start text-lg font-bold hover:border-ink dark:border-amber/60 dark:hover:border-amber"
              >
                <span>{themeLabel(b.theme)}</span>
                <span className="rounded-full bg-line/60 px-3 py-1 text-base text-muted">{b.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Trainer({ level, bucket }: { level: PuzzleLevel; bucket: PuzzleBucket }) {
  const load = useCallback(() => loadPuzzleChunk(bucket.file), [bucket.file]);
  const chunk = useLoad(load);
  const [attempt, setAttempt] = useState(0);
  if (chunk.status === 'loading') return <p className="text-xl text-muted">{m().common.loading}</p>;
  if (chunk.status === 'error') {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-xl font-bold text-coral">{m().puzzles.loadError}</p>
        <Link to="/puzzles" className="inline-flex min-h-11 items-center font-bold underline">{m().puzzles.changeSelection}</Link>
      </div>
    );
  }
  if (chunk.data.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xl">{m().puzzles.emptySet}</p>
        <Link to="/puzzles" className="inline-flex min-h-11 items-center font-bold underline">{m().puzzles.changeSelection}</Link>
      </div>
    );
  }
  return <Session key={attempt} level={level} bucket={bucket} puzzles={chunk.data} onRestart={() => setAttempt((n) => n + 1)} />;
}

interface Outcome {
  solved: boolean;
  hint: boolean;
  /** At least one wrong move was tried. */
  wrong: boolean;
  /** Solved with no wrong move and no hint. */
  clean: boolean;
}

function Session({ level, bucket, puzzles, onRestart }: { level: PuzzleLevel; bucket: PuzzleBucket; puzzles: Puzzle[]; onRestart: () => void }) {
  const [seed] = useState(() => Date.now() % 2147483647);
  const order = useMemo(() => shuffle(puzzles, seed), [puzzles, seed]);
  const [pos, setPos] = useState(0);
  const [streak, setStreak] = useState(0);
  const [classMode, setClassMode] = useState(false);
  const recordPuzzle = useProgress((s) => s.recordPuzzle);
  const addSrs = useProgress((s) => s.addSrs);

  useEffect(() => {
    if (!classMode) return;
    document.documentElement.dataset.classMode = '';
    useUi.getState().setSuppressToasts(true);
    return () => {
      delete document.documentElement.dataset.classMode;
      useUi.getState().setSuppressToasts(false);
    };
  }, [classMode]);

  const onDone = (puzzle: Puzzle, o: Outcome): number => {
    const first = useProgress.getState().data.puzzles.solved[puzzle.id] === undefined;
    recordPuzzle(puzzle.id, level.id, o.solved, o.hint);
    if (!o.solved || o.wrong) addSrs(`puzzle:${puzzle.id}`, 'puzzle', puzzle.id);
    setStreak((n) => (o.clean ? n + 1 : 0));
    return o.solved && first ? xpFor({ type: 'puzzle', hint: o.hint }) : 0;
  };

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className={`me-auto font-extrabold ${classMode ? 'text-3xl xl:text-4xl' : 'text-2xl'}`}>
        {fmt(m().puzzles.levelTheme, { level: levelLabel(level.id), theme: themeLabel(bucket.theme) })}
      </h1>
      <Button variant={classMode ? 'primary' : 'secondary'} aria-pressed={classMode} className={classMode ? 'min-h-14 px-5 text-xl xl:min-h-16 xl:px-8 xl:text-2xl' : ''} onClick={() => setClassMode((v) => !v)}>
        {m().puzzles.classMode}
      </Button>
      <Link to="/puzzles" className={`inline-flex min-h-11 items-center font-bold underline ${classMode ? 'text-xl' : ''}`}>
        {m().puzzles.changeSelection}
      </Link>
    </div>
  );

  const puzzle = order[pos];
  if (!puzzle) {
    return (
      <DoneCard header={header} total={order.length} classMode={classMode} onExitClass={() => setClassMode(false)} onRestart={onRestart} />
    );
  }
  return (
    <Round
      key={`${pos}-${puzzle.id}`}
      puzzle={puzzle}
      n={pos + 1}
      total={order.length}
      streak={streak}
      classMode={classMode}
      header={header}
      focusBoard={pos > 0}
      onToggleClass={() => setClassMode((v) => !v)}
      onDone={(o) => onDone(puzzle, o)}
      onNext={() => setPos((p) => p + 1)}
    />
  );
}

function DoneCard({ header, total, classMode, onExitClass, onRestart }: { header: ReactNode; total: number; classMode: boolean; onExitClass: () => void; onRestart: () => void }) {
  const againRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    againRef.current?.focus();
  }, []);
  useKeys((e) => {
    const key = e.key.toLowerCase();
    if (key === 'escape' && classMode) onExitClass();
    else if (key === 'enter' && !isButtonTarget(e)) onRestart();
  });
  return (
    <div className="space-y-4 rounded-2xl border-2 border-line bg-surface p-6">
      {header}
      <p className="text-2xl font-extrabold">{fmt(m().puzzles.allDone, { total })}</p>
      <Button ref={againRef} onClick={onRestart}>{m().puzzles.again}</Button>
    </div>
  );
}

interface RoundProps {
  puzzle: Puzzle;
  n: number;
  total: number;
  streak: number;
  classMode: boolean;
  /** Title, Class Mode toggle and change-selection link; rendered at the top of the side panel. */
  header: ReactNode;
  /** Move focus to the board when the round appears (after Next). */
  focusBoard: boolean;
  onToggleClass: () => void;
  onDone: (o: Outcome) => number;
  onNext: () => void;
}

function Round(props: RoundProps) {
  const initial = useMemo(() => {
    try {
      return start(props.puzzle);
    } catch {
      return null;
    }
  }, [props.puzzle]);
  if (!initial) {
    return (
      <div className="space-y-4 rounded-2xl border-2 border-line bg-surface p-4">
        {props.header}
        <Feedback tone="bad">{m().puzzles.badPuzzle}</Feedback>
        <Button onClick={props.onNext}>{m().puzzles.next}</Button>
      </div>
    );
  }
  return <RoundBody {...props} initial={initial} />;
}

type Phase = 'play' | 'solved' | 'revealing' | 'shown';
type Note = 'none' | 'wrong' | 'correct';

function RoundBody({ puzzle, n, total, streak, classMode, header, focusBoard, onToggleClass, onDone, onNext, initial }: RoundProps & { initial: PuzzleState }) {
  const [ps, setPs] = useState(initial);
  const [shown, setShown] = useState({ fen: initial.fen, lastMove: initial.lastMove });
  const [phase, setPhase] = useState<Phase>('play');
  const [busy, setBusy] = useState(false);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [note, setNote] = useState<Note>('none');
  const [xp, setXp] = useState(0);
  const [details, setDetails] = useState(false);
  const hadWrong = useRef(false);
  const usedHint = useRef(false);
  const timers = useRef<number[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (focusBoard) boardRef.current?.focus();
  }, [focusBoard]);

  const later = (fn: () => void, ms: number): void => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const interactive = phase === 'play' && !busy;
  const finished = phase === 'solved' || phase === 'shown';

  const onMove = (from: string, to: string, promo?: PromotionPiece): boolean => {
    if (!interactive) return false;
    const uci = `${from}${to}${promo ?? ''}`;
    const res = tryMove(ps, uci);
    if (res.kind === 'wrong') {
      hadWrong.current = true;
      setNote('wrong');
      return false;
    }
    setHintLevel(0);
    if (res.kind === 'solved') {
      setPs(res.state);
      setShown({ fen: res.state.fen, lastMove: res.state.lastMove });
      setPhase('solved');
      setNote('none');
      setXp(onDone({ solved: true, hint: usedHint.current, wrong: hadWrong.current, clean: !hadWrong.current && !usedHint.current }));
      return true;
    }
    const mine = playUci(ps.fen, uci);
    if (mine) setShown({ fen: mine.fen, lastMove: { from: mine.from, to: mine.to, san: mine.san } });
    setBusy(true);
    setNote('correct');
    later(() => {
      setPs(res.state);
      setShown({ fen: res.state.fen, lastMove: res.state.lastMove });
      setBusy(false);
    }, MOVE_DELAY_MS);
    return true;
  };

  /** Promotes to a queen unless the stored move is this very move with an underpromotion. */
  const promotion = (from: string, to: string): PromotionPiece => {
    const expected = ps.puzzle.moves[ps.index] ?? '';
    const piece = expected.slice(4);
    return expected.startsWith(`${from}${to}`) && (piece === 'n' || piece === 'b' || piece === 'r') ? piece : 'q';
  };

  const showHint = (): void => {
    if (phase !== 'play' || busy) return;
    usedHint.current = true;
    setNote('none');
    setHintLevel((l) => (l >= 3 ? 3 : ((l + 1) as 1 | 2 | 3)));
  };

  const showSolution = (): void => {
    if (phase !== 'play' || busy) return;
    setPhase('revealing');
    setNote('none');
    setHintLevel(0);
    onDone({ solved: false, hint: true, wrong: hadWrong.current, clean: false });
    let fen = ps.fen;
    let played = 0;
    for (const uci of remainingMoves(ps)) {
      const mv = playUci(fen, uci);
      if (!mv) break;
      fen = mv.fen;
      played += 1;
      later(() => setShown({ fen: mv.fen, lastMove: { from: mv.from, to: mv.to, san: mv.san } }), SOLUTION_DELAY_MS * played);
    }
    later(() => setPhase('shown'), SOLUTION_DELAY_MS * played);
  };

  useKeys((e) => {
    const key = e.key.toLowerCase();
    if (key === 'h') showHint();
    else if (key === 's') showSolution();
    else if (key === 'c') onToggleClass();
    else if (key === 'escape' && classMode) onToggleClass();
    else if ((key === 'n' || (key === 'enter' && !isButtonTarget(e))) && finished) onNext();
  });

  const h = phase === 'play' && hintLevel !== 0 ? hintFor(ps, hintLevel) : null;
  const highlights: Highlight[] = h ? [{ square: h.from, color: 'Y' }, ...(h.to && h.level >= 2 ? [{ square: h.to, color: 'G' as const }] : [])] : [];
  const arrows: Arrow[] = h && h.level === 3 && h.to ? [{ from: h.from, to: h.to, color: 'G' }] : [];

  const text = classMode ? 'text-xl xl:text-2xl' : 'text-lg';
  const white = ps.solver === 'white';
  const showDetails = !classMode || details;
  const pieceName = h ? (m().puzzles.pieces[h.piece] ?? '') : '';
  const btn = classMode ? 'min-h-14 px-5 text-xl xl:min-h-16 xl:px-8 xl:text-2xl' : '';
  const ariaOff =
    'aria-disabled:cursor-not-allowed aria-disabled:border-2 aria-disabled:border-dashed aria-disabled:border-muted aria-disabled:bg-surface aria-disabled:text-muted aria-disabled:hover:bg-surface aria-disabled:hover:text-muted dark:aria-disabled:hover:bg-surface dark:aria-disabled:hover:text-muted';

  const board = (
    <Board
      ref={boardRef}
      fen={shown.fen}
      orientation={ps.orientation}
      interactive={interactive}
      onMove={onMove}
      promotion={promotion}
      lastMove={shown.lastMove}
      highlights={highlights}
      arrows={arrows}
      size={classMode ? CLASS_BOARD : NORMAL_BOARD}
      ariaLabel={m().puzzles.boardLabel}
    />
  );

  const buttons = (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" className={`${btn} ${ariaOff}`} onClick={showHint} aria-disabled={phase !== 'play' || busy}>
        {m().puzzles.hintKey}
      </Button>
      <Button variant="secondary" className={`${btn} ${ariaOff}`} onClick={showSolution} aria-disabled={phase !== 'play' || busy}>
        {m().puzzles.showSolutionKey}
      </Button>
      <Button className={`${btn} ${ariaOff}`} onClick={() => finished && onNext()} aria-disabled={!finished}>
        {m().puzzles.nextKey}
      </Button>
    </div>
  );

  const panel = (
    <div className={`space-y-4 ${text}`}>
      <div className="flex flex-wrap items-center gap-3">
        <p className={`inline-flex items-center gap-3 rounded-xl border-2 border-ink px-4 py-2 font-extrabold dark:border-amber ${classMode ? 'text-2xl xl:text-3xl' : 'text-xl'}`}>
          <span aria-hidden="true" className={`inline-block size-6 rounded-full border-2 border-ink ${white ? 'bg-white' : 'bg-ink'}`} />
          {white ? m().puzzles.whiteToMove : m().puzzles.blackToMove}
        </p>
        <p className="font-bold text-muted">{fmt(m().puzzles.progress, { n, total })}</p>
        <p className="font-bold text-muted">{fmt(m().puzzles.sessionStreak, { count: streak })}</p>
      </div>
      {showDetails ? (
        <p className="font-bold text-muted">{fmt(m().puzzles.rating, { rating: puzzle.rating })}</p>
      ) : (
        <Button variant="secondary" className={btn} onClick={() => setDetails(true)}>
          {m().puzzles.revealDetails}
        </Button>
      )}
      {buttons}
      <div aria-live="polite" className="space-y-3">
        {note === 'wrong' ? <Feedback tone="bad" large={classMode}>{m().puzzles.wrong}</Feedback> : null}
        {note === 'correct' && busy ? <Feedback tone="good" large={classMode}>{m().puzzles.correct}</Feedback> : null}
        {busy ? <p className="font-bold text-muted">{m().puzzles.opponentReplies}</p> : null}
        {phase === 'solved' ? <Feedback tone="good" large={classMode}>{xp > 0 ? fmt(m().puzzles.solved, { xp }) : m().puzzles.solvedNoXp}</Feedback> : null}
        {phase === 'shown' ? <Feedback tone="info" large={classMode}>{m().puzzles.solutionShown}</Feedback> : null}
        {h ? (
          <Feedback tone="info" large={classMode}>
            {h.level === 1
              ? fmt(m().puzzles.hintPiece, { piece: pieceName })
              : h.level === 2
                ? fmt(m().puzzles.hintTarget, { piece: pieceName, square: h.to ?? '' })
                : m().puzzles.hintMove}
          </Feedback>
        ) : null}
      </div>
      {finished && showDetails ? <p>{fmt(m().puzzles.themesLine, { themes: listOf(puzzle.themes.filter((t) => !HIDDEN_THEMES.has(t)).map(themeLabel)) })}</p> : null}
      <p className={classMode ? 'text-lg text-muted' : 'text-sm text-muted'}>{m().puzzles.shortcuts}</p>
    </div>
  );

  return (
    <div
      className={
        classMode
          ? 'fixed inset-0 z-40 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-6 overflow-auto bg-bg p-4 portrait:grid-cols-1 portrait:justify-items-center'
          : 'grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start'
      }
    >
      <div>{board}</div>
      <div className={`space-y-4 rounded-2xl border-2 border-line bg-surface ${classMode ? 'p-6' : 'p-4'}`}>
        {header}
        {panel}
      </div>
    </div>
  );
}
