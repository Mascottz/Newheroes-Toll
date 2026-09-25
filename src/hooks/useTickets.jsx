import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as tickets from '../lib/ticketClient.js';
import { listProfiles } from '../lib/authClient.js';
import { sb, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { useAuth } from './useAuth.jsx';
import useOnline from './useOnline.js';

const Ctx = createContext(null);

export function TicketsProvider({ children }) {
  const { user } = useAuth();
  const online = useOnline();
  const [version, setVersion] = useState(0);
  const [pricing, setPricing] = useState(() => tickets.getPricing());
  const [profiles, setProfiles] = useState([]);
  const [syncing, setSyncing] = useState(false);

  // Re-render whenever the underlying store changes.
  useEffect(() => tickets.subscribe(() => setVersion((v) => v + 1)), []);

  const refreshAll = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      await Promise.all([tickets.refreshTickets(user).catch(() => {}), tickets.fetchPricing()]);
    } finally {
      setPricing(tickets.getPricing());
      setSyncing(false);
    }
  }, [user?.id]);

  const reloadProfiles = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      setProfiles(await listProfiles());
    } catch {
      /* admins see the error on the Staff page itself */
    }
  }, [user?.id, user?.role]);

  // Initial load on login + realtime subscription.
  useEffect(() => {
    if (!user) return;
    tickets.reloadLocalStore(); // picks up demo seed data written during login
    tickets.flushOutbox(user.id);
    refreshAll();
    reloadProfiles();

    if (!isSupabaseConfigured || !sb) return undefined;
    const channel = sb
      .channel('tickets-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets' },
        (payload) => {
          if (user.role !== 'admin' && payload.new?.issued_by !== user.id) return;
          tickets.mergeServerRows([payload.new]);
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [user?.id, refreshAll, reloadProfiles]);

  // Coming back online: push queued tickets, pull fresh data.
  useEffect(() => {
    if (online && user) {
      tickets.flushOutbox(user.id);
      refreshAll();
    }
  }, [online]);

  // Periodic + on-visible retry of the outbox (cheap when empty).
  useEffect(() => {
    const id = setInterval(() => {
      if (navigator.onLine) tickets.flushOutbox();
    }, 45000);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) tickets.flushOutbox();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const value = useMemo(
    () => ({
      version,
      online,
      syncing,
      tickets: tickets.getTickets(),
      pendingCount: tickets.getOutboxCount(),
      pricing,
      profiles,
      reloadProfiles,
      refreshAll,
      issue: tickets.issueTicket,
    }),
    [version, online, syncing, pricing, profiles, reloadProfiles, refreshAll]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTickets = () => useContext(Ctx);
