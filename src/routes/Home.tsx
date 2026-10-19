import { useMemo } from 'react';
import { fmt, m } from '../i18n';
import { ButtonLink } from '../components/Button';
import Ring from '../components/Ring';
import { isReady } from '../lib/ready-routes';
import { diffDays, todayLocal } from '../lib/date';
import { dueItems } from '../lib/srs';
import { levelFor } from '../lib/xp';
import { useActiveProfile } from '../store/profiles';
import { useProgress } from '../store/progress';

export default function Home() {
  const profile = useActiveProfile();
  const data = useProgress((s) => s.data);
  const { level, intoLevel, forNext } = levelFor(data.xp);
  const due = useMemo(() => dueItems(Object.values(data.srs), todayLocal()).length, [data.srs]);
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

        {isReady('/courses') ? (
        <section className="rounded-2xl border-2 border-amber bg-surface p-4">
          <h2 className="text-lg font-bold text-muted">{m().home.continue}</h2>
          {last ? (
            <>
              <p className="text-xl font-extrabold">{last.course}</p>
              <ButtonLink to={`/learn/${encodeURIComponent(last.course)}/${encodeURIComponent(last.lesson)}`} className="mt-3">
                {m().home.continueButton}
              </ButtonLink>
            </>
          ) : (
            <p className="text-lg">{m().home.nothingYet}</p>
          )}
        </section>
        ) : null}
      </div>

      <ButtonLink to="/puzzles">{m().home.startPuzzles}</ButtonLink>
    </div>
  );
}
