import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEVICE_ID_HEADER } from '@/lib/check-quota';
import {
  ANONYMOUS_IP_DAILY_PASSES,
  MAX_PASS_ASSESSMENTS,
  MAX_PASS_DIAGNOSES,
  PASS_WINDOW_MS,
  canAssess,
  canDiagnose,
  claimAssessment,
  claimDiagnosis,
  completeCheckPass,
  getCheckQuota,
  parseDeviceId,
  type CheckPass,
} from '@/server/check-quota';

type Row = Record<string, unknown>;

const backend = vi.hoisted(() => ({
  admin: null as unknown,
  user: null as { id: string; email: string } | null,
}));

vi.mock('@/server/supabase-admin', () => ({
  getSupabaseAdmin: () => backend.admin,
  getUserFromRequest: async () => backend.user,
}));

/** In-memory stand-in for the few Supabase query shapes the quota code uses. */
function fakeAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = (tables[table] ||= []);
      const filters: ((row: Row) => boolean)[] = [];
      let patch: Row | null = null;
      const matched = () => rows.filter((row) => filters.every((filter) => filter(row)));
      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        is(column: string, value: unknown) {
          filters.push((row) => (row[column] ?? null) === value);
          return builder;
        },
        gt(column: string, value: string) {
          filters.push((row) => String(row[column]) > value);
          return builder;
        },
        update(values: Row) {
          patch = values;
          return builder;
        },
        async insert(row: Row) {
          rows.push({
            id: `pass-${rows.length + 1}`,
            started_at: new Date().toISOString(),
            completed_at: null,
            diagnosis_count: 0,
            ...row,
          });
          return { error: null };
        },
        async maybeSingle() {
          const latest = matched().sort((a, b) =>
            String(b.started_at).localeCompare(String(a.started_at))
          )[0];
          return { data: latest ?? null, error: null };
        },
        then(resolve: (result: { count: number; error: null }) => void) {
          if (patch) matched().forEach((row) => Object.assign(row, patch));
          resolve({ count: matched().length, error: null });
        },
      };
      return builder;
    },
  };
}

function request(device = 'device-0000-0000-0001', ip = '203.0.113.7') {
  return new Request('https://example.com/assessment', {
    method: 'POST',
    headers: { [DEVICE_ID_HEADER]: device, 'x-real-ip': ip },
  });
}

/** Runs one whole check: six assessments, then the diagnosis that closes the pass. */
async function runFullCheck(req = request) {
  for (let take = 0; take < 6; take += 1) expect(await claimAssessment(req())).toBeNull();
  const claim = await claimDiagnosis(req());
  expect(claim.blocked).toBeNull();
  await completeCheckPass(claim.passId);
}

