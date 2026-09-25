// ============================================================================
// NEWHEROES Toll Gate — Edge Function: manage-user
// ----------------------------------------------------------------------------
// Admin-only staff account management. Uses the service-role key (auto-injected
// by Supabase) after verifying the CALLER is an active admin via their JWT.
//
// Deploy:  supabase functions deploy manage-user
//
// POST body (JSON):
//   { action: 'create',       email, password, fullName, role: 'staff'|'admin' }
//   { action: 'set_password', userId, password }
//   { action: 'set_active',   userId, isActive: boolean }
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Identify the caller from their Authorization header.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    // 2. Verify the caller is an ACTIVE admin (service client bypasses RLS).
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();
    if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
      return json({ error: 'Admin access required' }, 403);
    }

    const body = await req.json();
    const action = String(body.action ?? '');

    // ---------------------------------------------------------------- create
    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const fullName = String(body.fullName ?? '').trim();
      const role = body.role === 'admin' ? 'admin' : 'staff';

      if (!email || !email.includes('@')) return json({ error: 'A valid email is required' }, 400);
      if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
      if (!fullName) return json({ error: 'Full name is required' }, 400);

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role },
      });
      if (error) return json({ error: error.message }, 400);
      // The on_auth_user_created trigger builds the profile from metadata.
      return json({ ok: true, userId: created.user.id });
    }

    // ---------------------------------------------------------- set_password
    if (action === 'set_password') {
      const userId = String(body.userId ?? '');
      const password = String(body.password ?? '');
      if (!userId) return json({ error: 'userId is required' }, 400);
      if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ------------------------------------------------------------ set_active
    if (action === 'set_active') {
      const userId = String(body.userId ?? '');
      const isActive = Boolean(body.isActive);
      if (!userId) return json({ error: 'userId is required' }, 400);
      if (userId === user.id && !isActive) {
        return json({ error: 'You cannot deactivate your own account' }, 400);
      }

      const { error: profileError } = await admin
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId);
      if (profileError) return json({ error: profileError.message }, 400);

      // Also ban/unban at the auth level so tokens stop working immediately.
      const { error: userError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: isActive ? 'none' : '87600h', // 10 years
      });
      if (userError) return json({ error: userError.message }, 400);

      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: (err as Error)?.message ?? 'Unexpected error' }, 500);
  }
});
