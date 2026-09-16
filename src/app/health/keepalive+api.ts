import { pingSupabase } from '@/server/supabase-admin';

// Supabase pauses a Free plan project after about a week without database traffic, and usage is
// still thin enough that the app alone does not always clear that bar. Vercel Cron calls this
// once a day (see vercel.json) so the inactivity timer keeps resetting. The response carries no
// data and needs no secret, so an external uptime monitor can be pointed here as a second alarm.
export async function GET() {
  const result = await pingSupabase();
  if (!result.ok) {
    console.error('supabase keepalive failed', result.error);
    return Response.json({ ok: false }, { status: 502 });
  }
  return Response.json({ ok: true, checkedAt: new Date().toISOString() });
}
