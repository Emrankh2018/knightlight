import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Button, { ButtonLink } from '../Button';
import SoundToggle from '../SoundToggle';
import { fmt, m } from '../../i18n';
import type { Course, Step } from '../../lib/content/types';
import { stepKey, lessonKey, type FlatLesson } from '../../lib/lesson/nav';
import { awardFor, isClean, lessonEarnsCredit, type StepResult } from '../../lib/lesson/scoring';
import { useProgress } from '../../store/progress';
import { useUi } from '../../store/ui';
import ExplainView from './ExplainView';
import FindMoveView from './FindMoveView';
import LineDrillView from './LineDrillView';
import QuizView from './QuizView';
import TeacherPanel from './TeacherPanel';
import { bigButton, isButtonTarget, PresentShell, SidePanel, useKeys, ARIA_OFF, type StepControls } from './shared';

interface Props {
  course: Course;
  current: FlatLesson;
  next: FlatLesson | null;
  /** Arrived through a Continue button, so pick up at the saved step. */
  resume: boolean;
}

/** Present mode hides the site chrome and keeps toasts from covering the board. */
function usePresentEffects(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    document.documentElement.dataset.classMode = '';
    useUi.getState().setSuppressToasts(true);
    return () => {
      delete document.documentElement.dataset.classMode;
      useUi.getState().setSuppressToasts(false);
    };
  }, [on]);
}

