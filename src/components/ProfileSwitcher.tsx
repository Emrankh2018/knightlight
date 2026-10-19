import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt, m } from '../i18n';
import { levelFor } from '../lib/xp';
import { useProfiles, useActiveProfile } from '../store/profiles';
import { useProgress } from '../store/progress';

export default function ProfileSwitcher() {
  const profiles = useProfiles((s) => s.profiles);
  const switchTo = useProfiles((s) => s.switchTo);
  const active = useActiveProfile();
  const xp = useProgress((s) => s.data.xp);
  const { level } = levelFor(xp);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={fmt(m().profile.current, { name: active.name, level })}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-ink-soft"
      >
        <span className="text-2xl" aria-hidden="true">{active.avatar}</span>
        <span className="hidden max-w-[9rem] truncate font-bold sm:inline" title={active.name} aria-hidden="true">{active.name}</span>
        <span className="whitespace-nowrap rounded-full bg-amber px-2 text-sm font-extrabold text-ink" aria-hidden="true">{fmt(m().profile.level, { level })}</span>
      </button>
      {open ? (
        <div id={menuId} className="absolute end-0 z-40 mt-2 w-64 max-w-[calc(100vw-1rem)] rounded-xl border-2 border-line bg-surface p-2 text-fg shadow-xl">
          <p className="px-2 py-1 text-sm font-bold text-muted">{m().profile.switcher}</p>
          <ul>
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-current={p.id === active.id ? 'true' : undefined}
                  onClick={() => {
                    switchTo(p.id);
                    setOpen(false);
                  }}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-start text-lg hover:bg-line/60 ${p.id === active.id ? 'font-extrabold' : ''}`}
                >
                  <span className="text-2xl" aria-hidden="true">{p.avatar}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/students" onClick={() => setOpen(false)} className="mt-1 flex min-h-11 items-center rounded-lg px-2 text-lg font-bold underline hover:bg-line/60">
            {m().profile.manage}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
