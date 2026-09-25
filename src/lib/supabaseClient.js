import { createClient } from '@supabase/supabase-js';
import storage from './safeStorage.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Single Supabase client for the app. We pass our safe storage shim so that
 * auth sessions also work inside sandboxed preview iframes.
 */
export const sb = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