export default function LessonPlayer({ course, current, next, resume }: Props) {
  const { lesson } = current;
  const steps = lesson.steps;
  const slug = course.slug;
  const initial = (): number => {
    const last = useProgress.getState().data.lastLesson;
    const done = useProgress.getState().data.completedLessons[lessonKey(slug, lesson.id)] !== undefined;
    return resume && !done && last && last.course === slug && last.lesson === lesson.id && last.step < steps.length ? last.step : 0;
  };
  const [stepIndex, setStepIndex] = useState(initial);
  const [doneSteps, setDoneSteps] = useState<readonly number[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [classMode, setClassMode] = useState(false);
  const [finished, setFinished] = useState<{ xp: number; perfect: boolean; credited: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const teacherView = useUi((s) => s.teacherView);
  const setTeacherView = useUi((s) => s.setTeacherView);
  const completedSteps = useProgress((s) => s.data.completedSteps);
  const results = useRef<(StepResult | undefined)[]>([]);
  const startXp = useRef(useProgress.getState().data.xp);
  const controls = useRef<StepControls>({});
  const titleRef = useRef<HTMLParagraphElement>(null);

  usePresentEffects(classMode);

  // Notes are for the coach: they never carry over from another page, and never appear when the lesson opens.
  useEffect(() => {
    useUi.getState().setTeacherView(false);
  }, []);

  const setPresent = (on: boolean): void => {
    if (on) setTeacherView(false);
    setClassMode(on);
  };

  const restart = (): void => {
    results.current = [];
    startXp.current = useProgress.getState().data.xp;
    controls.current = {};
    setDoneSteps([]);
    setFinished(null);
    setStepIndex(0);
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    useProgress.getState().setLastLesson(slug, lesson.id, stepIndex);
    if (stepIndex > 0) titleRef.current?.focus();
  }, [slug, lesson.id, stepIndex]);

  const step: Step | undefined = steps[stepIndex];
  const canAdvance = (i: number): boolean => {
    const s = steps[i];
    return s !== undefined && (doneSteps.includes(i) || completedSteps[stepKey(slug, s.id)] !== undefined);
  };
  const isLast = stepIndex >= steps.length - 1;

  const complete = (i: number, result: StepResult): void => {
    const s = steps[i];
    if (!s) return;
    setDoneSteps((prev) => (prev.includes(i) ? prev : [...prev, i]));
    results.current[i] = result;
    const key = stepKey(slug, s.id);
    const store = useProgress.getState();
    const award = awardFor(s.type, result);
    // Replaying a finished step earns nothing more, so XP cannot be farmed.
    if (store.data.completedSteps[key] === undefined) {
      if (award.step) store.recordStep(key, award.step.hint);
      if (award.line) store.recordLine(key, award.line.clean);
    }
    if (award.srs) store.addSrs(`line:${key}`, 'line', key);
  };

  const goTo = (i: number): void => {
    if (i < 0 || i >= steps.length) return;
    setStepIndex(i);
  };

  const finish = (): void => {
    const store = useProgress.getState();
    const credited = lessonEarnsCredit(
      steps.map((s, i) => {
        const r = results.current[i];
        return { type: s.type, solved: r ? !r.failed : store.data.completedSteps[stepKey(slug, s.id)] !== undefined };
      }),
    );
    const perfect = credited && lessonPerfect(results.current, steps.length);
    if (credited) {
      store.recordLesson(lessonKey(slug, lesson.id), perfect);
      store.setLastLesson(slug, next ? next.lesson.id : lesson.id, 0);
    } else {
      store.setLastLesson(slug, lesson.id, 0);
    }
    setFinished({ xp: useProgress.getState().data.xp - startXp.current, perfect, credited });
  };

  const advance = (): void => {
    if (!canAdvance(stepIndex)) return;
    if (isLast) finish();
    else goTo(stepIndex + 1);
  };

  useKeys((e) => {
    const key = e.key.toLowerCase();
    if (key === 'escape' && classMode) {
      setPresent(false);
      return;
    }
    if (finished) return;
    const c = controls.current;
    // Holding a key must not run through several steps.
    if (e.repeat && (key === 'arrowleft' || key === 'arrowright' || key === 'enter')) return;
    if (key === 'arrowleft') {
      if (!c.back?.()) goTo(stepIndex - 1);
    } else if (key === 'arrowright' || (key === 'enter' && !isButtonTarget(e))) {
      if (!c.forward?.()) advance();
    } else if (key === 'h') c.hint?.();
    else if (key === 'f') setFlipped((v) => !v);
    else if (key === 'p') setPresent(!classMode);
    else if (key === 't') setTeacherView(!teacherView);
    else if (/^[1-9]$/.test(key)) c.answer?.(Number(key));
  });

  const btn = bigButton(classMode);
  const small = 'min-h-11 px-3 text-base';
  const titleSize = classMode ? 'text-xl 2xl:text-3xl' : 'text-2xl';

  const toggles = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={classMode ? 'primary' : 'secondary'} aria-pressed={classMode} className={small} onClick={() => setPresent(!classMode)}>
        {m().lesson.present}
      </Button>
      <Button variant={teacherView ? 'primary' : 'secondary'} aria-pressed={teacherView} className={small} onClick={() => setTeacherView(!teacherView)}>
        {m().lesson.teacherView}
      </Button>
      {finished ? null : (
        <Button variant="secondary" className={small} onClick={() => setFlipped((v) => !v)}>
          {m().lesson.flip}
        </Button>
      )}
      {!classMode && (finished || stepIndex > 0 || doneSteps.length > 0) ? (
        <Button variant="secondary" className={small} onClick={restart}>
          {m().lesson.restart}
        </Button>
      ) : null}
      {classMode ? <SoundToggle compact className="hover:bg-line" /> : null}
    </div>
  );

  const reviewBadge = course.reviewed ? null : teacherView ? (
    <p className="inline-block rounded-full border-2 border-coral bg-coral/15 px-3 py-0.5 text-base font-bold">{m().courses.unreviewed}</p>
  ) : (
    <p className="inline-block rounded-full border-2 border-amber bg-amber/20 px-3 py-0.5 text-base font-bold">{m().courses.checking}</p>
  );

  const stepText = finished
    ? finished.credited
      ? m().lesson.completeTitle
      : m().lesson.finishedNoCredit
    : `${fmt(m().lesson.stepOf, { n: stepIndex + 1, total: steps.length })}${step && !classMode ? ` · ${m().lesson.stepLabels[step.type] ?? step.type}` : ''}`;

  const header = (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {classMode ? null : (
          <Link to={`/courses/${encodeURIComponent(slug)}`} className="inline-flex min-h-11 items-center font-bold underline">
            {m().lesson.backToCourse}
          </Link>
        )}
        {classMode ? <h1 className={`font-extrabold ${titleSize}`}>{lesson.title}</h1> : null}
        {reviewBadge}
      </div>
      {classMode ? null : <h1 className={`font-extrabold ${titleSize}`}>{lesson.title}</h1>}
      <div className="flex items-center gap-3">
        <p ref={titleRef} tabIndex={-1} className="shrink-0 font-bold text-muted focus:outline-none">
          {stepText}
        </p>
        <div
          role="progressbar"
          aria-label={m().lesson.progress}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={finished ? steps.length : stepIndex}
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-amber" style={{ width: `${((finished ? steps.length : stepIndex) / Math.max(1, steps.length)) * 100}%` }} />
        </div>
      </div>
      <div className="pt-1">{toggles}</div>
    </div>
  );

  if (finished) {
    return <CompleteCard course={course} next={next} classMode={classMode} header={header} xp={finished.xp} perfect={finished.perfect} credited={finished.credited} />;
  }
  if (!step) return <p role="alert" className="text-xl font-bold text-coral">{m().lesson.notFound}</p>;

  const notes: ReactNode = (
    <>
      {teacherView ? <TeacherPanel notes={lesson.teacherNotes} classMode={classMode} /> : null}
      {classMode ? null : <p className="text-sm text-muted">{m().lesson.keyboardHelp}</p>}
    </>
  );
  const footer: ReactNode = (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className={`${btn} ${ARIA_OFF}`} aria-disabled={stepIndex === 0} onClick={() => goTo(stepIndex - 1)}>
          {m().lesson.previous}
        </Button>
        <Button className={`${btn} ${ARIA_OFF}`} aria-disabled={!canAdvance(stepIndex)} onClick={advance}>
          {isLast ? m().lesson.finish : m().lesson.nextStep}
        </Button>
      </div>
    </>
  );

  const common = {
    flipped,
    courseSide: course.side ?? ('white' as const),
    classMode,
    header,
    notes,
    footer,
    controls,
    onComplete: (r: StepResult) => complete(stepIndex, r),
  };
  switch (step.type) {
    case 'explain':
      return <ExplainView key={`${attempt}-${stepIndex}`} step={step} {...common} />;
    case 'find-move':
      return <FindMoveView key={`${attempt}-${stepIndex}`} step={step} {...common} />;
    case 'line-drill':
      return <LineDrillView key={`${attempt}-${stepIndex}`} step={step} {...common} />;
    case 'quiz':
      return <QuizView key={`${attempt}-${stepIndex}`} step={step} {...common} />;
  }
}

