import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import Button from '../components/Button';
import Ring from '../components/Ring';
import TeacherPanel from '../components/lesson/TeacherPanel';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import { loadCourse } from '../lib/data';
import { completedCount, flatLessons, lessonKey, nextUp, RESUME_STATE } from '../lib/lesson/nav';
import { useProgress } from '../store/progress';
import { useUi } from '../store/ui';

export default function Course() {
  const { slug = '' } = useParams();
  const load = useCallback(() => loadCourse(slug), [slug]);
  const state = useLoad(load);
  const completed = useProgress((s) => s.data.completedLessons);
  const last = useProgress((s) => s.data.lastLesson);
  const teacherView = useUi((s) => s.teacherView);
  const setTeacherView = useUi((s) => s.setTeacherView);

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
    <div className="space-y-6">
      {back}
      <header className="flex flex-wrap items-start gap-5">
        <Ring value={total > 0 ? done / total : 0} label={m().courses.progress} size={96}>
          <span className="text-xl">{done}/{total}</span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-3xl font-extrabold">{course.title}</h1>
          <p className="text-sm font-bold text-muted">
            {m().courses.kinds[course.kind]} · {m().courses.levels[course.level]}
            {course.side ? ` · ${fmt(m().course.opening, { side: course.side === 'white' ? m().course.white : m().course.black })}` : ''}
          </p>
          <p className="text-lg">{course.description}</p>
          {course.reviewed ? null : (
            <p className="inline-block rounded-full border-2 border-coral bg-coral/15 px-3 py-0.5 text-base font-bold">{m().courses.unreviewed}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {target ? (
              <ButtonLink to={`/learn/${encodeURIComponent(course.slug)}/${encodeURIComponent(target.lesson.id)}`} state={resume ? RESUME_STATE : undefined}>
                {finished ? m().course.startAgain : started ? m().course.continue : m().course.start}
              </ButtonLink>
            ) : null}
            <Button variant={teacherView ? 'primary' : 'secondary'} aria-pressed={teacherView} onClick={() => setTeacherView(!teacherView)}>
              {m().lesson.teacherView}
            </Button>
          </div>
        </div>
      </header>

      <ol className="space-y-6">
        {course.chapterList.map((chapter, ci) => (
          <li key={chapter.id}>
            <section aria-labelledby={`ch-${chapter.id}`} className="space-y-3">
              <h2 id={`ch-${chapter.id}`} className="text-2xl font-extrabold">
                {fmt(m().course.chapter, { n: ci + 1, title: chapter.title })}
              </h2>
              <ul className="space-y-3">
                {chapter.lessons.map((lesson) => {
                  const isDone = completed[lessonKey(course.slug, lesson.id)] !== undefined;
                  return (
                    <li key={lesson.id} className="space-y-2 rounded-2xl border-2 border-line bg-surface p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={`inline-flex size-9 items-center justify-center rounded-full border-2 text-lg font-extrabold ${isDone ? 'border-leaf bg-leaf text-white' : 'border-line'}`}
                        >
                          {isDone ? '✓' : ''}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-extrabold">
                            <Link to={`/learn/${encodeURIComponent(course.slug)}/${encodeURIComponent(lesson.id)}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                              {lesson.title}
                            </Link>
                          </h3>
                          <p className="text-sm font-bold text-muted">
                            {fmt(m().course.steps, { count: lesson.steps.length })} · {isDone ? m().course.done : m().course.notDone}
                          </p>
                        </div>
                        <ButtonLink to={`/learn/${encodeURIComponent(course.slug)}/${encodeURIComponent(lesson.id)}`} variant={isDone ? 'secondary' : 'primary'}>
                          {isDone ? m().course.review : m().course.start}
                          <span className="sr-only"> {lesson.title}</span>
                        </ButtonLink>
                      </div>
                      {teacherView ? <TeacherPanel notes={lesson.teacherNotes} /> : null}
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
