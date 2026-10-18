import { m } from '../i18n';
import { useSettings, type ThemeSetting } from '../store/settings';

const ORDER: ThemeSetting[] = ['light', 'dark', 'system'];
const ICON: Record<ThemeSetting, string> = { light: '☀️', dark: '🌙', system: '💻' };

/** Cycles light, dark, system. */
export default function ThemeToggle() {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system';
  const name = m().theme[theme];
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`${m().nav.toggleTheme} (${name})`}
      title={`${m().theme.label}: ${name}`}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl hover:bg-ink-soft"
    >
      <span aria-hidden="true">{ICON[theme]}</span>
    </button>
  );
}
