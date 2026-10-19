import { useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { m } from '../i18n';
import { isReady } from '../lib/ready-routes';
import ProfileSwitcher from './ProfileSwitcher';
import SearchSlot from './SearchSlot';
import SoundToggle from './SoundToggle';
import ThemeToggle from './ThemeToggle';
import Toasts from './Toasts';

const allLinks = [
  { to: '/', label: () => m().nav.home, end: true },
  { to: '/courses', label: () => m().nav.library, end: false },
  { to: '/puzzles', label: () => m().nav.puzzles, end: false },
  { to: '/teacher', label: () => m().nav.teacher, end: false },
  { to: '/openings', label: () => m().nav.explorer, end: false },
  { to: '/play', label: () => m().nav.play, end: false },
  { to: '/review', label: () => m().nav.review, end: false },
  { to: '/students', label: () => m().nav.profiles, end: false },
];

const links = allLinks.filter((l) => isReady(l.to));

const MENU_ID = 'kl-main-menu';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const linkClass = ({ isActive }: { isActive: boolean }): string =>
    `flex min-h-11 items-center rounded-lg px-3 ${isActive ? 'font-extrabold text-amber' : 'hover:text-amber'}`;

  return (
    <div className="flex min-h-full flex-col">
      <button
        type="button"
        onClick={() => mainRef.current?.focus()}
        className="kl-chrome sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-amber focus:px-3 focus:py-2 focus:text-ink"
      >
        {m().app.skipToContent}
      </button>
      <header className="kl-chrome relative bg-ink text-cream">
        <nav aria-label={m().nav.mainNav} className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
          <NavLink to="/" className="me-2 flex min-h-11 items-center gap-2 text-xl font-extrabold">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={32} height={32} />
            {m().app.name}
          </NavLink>
          <ul className="hidden flex-1 items-center gap-1 xl:flex">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={linkClass}>
                  {l.label()}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="ms-auto flex items-center gap-1 xl:ms-0">
            <SearchSlot />
            <SoundToggle />
            <ThemeToggle />
            <ProfileSwitcher />
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls={MENU_ID}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 font-bold hover:bg-ink-soft xl:hidden"
            >
              <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
              {menuOpen ? m().nav.closeMenu : m().nav.openMenu}
            </button>
          </div>
        </nav>
        {menuOpen ? (
          <ul id={MENU_ID} className="border-t border-ink-soft px-4 pb-3 pt-2 xl:hidden">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={linkClass} onClick={() => setMenuOpen(false)}>
                  {l.label()}
                </NavLink>
              </li>
            ))}
          </ul>
        ) : null}
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto focus:outline-none w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="kl-chrome border-t border-line px-4 py-4 text-center text-sm text-muted">
        <p>
          {m().app.footerCredit}{' '}
          <a className="underline" href="https://database.lichess.org/">database.lichess.org</a> · {m().app.footerLicense}
        </p>
      </footer>
      <Toasts />
    </div>
  );
}
