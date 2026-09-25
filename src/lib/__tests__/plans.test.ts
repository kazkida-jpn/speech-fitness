import { describe, expect, it } from 'vitest';

import { isAdminEmail } from '@/lib/plans';

describe('isAdminEmail', () => {
  it('matches the admin address regardless of case and whitespace', () => {
    expect(isAdminEmail('kazkida@learn-k.net')).toBe(true);
    expect(isAdminEmail('  KazKida@Learn-K.net ')).toBe(true);
  });

  it('rejects everyone else', () => {
    expect(isAdminEmail('kazkida@gmail.com')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
