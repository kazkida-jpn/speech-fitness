import { createClient } from '@supabase/supabase-js';

import type { Plan } from '@/lib/plans';

// Server-only. Uses the secret key, which bypasses row level security.

function serverClient(key: string | undefined) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getSupabaseAdmin() {
  return serverClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Resolves the signed-in user from the bearer token the app sends. */
export async function getUserFromRequest(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const client = serverClient(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!token || !client) return null;
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

export async function setUserPlan(userId: string, plan: Plan) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  const { error } = await admin
    .from('profiles')
    .upsert({ user_id: userId, plan }, { onConflict: 'user_id' });
  if (error) throw error;
}

/**
 * Runs the cheapest possible query against the project so it keeps registering database
 * activity. Supabase pauses Free plan projects after about a week without any, which would
 * take sign-in and history sync down with it. Called by /health/keepalive.
 * Uses the secret key when it is set and the publishable key otherwise; either way the query
 * only counts rows, so no user data is read.
 */
export async function pingSupabase(): Promise<{ ok: boolean; error?: string }> {
  const client =
    getSupabaseAdmin() ?? serverClient(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!client) return { ok: false, error: 'Supabase is not configured' };
  const { error } = await client.from('profiles').select('user_id', { head: true, count: 'exact' });
  return error ? { ok: false, error: error.message } : { ok: true };
}
