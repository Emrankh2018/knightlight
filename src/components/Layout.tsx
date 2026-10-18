import { NavLink, Outlet } from 'react-router-dom';
import { m } from '../i18n';

const links = [
  { to: '/', label: () => m().nav.home, end: true },
];

export default function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-amber focus:px-3 focus:py-2 focus:text-ink">
        {m().app.skipToContent}
      </a>
      <header className="bg-ink text-cream">
        <nav aria-label={m().nav.mainNav} className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-xl font-extrabold">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={32} height={32} />
            {m().app.name}
          </NavLink>
          <ul className="flex gap-3">
            {links.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'font-bold text-amber' : 'hover:text-amber')}>
                  {l.label()}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-line px-4 py-4 text-center text-sm text-muted">
        <p>
          {m().app.footerCredit}{' '}
          <a className="underline" href="https://database.lichess.org/">database.lichess.org</a> · {m().app.footerLicense}
        </p>
      </footer>
    </div>
  );
}
