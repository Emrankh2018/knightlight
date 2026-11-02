import { fmt, m } from '../i18n';

/** Numbered move list; the shown move is marked and every move is a button that jumps to it. */
export default function MoveList({ plies, cursor, onJump, startFen }: { plies: { san: string }[]; cursor: number; onJump: (cursor: number) => void; startFen?: string }) {
  const t = m().openings;
  const fields = startFen?.split(' ');
  const blackFirst = fields?.[1] === 'b';
  const firstNumber = Math.max(1, Number(fields?.[5]) || 1);
  const rows: { index: number; number: number; blackOnly: boolean }[] = [];
  for (let i = 0; i < plies.length;) {
    const blackOnly = blackFirst && i === 0;
    rows.push({ index: i, number: firstNumber + Math.floor((i + (blackFirst ? 1 : 0)) / 2), blackOnly });
    i += blackOnly ? 1 : 2;
  }
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
          {rows.map(({ index, number, blackOnly }) => (
            <li key={index} className="flex items-center gap-1">
              <span className="text-lg text-muted">{number}{blackOnly ? '...' : '.'}</span>
              {cell(index)}
              {blackOnly ? null : cell(index + 1)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
