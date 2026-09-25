import { BILLING_PLANS, type BillingPlan } from '@/lib/plans';

// When a signed-out visitor picks a plan, the choice is kept here across the Google
// sign-in round trip so the app can carry them on to Stripe once they are back.

/** How long a remembered choice stays valid; sign-in normally takes well under this. */
export const PENDING_CHECKOUT_TTL_MS = 15 * 60 * 1000;

export function encodePendingCheckout(plan: BillingPlan, now = Date.now()) {
  return JSON.stringify({ plan, at: now });
}

/** Returns the remembered plan, or null when the value is missing, malformed, or stale. */
export function decodePendingCheckout(raw: string | null, now = Date.now()): BillingPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { plan?: unknown; at?: unknown };
    if (typeof parsed.at !== 'number' || now - parsed.at > PENDING_CHECKOUT_TTL_MS) return null;
    return isBillingPlan(parsed.plan) ? parsed.plan : null;
  } catch {
    return null;
  }
}

export function isBillingPlan(value: unknown): value is BillingPlan {
  return typeof value === 'string' && Object.hasOwn(BILLING_PLANS, value);
}
