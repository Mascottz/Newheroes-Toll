// ============================================================================
// Ticket store — offline-first with a sync "outbox".
//
// Every ticket is written locally FIRST (so the attendant always gets an
// instant receipt), then queued for upload. When Supabase is configured and
// the device is online, tickets are pushed via the idempotent `create_ticket`
// RPC and recent history is pulled into a local cache (last 60 days).
//
// Reports read from the authoritative `revenue_report` RPC when online and
// fall back to the local cache when offline / in demo mode.
// ============================================================================

import { sb, isSupabaseConfigured } from './supabaseClient.js';
import storage from './safeStorage.js';
import { DEFAULT_VEHICLES, DEFAULT_NIGHT_SURCHARGE } from './constants.js';
import { dayKeyOf, lagosDateStr } from './format.js';
import { getProfilesCache } from './authClient.js';
import { uuid } from './util.js';
import { TICKETS_CACHE_KEY, OUTBOX_KEY, PRICING_KEY } from './keys.js';

const CACHE_DAYS = 60; // how much history to keep on-device
const CACHE_MAX_ITEMS = 5000;

/* ------------------------------ local state ------------------------------- */

function loadJSON(key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, val) {
  try {
    storage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn('Local storage write failed:', e?.message);
  }
}

let cache = loadJSON(TICKETS_CACHE_KEY, []);
let outbox = loadJSON(OUTBOX_KEY, []);
let pricing = loadJSON(PRICING_KEY, null) || {
  vehicles: DEFAULT_VEHICLES,
  nightSurcharge: DEFAULT_NIGHT_SURCHARGE,
  source: 'default',
};

/** Re-read the local stores from storage (used after demo seeding / login). */
export function reloadLocalStore() {
  cache = loadJSON(TICKETS_CACHE_KEY, []);
  outbox = loadJSON(OUTBOX_KEY, []);
  const storedPricing = loadJSON(PRICING_KEY, null);
  if (storedPricing) pricing = storedPricing;
  emit();
}

// Reload when another tab on this device writes to storage — this gives demo
// mode (and offline outbox states) live updates across tabs, mirroring the
// Supabase realtime behaviour.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === TICKETS_CACHE_KEY || e.key === OUTBOX_KEY) {
      reloadLocalStore();
    }
  });
}

const listeners = new Set();
let flushing = false;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* listener errors must not break the store */
    }
  });
}

export const getTickets = () => cache;
export const getOutboxCount = () => outbox.length;
export const getPricing = () => pricing;

function nameFor(id) {
  return getProfilesCache().find((p) => p.id === id)?.fullName || null;
}

function serverToLocal(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    ticketNo: row.ticket_no,
    vehicleCode: row.vehicle_code,
    vehicleLabel: row.vehicle_label,
    baseAmount: row.base_amount,
    nightParking: !!row.night_parking,
    surcharge: row.surcharge || 0,
    totalAmount: row.total_amount,
    issuedBy: row.issued_by,
    issuedByName: nameFor(row.issued_by),
    issuedAt: row.issued_at,
    synced: true,
  };
}

/* -------------------------------- pricing --------------------------------- */

export async function fetchPricing() {
  if (!isSupabaseConfigured || !sb || !navigator.onLine) return pricing;
  try {
    const [vehiclesRes, settingsRes] = await Promise.all([
      sb.from('vehicle_types').select('code,label,base_amount').eq('is_active', true).order('sort_order'),
      sb.from('settings').select('value').eq('key', 'night_surcharge').maybeSingle(),
    ]);
    if (vehiclesRes.data && vehiclesRes.data.length) {
      const next = {
        vehicles: vehiclesRes.data.map((r) => ({
          code: r.code,
          label: r.label,
          baseAmount: r.base_amount,
        })),
        nightSurcharge: settingsRes.data ? parseInt(settingsRes.data.value, 10) || DEFAULT_NIGHT_SURCHARGE : DEFAULT_NIGHT_SURCHARGE,
        source: 'server',
      };
      if (JSON.stringify(next) !== JSON.stringify(pricing)) {
        pricing = next;
        saveJSON(PRICING_KEY, pricing);
        emit();
      }
    }
  } catch (e) {
    console.warn('Pricing refresh skipped:', e?.message);
  }
  return pricing;
}

/* ------------------------------ issuing ----------------------------------- */

