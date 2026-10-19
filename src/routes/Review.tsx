import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Button, { ButtonLink } from '../components/Button';
import LineDrillView from '../components/lesson/LineDrillView';
import { bigButton, isButtonTarget, useKeys, ARIA_OFF, type StepControls } from '../components/lesson/shared';
import { Round, type Outcome } from '../components/PuzzleRound';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import { loadCourse, loadPuzzleChunk, loadPuzzleIndex } from '../lib/data';
import { diffDays, todayLocal } from '../lib/date';
import type { PuzzleIndex } from '../lib/puzzle-types';
import { createPuzzleLookup, gradeFor, prepareReview, reviewQueue, type LineEntry, type PrepareDeps, type Prepared, type PuzzleLookup, type ReviewResult } from '../lib/review';
import type { SrsItem } from '../lib/srs';
import { useProgress } from '../store/progress';
import { useUi } from '../store/ui';

let sharedLookup: { index: PuzzleIndex; lookup: PuzzleLookup } | null = null;

function lookupFor(index: PuzzleIndex): PuzzleLookup {
  if (sharedLookup?.index !== index) sharedLookup = { index, lookup: createPuzzleLookup(index, loadPuzzleChunk) };
  return sharedLookup.lookup;
}

const deps: PrepareDeps = {
  resolvePuzzles: async (ids) => lookupFor(await loadPuzzleIndex()).resolve(ids),
  loadCourse,
};

/** Days from today to the earliest item still waiting, or null when nothing is scheduled. */
function nextDueIn(srs: Readonly<Record<string, SrsItem>>, today: string): number | null {
  let best: number | null = null;
  for (const i of Object.values(srs)) {
    if (i.kind === 'step' || i.due <= today) continue;
    const d = diffDays(i.due, today);
    if (best === null || d < best) best = d;
  }
  return best;
}

function NextDue() {
  const srs = useProgress((s) => s.data.srs);
  const days = nextDueIn(srs, todayLocal());
  return <p className="text-muted">{days === null ? m().review.nextNone : days === 1 ? m().review.nextTomorrow : fmt(m().review.nextInDays, { days })}</p>;
}

export default function Review() {
  const srs = useProgress((s) => s.data.srs);
  const today = todayLocal();
  const due = useMemo(() => reviewQueue(Object.values(srs), today), [srs, today]);
  const [session, setSession] = useState<SrsItem[] | null>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (session === null) startRef.current?.focus();
  }, [session]);

  if (session !== null) return <Session items={session} onExit={() => setSession(null)} />;

  return (
    <section className="mx-auto max-w-2xl space-y-6 text-center">
      <h1 className="text-3xl font-extrabold">{m().review.title}</h1>
      {due.length === 0 ? (
        <div role="status" className="space-y-3 rounded-2xl border-2 border-leaf bg-leaf/15 p-8">
          <p aria-hidden="true" className="text-5xl">🌟</p>
          <p className="text-3xl font-extrabold">{m().review.empty}</p>
          <p className="text-lg text-muted">{m().review.emptyHint}</p>
          <NextDue />
          <ButtonLink to="/puzzles" variant="secondary" className="mt-2">{m().review.morePuzzles}</ButtonLink>
        </div>
      ) : (
        <div className="space-y-5 rounded-2xl border-2 border-line bg-surface p-8">
          <p className="text-lg text-muted">{m().review.intro}</p>
          <p className="text-5xl font-extrabold">{due.length === 1 ? m().review.dueTodayOne : fmt(m().review.dueToday, { count: due.length })}</p>
          <Button ref={startRef} className="min-h-16 px-12 text-2xl" onClick={() => setSession(due)}>
            {m().review.start}
          </Button>
        </div>
      )}
    </section>
  );
}

