import { findCustomerId, getStripe, requestOrigin } from '@/server/stripe';
import { getUserFromRequest } from '@/server/supabase-admin';

/** Opens the Stripe billing portal so the user can cancel or change payment details. */
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
    const customerId = await findCustomerId(stripe, user.id);
    if (!customerId) {
      return Response.json({ error: '有料プランの契約が見つかりません。' }, { status: 404 });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${requestOrigin(request)}/pricing`,
    });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('billing portal failed', error);
    return Response.json({ error: 'お支払い管理ページを開けませんでした。' }, { status: 502 });
  }
}
