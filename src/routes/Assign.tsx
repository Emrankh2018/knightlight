import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { buttonClass, ButtonLink } from '../components/Button';
import { themeLabel } from '../components/PuzzleRound';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import { findPuzzleSet, parseAssign, targetPath, type Assignment } from '../lib/assign';
import { loadCatalog, loadCourse, loadPuzzleIndex } from '../lib/data';
import { findLesson, isListed } from '../lib/lesson/nav';
import { useActiveProfile } from '../store/profiles';

const START = 'min-h-16 px-10 text-2xl xl:min-h-20 xl:px-14 xl:text-3xl';

export default function Assign() {
  const [params] = useSearchParams();
  const parsed = parseAssign(params);
  const t = m().assign;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-extrabold">{t.title}</h1>
      {parsed.ok ? (
        parsed.assignment.type === 'puzzles' ? (
          <PuzzlesCard level={parsed.assignment.level} theme={parsed.assignment.theme} assignment={parsed.assignment} />
        ) : (
          <LessonCard assignment={parsed.assignment} course={parsed.assignment.course} lesson={parsed.assignment.lesson} />
        )
      ) : (
        <Problem text={`${t.invalid} ${t.reasons[parsed.reason]}`} />
      )}
    </div>
  );
}

function Problem({ text }: { text: string }) {
  const t = m().assign;
  return (
    <div className="space-y-4">
      <p role="alert" className="text-xl font-bold text-error">{text}</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink to="/puzzles" variant="secondary">{t.browsePuzzles}</ButtonLink>
        <ButtonLink to="/courses" variant="secondary">{t.browseCourses}</ButtonLink>
      </div>
    </div>
  );
}

function Loading() {
  return <p className="text-xl text-muted">{m().common.loading}</p>;
}

function Card({ lines, assignment, startLabel }: { lines: ReactNode; assignment: Assignment; startLabel: string }) {
  const t = m().assign;
  const startRef = useRef<HTMLAnchorElement>(null);
  const student = useActiveProfile();
  useEffect(() => {
    startRef.current?.focus();
  }, []);
  return (
    <div className="space-y-6 rounded-2xl border-2 border-line bg-surface p-6">
      <div className="space-y-2 text-2xl">{lines}</div>
      <Link ref={startRef} to={targetPath(assignment)} aria-label={startLabel} className={buttonClass('primary', START)}>
        {t.start}
      </Link>
      <p className="flex flex-wrap items-center gap-2 text-lg">
        <span>{t.working}</span>
        <span aria-hidden="true" className="text-2xl">{student.avatar}</span>
        <strong>{student.name}</strong>
        <Link to="/students" className="inline-flex min-h-11 items-center font-bold underline">{t.changeStudent}</Link>
      </p>
    </div>
  );
}

function PuzzlesCard({ level, theme, assignment }: { level: string; theme: string; assignment: Assignment }) {
  const t = m().assign;
  const index = useLoad(loadPuzzleIndex);
  if (index.status === 'loading') return <Loading />;
  if (index.status === 'error') return <Problem text={t.loadError} />;
  const set = findPuzzleSet(index.data.levels, level, theme);
  if (!set) return <Problem text={t.unknownSet} />;
  return (
    <Card
      assignment={assignment}
      startLabel={t.startPuzzles}
      lines={
        <>
          <p className="font-extrabold">{fmt(t.puzzlesLine, { level: (m().courses.levels as Record<string, string>)[set.level.id] ?? set.level.id, theme: themeLabel(set.bucket.theme) })}</p>
          <p className="text-lg text-muted">{fmt(t.puzzlesCount, { count: set.bucket.count })}</p>
        </>
      }
    />
  );
}

function LessonCard({ assignment, course, lesson }: { assignment: Assignment; course: string; lesson: string }) {
  const t = m().assign;
  const catalog = useLoad(loadCatalog);
  const known = catalog.status === 'ready' && catalog.data.some((c) => c.slug === course && isListed(c));
  const load = useCallback(() => (known ? loadCourse(course) : Promise.reject(new Error('unknown course'))), [known, course]);
  const full = useLoad(load);
  if (catalog.status === 'loading') return <Loading />;
  if (catalog.status === 'error') return <Problem text={t.loadError} />;
  if (!known) return <Problem text={t.unknownLesson} />;
  if (full.status === 'loading') return <Loading />;
  if (full.status === 'error') return <Problem text={t.loadError} />;
  const found = findLesson(full.data, lesson);
  if (!found || found.lesson.steps.length === 0) return <Problem text={t.unknownLesson} />;
  return (
    <Card
      assignment={assignment}
      startLabel={t.startLesson}
      lines={
        <>
          <p className="font-extrabold">{fmt(t.lessonLine, { lesson: found.lesson.title })}</p>
          <p className="text-lg text-muted">{fmt(t.lessonFrom, { course: full.data.title })}</p>
        </>
      }
    />
  );
}
