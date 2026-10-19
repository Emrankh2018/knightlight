import { Link } from 'react-router-dom';
import { buttonClass } from '../components/Button';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import { loadPuzzleIndex } from '../lib/data';
import type { PuzzleIndex, PuzzleLevel } from '../lib/puzzle-types';
import { TACTIC_THEMES, type TacticTheme } from '../lib/tactics';

function countFor(level: PuzzleLevel | undefined, theme: string): number {
  return level?.buckets.find((b) => b.theme === theme)?.count ?? 0;
}

function practiseHref(level: string, theme: string): string {
  return `/puzzles?level=${encodeURIComponent(level)}&theme=${encodeURIComponent(theme)}`;
}

function Card({ theme, index, order }: { theme: TacticTheme; index: PuzzleIndex; order: number }) {
  const t = m().tactics;
  const card = t.cards[theme];
  const beginner = index.levels.find((l) => l.id === 'beginner');
  const beginnerCount = countFor(beginner, theme);
  const others = index.levels.filter((l) => l.id !== 'beginner' && countFor(l, theme) > 0);
  const name = card.name;
  return (
    <li className="flex flex-col rounded-2xl border-2 border-line bg-surface p-5">
      <p className="text-base font-bold text-muted">{fmt(t.step, { n: order })}</p>
      <h2 className="mt-1 text-2xl font-extrabold">{name}</h2>
      <p className="mt-2 flex-1 text-lg leading-snug">{card.blurb}</p>
      {beginnerCount > 0 ? (
        <Link
          to={practiseHref('beginner', theme)}
          aria-label={fmt(t.practiseLabel, { theme: name, count: beginnerCount })}
          className={buttonClass('primary', 'mt-4 min-h-14 text-xl')}
        >
          {t.practise}
          <span className="text-base font-semibold">{fmt(t.count, { count: beginnerCount })}</span>
        </Link>
      ) : (
        <p className="mt-4 rounded-xl border-2 border-dashed border-line px-4 py-3 text-center text-lg text-muted">{t.noBeginner}</p>
      )}
      {others.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={fmt(t.moreLevels, { theme: name })}>
          {others.map((l) => (
            <li key={l.id}>
              <Link
                to={practiseHref(l.id, theme)}
                title={fmt(m().puzzles.ratingRange, { min: l.min, max: l.max })}
                aria-label={fmt(t.levelLabel, { theme: name, level: m().puzzles.levels[l.id] ?? l.id, min: l.min, max: l.max, count: countFor(l, theme) })}
                className={`inline-flex min-h-11 items-center rounded-lg border-2 border-ink px-3 text-base font-bold hover:bg-ink hover:text-cream dark:border-amber dark:text-amber dark:hover:bg-amber dark:hover:text-ink`}
              >
                {t.shortLevels[l.id] ?? l.id}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function Tactics() {
  const t = m().tactics;
  const index = useLoad(loadPuzzleIndex);
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-4xl font-extrabold">{t.title}</h1>
        <p className="mt-2 max-w-3xl text-xl text-muted">{t.intro}</p>
        <p className="mt-3 max-w-3xl rounded-xl border-2 border-amber bg-surface px-4 py-3 text-lg">
          <strong>{t.orderTitle}</strong> {t.orderHint}
        </p>
      </header>
      {index.status === 'loading' ? <p className="text-xl text-muted" role="status">{m().common.loading}</p> : null}
      {index.status === 'error' ? <p role="alert" className="text-xl font-bold text-coral">{m().puzzles.loadError}</p> : null}
      {index.status === 'ready' ? (
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={t.gridLabel}>
          {TACTIC_THEMES.map((theme, i) => (
            <Card key={theme} theme={theme} index={index.data} order={i + 1} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
