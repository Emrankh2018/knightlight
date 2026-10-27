import { useEffect, useRef, type ReactNode } from 'react';
import Button from '../Button';
import { PieceIcon } from '../icons';
import { LEVEL_IDS, type BotLevelId } from '../../engine/level-ids';
import { fmt, m } from '../../i18n';
import type { ColorChoice } from '../../lib/play';

export interface PlaySettings {
  level: BotLevelId;
  color: ColorChoice;
  /** Minutes per side for the player's clock; 0 means no clock. */
  clock: number;
}

export const CLOCK_CHOICES: readonly number[] = [0, 5, 10];

interface ChoiceProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}

/** A native radio styled as a card: arrow keys move between options and the group is one tab stop. */
function Choice({ name, value, checked, onChange, children }: ChoiceProps) {
  return (
    <label className="block cursor-pointer">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="block h-full rounded-control border-2 border-edge bg-surface px-3 py-2 text-lg font-bold peer-checked:border-ink peer-checked:bg-amber/30 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink dark:peer-checked:border-amber dark:peer-focus-visible:outline-amber">
        {children}
      </span>
    </label>
  );
}

interface PlaySetupProps {
  value: PlaySettings;
  onChange: (next: PlaySettings) => void;
  onStart: () => void;
  /** Move focus to the heading on arrival, for when the player comes back from a game. */
  focusHeading?: boolean;
}

export default function PlaySetup({ value, onChange, onStart, focusHeading = false }: PlaySetupProps) {
  const t = m().play;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) heading.current?.focus();
  }, [focusHeading]);
  const colors: { id: ColorChoice; label: string }[] = [
    { id: 'w', label: t.white },
    { id: 'b', label: t.black },
    { id: 'random', label: t.random },
  ];
  return (
    <section className="mx-auto max-w-6xl space-y-3">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold focus:outline-none">{t.title}</h1>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-lg font-extrabold">{t.levelLegend}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {LEVEL_IDS.map((id, i) => (
            <Choice key={id} name="play-level" value={id} checked={value.level === id} onChange={() => onChange({ ...value, level: id })}>
              <span className="flex flex-col items-center gap-2 text-center">
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-lamp">
                  <PieceIcon piece={id} width="2rem" height="2rem" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base">{fmt(t.levelOption, { level: i + 1, name: t.levels[id].name })}</span>
                  <span className="block text-sm font-normal leading-snug text-muted">{t.levels[id].blurb}</span>
                  <span aria-hidden="true" className="mt-1 flex justify-center gap-1">
                    {LEVEL_IDS.map((_, d) => (
                      <span key={d} className={`h-1.5 w-6 rounded-full ${d <= i ? 'bg-amber' : 'bg-line'}`} />
                    ))}
                  </span>
                </span>
              </span>
            </Choice>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-lg font-extrabold">{t.colorLegend}</legend>
          <div className="grid grid-cols-3 gap-2">
            {colors.map((c) => (
              <Choice key={c.id} name="play-color" value={c.id} checked={value.color === c.id} onChange={() => onChange({ ...value, color: c.id })}>
                {c.label}
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-lg font-extrabold">{t.clockLegend}</legend>
          <div className="grid grid-cols-3 gap-2">
            {CLOCK_CHOICES.map((n) => (
              <Choice key={n} name="play-clock" value={String(n)} checked={value.clock === n} onChange={() => onChange({ ...value, clock: n })}>
                {n === 0 ? t.clockOff : fmt(t.clockMinutes, { n })}
              </Choice>
            ))}
          </div>
        </fieldset>
      </div>
      <Button className="min-h-12 px-8 text-xl" onClick={onStart}>
        {t.start}
      </Button>
    </section>
  );
}
