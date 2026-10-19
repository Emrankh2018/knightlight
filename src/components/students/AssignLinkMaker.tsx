import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useLoad } from '../../hooks/useLoad';
import { fmt, m } from '../../i18n';
import { assignPath, assignUrl, type Assignment } from '../../lib/assign';
import { loadCatalog, loadCourse, loadPuzzleIndex } from '../../lib/data';
import { flatLessons, isListed } from '../../lib/lesson/nav';
import { themeLabel } from '../PuzzleRound';
import Button, { ButtonLink } from '../Button';

const FIELD = 'min-h-12 w-full rounded-xl border-2 border-ink bg-bg px-3 text-lg text-fg dark:border-amber';

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-48 flex-1 space-y-1">
      <label htmlFor={id} className="block text-lg font-bold">{label}</label>
      {children}
    </div>
  );
}

function LinkOutput({ assignment }: { assignment: Assignment }) {
  const t = m().students.link;
  const ref = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const url = assignUrl(assignment, window.location.href);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setNote(t.copied);
    } catch {
      ref.current?.select();
      setNote(t.copyFailed);
    }
  };

  return (
    <div className="space-y-2">
      <label htmlFor="assign-link" className="block text-lg font-bold">{t.linkLabel}</label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="assign-link"
          ref={ref}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className={`${FIELD} min-w-0 flex-1 basis-80 font-mono text-base`}
        />
        <Button onClick={() => void copy()}>{t.copy}</Button>
        <ButtonLink to={assignPath(assignment)} variant="secondary">{t.test}</ButtonLink>
      </div>
      <p role="status" className="text-lg font-bold">{note}</p>
    </div>
  );
}

function PuzzlePicker() {
  const t = m().students.link;
  const index = useLoad(loadPuzzleIndex);
  const [levelId, setLevelId] = useState('');
  const [theme, setTheme] = useState('');
  if (index.status === 'loading') return <p className="text-lg text-muted">{m().common.loading}</p>;
  if (index.status === 'error') return <p role="alert" className="text-lg font-bold text-error">{t.loadError}</p>;
  const level = index.data.levels.find((l) => l.id === levelId) ?? index.data.levels[0];
  if (!level) return <p role="alert" className="text-lg font-bold text-error">{t.loadError}</p>;
  const buckets = [...level.buckets].filter((b) => b.count > 0).sort((a, b) => (a.theme === 'mixed' ? -1 : b.theme === 'mixed' ? 1 : 0));
  const bucket = buckets.find((b) => b.theme === theme) ?? buckets[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Field id="link-level" label={t.level}>
          <select id="link-level" value={level.id} onChange={(e) => setLevelId(e.target.value)} className={FIELD}>
            {index.data.levels.map((l) => (
              <option key={l.id} value={l.id}>{m().puzzles.levels[l.id] ?? l.id}</option>
            ))}
          </select>
        </Field>
        <Field id="link-theme" label={t.theme}>
          <select id="link-theme" value={bucket?.theme ?? ''} onChange={(e) => setTheme(e.target.value)} className={FIELD}>
            {buckets.map((b) => (
              <option key={b.theme} value={b.theme}>{fmt(t.themeOption, { theme: themeLabel(b.theme), count: b.count })}</option>
            ))}
          </select>
        </Field>
      </div>
      {bucket ? <LinkOutput assignment={{ type: 'puzzles', level: level.id, theme: bucket.theme }} /> : null}
    </div>
  );
}

function LessonPicker() {
  const t = m().students.link;
  const catalog = useLoad(loadCatalog);
  const [slug, setSlug] = useState('');
  if (catalog.status === 'loading') return <p className="text-lg text-muted">{m().common.loading}</p>;
  const entries = catalog.status === 'ready' ? catalog.data.filter(isListed) : [];
  const course = entries.find((c) => c.slug === slug) ?? entries[0];
  if (catalog.status === 'error' || !course) return <p role="alert" className="text-lg font-bold text-error">{t.loadError}</p>;
  return (
    <div className="space-y-4">
      <Field id="link-course" label={t.course}>
        <select id="link-course" value={course.slug} onChange={(e) => setSlug(e.target.value)} className={FIELD}>
          {entries.map((c) => (
            <option key={c.slug} value={c.slug}>{c.title}</option>
          ))}
        </select>
      </Field>
      <LessonSelect key={course.slug} slug={course.slug} />
    </div>
  );
}

function LessonSelect({ slug }: { slug: string }) {
  const t = m().students.link;
  const load = useCallback(() => loadCourse(slug), [slug]);
  const full = useLoad(load);
  const [lessonId, setLessonId] = useState('');
  if (full.status === 'loading') return <p className="text-lg text-muted">{m().common.loading}</p>;
  if (full.status === 'error') return <p role="alert" className="text-lg font-bold text-error">{t.loadError}</p>;
  const lessons = flatLessons(full.data).filter((l) => l.lesson.steps.length > 0);
  const lesson = lessons.find((l) => l.lesson.id === lessonId) ?? lessons[0];
  if (!lesson) return <p className="text-lg">{t.noLessons}</p>;
  return (
    <div className="space-y-4">
      <Field id="link-lesson" label={t.lessonPick}>
        <select id="link-lesson" value={lesson.lesson.id} onChange={(e) => setLessonId(e.target.value)} className={FIELD}>
          {lessons.map((l) => (
            <option key={l.lesson.id} value={l.lesson.id}>{l.lesson.title}</option>
          ))}
        </select>
      </Field>
      <LinkOutput assignment={{ type: 'lesson', course: slug, lesson: lesson.lesson.id }} />
    </div>
  );
}

export default function AssignLinkMaker() {
  const t = m().students.link;
  const [kind, setKind] = useState<'puzzles' | 'lesson'>('puzzles');
  return (
    <section aria-labelledby="link-title" className="space-y-4">
      <h2 id="link-title" className="text-2xl font-extrabold">{t.title}</h2>
      <p className="text-lg">{t.intro}</p>
      <div role="group" aria-label={t.kind} className="flex flex-wrap gap-2">
        <Button variant={kind === 'puzzles' ? 'primary' : 'secondary'} aria-pressed={kind === 'puzzles'} onClick={() => setKind('puzzles')}>{t.puzzles}</Button>
        <Button variant={kind === 'lesson' ? 'primary' : 'secondary'} aria-pressed={kind === 'lesson'} onClick={() => setKind('lesson')}>{t.lesson}</Button>
      </div>
      {kind === 'puzzles' ? <PuzzlePicker /> : <LessonPicker />}
    </section>
  );
}
