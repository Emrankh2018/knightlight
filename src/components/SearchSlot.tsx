import { useEffect } from 'react';
import { m } from '../i18n';

export const OPEN_SEARCH_EVENT = 'knightlight:open-search';

/** Placeholder for the search palette: renders only the trigger button. Later work replaces this file. */
export default function SearchSlot() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT))}
      aria-label={m().nav.searchShortcut}
      title={m().nav.searchShortcut}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl hover:bg-ink-soft"
    >
      <span aria-hidden="true">🔍</span>
    </button>
  );
}
