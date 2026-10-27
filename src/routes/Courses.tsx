import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button, { ButtonLink } from '../components/Button';
import MiniBoard from '../components/MiniBoard';
import Ring from '../components/Ring';
import { cardClass } from '../components/Card';
import { coverFen } from '../lib/cover';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import type { CourseKind, Level } from '../lib/content/types';
import { loadCatalog, type CatalogEntry } from '../lib/data';
import { completedCount, isListed, RESUME_STATE } from '../lib/lesson/nav';
import { useProgress } from '../store/progress';

const LEVEL_ORDER: readonly Level[] = ['beginner', 'intermediate', 'mid-advanced', 'advanced', 'master'];
const KINDS: readonly CourseKind[] = ['skills', 'opening'];

function FilterGroup<T extends string>({ label, options, value, onChange, nameOf }: { label: string; options: readonly T[]; value: T | null; onChange: (v: T | null) => void; nameOf: (v: T) => string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="font-bold text-muted">{label}</span>
      <Button variant={value === null ? 'primary' : 'secondary'} aria-pressed={value === null} onClick={() => onChange(null)}>
        {m().courses.all}
      </Button>
      {options.map((o) => (
        <Button key={o} variant={value === o ? 'primary' : 'secondary'} aria-pressed={value === o} onClick={() => onChange(o)}>
          {nameOf(o)}
        </Button>
      ))}
    </div>
  );
}

function CourseCard({ entry }: { entry: CatalogEntry }) {
  const completed = useProgress((s) => s.data.completedLessons);
  const last = useProgress((s) => s.data.lastLesson);
  const done = completedCount(entry.slug, completed, entry.counts.lessons);
  const total = entry.counts.lessons;
  const finished = total > 0 && done >= total;
  const started = done > 0 || last?.course === entry.slug;
  const resume = !finished && last?.course === entry.slug;
  const to = resume ? `/learn/${encodeURIComponent(entry.slug)}/${encodeURIComponent(last.lesson)}` : `/courses/${encodeURIComponent(entry.slug)}`;
  const titleId = `course-${entry.slug}`;
  return (
    <li>
      <article aria-labelledby={titleId} className={cardClass('interactive', 'flex h-full flex-col gap-3')}>
        <div className="flex items-start gap-4">
          <MiniBoard fen={coverFen(entry.slug)} size={96} />
          <div className="min-w-0 flex-1 space-y-1">
            <h2 id={titleId} className="text-xl font-extrabold">
              <Link to={`/courses/${encodeURIComponent(entry.slug)}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                {entry.title}
              </Link>
            </h2>
            <p className="text-sm font-bold text-muted">
              {m().courses.kinds[entry.kind]} · {m().courses.levels[entry.level]}
            </p>
          </div>
          <Ring value={total > 0 ? done / total : 0} label={m().courses.progress} size={64} stroke={7}>
            <span className="text-sm">{done}/{total}</span>
          </Ring>
        </div>
        {entry.reviewed ? null : (
          <p className="self-start rounded-full border-2 border-amber bg-amber/20 px-3 py-0.5 text-base font-bold">{m().courses.checking}</p>
        )}
        <p className="flex-1">{entry.description}</p>
        <p className="font-bold text-muted">{fmt(m().courses.counts, { chapters: entry.counts.chapters, lessons: entry.counts.lessons })}</p>
        <ButtonLink to={to} state={resume ? RESUME_STATE : undefined} className="self-start">
          {finished ? m().courses.review : started ? m().courses.continueButton : m().courses.start}
          <span className="sr-only"> {entry.title}</span>
        </ButtonLink>
      </article>
    </li>
  );
}

export default function Courses() {
  const catalog = useLoad(loadCatalog);
  const [kind, setKind] = useState<CourseKind | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const listed = useMemo(() => (catalog.status === 'ready' ? catalog.data.filter(isListed) : []), [catalog]);
  const levels = LEVEL_ORDER.filter((l) => listed.some((c) => c.level === l));
  const shown = listed.filter((c) => (kind === null || c.kind === kind) && (level === null || c.level === level));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">{m().courses.title}</h1>
        <p className="mt-1 text-lg text-muted">{m().courses.intro}</p>
      </header>
      {catalog.status === 'loading' ? <p className="text-xl text-muted">{m().common.loading}</p> : null}
      {catalog.status === 'error' ? <p role="alert" className="text-xl font-bold text-coral">{m().courses.loadError}</p> : null}
      {catalog.status === 'ready' ? (
        <>
          <section aria-label={m().courses.filters} className="space-y-3">
            <FilterGroup label={m().courses.filterKind} options={KINDS} value={kind} onChange={setKind} nameOf={(k) => m().courses.kinds[k]} />
            <FilterGroup label={m().courses.filterLevel} options={levels} value={level} onChange={setLevel} nameOf={(l) => m().courses.levels[l]} />
          </section>
          {shown.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xl" role="status">{m().courses.none}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setKind(null);
                  setLevel(null);
                }}
              >
                {m().courses.clear}
              </Button>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((c) => (
                <CourseCard key={c.slug} entry={c} />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
