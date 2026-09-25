import { createClient } from '@supabase/supabase-js';

import { isAdminEmail, type Plan } from '@/lib/plans';

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

/**
 * Stores the user's plan and returns what was stored. Admin accounts stay premium no matter
 * what Stripe says, so a webhook or sync can never downgrade them.
 */
export async function setUserPlan(userId: string, plan: Plan): Promise<Plan> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  const { data: lookup } = await admin.auth.admin.getUserById(userId);
  const effective: Plan = isAdminEmail(lookup?.user?.email) ? 'premium' : plan;
  const { error } = await admin
    .from('profiles')
    .upsert({ user_id: userId, plan: effective }, { onConflict: 'user_id' });
  if (error) throw error;
  return effective;
}