function Session({ items, onExit }: { items: SrsItem[]; onExit: () => void }) {
  const load = useCallback(() => prepareReview(items, deps), [items]);
  const state = useLoad(load);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const failed = state.status === 'error';
  useEffect(() => {
    if (failed) errorRef.current?.focus();
  }, [failed]);
  if (state.status === 'loading') return <p role="status" className="text-xl text-muted">{m().review.preparing}</p>;
  if (state.status === 'error') {
    return (
      <div className="space-y-3">
        <p ref={errorRef} tabIndex={-1} role="alert" className="text-xl font-bold text-coral focus:outline-none">{m().review.loadError}</p>
        <Button variant="secondary" onClick={onExit}>{m().common.back}</Button>
      </div>
    );
  }
  return <Run prepared={state.data} onExit={onExit} />;
}

function Run({ prepared, onExit }: { prepared: Prepared; onExit: () => void }) {
  const { entries, dropIds } = prepared;
  const [pos, setPos] = useState(0);
  const [classMode, setClassMode] = useState(false);
  const [tally, setTally] = useState({ done: 0, smooth: 0, clean: 0 });
  const reviewSrs = useProgress((s) => s.reviewSrs);

  const removeSrs = useProgress((s) => s.removeSrs);

  useEffect(() => {
    for (const id of dropIds) removeSrs(id);
  }, [dropIds, removeSrs]);

  const entry = entries[pos];
  // Class Mode ends with the last question so the Done screen is not full-screen and toasts are not muted.
  const classActive = classMode && entry !== undefined;

  useEffect(() => {
    if (!classActive) return;
    document.documentElement.dataset.classMode = '';
    useUi.getState().setSuppressToasts(true);
    return () => {
      delete document.documentElement.dataset.classMode;
      useUi.getState().setSuppressToasts(false);
    };
  }, [classActive]);

  const grade = (item: SrsItem, r: ReviewResult): void => {
    const g = gradeFor(r);
    reviewSrs(item.id, g);
    setTally((t) => ({ done: t.done + 1, smooth: t.smooth + (g === 'again' ? 0 : 1), clean: g === 'good' ? t.clean + 1 : 0 }));
  };

  if (!entry) return <Done prepared={prepared} done={tally.done} smooth={tally.smooth} />;

  const header = (showProgress: boolean): ReactNode => (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className={`me-auto font-extrabold ${classMode ? 'text-3xl xl:text-4xl' : 'text-2xl'}`}>{m().review.title}</h1>
        <Button variant={classMode ? 'primary' : 'secondary'} aria-pressed={classMode} className="min-h-11 px-3 text-base" onClick={() => setClassMode((v) => !v)}>
          {m().review.classMode}
        </Button>
        <Button variant="secondary" className="min-h-11 px-3 text-base" onClick={onExit}>
          {m().review.stop}
        </Button>
      </div>
      <p className="font-bold text-muted">
        {entry.kind === 'line' ? fmt(m().review.lineKind, { course: entry.course.title }) : m().review.puzzleKind}
        {showProgress ? ` · ${fmt(m().review.itemOf, { n: pos + 1, total: entries.length })}` : ''}
      </p>
      {prepared.skipped > 0 ? <p className="text-sm text-muted">{m().review.skippedNote}</p> : null}
    </div>
  );

  if (entry.kind === 'puzzle') {
    return (
      <Round
        key={entry.item.id}
        puzzle={entry.puzzle}
        n={pos + 1}
        total={entries.length}
        streak={tally.clean}
        classMode={classMode}
        header={header(false)}
        focusBoard
        onToggleClass={() => setClassMode((v) => !v)}
        onDone={(o: Outcome) => {
          grade(entry.item, { solved: o.solved, hint: o.hint, mistakes: o.wrong ? 1 : 0 });
          return 0;
        }}
        onNext={() => setPos((p) => p + 1)}
      />
    );
  }
  return (
    <LineRound
      key={entry.item.id}
      entry={entry}
      last={pos === entries.length - 1}
      classMode={classMode}
      header={header(true)}
      onToggleClass={() => setClassMode((v) => !v)}
      onGrade={(r) => grade(entry.item, r)}
      onNext={() => setPos((p) => p + 1)}
    />
  );
}