describe('speech check limits', () => {
  let tables: Record<string, Row[]>;

  beforeEach(() => {
    vi.useFakeTimers();
    // 10:00 in Japan.
    vi.setSystemTime(new Date('2026-10-03T01:00:00Z'));
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-secret');
    tables = { check_passes: [], profiles: [] };
    backend.admin = fakeAdmin(tables);
    backend.user = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('gives a signed-out visitor one check, counted as a single pass', async () => {
    expect((await getCheckQuota(request())).allowed).toBe(true);
    await runFullCheck();
    expect(tables.check_passes).toHaveLength(1);
    expect(tables.check_passes[0]).toMatchObject({ user_id: null, assessment_count: 6 });
    expect(tables.check_passes[0].ip_hash).not.toContain('203.0.113.7');

    const blocked = await claimAssessment(request());
    expect(blocked?.status).toBe(429);
    expect(((await blocked?.json()) as { error: string }).error).toContain('1回まで');

    vi.setSystemTime(new Date('2027-10-03T01:00:00Z'));
    expect(await getCheckQuota(request())).toEqual({
      tier: 'anonymous',
      allowed: false,
      nextAvailableOn: null,
    });
  });

  it('caps signed-out checks from one address even when the device id changes', async () => {
    for (let device = 0; device < ANONYMOUS_IP_DAILY_PASSES; device += 1) {
      await runFullCheck(() => request(`device-0000-0000-000${device}`));
    }
    expect((await claimAssessment(request('device-0000-0000-0009')))?.status).toBe(429);
    expect(await claimAssessment(request('device-0000-0000-0009', '198.51.100.4'))).toBeNull();
  });

  it('lets an unfinished check be retried without starting a second pass', async () => {
    for (let call = 0; call < MAX_PASS_ASSESSMENTS; call += 1) {
      expect(await claimAssessment(request())).toBeNull();
    }
    expect(tables.check_passes).toHaveLength(1);
    expect((await claimAssessment(request()))?.status).toBe(429);
  });

  it('gives a free member one check a week', async () => {
    backend.user = { id: 'user-1', email: 'member@example.com' };
    await runFullCheck();
    expect(await getCheckQuota(request())).toEqual({
      tier: 'free',
      allowed: false,
      nextAvailableOn: '2026-10-10',
    });

    vi.setSystemTime(new Date('2026-10-09T14:00:00Z'));
    expect((await claimAssessment(request()))?.status).toBe(429);
    vi.setSystemTime(new Date('2026-10-09T15:00:00Z'));
    expect(await claimAssessment(request())).toBeNull();
    expect(tables.check_passes).toHaveLength(2);
  });

  it('gives a premium member one check a day', async () => {
    backend.user = { id: 'user-2', email: 'premium@example.com' };
    tables.profiles.push({ user_id: 'user-2', plan: 'premium' });
    await runFullCheck();
    expect(await getCheckQuota(request())).toEqual({
      tier: 'premium',
      allowed: false,
      nextAvailableOn: '2026-10-04',
    });

    vi.setSystemTime(new Date('2026-10-03T14:00:00Z'));
    expect((await claimAssessment(request()))?.status).toBe(429);
    vi.setSystemTime(new Date('2026-10-03T15:00:00Z'));
    expect(await claimAssessment(request())).toBeNull();
  });

  it('does not count a signed-out check against the member who then signs in', async () => {
    await runFullCheck();
    backend.user = { id: 'user-3', email: 'new@example.com' };
    expect((await getCheckQuota(request())).allowed).toBe(true);
  });

  it('never limits the admin account', async () => {
    backend.user = { id: 'admin', email: 'kazkida@learn-k.net' };
    await runFullCheck();
    await runFullCheck();
    expect(tables.check_passes).toHaveLength(0);
    expect((await getCheckQuota(request())).allowed).toBe(true);
  });

  it('refuses a diagnosis that has no open check behind it', async () => {
    expect((await claimDiagnosis(request())).blocked?.status).toBe(429);
    await runFullCheck();
    expect((await claimDiagnosis(request())).blocked?.status).toBe(429);
  });

  it('lets requests through when the table cannot be read', async () => {
    backend.admin = {
      from() {
        throw new Error('relation "check_passes" does not exist');
      },
    };
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await claimAssessment(request())).toBeNull();
    expect((await claimDiagnosis(request())).blocked).toBeNull();
    expect((await getCheckQuota(request())).allowed).toBe(true);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

const startedAt = Date.parse('2026-10-03T01:00:00Z');
const pass: CheckPass = {
  id: 'p1',
  started_at: new Date(startedAt).toISOString(),
  completed_at: null,
  assessment_count: 6,
  diagnosis_count: 0,
};
const soonAfter = new Date(startedAt + 5 * 60 * 1000);

describe('check pass', () => {
  it('stays open for retries while the check is unfinished', () => {
    expect(canAssess(pass, soonAfter)).toBe(true);
    expect(canDiagnose(pass, soonAfter)).toBe(true);
  });

  it('closes once the diagnosis has completed', () => {
    const done = { ...pass, completed_at: soonAfter.toISOString() };
    expect(canAssess(done, soonAfter)).toBe(false);
    expect(canDiagnose(done, soonAfter)).toBe(false);
  });

  it('closes when the time window has passed', () => {
    const late = new Date(startedAt + PASS_WINDOW_MS);
    expect(canAssess(pass, late)).toBe(false);
    expect(canDiagnose(pass, late)).toBe(false);
  });

  it('stops counting each kind of call at its own cap', () => {
    const spent = { ...pass, assessment_count: MAX_PASS_ASSESSMENTS };
    expect(canAssess(spent, soonAfter)).toBe(false);
    expect(canDiagnose(spent, soonAfter)).toBe(true);
    expect(canDiagnose({ ...pass, diagnosis_count: MAX_PASS_DIAGNOSES }, soonAfter)).toBe(false);
  });
});

describe('parseDeviceId', () => {
  it('accepts ids shaped like the ones the app generates', () => {
    expect(parseDeviceId('3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b')).toBe(
      '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b'
    );
  });

  it('rejects missing, short, or oddly shaped values', () => {
    expect(parseDeviceId(null)).toBeNull();
    expect(parseDeviceId('short')).toBeNull();
    expect(parseDeviceId('x'.repeat(65))).toBeNull();
    expect(parseDeviceId('abc def ghi jkl mno pqr')).toBeNull();
  });
});