/** NH-YYMMDD-#### — continues from the highest number seen today on this device. */
export function nextLocalTicketNo() {
  const prefix = `NH-${lagosDateStr().slice(2).replace(/-/g, '')}-`;
  let max = 0;
  for (const t of cache) {
    if (typeof t.ticketNo === 'string' && t.ticketNo.startsWith(prefix)) {
      const n = parseInt(t.ticketNo.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return prefix + String(max + 1).padStart(4, '0');
}

export function issueTicket({ vehicleCode, vehicleLabel, baseAmount, nightParking, user }) {
  const surcharge = nightParking ? pricing.nightSurcharge : 0;
  const ticket = {
    id: 'local:' + uuid(),
    clientId: uuid(),
    ticketNo: nextLocalTicketNo(),
    vehicleCode,
    vehicleLabel,
    baseAmount,
    nightParking: !!nightParking,
    surcharge,
    totalAmount: baseAmount + surcharge,
    issuedBy: user.id,
    issuedByName: user.fullName,
    issuedAt: new Date().toISOString(),
    synced: false,
  };

  cache = [ticket, ...cache];
  outbox = [...outbox, ticket];
  saveJSON(TICKETS_CACHE_KEY, cache);
  saveJSON(OUTBOX_KEY, outbox);
  emit();

  flushOutbox(user.id); // fire & forget — never blocks the receipt
  return ticket;
}

/* ------------------------------- syncing ---------------------------------- */

export async function flushOutbox(userId = null) {
  if (!isSupabaseConfigured || !sb || flushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const queue = userId ? outbox.filter((o) => o.issuedBy === userId) : outbox;
  if (!queue.length) return;

  flushing = true;
  try {
    for (const item of queue) {
      const { data, error } = await sb.rpc('create_ticket', {
        p_client_id: item.clientId,
        p_ticket_no: item.ticketNo,
        p_vehicle_code: item.vehicleCode,
        p_night_parking: !!item.nightParking,
        p_issued_at: item.issuedAt,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        const local = serverToLocal(row);
        cache = cache.map((t) => (t.clientId === item.clientId ? local : t));
      }
      outbox = outbox.filter((o) => o.clientId !== item.clientId);
      saveJSON(TICKETS_CACHE_KEY, cache);
      saveJSON(OUTBOX_KEY, outbox);
      emit();
    }
  } catch (e) {
    // Keep remaining tickets queued — retried when online/visible/next issue.
    console.warn('Ticket sync will retry later:', e?.message);
  } finally {
    flushing = false;
  }
}

function prune() {
  const cutoff = Date.now() - CACHE_DAYS * 86400000;
  const isStale = (t) => t.synced && Date.parse(t.issuedAt) < cutoff;
  if (cache.some(isStale)) cache = cache.filter((t) => !isStale(t));
  if (cache.length > CACHE_MAX_ITEMS) {
    const keep = new Set(cache.slice(0, CACHE_MAX_ITEMS).map((t) => t.clientId));
    cache = cache.filter((t) => !t.synced || keep.has(t.clientId));
  }
}

/** Merge server rows into the cache (used by refresh + realtime). */
export function mergeServerRows(rows) {
  if (!rows?.length) return;
  const pending = new Set(outbox.map((o) => o.clientId));
  const map = new Map(cache.map((t) => [t.clientId, t]));
  let changed = false;

  for (const r of rows) {
    const t = serverToLocal(r);
    if (!t) continue;
    const existing = map.get(t.clientId);
    const identical =
      existing &&
      existing.synced &&
      existing.id === t.id &&
      existing.ticketNo === t.ticketNo &&
      existing.totalAmount === t.totalAmount &&
      existing.nightParking === t.nightParking &&
      Date.parse(existing.issuedAt) === Date.parse(t.issuedAt);
    if (identical || (existing && pending.has(t.clientId))) continue;
    map.set(t.clientId, t);
    changed = true;
  }

  if (!changed) return;
  cache = [...map.values()].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
  prune();
  saveJSON(TICKETS_CACHE_KEY, cache);
  emit();
}

export async function refreshTickets(user) {
  if (!isSupabaseConfigured || !sb || !user) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const since = new Date(Date.now() - CACHE_DAYS * 86400000).toISOString();
  let q = sb
    .from('tickets')
    .select('*')
    .gte('issued_at', since)
    .order('issued_at', { ascending: false })
    .limit(3000);
  if (user.role !== 'admin') q = q.eq('issued_by', user.id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  mergeServerRows(data || []);
}

/* ------------------------------- reporting -------------------------------- */

function aggregate(rows) {
  const byVehicle = new Map();
  const byStaff = new Map();
  const byDay = new Map();
  const byMonth = new Map();
  let totalRevenue = 0;
  let nightTickets = 0;
  let nightRevenue = 0;

  for (const t of rows) {
    totalRevenue += t.totalAmount;
    if (t.nightParking) {
      nightTickets += 1;
      nightRevenue += t.totalAmount;
    }
    const vKey = t.vehicleCode;
    const v = byVehicle.get(vKey) || { code: t.vehicleCode, label: t.vehicleLabel, tickets: 0, revenue: 0 };
    v.tickets += 1;
    v.revenue += t.totalAmount;
    byVehicle.set(vKey, v);

    const sKey = t.issuedBy;
    const s = byStaff.get(sKey) || {
      staff_id: t.issuedBy,
      staff_name: nameFor(t.issuedBy) || t.issuedByName || 'Unknown',
      tickets: 0,
      revenue: 0,
    };
    s.tickets += 1;
    s.revenue += t.totalAmount;
    byStaff.set(sKey, s);

    const dayK = dayKeyOf(t.issuedAt);
    const d = byDay.get(dayK) || { day: dayK, tickets: 0, revenue: 0 };
    d.tickets += 1;
    d.revenue += t.totalAmount;
    byDay.set(dayK, d);

    const monthK = dayK.slice(0, 7);
    const m = byMonth.get(monthK) || { month: monthK, tickets: 0, revenue: 0 };
    m.tickets += 1;
    m.revenue += t.totalAmount;
    byMonth.set(monthK, m);
  }

  return {
    totalRevenue,
    totalTickets: rows.length,
    nightTickets,
    nightRevenue,
    byVehicle: [...byVehicle.values()].sort((a, b) => b.revenue - a.revenue),
    byStaff: [...byStaff.values()].sort((a, b) => b.revenue - a.revenue),
    byDay: [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
    byMonth: [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1)),
  };
}

function inRange(t, fromMs, toMs, staffId, user) {
  if (staffId ? t.issuedBy !== staffId : user && user.role !== 'admin' && t.issuedBy !== user.id) {
    return false;
  }
  const ts = Date.parse(t.issuedAt);
  return ts >= fromMs && ts < toMs;
}

function localReport(from, to, staffId, user) {
  const fromMs = +from;
  const toMs = +to;
  return aggregate(cache.filter((t) => inRange(t, fromMs, toMs, staffId, user)));
}

function mergeReports(server, local) {
  if (!local || !local.totalTickets) return server;
  const mergeList = (listA, listB, key, desc = true) => {
    const m = new Map();
    for (const r of [...(listA || []), ...(listB || [])]) {
      const ex = m.get(r[key]);
      if (ex) {
        ex.tickets += r.tickets;
        ex.revenue += r.revenue;
      } else {
        m.set(r[key], { ...r });
      }
    }
    return [...m.values()].sort((a, b) =>
      desc ? b.revenue - a.revenue : a[key] < b[key] ? -1 : 1
    );
  };
  return {
    ...server,
    totalRevenue: (server.totalRevenue || 0) + local.totalRevenue,
    totalTickets: (server.totalTickets || 0) + local.totalTickets,
    nightTickets: (server.nightTickets || 0) + local.nightTickets,
    nightRevenue: (server.nightRevenue || 0) + local.nightRevenue,
    byVehicle: mergeList(server.byVehicle, local.byVehicle, 'code'),
    byStaff: mergeList(server.byStaff, local.byStaff, 'staff_id'),
    byDay: mergeList(server.byDay, local.byDay, 'day', false),
    byMonth: mergeList(server.byMonth, local.byMonth, 'month', false),
  };
}

/**
 * Report for a date range. Prefers the server (full history incl. beyond the
 * local cache) and layers unsynced local tickets on top; falls back entirely
 * to the local cache when offline or in demo mode.
 */
export async function getReport({ from, to, staffId = null, user }) {
  if (isSupabaseConfigured && sb && typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const { data, error } = await sb.rpc('revenue_report', {
        p_from: new Date(from).toISOString(),
        p_to: new Date(to).toISOString(),
        p_staff: staffId,
      });
      if (!error && data && typeof data === 'object') {
        const fromMs = +new Date(from);
        const toMs = +new Date(to);
        const unsynced = aggregate(cache.filter((t) => !t.synced && inRange(t, fromMs, toMs, staffId, user)));
        return mergeReports(data, unsynced);
      }
    } catch (e) {
      console.warn('Server report unavailable, using local cache:', e?.message);
    }
  }
  return localReport(from, to, staffId, user);
}
