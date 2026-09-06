import Stripe from 'stripe';

import type { BillingPlan, Plan } from '@/lib/plans';

// Server-only. Never import from screens: it reads the secret key.

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

export function getPriceId(plan: BillingPlan) {
  return plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
}

const PREMIUM_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];

export function planForStatus(status: Stripe.Subscription.Status): Plan {
  return PREMIUM_STATUSES.includes(status) ? 'premium' : 'free';
}

const isUserId = (userId: string) => /^[0-9a-f-]{36}$/i.test(userId);

/** The Stripe customer created for this Supabase user, if any. */
export async function findCustomerId(stripe: Stripe, userId: string) {
  if (!isUserId(userId)) return null;
  const result = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });
  return result.data[0]?.id ?? null;
}

/**
 * The plan Stripe currently grants this user, read straight from their subscriptions.
 * Used to reconcile when a webhook was missed or failed.
 */
export async function findSubscriptionPlan(stripe: Stripe, userId: string): Promise<Plan> {
  if (!isUserId(userId)) return 'free';
  const subscriptions: Stripe.Subscription[] = [];
  const byMetadata = await stripe.subscriptions.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 20,
  });
  subscriptions.push(...byMetadata.data);
  const customerId = await findCustomerId(stripe, userId);
  if (customerId) {
    const byCustomer = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
    });
    subscriptions.push(...byCustomer.data);
  }
  return subscriptions.some((subscription) => planForStatus(subscription.status) === 'premium')
    ? 'premium'
    : 'free';
}

/** Where Checkout and the billing portal send the user back to. */
export function requestOrigin(request: Request) {
  return request.headers.get('origin') ?? new URL(request.url).origin;
}
