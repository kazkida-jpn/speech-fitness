// How often the speech check may be run, shared by the screens and the API routes. The server
// enforces it (see src/server/check-quota.ts); the screens only use it to explain the limit.

/** Who is asking: a signed-out visitor, a signed-in free member, or a premium member. */
export type CheckTier = 'anonymous' | 'free' | 'premium';

/** Days from one check to the next. `null` means the single check is all there is. */
export const CHECK_INTERVAL_DAYS: Record<CheckTier, number | null> = {
  anonymous: null,
  free: 7,
  premium: 1,
};

export type CheckQuota = {
  tier: CheckTier;
  /** Whether a check can be started (or an unfinished one continued) right now. */
  allowed: boolean;
  /** Date in Japan (YYYY-MM-DD) the next check opens; null when allowed or when it never does. */
  nextAvailableOn: string | null;
};

/** Request header carrying the id from src/lib/device-id.ts on speech check requests. */
export const DEVICE_ID_HEADER = 'x-device-id';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Calendar date in Japan (YYYY-MM-DD). The limits roll over at midnight there. */
export function jstDateKey(date = new Date()) {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `today` until `dateKey`; 0 when the date is today or already past. */
export function daysUntilDateKey(dateKey: string, today = jstDateKey()) {
  const diff = Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.max(0, Math.round(diff / DAY_MS));
}

/** The quota for a caller whose latest check started at `lastCheckAt` (null if none yet). */
export function quotaAfterLastCheck(
  tier: CheckTier,
  lastCheckAt: Date | null,
  now = new Date()
): CheckQuota {
  if (!lastCheckAt) return { tier, allowed: true, nextAvailableOn: null };
  const interval = CHECK_INTERVAL_DAYS[tier];
  if (interval === null) return { tier, allowed: false, nextAvailableOn: null };
  const next = addDaysToDateKey(jstDateKey(lastCheckAt), interval);
  return next <= jstDateKey(now)
    ? { tier, allowed: true, nextAvailableOn: null }
    : { tier, allowed: false, nextAvailableOn: next };
}

function nextDateLabel(dateKey: string, today: string) {
  if (daysUntilDateKey(dateKey, today) === 1) return '明日';
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

/** What to tell a caller who has reached the limit. */
export function checkLimitMessage(quota: CheckQuota, today = jstDateKey()) {
  if (quota.tier === 'anonymous' || !quota.nextAvailableOn) {
    return {
      title: 'ログインなしの発話チェックは1回までです',
      body: 'Googleでログインすると、週に1回、無料で発話チェックができます。',
    };
  }
  const title = `次の発話チェックは${nextDateLabel(quota.nextAvailableOn, today)}からです`;
  return quota.tier === 'premium'
    ? { title, body: '発話チェックは1日1回です。日付が変わると、また測定できます。' }
    : {
        title,
        body: '無料プランの発話チェックは週に1回です。プレミアムでは毎日測定できます。',
      };
}
