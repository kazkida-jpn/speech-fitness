import { createHmac } from 'node:crypto';

import {
  DEVICE_ID_HEADER,
  checkLimitMessage,
  quotaAfterLastCheck,
  type CheckQuota,
  type CheckTier,
} from '@/lib/check-quota';
import { TAKE_NUMBERS } from '@/lib/check-session';
import { isAdminEmail } from '@/lib/plans';
import { getSupabaseAdmin, getUserFromRequest } from '@/server/supabase-admin';

// Server-only. Enforces how often the speech check may be run: once for a signed-out visitor,
// weekly for a free member, daily for a premium member (see src/lib/check-quota.ts).
//
// Starting a check writes a "pass" row to the Supabase `check_passes` table. The pass covers
// the six assessments and the diagnosis of that one check, with room for retries, and closes
// when the diagnosis succeeds. The date of the latest pass decides when the next one opens.
//
// The limit protects the Azure and OpenAI spend; it is not a security boundary. If the table
// cannot be read, requests are let through and the failure is logged.

/** How long an unfinished check can still be continued. */
export const PASS_WINDOW_MS = 60 * 60 * 1000;
/** Assessment calls per pass: one full set of takes plus two complete retries. */
export const MAX_PASS_ASSESSMENTS = TAKE_NUMBERS.length * 3;
export const MAX_PASS_DIAGNOSES = 3;
/**
 * Signed-out checks started from one IP address per 24 hours. A signed-out visitor is held to
 * one check by the device id, which is lost when browser storage is cleared; this cap bounds
 * that. It is above 1 because households and mobile carriers share addresses.
 */
export const ANONYMOUS_IP_DAILY_PASSES = 3;

export type CheckPass = {
  id: string;
  started_at: string;
  completed_at: string | null;
  assessment_count: number;
  diagnosis_count: number;
};

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

type Caller = {
  tier: CheckTier;
  /** Admin accounts are never limited, so the app can be checked repeatedly. */
  unlimited: boolean;
  userId: string | null;
  deviceId: string | null;
  ipHash: string | null;
};

const PASS_COLUMNS = 'id, started_at, completed_at, assessment_count, diagnosis_count';
const OPEN_QUOTA = { allowed: true, nextAvailableOn: null } as const;

function isPassRunning(pass: CheckPass, now: Date) {
  return !pass.completed_at && now.getTime() - Date.parse(pass.started_at) < PASS_WINDOW_MS;
}

export function canAssess(pass: CheckPass, now: Date) {
  return isPassRunning(pass, now) && pass.assessment_count < MAX_PASS_ASSESSMENTS;
}

export function canDiagnose(pass: CheckPass, now: Date) {
  return isPassRunning(pass, now) && pass.diagnosis_count < MAX_PASS_DIAGNOSES;
}

/** Accepts only ids shaped like the ones the app generates. */
export function parseDeviceId(value: string | null) {
  return value && /^[A-Za-z0-9-]{16,64}$/.test(value) ? value : null;
}

/** The address is stored only as a keyed hash, so the table never holds a raw IP. */
function hashIp(request: Request) {
  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return ip && secret ? createHmac('sha256', secret).update(ip).digest('hex') : null;
}

async function resolveCaller(request: Request, admin: Admin): Promise<Caller> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return {
      tier: 'anonymous',
      unlimited: false,
      userId: null,
      deviceId: parseDeviceId(request.headers.get(DEVICE_ID_HEADER)),
      ipHash: hashIp(request),
    };
  }
  const member = { userId: user.id, deviceId: null, ipHash: null };
  if (isAdminEmail(user.email)) return { tier: 'premium', unlimited: true, ...member };
  const { data, error } = await admin
    .from('profiles')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return { tier: data?.plan === 'premium' ? 'premium' : 'free', unlimited: false, ...member };
}

/** The caller's most recent pass. A signed-out visitor is matched by device id, else by IP. */
async function latestPass(admin: Admin, caller: Caller): Promise<CheckPass | null> {
  const column = caller.userId ? 'user_id' : caller.deviceId ? 'device_id' : 'ip_hash';
  const value = caller.userId ?? caller.deviceId ?? caller.ipHash;
  if (!value) return null;
  let query = admin.from('check_passes').select(PASS_COLUMNS).eq(column, value);
  if (!caller.userId) query = query.is('user_id', null);
  const { data, error } = await query
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CheckPass | null;
}

