import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Board, { type PromotionPiece } from './Board';
import Button from './Button';
import SoundToggle from './SoundToggle';
import { Feedback, isButtonTarget, useKeys } from './lesson/shared';
import { fmt, m } from '../i18n';
import type { Arrow, Highlight } from '../lib/content/types';
import type { Puzzle } from '../lib/puzzle-types';
import { hint as hintFor, playUci, remainingMoves, start, tryMove, type PuzzleState } from '../lib/puzzles';
import { playMoveSound, playSound } from '../lib/sound';

const MOVE_DELAY_MS = 500;
const SOLUTION_DELAY_MS = 900;

/** Board widths. Class Mode: sized by --kl-class-board (landscape: as tall as the screen allows, at most 60% of its width; portrait: full width). Normal: fits the viewport below the site header. */
const CLASS_BOARD = 'var(--kl-class-board)';
const NORMAL_BOARD = 'max(16rem, min(100%, calc(100dvh - 8rem)))';

export function themeLabel(theme: string): string {
  if (theme === 'mixed') return m().puzzles.mixed;
  const humanised = theme.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return m().puzzles.themes[theme] ?? humanised.charAt(0).toUpperCase() + humanised.slice(1);
}

/** Lichess tags that describe length or strength of play rather than the idea, so students never see them. */
const HIDDEN_THEMES: ReadonlySet<string> = new Set(['short', 'long', 'veryLong', 'oneMove', 'crushing', 'advantage', 'master', 'masterVsMaster', 'superGM', 'collinearMove']);

/** Locale-aware list such as "a, b and c". */
function listOf(items: string[]): string {
  return new Intl.ListFormat(m().lang, { style: 'long', type: 'conjunction' }).format(items);
}

export interface Outcome {
  solved: boolean;
  hint: boolean;
  /** At least one wrong move was tried. */
  wrong: boolean;
  /** Solved with no wrong move and no hint. */
  clean: boolean;
}

export interface RoundProps {
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

export function Round(props: RoundProps) {
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
      playSound('wrong');
      return false;
    }
    setHintLevel(0);
    if (res.kind === 'solved') {
      setPs(res.state);
      setShown({ fen: res.state.fen, lastMove: res.state.lastMove });
      setPhase('solved');
      setNote('none');
      playSound('solved');
      setXp(onDone({ solved: true, hint: usedHint.current, wrong: hadWrong.current, clean: !hadWrong.current && !usedHint.current }));
      return true;
    }
    const mine = playUci(ps.fen, uci);
    if (mine) {
      setShown({ fen: mine.fen, lastMove: { from: mine.from, to: mine.to, san: mine.san } });
      playMoveSound(mine.san);
    }
    setBusy(true);
    setNote('correct');
    later(() => {
      setPs(res.state);
      setShown({ fen: res.state.fen, lastMove: res.state.lastMove });
      if (res.state.lastMove) playMoveSound(res.state.lastMove.san);
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
    playSound('hint');
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
      later(() => {
        setShown({ fen: mv.fen, lastMove: { from: mv.from, to: mv.to, san: mv.san } });
        playMoveSound(mv.san);
      }, SOLUTION_DELAY_MS * played);
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
        {classMode ? <SoundToggle compact className="hover:bg-line" /> : null}
      </div>
      {showDetails ? (
        <p className="font-bold text-muted">{fmt(m().puzzles.rating, { rating: puzzle.rating })}</p>
      ) : (
        <Button variant="secondary" className={btn} onClick={() => setDetails(true)}>
          {m().puzzles.revealDetails}
        </Button>
      )}
      {buttons}
      {classMode ? null : <SoundToggle volume className="hover:bg-line" />}
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
      <div className={`space-y-4 rounded-2xl border-2 border-line bg-surface ${classMode ? 'p-5' : 'p-4'}`}>
        {header}
        {panel}
      </div>
    </div>
  );
}
