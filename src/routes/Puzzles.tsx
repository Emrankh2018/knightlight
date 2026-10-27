import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../components/Button';
import { cardClass } from '../components/Card';
import { Round, themeLabel, type Outcome } from '../components/PuzzleRound';
import { Feedback, isButtonTarget, useKeys } from '../components/lesson/shared';
import { useLoad } from '../hooks/useLoad';
import { fmt, m } from '../i18n';
import { loadPuzzleChunk, loadPuzzleIndex } from '../lib/data';
import type { Puzzle, PuzzleBucket, PuzzleLevel } from '../lib/puzzle-types';
import { shuffle } from '../lib/puzzles';
import { xpFor } from '../lib/xp';
import { useProgress } from '../store/progress';
import { useUi } from '../store/ui';

function levelLabel(id: string): string {
  return m().puzzles.levels[id] ?? id;
}

export default function Puzzles() {
  const [params, setParams] = useSearchParams();
  const index = useLoad(loadPuzzleIndex);
  const levelId = params.get('level');
  const theme = params.get('theme') ?? 'mixed';

  if (index.status === 'loading') return <p className="text-xl text-muted">{m().common.loading}</p>;
  if (index.status === 'error') return <p role="alert" className="text-xl font-bold text-coral">{m().puzzles.loadError}</p>;

  const levels = index.data.levels;
  const level = levels.find((l) => l.id === levelId);
  const bucket = level?.buckets.find((b) => b.theme === theme);
  if (level && bucket) return <Trainer key={bucket.file} level={level} bucket={bucket} />;

  const initialLevel = level?.id ?? levels[0]?.id ?? '';
  return (
    <Picker
      key={initialLevel}
      levels={levels}
      initialLevel={initialLevel}
      unknown={levelId !== null}
      onPick={(l, t) => setParams({ level: l, theme: t })}
    />
  );
}

