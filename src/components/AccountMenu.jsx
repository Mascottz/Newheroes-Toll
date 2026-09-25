import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTickets } from '../hooks/useTickets.jsx';
import Icon from './Icon.jsx';
import { Avatar, Badge, Spinner } from './ui.jsx';
import { canInstall, onInstallAvailability, promptInstall } from '../lib/installPrompt.js';

/** Offline / pending-sync status pills shown in the header. */
export function StatusBadges() {
  const { online, pendingCount } = useTickets();
  if (online && pendingCount === 0) return null;
  return (
    <span className="flex items-center gap-1.5">
      {!online && (
        <Badge tone="amber">
          <Icon name="wifiOff" className="h-3 w-3" /> Offline
        </Badge>
      )}
      {online && pendingCount > 0 && (
        <Badge tone="amber">
          <Icon name="clock" className="h-3 w-3" /> {pendingCount} pending
        </Badge>
      )}
    </span>
  );
}

/** Manual "sync now" button with spinner while syncing. */
export function SyncButton() {
  const { syncing, refreshAll } = useTickets();
  return (
    <button
      type="button"
      onClick={() => refreshAll()}
      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
      aria-label="Sync now"
      title="Sync now"
    >
      {syncing ? <Spinner className="h-5 w-5 text-brand-500" /> : <Icon name="refresh" />}
    </button>
  );
}

/** Avatar chip with dropdown: user info, install app, sign out. */
export default function AccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [installable, setInstallable] = useState(canInstall());
  const ref = useRef(null);

  useEffect(() => onInstallAvailability(setInstallable), []);
  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const doSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full ring-2 ring-white transition hover:ring-brand-100"
        aria-label="Account menu"
      >
        <Avatar name={user.fullName} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="truncate text-sm font-bold text-slate-800">{user.fullName}</div>
            <div className="truncate text-xs text-slate-400">{user.email}</div>
            <div className="mt-1.5">
              <Badge tone={user.role === 'admin' ? 'pink' : 'sky'}>
                {user.role === 'admin' ? (
                  <>
                    <Icon name="shield" className="h-3 w-3" /> Manager
                  </>
                ) : (
                  <>
                    <Icon name="user" className="h-3 w-3" /> Attendant
                  </>
                )}
              </Badge>
            </div>
          </div>
          {installable && (
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                promptInstall();
              }}
            >
              <Icon name="download" className="h-4 w-4 text-brand-500" /> Install app
            </button>
          )}
          <button
            type="button"
            onClick={doSignOut}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <Icon name="logout" className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
