import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { cardClass } from '../components/Card';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import { loadCourse } from '../lib/data';
import { completedCount, flatLessons, lessonKey, nextUp, RESUME_STATE } from '../lib/lesson/nav';
import { useProgress } from '../store/progress';

export default function Course() {
  const { slug = '' } = useParams();
  const load = useCallback(() => loadCourse(slug), [slug]);
  const state = useLoad(load);
  const completed = useProgress((s) => s.data.completedLessons);
  const last = useProgress((s) => s.data.lastLesson);

  const back = (
    <Link to="/courses" className="inline-flex min-h-11 items-center font-bold underline">
      {m().course.back}
    </Link>
  );
  if (state.status === 'loading') return <p className="text-xl text-muted">{m().common.loading}</p>;
  if (state.status === 'error') {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-xl font-bold text-coral">{m().course.loadError}</p>
        {back}
      </div>
    );
  }

  const course = state.data;
  const total = flatLessons(course).length;
  const done = completedCount(course.slug, completed, total);
  const finished = total > 0 && done >= total;
  const resume = !finished && last?.course === course.slug ? flatLessons(course).find((l) => l.lesson.id === last.lesson) : undefined;
  const target = resume ?? nextUp(course, completed);
  const started = done > 0 || resume !== undefined;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {back}
        <h1 className="text-3xl font-bold">{course.title}</h1>
        <p className="text-sm font-bold text-muted">
          {m().courses.kinds[course.kind]} · {m().courses.levels[course.level]}
          {course.side ? ` · ${fmt(m().course.opening, { side: course.side === 'white' ? m().course.white : m().course.black })}` : ''}
          {' · '}
          {fmt(m().courses.lessonsDone, { done, total })}
        </p>
        {target ? (
          <ButtonLink to={`/learn/${encodeURIComponent(course.slug)}/${encodeURIComponent(target.lesson.id)}`} state={resume ? RESUME_STATE : undefined} className="ms-auto">
            {finished ? m().course.startAgain : started ? m().course.continue : m().course.start}
          </ButtonLink>
        ) : null}
      </header>
      <p className="max-w-4xl text-base text-muted">{course.description}</p>

      <ol className="grid min-h-0 flex-1 content-start gap-3 md:grid-cols-2 lg:grid-cols-4">
        {course.chapterList.map((chapter, ci) => (
          <li key={chapter.id}>
            <section aria-labelledby={`ch-${chapter.id}`} className={cardClass('plain', 'h-full space-y-1')}>
              <h2 id={`ch-${chapter.id}`} className="text-lg font-extrabold leading-tight">
                {fmt(m().course.chapter, { n: ci + 1, title: chapter.title })}
              </h2>
              <ul>
                {chapter.lessons.map((lesson) => {
                  const isDone = completed[lessonKey(course.slug, lesson.id)] !== undefined;
                  return (
                    <li key={lesson.id}>
                      <Link
                        to={`/learn/${encodeURIComponent(course.slug)}/${encodeURIComponent(lesson.id)}`}
                        className="flex min-h-11 items-center gap-2 rounded-control px-1 text-base font-bold underline-offset-4 hover:bg-line/50 hover:underline"
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-sm ${isDone ? 'border-leaf bg-leaf text-white' : 'border-line'}`}
                        >
                          {isDone ? '✓' : ''}
                        </span>
                        <span className="min-w-0">
                          {lesson.title}
                          <span className="sr-only"> {isDone ? m().course.done : m().course.notDone}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </li>
        ))}
      </ol>
    </div>
  );
}
