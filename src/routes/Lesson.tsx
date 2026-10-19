import { useCallback } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import LessonPlayer from '../components/lesson/LessonPlayer';
import { useLoad } from '../hooks/useLoad';
import { m } from '../i18n';
import { loadCourse } from '../lib/data';
import { findLesson, nextLessonAfter } from '../lib/lesson/nav';

/** Router state set by the Continue buttons (see `RESUME_STATE`). */
function isResume(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'resume' in state && state.resume === true;
}

export default function Lesson() {
  const { slug = '', lessonId = '' } = useParams();
  const load = useCallback(() => loadCourse(slug), [slug]);
  const state = useLoad(load);
  const resume = isResume(useLocation().state);

  if (state.status === 'loading') return <p className="text-xl text-muted">{m().common.loading}</p>;
  const toCourses = state.status === 'error';
  const back = (
    <Link to={toCourses ? '/courses' : `/courses/${encodeURIComponent(slug)}`} className="inline-flex min-h-11 items-center font-bold underline">
      {toCourses ? m().lesson.backToCourses : m().lesson.backToCourse}
    </Link>
  );
  if (state.status === 'error') {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-xl font-bold text-coral">{m().lesson.loadError}</p>
        {back}
      </div>
    );
  }
  const current = findLesson(state.data, lessonId);
  if (!current || current.lesson.steps.length === 0) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-xl font-bold text-coral">{m().lesson.notFound}</p>
        {back}
      </div>
    );
  }
  return <LessonPlayer key={`${slug}/${lessonId}`} course={state.data} current={current} next={nextLessonAfter(state.data, lessonId)} resume={resume} />;
}
