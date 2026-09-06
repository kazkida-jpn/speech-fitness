import { findSubscriptionPlan, getStripe } from '@/server/stripe';
import { getUserFromRequest, setUserPlan } from '@/server/supabase-admin';

/**
 * Reconciles the signed-in user's plan with Stripe. The app calls this when the user returns
 * from Checkout, so the plan flips even if the webhook is late or failed.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: '決済が未設定です。' }, { status: 503 });
  }
  const user = await getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: 'ログインが必要です。' }, { status: 401 });
  }
  try {
    const plan = await findSubscriptionPlan(stripe, user.id);
    await setUserPlan(user.id, plan);
    return Response.json({ plan });
  } catch (error) {
    console.error('plan sync failed', error);
    return Response.json({ error: 'プランの確認に失敗しました。' }, { status: 502 });
  }
}
