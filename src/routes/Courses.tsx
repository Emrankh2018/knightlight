import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cardClass } from '../components/Card';
import MiniBoard from '../components/MiniBoard';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import { coverFen } from '../lib/cover';
import { loadCatalog, type CatalogEntry } from '../lib/data';
import { completedCount, isListed, RESUME_STATE } from '../lib/lesson/nav';
import { useProgress } from '../store/progress';

/** One whole card is the link, so there is no separate Start button and no filter bar: every course fits on one screen. */
function CourseCard({ entry }: { entry: CatalogEntry }) {
  const completed = useProgress((s) => s.data.completedLessons);
  const last = useProgress((s) => s.data.lastLesson);
  const total = entry.counts.lessons;
  const done = completedCount(entry.slug, completed, total);
  const finished = total > 0 && done >= total;
  const resume = !finished && last?.course === entry.slug;
  const to = resume ? `/learn/${encodeURIComponent(entry.slug)}/${encodeURIComponent(last.lesson)}` : `/courses/${encodeURIComponent(entry.slug)}`;
  const action = finished ? m().courses.review : done > 0 || resume ? m().courses.continueButton : m().courses.start;
  return (
    <li className="min-h-0">
      <Link
        to={to}
        state={resume ? RESUME_STATE : undefined}
        title={entry.description}
        className={cardClass('interactive', 'flex h-full min-h-11 flex-col items-center gap-2 text-center')}
      >
        <MiniBoard fen={coverFen(entry.slug)} size={96} />
        <span className="text-lg font-extrabold leading-tight">{entry.title}</span>
        <span className="text-sm font-bold text-muted">
          {m().courses.kinds[entry.kind]} · {m().courses.levels[entry.level]}
        </span>
        <span className="mt-auto w-full space-y-1">
          <span className="block h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={fmt(m().courses.lessonsDone, { done, total })}>
            <span className="block h-full rounded-full bg-amber" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
          </span>
          <span className="block text-sm font-bold">
            {done}/{total} · {action}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function Courses() {
  const catalog = useLoad(loadCatalog);
  const listed = useMemo(() => (catalog.status === 'ready' ? catalog.data.filter(isListed) : []), [catalog]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h1 className="text-3xl font-bold">{m().courses.title}</h1>
      {catalog.status === 'loading' ? <p className="text-xl text-muted">{m().common.loading}</p> : null}
      {catalog.status === 'error' ? <p role="alert" className="text-xl font-bold text-coral">{m().courses.loadError}</p> : null}
      {catalog.status === 'ready' ? (
        <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:auto-rows-fr">
          {listed.map((c) => (
            <CourseCard key={c.slug} entry={c} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
