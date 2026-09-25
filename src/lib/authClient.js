// Authentication + staff-account management.
// Two modes:
//   • 'supabase' — real auth backed by Supabase (when env vars are configured)
//   • 'demo'     — local accounts in storage (no backend, works fully offline)

import { sb, isSupabaseConfigured } from './supabaseClient.js';
import storage from './safeStorage.js';
import { ensureDemoData } from './demoData.js';
import { USERS_KEY, CURRENT_USER_KEY } from './keys.js';
import { uuid } from './util.js';

export const authMode = isSupabaseConfigured ? 'supabase' : 'demo';

/* ---------------- profile cache (used for names in reports) ---------------- */
let profilesCache = [];
export const getProfilesCache = () => profilesCache;

function mapProfileRow(r) {
  return {
    id: r.id,
    email: r.email || '',
    fullName: r.full_name || r.fullName || '',
    role: r.role || 'staff',
    isActive: r.is_active !== undefined ? r.is_active : r.active !== false,
    createdAt: r.created_at || r.createdAt || null,
  };
}

/* --------------------------------- demo ---------------------------------- */

function getDemoUsers() {
  try {
    return JSON.parse(storage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveDemoUsers(users) {
  storage.setItem(USERS_KEY, JSON.stringify(users));
}

const demoToProfile = (u) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
  isActive: u.active,
  createdAt: u.createdAt,
});

export function getDemoAccounts() {
  return getDemoUsers().map(demoToProfile);
}

/* --------------------------------- auth ---------------------------------- */

export async function loadProfileById(id) {
  if (authMode === 'demo') {
    const u = getDemoUsers().find((x) => x.id === id);
    return u ? demoToProfile(u) : null;
  }
  const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    const p = mapProfileRow(data);
    profilesCache = [p, ...profilesCache.filter((x) => x.id !== p.id)];
    return p;
  }
  return null;
}

export async function signIn(email, password) {
  const e = String(email || '').trim().toLowerCase();

  if (authMode === 'demo') {
    ensureDemoData();
    const u = getDemoUsers().find((x) => x.email.toLowerCase() === e);
    if (!u || u.password !== password) throw new Error('Incorrect email or password');
    if (!u.active) throw new Error('This account has been deactivated. Contact your manager.');
    storage.setItem(CURRENT_USER_KEY, u.id);
    return demoToProfile(u);
  }

  const { data, error } = await sb.auth.signInWithPassword({ email: e, password });
  if (error) {
    const msg =
      error.message === 'Invalid login credentials'
        ? 'Incorrect email or password'
        : error.message;
    throw new Error(msg);
  }
  const profile = await loadProfileById(data.user.id).catch(() => null);
  if (!profile) {
    await sb.auth.signOut();
    throw new Error('No staff profile exists for this account yet. Ask your manager to complete setup.');
  }
  if (!profile.isActive) {
    await sb.auth.signOut();
    throw new Error('This account has been deactivated. Contact your manager.');
  }
  return profile;
}

export async function signOut() {
  if (authMode === 'demo') {
    storage.removeItem(CURRENT_USER_KEY);
    return;
  }
  await sb.auth.signOut();
}

export async function loadCurrentUser() {
  if (authMode === 'demo') {
    ensureDemoData();
    const id = storage.getItem(CURRENT_USER_KEY);
    if (!id) return null;
    const u = getDemoUsers().find((x) => x.id === id);
    return u && u.active ? demoToProfile(u) : null;
  }
  const { data } = await sb.auth.getSession();
  const sessionUser = data?.session?.user;
  if (!sessionUser) return null;
  const profile = await loadProfileById(sessionUser.id).catch(() => null);
  if (!profile || !profile.isActive) {
    await sb.auth.signOut();
    return null;
  }
  return profile;
}

/* --------------------------- staff management (admin) -------------------- */

function edgeHint(msg) {
  if (/fetch|404|network|Failed/i.test(msg)) {
    return `${msg} — the "manage-user" Edge Function may not be deployed yet (see docs/SUPABASE_SETUP.md).`;
  }
  return msg;
}

async function invokeManageUser(body) {
  const { data, error } = await sb.functions.invoke('manage-user', { body });
  if (error) throw new Error(edgeHint(error.message || 'Edge function request failed'));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listProfiles() {
  if (authMode === 'demo') {
    const list = getDemoUsers().map(demoToProfile);
    profilesCache = list;
    return list;
  }
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const list = (data || []).map(mapProfileRow);
  profilesCache = list;
  return list;
}

export async function createStaff({ fullName, email, password, role = 'staff' }) {
  const e = String(email || '').trim().toLowerCase();
  if (!fullName?.trim()) throw new Error('Full name is required');
  if (!e.includes('@')) throw new Error('A valid email is required');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

  if (authMode === 'demo') {
    const users = getDemoUsers();
    if (users.some((u) => u.email.toLowerCase() === e)) {
      throw new Error('An account with this email already exists');
    }
    const u = {
      id: 'demo-' + uuid(),
      email: e,
      password,
      fullName: fullName.trim(),
      role: role === 'admin' ? 'admin' : 'staff',
      active: true,
      createdAt: new Date().toISOString(),
    };
    users.push(u);
    saveDemoUsers(users);
    return demoToProfile(u);
  }

  return invokeManageUser({ action: 'create', email: e, password, fullName: fullName.trim(), role });
}

export async function setStaffActive(profile, isActive) {
  if (authMode === 'demo') {
    const users = getDemoUsers().map((u) =>
      u.id === profile.id ? { ...u, active: isActive } : u
    );
    saveDemoUsers(users);
    return;
  }
  const { error } = await sb.from('profiles').update({ is_active: isActive }).eq('id', profile.id);
  if (error) throw new Error(error.message);
  // Best-effort auth-level ban (requires the edge function).
  try {
    await invokeManageUser({ action: 'set_active', userId: profile.id, isActive });
  } catch (err) {
    console.warn('Auth-level ban skipped:', err.message);
  }
}

export async function setStaffPassword(profile, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  if (authMode === 'demo') {
    const users = getDemoUsers().map((u) =>
      u.id === profile.id ? { ...u, password: newPassword } : u
    );
    saveDemoUsers(users);
    return;
  }
  await invokeManageUser({ action: 'set_password', userId: profile.id, password: newPassword });
}