function lessonPerfect(results: readonly (StepResult | undefined)[], total: number): boolean {
  for (let i = 0; i < total; i++) {
    const r = results[i];
    if (r === undefined || !isClean(r)) return false;
  }
  return true;
}

function CompleteCard({ course, next, classMode, header, xp, perfect, credited }: { course: Course; next: FlatLesson | null; classMode: boolean; header: ReactNode; xp: number; perfect: boolean; credited: boolean }) {
  const actions = useRef<HTMLDivElement>(null);
  useEffect(() => {
    actions.current?.querySelector('a')?.focus();
  }, []);
  const big = classMode ? 'min-h-14 px-5 text-xl 2xl:min-h-16 2xl:px-8 2xl:text-2xl' : '';
  return (
    <PresentShell classMode={classMode} center>
      <SidePanel classMode={classMode}>
        {header}
        <div className={`space-y-4 ${classMode ? 'text-xl 2xl:text-2xl' : 'text-lg'}`}>
          <div role="status" className="space-y-2 rounded-xl border-2 border-leaf bg-leaf/15 px-4 py-4 text-center">
            <p aria-hidden="true" className="text-5xl">{credited ? '🏆' : '⭐'}</p>
            {credited ? (
              <>
                <p className="text-4xl font-extrabold">{fmt(m().lesson.xpEarned, { xp })}</p>
                {perfect ? <p className="font-bold">{m().lesson.perfect}</p> : null}
              </>
            ) : (
              <p className="font-bold">{m().lesson.noCredit}</p>
            )}
          </div>
          <div ref={actions} className="flex flex-wrap gap-2">
            {next ? (
              <ButtonLink to={`/learn/${encodeURIComponent(course.slug)}/${encodeURIComponent(next.lesson.id)}`} className={big}>
                {fmt(m().lesson.nextLesson, { title: next.lesson.title })}
              </ButtonLink>
            ) : credited ? (
              <p className="font-extrabold">{m().lesson.courseDone}</p>
            ) : null}
            <ButtonLink to={`/courses/${encodeURIComponent(course.slug)}`} variant="secondary" className={big}>
              {m().lesson.backToCourseLink}
            </ButtonLink>
          </div>
        </div>
      </SidePanel>
    </PresentShell>
  );
}
