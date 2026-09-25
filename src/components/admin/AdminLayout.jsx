import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import Icon from '../Icon.jsx';
import { Avatar, Badge, Spinner } from '../ui.jsx';
import { cx } from '../../lib/util.js';
import AccountMenu, { StatusBadges, SyncButton } from '../AccountMenu.jsx';

const NAV_GROUPS = [
  {
    group: 'Monitoring',
    items: [
      { to: '/admin', label: 'Car Park Analytics', icon: 'chart', end: true },
      { to: '/admin/reports', label: 'Detailed Reports', icon: 'fileText' },
      { to: '/admin/balancing', label: 'Daily Balancing', icon: 'banknote' },
    ],
  },
  {
    group: 'Finance',
    items: [{ to: '/admin/expenses', label: 'Expenses', icon: 'wallet' }],
  },
  {
    group: 'Administration',
    items: [{ to: '/admin/staff', label: 'Staff Management', icon: 'users' }],
  },
  {
    group: 'Operations',
    items: [
      { to: '/', label: 'Issue Tickets', icon: 'ticket' },
      { to: '/my-sales', label: 'All Sales', icon: 'receipt' },
    ],
  },
];

const MOBILE_NAV = [
  { to: '/admin', label: 'Analytics', icon: 'chart', end: true },
  { to: '/admin/reports', label: 'Reports', icon: 'fileText' },
  { to: '/admin/expenses', label: 'Expenses', icon: 'wallet' },
  { to: '/admin/staff', label: 'Staff', icon: 'users' },
];

function SidebarContent({ onNavigate }) {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-brand-100 px-5 py-4">
        <img
          src="/brand/logo.png"
          alt="NEWHEROES GROUP"
          className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-brand-100"
        />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-extrabold tracking-wide text-slate-800">
            Newheroes <span className="text-brand-600">Toll</span>
          </div>
          <div className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Dutse Market
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((g) => (
          <div key={g.group} className="mb-5">
            <div className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-300">
              {g.group}
            </div>
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition',
                      isActive
                        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    )
                  }
                >
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="border-t border-slate-100 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.fullName} className="h-9 w-9 text-xs" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-extrabold text-slate-700">{user.fullName}</div>
            <div className="mt-0.5">
              <Badge tone={user.role === 'admin' ? 'pink' : 'sky'}>
                {user.role === 'admin' ? 'Manager' : 'Attendant'}
              </Badge>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] italic text-brand-400">giving quality SINCE 2006</p>
      </div>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner className="h-8 w-8 text-brand-500" />
    </div>
  );
}

export default function AdminLayout() {
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setDrawer(false);
  }, [location.pathname]);

  return (
    <div className="min-h-[100dvh] bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-brand-100 bg-white lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-2xl">
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2.5 px-4 py-2.5">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 lg:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <img
              src="/brand/logo.png"
              alt=""
              className="h-8 w-8 rounded-lg object-cover ring-1 ring-brand-100 lg:hidden"
            />
            <div className="min-w-0 flex-1 leading-tight lg:hidden">
              <div className="text-[13px] font-extrabold tracking-wide text-slate-800">
                Newheroes <span className="text-brand-600">Toll</span>
              </div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Admin Area
              </div>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <Badge tone="pink">
                <Icon name="shield" className="h-3 w-3" /> Admin Area
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusBadges />
              <SyncButton />
              <AccountMenu />
            </div>
          </div>
        </header>

        <main className="px-4 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-6">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile quick nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/95 pb-safe backdrop-blur lg:hidden">
        <div className="grid grid-cols-4">
          {MOBILE_NAV.map((item) => (
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
