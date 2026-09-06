import { BILLING_PLANS, TRIAL_DAYS, type BillingPlan } from '@/lib/plans';
import { findCustomerId, getPriceId, getStripe, requestOrigin } from '@/server/stripe';
import { getUserFromRequest } from '@/server/supabase-admin';

/** Starts a Stripe Checkout session for a subscription and returns its URL. */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: '決済が未設定です。' }, { status: 503 });
  }
  const user = await getUserFromRequest(request);
  if (!user) {
    return Response.json({ error: 'ログインが必要です。' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { plan?: string } | null;
  const plan = body?.plan as BillingPlan | undefined;
  if (!plan || !(plan in BILLING_PLANS)) {
    return Response.json({ error: 'プランの指定が正しくありません。' }, { status: 400 });
  }
  const priceId = getPriceId(plan);
  if (!priceId) {
    return Response.json({ error: 'このプランの価格が未設定です。' }, { status: 503 });
  }

  try {
    const customerId = await findCustomerId(stripe, user.id);
    const origin = requestOrigin(request);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customerId ? { customer: customerId } : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { userId: user.id } },
      allow_promotion_codes: true,
      locale: 'ja',
      success_url: `${origin}/pricing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
    });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('checkout session failed', error);
    return Response.json({ error: '決済ページを開けませんでした。' }, { status: 502 });
  }
}
