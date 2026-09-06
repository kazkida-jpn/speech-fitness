import Stripe from 'stripe';

import type { BillingPlan } from '@/lib/plans';

// Server-only. Never import from screens: it reads the secret key.

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

export function getPriceId(plan: BillingPlan) {
  return plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
}

/** The Stripe customer created for this Supabase user, if any. */
export async function findCustomerId(stripe: Stripe, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const result = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });
  return result.data[0]?.id ?? null;
}

/** Where Checkout and the billing portal send the user back to. */
export function requestOrigin(request: Request) {
  return request.headers.get('origin') ?? new URL(request.url).origin;
}
