import { useCallback, useMemo } from 'react';
import { useLoad } from '../hooks/useLoad';
import { loadCourse } from '../lib/data';
import { findLesson, RESUME_STATE } from '../lib/lesson/nav';
import { fmt, m } from '../i18n';
import { ButtonLink } from '../components/Button';
import Ring from '../components/Ring';
import { isReady } from '../lib/ready-routes';
import { diffDays, todayLocal } from '../lib/date';
import { reviewQueue } from '../lib/review';
import { levelFor } from '../lib/xp';
import { useActiveProfile } from '../store/profiles';
import { useProgress } from '../store/progress';

/** The Continue card. It only offers a lesson that exists; otherwise it points to the library and never shows a raw slug. */
function ContinueCard({ last }: { last: { course: string; lesson: string } | undefined }) {
  const slug = last?.course ?? '';
  const load = useCallback(() => (slug === '' ? Promise.reject(new Error('no course')) : loadCourse(slug)), [slug]);
  const state = useLoad(load);
  const lesson = last && state.status === 'ready' ? findLesson(state.data, last.lesson) : null;
  return (
    <section className="rounded-2xl border-2 border-amber bg-surface p-4">
      <h2 className="text-lg font-bold text-muted">{m().home.continue}</h2>
      {last && state.status === 'loading' ? <p className="text-lg text-muted">{m().common.loading}</p> : null}
      {last && state.status === 'ready' && lesson ? (
        <>
          <p className="text-xl font-extrabold">{state.data.title}</p>
          <p className="text-muted">{lesson.lesson.title}</p>
          <ButtonLink to={`/learn/${encodeURIComponent(last.course)}/${encodeURIComponent(last.lesson)}`} state={RESUME_STATE} className="mt-3">
            {m().home.continueButton}
          </ButtonLink>
        </>
      ) : null}
      {!last || state.status === 'error' || (state.status === 'ready' && !lesson) ? (
        <>
          <p className="text-lg">{m().home.nothingYet}</p>
          <ButtonLink to="/courses" variant="secondary" className="mt-3">
            {m().home.browseCourses}
          </ButtonLink>
        </>
      ) : null}
    </section>
  );
}

export default function Home() {
  const profile = useActiveProfile();
  const data = useProgress((s) => s.data);
  const { level, intoLevel, forNext } = levelFor(data.xp);
  const due = useMemo(() => reviewQueue(Object.values(data.srs), todayLocal()).length, [data.srs]);
  const last = data.lastLesson;
  // A streak only counts while the last active day is today or yesterday.
  const lastDay = data.streak.lastDay;
  const streak = lastDay !== undefined && diffDays(todayLocal(), lastDay) > 1 ? 0 : data.streak.current;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">
          <span aria-hidden="true">{profile.avatar} </span>
          {fmt(m().home.welcome, { name: profile.name || m().home.defaultName })}
        </h1>
        <p className="mt-1 text-lg text-muted">{m().app.tagline}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section className="flex items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4" aria-label={m().home.levelRing}>
          <Ring value={forNext > 0 ? intoLevel / forNext : 0} label={m().home.levelRing} size={96}>
            <span className="text-2xl">{level}</span>
          </Ring>
          <div>
            <p className="text-xl font-extrabold">{fmt(m().home.level, { level })}</p>
            <p className="text-muted">{fmt(m().home.xpProgress, { into: intoLevel, total: forNext })}</p>
          </div>
        </section>

        <section className="rounded-2xl border-2 border-line bg-surface p-4">
          <h2 className="text-lg font-bold text-muted">{m().home.streak}</h2>
          <p className="text-3xl font-extrabold">
            <span aria-hidden="true">🔥 </span>
            {fmt(m().home.streakDays, { count: streak })}
          </p>
          <p className="text-muted">{fmt(m().home.bestStreak, { count: data.streak.best })}</p>
        </section>

        {isReady('/review') ? (
        <section className="rounded-2xl border-2 border-line bg-surface p-4">
          <h2 className="text-lg font-bold text-muted">{m().nav.review}</h2>
          <p className="text-xl font-extrabold">{due > 0 ? fmt(m().home.dueReviews, { count: due }) : m().home.noDue}</p>
          {due > 0 ? (
            <ButtonLink to="/review" variant="secondary" className="mt-3">
              {m().home.reviewNow}
            </ButtonLink>
          ) : null}
        </section>
        ) : null}

        {isReady('/courses') ? <ContinueCard last={last} /> : null}
      </div>

      <ButtonLink to="/puzzles">{m().home.startPuzzles}</ButtonLink>
    </div>
  );
}
