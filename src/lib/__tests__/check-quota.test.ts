import { describe, expect, it } from 'vitest';

import {
  addDaysToDateKey,
  checkLimitMessage,
  daysUntilDateKey,
  jstDateKey,
  quotaAfterLastCheck,
} from '@/lib/check-quota';

describe('jstDateKey', () => {
  it('rolls over at midnight in Japan, not UTC', () => {
    expect(jstDateKey(new Date('2026-10-03T14:59:59Z'))).toBe('2026-10-03');
    expect(jstDateKey(new Date('2026-10-03T15:00:00Z'))).toBe('2026-10-04');
  });
});

describe('date key arithmetic', () => {
  it('adds days across month ends', () => {
    expect(addDaysToDateKey('2026-10-28', 7)).toBe('2026-11-04');
  });

  it('counts the days left and never goes negative', () => {
    expect(daysUntilDateKey('2026-10-10', '2026-10-03')).toBe(7);
    expect(daysUntilDateKey('2026-10-03', '2026-10-03')).toBe(0);
    expect(daysUntilDateKey('2026-10-01', '2026-10-03')).toBe(0);
  });
});

describe('quotaAfterLastCheck', () => {
  // 2026-10-03 10:00 in Japan.
  const last = new Date('2026-10-03T01:00:00Z');

  it('allows the first check on every tier', () => {
    for (const tier of ['anonymous', 'free', 'premium'] as const) {
      expect(quotaAfterLastCheck(tier, null)).toEqual({
        tier,
        allowed: true,
        nextAvailableOn: null,
      });
    }
  });

  it('never reopens for a signed-out visitor', () => {
    const muchLater = new Date('2027-10-03T01:00:00Z');
    expect(quotaAfterLastCheck('anonymous', last, muchLater)).toEqual({
      tier: 'anonymous',
      allowed: false,
      nextAvailableOn: null,
    });
  });

  it('reopens for a free member on the seventh day', () => {
    expect(quotaAfterLastCheck('free', last, new Date('2026-10-09T14:59:00Z'))).toEqual({
      tier: 'free',
      allowed: false,
      nextAvailableOn: '2026-10-10',
    });
    expect(quotaAfterLastCheck('free', last, new Date('2026-10-09T15:00:00Z')).allowed).toBe(true);
  });

  it('reopens for a premium member when the date changes in Japan', () => {
    expect(quotaAfterLastCheck('premium', last, new Date('2026-10-03T14:00:00Z'))).toEqual({
      tier: 'premium',
      allowed: false,
      nextAvailableOn: '2026-10-04',
    });
    expect(quotaAfterLastCheck('premium', last, new Date('2026-10-03T15:00:00Z')).allowed).toBe(
      true
    );
  });
});

describe('checkLimitMessage', () => {
  it('points a signed-out visitor to sign-in', () => {
    const message = checkLimitMessage({ tier: 'anonymous', allowed: false, nextAvailableOn: null });
    expect(message.title).toContain('1回まで');
    expect(message.body).toContain('ログイン');
  });

  it('names the date for a free member and says tomorrow for a premium member', () => {
    const free = checkLimitMessage(
      { tier: 'free', allowed: false, nextAvailableOn: '2026-10-10' },
      '2026-10-03'
    );
    expect(free.title).toContain('10月10日');
    expect(free.body).toContain('週に1回');
    const premium = checkLimitMessage(
      { tier: 'premium', allowed: false, nextAvailableOn: '2026-10-04' },
      '2026-10-03'
    );
    expect(premium.title).toContain('明日');
    expect(premium.body).toContain('1日1回');
  });
});
