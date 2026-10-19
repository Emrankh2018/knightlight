import { fmt, m } from '../i18n';

/** Numbered move list; the shown move is marked and every move is a button that jumps to it. */
export default function MoveList({ plies, cursor, onJump }: { plies: { san: string }[]; cursor: number; onJump: (cursor: number) => void }) {
  const t = m().openings;
  const rows: number[] = [];
  for (let i = 0; i < plies.length; i += 2) rows.push(i);
  const current = 'rounded-lg bg-amber px-2 text-ink';
  const idle = 'rounded-lg px-2 hover:bg-line/70';
  const cell = (i: number) => {
    const p = plies[i];
    if (!p) return null;
    return (
      <button
        type="button"
        aria-label={fmt(t.moveLabel, { n: i + 1, san: p.san })}
        aria-current={cursor === i + 1 ? 'step' : undefined}
        onClick={() => onJump(i + 1)}
        className={`min-h-11 min-w-11 text-xl font-bold ${cursor === i + 1 ? current : idle}`}
      >
        {p.san}
      </button>
    );
  };
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-current={cursor === 0 ? 'step' : undefined}
        onClick={() => onJump(0)}
        className={`min-h-11 text-lg font-bold ${cursor === 0 ? current : idle}`}
      >
        {t.movesStart}
      </button>
      {plies.length === 0 ? (
        <p className="text-lg text-muted">{t.noMoves}</p>
      ) : (
        <ol className="mt-1 flex max-h-32 flex-wrap gap-x-3 gap-y-1 overflow-y-auto pe-1">
          {rows.map((i) => (
            <li key={i} className="flex items-center gap-1">
              <span className="text-lg text-muted">{i / 2 + 1}.</span>
              {cell(i)}
              {cell(i + 1)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
