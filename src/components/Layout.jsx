import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import Icon from './Icon.jsx';
import AccountMenu, { StatusBadges, SyncButton } from './AccountMenu.jsx';
import { cx } from '../lib/util.js';

export default function Layout() {
  const { user } = useAuth();

  const navItems = [
    { to: '/', label: 'Issue', icon: 'ticket', end: true },
    { to: '/my-sales', label: user.role === 'admin' ? 'All Sales' : 'My Sales', icon: 'receipt' },
    ...(user.role === 'admin'
      ? [{ to: '/admin', label: 'Analytics', icon: 'chart' }]
      : []),
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {/* ------------------------------- header ------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-2.5">
          <img
            src="/brand/logo.png"
            alt="NEWHEROES GROUP"
            className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-brand-100"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-extrabold tracking-wide text-slate-800">
              Newheroes <span className="text-brand-600">Toll</span>
            </div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Dutse Market · Toll Gate
            </div>
          </div>
          <StatusBadges />
          <SyncButton />
          <AccountMenu />
        </div>
      </header>

      {/* ------------------------------ content ------------------------------ */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-44 pt-4">
        <Outlet />
      </main>

      {/* ------------------------------- nav --------------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-100 bg-white/95 pb-safe backdrop-blur">
        <div
          className={cx(
            'mx-auto grid max-w-3xl',
            navItems.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
          )}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold uppercase tracking-wide transition',
                  isActive ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
                )
              }
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