async function isAnonymousIpCapReached(admin: Admin, ipHash: string, now: Date) {
  const { count, error } = await admin
    .from('check_passes')
    .select('id', { count: 'exact', head: true })
    .is('user_id', null)
    .eq('ip_hash', ipHash)
    .gt('started_at', new Date(now.getTime() - 86_400_000).toISOString());
  if (error) throw error;
  return (count ?? 0) >= ANONYMOUS_IP_DAILY_PASSES;
}

/** The caller's quota, plus the pass to continue when an unfinished check is still open. */
async function readQuota(admin: Admin, caller: Caller, now: Date) {
  const pass = await latestPass(admin, caller);
  if (pass && canAssess(pass, now)) {
    return { quota: { tier: caller.tier, ...OPEN_QUOTA }, openPass: pass };
  }
  let quota = quotaAfterLastCheck(caller.tier, pass ? new Date(pass.started_at) : null, now);
  if (quota.allowed && caller.tier === 'anonymous' && caller.ipHash) {
    if (await isAnonymousIpCapReached(admin, caller.ipHash, now)) {
      quota = { ...quota, allowed: false };
    }
  }
  return { quota, openPass: null };
}

/** For GET /check-quota: whether the caller can start a check now. */
export async function getCheckQuota(request: Request): Promise<CheckQuota> {
  const admin = getSupabaseAdmin();
  if (!admin) return { tier: 'anonymous', ...OPEN_QUOTA };
  try {
    const caller = await resolveCaller(request, admin);
    if (caller.unlimited) return { tier: caller.tier, ...OPEN_QUOTA };
    return (await readQuota(admin, caller, new Date())).quota;
  } catch (error) {
    console.error('check quota unavailable; reporting the check as open', error);
    return { tier: 'anonymous', ...OPEN_QUOTA };
  }
}

/**
 * Counts one assessment against the caller's quota, starting a new pass when the previous
 * check is finished and the next one has opened. Returns the 429 response to send when the
 * limit is reached, or null when the assessment may go ahead.
 */
export async function claimAssessment(request: Request): Promise<Response | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const caller = await resolveCaller(request, admin);
    if (caller.unlimited) return null;
    const { quota, openPass } = await readQuota(admin, caller, new Date());
    if (!quota.allowed) {
      const { title, body } = checkLimitMessage(quota);
      return Response.json({ error: `${title}。${body}`, quota }, { status: 429 });
    }
    const { error } = openPass
      ? await admin
          .from('check_passes')
          .update({ assessment_count: openPass.assessment_count + 1 })
          .eq('id', openPass.id)
      : await admin.from('check_passes').insert({
          user_id: caller.userId,
          device_id: caller.deviceId,
          ip_hash: caller.ipHash,
          assessment_count: 1,
        });
    if (error) throw error;
    return null;
  } catch (error) {
    console.error('check quota unavailable; allowing the assessment', error);
    return null;
  }
}

/**
 * Counts one diagnosis against the caller's open pass. `blocked` is the response to send when
 * there is no pass to diagnose; otherwise call `completeCheckPass(passId)` once the diagnosis
 * has been produced.
 */
export async function claimDiagnosis(
  request: Request
): Promise<{ blocked: Response | null; passId: string | null }> {
  const open = { blocked: null, passId: null };
  const admin = getSupabaseAdmin();
  if (!admin) return open;
  try {
    const caller = await resolveCaller(request, admin);
    if (caller.unlimited) return open;
    const pass = await latestPass(admin, caller);
    if (!pass || !canDiagnose(pass, new Date())) {
      return {
        blocked: Response.json(
          {
            error:
              'この測定のAI診断は、これ以上作成できません。次回の発話チェックでお試しください。',
          },
          { status: 429 }
        ),
        passId: null,
      };
    }
    const { error } = await admin
      .from('check_passes')
      .update({ diagnosis_count: pass.diagnosis_count + 1 })
      .eq('id', pass.id);
    if (error) throw error;
    return { blocked: null, passId: pass.id };
  } catch (error) {
    console.error('check quota unavailable; allowing the diagnosis', error);
    return open;
  }
}

/** Closes the pass once its diagnosis is done, so the check counts as used. */
export async function completeCheckPass(passId: string | null) {
  const admin = getSupabaseAdmin();
  if (!admin || !passId) return;
  const { error } = await admin
    .from('check_passes')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', passId);
  if (error) console.error('could not close the check pass', error);
}