interface LineRoundProps {
  entry: LineEntry;
  last: boolean;
  classMode: boolean;
  header: ReactNode;
  onToggleClass: () => void;
  onGrade: (r: ReviewResult) => void;
  onNext: () => void;
}

function LineRound({ entry, last, classMode, header, onToggleClass, onGrade, onNext }: LineRoundProps) {
  const [finished, setFinished] = useState(false);
  const controls = useRef<StepControls>({});
  const anchor = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    anchor.current?.focus();
  }, []);

  // LineDrillView reports completion once, so a changing callback identity is safe.
  const onComplete = (r: { hint: boolean; mistakes: number }): void => {
    onGrade({ solved: true, hint: r.hint, mistakes: r.mistakes });
    setFinished(true);
  };

  useKeys((e) => {
    const key = e.key.toLowerCase();
    if (key === 'h') controls.current.hint?.();
    else if (key === 'c') onToggleClass();
    else if (key === 'escape' && classMode) onToggleClass();
    else if ((key === 'n' || (key === 'enter' && !isButtonTarget(e))) && finished) onNext();
  });

  const btn = bigButton(classMode);
  const footer = (
    <div className="space-y-2">
      <Button className={`${btn} ${ARIA_OFF}`} aria-disabled={!finished} onClick={() => finished && onNext()}>
        {last ? m().review.finish : m().review.next}
      </Button>
      {classMode ? null : <p className="text-sm text-muted">{m().review.lineKeys}</p>}
    </div>
  );

  return (
    <LineDrillView
      step={entry.step}
      flipped={false}
      courseSide={entry.course.side ?? 'white'}
      classMode={classMode}
      header={
        <>
          <p ref={anchor} tabIndex={-1} className="sr-only focus:not-sr-only focus:outline-none">{m().review.title}</p>
          {header}
        </>
      }
      notes={null}
      footer={footer}
      controls={controls}
      onComplete={onComplete}
    />
  );
}

function Done({ prepared, done, smooth }: { prepared: Prepared; done: number; smooth: number }) {
  const actions = useRef<HTMLDivElement>(null);
  useEffect(() => {
    actions.current?.querySelector('a')?.focus();
  }, []);
  const notes = (
    <>
      {prepared.dropIds.length > 0 ? <p className="text-lg">{m().review.droppedNote}</p> : null}
      {prepared.skipped > 0 ? <p className="text-lg">{m().review.skippedNote}</p> : null}
    </>
  );
  if (done === 0) {
    const nothingRan = prepared.dropIds.length + prepared.skipped > 0;
    return (
      <section className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-3xl font-extrabold">{m().review.title}</h1>
        <div role="status" className="space-y-3 rounded-2xl border-2 border-leaf bg-leaf/15 p-8">
          <p className="text-3xl font-extrabold">{nothingRan ? m().review.nothingRan : m().review.empty}</p>
          {notes}
        </div>
        <div ref={actions}>
          <Link to="/" className="inline-flex min-h-12 items-center font-bold underline">{m().review.backHome}</Link>
        </div>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-2xl space-y-4 text-center">
      <h1 className="text-3xl font-extrabold">{m().review.title}</h1>
      <div role="status" className="space-y-3 rounded-2xl border-2 border-leaf bg-leaf/15 p-8">
        <p aria-hidden="true" className="text-5xl">🏆</p>
        <p className="text-3xl font-extrabold">{m().review.doneTitle}</p>
        <p className="text-xl">{done === 1 ? m().review.doneSummaryOne : fmt(m().review.doneSummary, { count: done, good: smooth })}</p>
        <NextDue />
        {notes}
      </div>
      <div ref={actions} className="flex flex-wrap justify-center gap-3">
        <ButtonLink to="/">{m().review.backHome}</ButtonLink>
        <ButtonLink to="/puzzles" variant="secondary">{m().review.morePuzzles}</ButtonLink>
      </div>
    </section>
  );
}
