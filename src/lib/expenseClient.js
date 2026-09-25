// ============================================================================
// Expense store — operational expenses recorded manually by managers
// (fuel, maintenance, supplies, salaries…). Admin-only. Mirrors the
// ticketClient pattern: Supabase when configured, local demo storage otherwise.
// ============================================================================

import { sb, isSupabaseConfigured } from './supabaseClient.js';
import storage from './safeStorage.js';
import { authMode, getProfilesCache } from './authClient.js';
import { ensureDemoExpenses } from './demoData.js';
import { EXPENSES_KEY } from './keys.js';
import { uuid } from './util.js';

let localExpenses = (() => {
  try {
    return JSON.parse(storage.getItem(EXPENSES_KEY)) || [];
  } catch {
    return [];
  }
})();

const listeners = new Set();
function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}
function saveLocal() {
  storage.setItem(EXPENSES_KEY, JSON.stringify(localExpenses));
}

// Live updates across tabs in demo mode.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === EXPENSES_KEY) {
      try {
        localExpenses = JSON.parse(storage.getItem(EXPENSES_KEY)) || [];
      } catch {
        localExpenses = [];
      }
      emit();
    }
  });
}

function ensureDemo() {
  if (authMode !== 'demo') return;
  ensureDemoExpenses();
  // The seed may have been written AFTER this module loaded — pick it up.
  if (localExpenses.length === 0) {
    try {
      localExpenses = JSON.parse(storage.getItem(EXPENSES_KEY)) || [];
    } catch {
      localExpenses = [];
    }
  }
}

function nameFor(id) {
  return getProfilesCache().find((p) => p.id === id)?.fullName || null;
}

function mapRow(r) {
  return {
    id: r.id,
    description: r.description,
    category: r.category,
    amount: r.amount,
    incurredAt: r.incurred_at, // 'YYYY-MM-DD'
    recordedBy: r.recorded_by,
    recordedByName: nameFor(r.recorded_by),
    createdAt: r.created_at,
  };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Recent expenses (admin). Fetches from Supabase when configured, otherwise
 * returns the local demo list.
 */
export async function listExpenses(limit = 1000) {
  ensureDemo();
  if (authMode === 'supabase' && isSupabaseConfigured && sb) {
    const { data, error } = await sb
      .from('expenses')
      .select('*')
      .order('incurred_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  }
  return [...localExpenses].sort((a, b) => (a.incurredAt < b.incurredAt ? 1 : -1));
}

export async function addExpense({ description, category, amount, incurredAt, user }) {
  ensureDemo();
  const desc = String(description || '').trim();
  const amt = Math.round(Number(amount));
  const cat = String(category || 'Other').trim() || 'Other';
  if (!desc) throw new Error('Description is required');
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Amount must be a positive number');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incurredAt || '')) throw new Error('A valid date is required');

  if (authMode === 'supabase' && isSupabaseConfigured && sb) {
    const { data, error } = await sb
      .from('expenses')
      .insert({
        description: desc,
        category: cat,
        amount: amt,
        incurred_at: incurredAt,
        recorded_by: user.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    emit();
    return mapRow(data);
  }

  const row = {
    id: 'local-' + uuid(),
    description: desc,
    category: cat,
    amount: amt,
    incurredAt,
    recordedBy: user.id,
    recordedByName: user.fullName,
    createdAt: new Date().toISOString(),
  };
  localExpenses = [row, ...localExpenses];
  saveLocal();
  emit();
  return row;
}

export async function deleteExpense(id) {
  if (authMode === 'supabase' && isSupabaseConfigured && sb) {
    const { error } = await sb.from('expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
    emit();
    return;
  }
  localExpenses = localExpenses.filter((e) => e.id !== id);
  saveLocal();
  emit();
}

/**
 * Summary for a date range: { total, count, byCategory: [{category,count,amount}] }.
 * `toStr` is EXCLUSIVE. Prefers the server RPC; falls back to the local list.
 */
export async function getExpenseSummary(fromStr, toStr) {
  ensureDemo();
  if (authMode === 'supabase' && isSupabaseConfigured && sb) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // fall through to local (may be stale/empty offline)
    } else {
      try {
        const { data, error } = await sb.rpc('expense_summary', {
          p_from: fromStr,
          p_to: toStr,
        });
        if (!error && data && typeof data === 'object') return data;
      } catch (e) {
        console.warn('Expense summary RPC unavailable, using local data:', e?.message);
      }
    }
  }
  const rows = localExpenses.filter((e) => e.incurredAt >= fromStr && e.incurredAt < toStr);
  const byCategory = new Map();
  let total = 0;
  for (const e of rows) {
    total += e.amount;
    const c = byCategory.get(e.category) || { category: e.category, count: 0, amount: 0 };
    c.count += 1;
    c.amount += e.amount;
    byCategory.set(e.category, c);
  }
  return {
    total,
    count: rows.length,
    byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
  };
}
