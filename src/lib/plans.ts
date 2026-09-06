import type { DrillId } from '@/lib/drills';

// Plan definitions shared by the screens and the billing API routes. Prices here are for
// display only; Stripe holds the amounts that are actually charged.

export type Plan = 'free' | 'premium';

export type BillingPlan = 'monthly' | 'yearly';

export const BILLING_PLANS: Record<
  BillingPlan,
  { label: string; amount: number; per: string; note: string }
> = {
  monthly: { label: '月額プラン', amount: 500, per: '月', note: 'いつでも解約できます' },
  yearly: { label: '年額プラン', amount: 3980, per: '年', note: '月あたり約332円' },
};

export const TRIAL_DAYS = 14;

/** Drills everyone can use. The rest need a premium plan. */
export const FREE_DRILL_IDS: DrillId[] = ['sibilants', 'speed'];

export function isDrillFree(id: DrillId) {
  return FREE_DRILL_IDS.includes(id);
}

export const PREMIUM_FEATURES = [
  '8種類すべてのドリル',
  'AIが診断から選んだ最優先ドリル',
  '測定履歴と推移の記録',
  '練習カレンダーの端末間同期',
];
