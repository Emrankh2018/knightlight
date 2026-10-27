import { m } from '../i18n';
import { BOARD_THEMES, PICKABLE_BOARD_THEMES, useSettings } from '../store/settings';

/** Cycles the board colours. The swatch shows the chosen palette (the dusk variant is automatic in dark mode). */
export default function BoardThemeToggle() {
  const id = useSettings((s) => s.boardTheme);
  const setBoardTheme = useSettings((s) => s.setBoardTheme);
  const pick = PICKABLE_BOARD_THEMES;
  const at = pick.indexOf(id);
  const next = pick[(at + 1) % pick.length] ?? pick[0] ?? 'cream';
  const name = m().boardTheme[id];
  const { light, dark } = BOARD_THEMES[id];
  return (
    <button
      type="button"
      onClick={() => setBoardTheme(next)}
      aria-label={m().boardTheme.switch.replace('{name}', name)}
      title={`${m().boardTheme.label}: ${name}`}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-ink-soft"
    >
      <span
        aria-hidden="true"
        className="grid h-6 w-6 grid-cols-2 overflow-hidden rounded-sm ring-1 ring-cream/60"
        style={{ background: `conic-gradient(${light} 25%, ${dark} 0 50%, ${light} 0 75%, ${dark} 0)` }}
      />
    </button>
  );
}
