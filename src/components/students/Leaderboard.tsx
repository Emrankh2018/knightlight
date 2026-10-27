import { useEffect, useRef, useState, type Ref } from 'react';
import { fmt, m } from '../../i18n';
import { rankStudents, SORT_KEYS, type Ranked, type SortKey, type StudentStats } from '../../lib/leaderboard';
import Avatar from '../Avatar';
import Button from '../Button';

interface Props {
  rows: readonly StudentStats[];
  sort: SortKey;
  onSort: (key: SortKey) => void;
  big: boolean;
  onToggleBig: () => void;
  /** Ref for the "Projector view" button, so the page can return focus to it when the projector view closes. */
  toggleRef?: Ref<HTMLButtonElement>;
}

type View = 'top5' | 'all' | 'az';
const VIEWS: readonly View[] = ['top5', 'all', 'az'];
const TOP_COUNT = 5;

export default function Leaderboard({ rows, sort, onSort, big, onToggleBig, toggleRef }: Props) {
  const t = m().students.leaderboard;
  const [view, setView] = useState<View>('top5');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (big) headingRef.current?.focus();
  }, [big]);

  const ranked = rankStudents(rows, sort);
  // Nobody has scored yet: a "top 5" of arbitrary names would be unfair, so show the whole class A to Z.
  const nobodyScored = !ranked.some((r) => r[sort] > 0);
  const shownView: View = !big ? 'all' : view === 'top5' && nobodyScored ? 'az' : view;
  const shown: Ranked[] =
    shownView === 'top5'
      ? ranked.filter((r) => r[sort] > 0).slice(0, TOP_COUNT)
      : shownView === 'az'
        ? [...ranked].sort((a, b) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1))
        : ranked;
  const showRank = shownView !== 'az';

  const size = big ? 'text-2xl xl:text-4xl' : 'text-lg';
  const pad = big ? 'px-3 py-2 xl:px-4 xl:py-3' : 'px-3 py-2';
  const nowrap = big ? 'whitespace-nowrap' : '';
  const bigBtn = big ? 'min-h-14 px-5 text-xl xl:min-h-16 xl:px-8 xl:text-2xl' : '';
  const head = (key: SortKey | null, label: string, numeric: boolean) => (
    <th scope="col" className={`${pad} ${nowrap} font-extrabold ${numeric ? 'text-end' : 'text-start'} ${key === sort ? 'underline' : ''}`}>
      {label}
    </th>
  );
  const cell = (key: SortKey | null) => `${pad} ${nowrap} text-end tabular-nums ${key === sort ? 'font-extrabold' : ''}`;
  const days = (n: number): string => (n === 1 ? t.day : fmt(t.days, { count: n }));
  const streakText = (n: number): string => (big && n === 0 ? t.startToday : days(n));
  const viewLabel: Record<View, string> = { top5: t.top5, all: t.everyone, az: t.alphabetical };

  return (
    <section aria-labelledby="lb-title" className={big ? 'flex h-[calc(100dvh-3rem)] flex-col gap-3' : 'space-y-4'}>
      <div className="flex flex-wrap items-center gap-3">
        <h2
          id="lb-title"
          ref={headingRef}
          tabIndex={-1}
          className={`me-auto font-extrabold focus:outline-none ${big ? 'text-3xl xl:text-5xl' : 'text-2xl'}`}
        >
          {t.title}
        </h2>
        <div role="group" aria-label={t.sortBy} className="flex flex-wrap items-center gap-2">
          {SORT_KEYS.map((k) => (
            <Button key={k} variant={k === sort ? 'primary' : 'secondary'} aria-pressed={k === sort} className={bigBtn} onClick={() => onSort(k)}>
              {t[k]}
            </Button>
          ))}
        </div>
        <Button ref={toggleRef} variant={big ? 'primary' : 'secondary'} aria-pressed={big} className={bigBtn} onClick={onToggleBig}>
          {big ? t.exitProjector : t.projector}
        </Button>
      </div>
      {big ? (
        <div role="group" aria-label={t.view} className="flex flex-wrap items-center gap-2">
          {VIEWS.map((v) => (
            <Button key={v} variant={v === shownView ? 'primary' : 'secondary'} aria-pressed={v === shownView} className={bigBtn} onClick={() => setView(v)}>
              {viewLabel[v]}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-base text-muted">{t.namesOnScreen}</p>
      )}
      {ranked.length === 0 ? (
        <p className={size}>{t.empty}</p>
      ) : (
        <div
          role="region"
          aria-label={t.title}
          tabIndex={0}
          className={`rounded-2xl border-2 border-line bg-surface ${big ? 'min-h-0 flex-1 overflow-y-auto' : 'overflow-x-auto'}`}
        >
          <table className={`w-full ${size}`}>
            <caption className="sr-only">{fmt(t.caption, { key: t[sort] })}</caption>
            <thead className="sticky top-0 border-b-2 border-line bg-surface">
              <tr>
                {showRank ? head(null, t.rank, false) : null}
                {head(null, t.student, false)}
                {head(null, t.level, true)}
                {head('xp', t.xp, true)}
                {head('streak', t.streak, true)}
                {head('puzzles', t.puzzles, true)}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-b-0">
                  {showRank ? <th scope="row" className={`${pad} ${nowrap} text-start font-extrabold tabular-nums`}>{r.rank}</th> : null}
                  <td className={`${pad} ${big ? 'w-full max-w-0' : ''}`}>
                    <span className="flex items-center gap-3">
                      <Avatar value={r.avatar} size={big ? 'xl' : 'lg'} />
                      <span className={`font-bold ${big ? 'min-w-0 truncate whitespace-nowrap' : 'break-words'}`}>{r.name}</span>
                    </span>
                  </td>
                  <td className={cell(null)}>{r.level}</td>
                  <td className={cell('xp')}>{r.xp}</td>
                  <td className={cell('streak')}>{streakText(r.streak)}</td>
                  <td className={cell('puzzles')}>{r.puzzles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {big && shownView === 'top5' && ranked.length > shown.length ? (
        <p className="text-xl text-muted">{fmt(t.showingTop, { count: shown.length, total: ranked.length })}</p>
      ) : null}
      {big && shownView === 'az' ? <p className="text-xl text-muted">{t.alphaNote}</p> : null}
      <p className={big ? 'text-xl text-muted' : 'text-base text-muted'}>{t.note}</p>
    </section>
  );
}
