import { describe, expect, it } from 'vitest';

import {
  PENDING_CHECKOUT_TTL_MS,
  decodePendingCheckout,
  encodePendingCheckout,
  isBillingPlan,
} from '../pending-checkout';

describe('pending checkout', () => {
  it('round-trips a plan chosen just now', () => {
    const now = 1_700_000_000_000;
    expect(decodePendingCheckout(encodePendingCheckout('yearly', now), now)).toBe('yearly');
    expect(decodePendingCheckout(encodePendingCheckout('monthly', now), now + 60_000)).toBe(
      'monthly'
    );
  });

  it('forgets a choice older than the time limit', () => {
    const now = 1_700_000_000_000;
    const raw = encodePendingCheckout('yearly', now);
    expect(decodePendingCheckout(raw, now + PENDING_CHECKOUT_TTL_MS)).toBe('yearly');
    expect(decodePendingCheckout(raw, now + PENDING_CHECKOUT_TTL_MS + 1)).toBeNull();
  });

  it('ignores missing, malformed, or unknown values', () => {
    expect(decodePendingCheckout(null)).toBeNull();
    expect(decodePendingCheckout('not json')).toBeNull();
    expect(decodePendingCheckout(JSON.stringify({ plan: 'lifetime', at: Date.now() }))).toBeNull();
    expect(decodePendingCheckout(JSON.stringify({ plan: 'yearly' }))).toBeNull();
  });

  it('recognises only the two billing plans', () => {
    expect(isBillingPlan('monthly')).toBe(true);
    expect(isBillingPlan('yearly')).toBe(true);
    expect(isBillingPlan('free')).toBe(false);
    expect(isBillingPlan('toString')).toBe(false);
    expect(isBillingPlan(1)).toBe(false);
  });
});