function Picker({ levels, initialLevel, unknown, onPick }: { levels: PuzzleLevel[]; initialLevel: string; unknown: boolean; onPick: (level: string, theme: string) => void }) {
  const [chosen, setChosen] = useState(initialLevel);
  const level = levels.find((l) => l.id === chosen);
  const buckets = level ? [...level.buckets].sort((a, b) => (a.theme === 'mixed' ? -1 : b.theme === 'mixed' ? 1 : 0)) : [];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">{m().puzzles.title}</h1>
      {unknown ? <Feedback tone="bad">{m().puzzles.unknownSet}</Feedback> : null}
      <section aria-labelledby="pz-levels" className="space-y-3">
        <h2 id="pz-levels" className="text-xl font-bold">{m().puzzles.pickLevel}</h2>
        <div className="flex flex-wrap gap-3">
          {levels.map((l) => (
            <Button key={l.id} variant={l.id === chosen ? 'primary' : 'secondary'} aria-pressed={l.id === chosen} onClick={() => setChosen(l.id)}>
              <span className="flex flex-col items-center leading-tight">
                <span>{levelLabel(l.id)}</span>
                <span className="text-sm font-normal">{fmt(m().puzzles.ratingRange, { min: l.min, max: l.max })}</span>
              </span>
            </Button>
          ))}
        </div>
      </section>
      <section aria-labelledby="pz-themes" className="space-y-3">
        <h2 id="pz-themes" className="text-xl font-bold">{m().puzzles.pickTheme}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buckets.map((b) => (
            <li key={b.file}>
              <button
                type="button"
                aria-label={fmt(m().puzzles.themeCount, { theme: themeLabel(b.theme), count: b.count })}
                onClick={() => onPick(chosen, b.theme)}
                className={cardClass('interactive', 'flex min-h-14 w-full items-center justify-between py-3 text-start text-lg font-bold')}
              >
                <span>{themeLabel(b.theme)}</span>
                <span className="rounded-full bg-line/60 px-3 py-1 text-base text-muted">{b.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Trainer({ level, bucket }: { level: PuzzleLevel; bucket: PuzzleBucket }) {
  const load = useCallback(() => loadPuzzleChunk(bucket.file), [bucket.file]);
  const chunk = useLoad(load);
  const [attempt, setAttempt] = useState(0);
  if (chunk.status === 'loading') return <p className="text-xl text-muted">{m().common.loading}</p>;
  if (chunk.status === 'error') {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-xl font-bold text-coral">{m().puzzles.loadError}</p>
        <Link to="/puzzles" className="inline-flex min-h-11 items-center font-bold underline">{m().puzzles.changeSelection}</Link>
      </div>
    );
  }
  if (chunk.data.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xl">{m().puzzles.emptySet}</p>
        <Link to="/puzzles" className="inline-flex min-h-11 items-center font-bold underline">{m().puzzles.changeSelection}</Link>
      </div>
    );
  }
  return <Session key={attempt} level={level} bucket={bucket} puzzles={chunk.data} onRestart={() => setAttempt((n) => n + 1)} />;
}


function Session({ level, bucket, puzzles, onRestart }: { level: PuzzleLevel; bucket: PuzzleBucket; puzzles: Puzzle[]; onRestart: () => void }) {
  const [seed] = useState(() => Date.now() % 2147483647);
  const order = useMemo(() => shuffle(puzzles, seed), [puzzles, seed]);
  const [pos, setPos] = useState(0);
  const [streak, setStreak] = useState(0);
  const [classMode, setClassMode] = useState(false);
  const recordPuzzle = useProgress((s) => s.recordPuzzle);
  const addSrs = useProgress((s) => s.addSrs);

  useEffect(() => {
    if (!classMode) return;
    document.documentElement.dataset.classMode = '';
    useUi.getState().setSuppressToasts(true);
    return () => {
      delete document.documentElement.dataset.classMode;
      useUi.getState().setSuppressToasts(false);
    };
  }, [classMode]);

  const onDone = (puzzle: Puzzle, o: Outcome): number => {
    const first = useProgress.getState().data.puzzles.solved[puzzle.id] === undefined;
    recordPuzzle(puzzle.id, level.id, o.solved, o.hint);
    if (!o.solved || o.wrong) addSrs(`puzzle:${puzzle.id}`, 'puzzle', puzzle.id);
    setStreak((n) => (o.clean ? n + 1 : 0));
    return o.solved && first ? xpFor({ type: 'puzzle', hint: o.hint }) : 0;
  };

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className={`me-auto font-extrabold ${classMode ? 'text-3xl xl:text-4xl' : 'text-2xl'}`}>
        {fmt(m().puzzles.levelTheme, { level: levelLabel(level.id), theme: themeLabel(bucket.theme) })}
      </h1>
      <Button variant={classMode ? 'primary' : 'secondary'} aria-pressed={classMode} className={classMode ? 'min-h-14 px-5 text-xl xl:min-h-16 xl:px-8 xl:text-2xl' : ''} onClick={() => setClassMode((v) => !v)}>
        {m().puzzles.classMode}
      </Button>
      <Link to="/puzzles" className={`inline-flex min-h-11 items-center font-bold underline ${classMode ? 'text-xl' : ''}`}>
        {m().puzzles.changeSelection}
      </Link>
    </div>
  );

  const puzzle = order[pos];
  if (!puzzle) {
    return (
      <DoneCard header={header} total={order.length} classMode={classMode} onExitClass={() => setClassMode(false)} onRestart={onRestart} />
    );
  }
  return (
    <Round
      key={`${pos}-${puzzle.id}`}
      puzzle={puzzle}
      n={pos + 1}
      total={order.length}
      streak={streak}
      classMode={classMode}
      header={header}
      focusBoard={pos > 0}
      onToggleClass={() => setClassMode((v) => !v)}
      onDone={(o) => onDone(puzzle, o)}
      onNext={() => setPos((p) => p + 1)}
    />
  );
}

function DoneCard({ header, total, classMode, onExitClass, onRestart }: { header: ReactNode; total: number; classMode: boolean; onExitClass: () => void; onRestart: () => void }) {
  const againRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    againRef.current?.focus();
  }, []);
  useKeys((e) => {
    const key = e.key.toLowerCase();
    if (key === 'escape' && classMode) onExitClass();
    else if (key === 'enter' && !isButtonTarget(e)) onRestart();
  });
  return (
    <div className="space-y-4 rounded-2xl border-2 border-line bg-surface p-6">
      {header}
      <p className="text-2xl font-extrabold">{fmt(m().puzzles.allDone, { total })}</p>
      <Button ref={againRef} onClick={onRestart}>{m().puzzles.again}</Button>
    </div>
  );
}

