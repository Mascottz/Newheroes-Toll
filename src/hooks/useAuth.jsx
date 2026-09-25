import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  authMode,
  signIn as authSignIn,
  signOut as authSignOut,
  loadCurrentUser,
  loadProfileById,
} from '../lib/authClient.js';
import { flushOutbox } from '../lib/ticketClient.js';
import { sb, isSupabaseConfigured } from '../lib/supabaseClient.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubAuth = null;

    (async () => {
      const current = await loadCurrentUser().catch(() => null);
      if (mounted) {
        setUser(current);
        setBooting(false);
      }
    })();

    if (authMode === 'supabase' && isSupabaseConfigured && sb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          return;
        }
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          // Defer async work (recommended by supabase-js to avoid deadlocks).
          setTimeout(async () => {
            const profile = await loadProfileById(session.user.id).catch(() => null);
            if (mounted && profile) setUser(profile.isActive ? profile : null);
          }, 0);
        }
      });
      unsubAuth = () => data.subscription.unsubscribe();
    }

    return () => {
      mounted = false;
      if (unsubAuth) unsubAuth();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const u = await authSignIn(email, password);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    // Best-effort: upload any pending tickets for the outgoing user first.
    try {
      await flushOutbox();
    } catch {
      /* stays queued for next time */
    }
    await authSignOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, booting, mode: authMode, signIn, signOut }),
    [user, booting, signIn, signOut]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
