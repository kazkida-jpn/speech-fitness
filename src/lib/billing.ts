import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import type { ApiErrorBody } from '@/lib/assessment-types';
import type { BillingPlan, Plan } from '@/lib/plans';
import { supabase } from '@/lib/supabase';

// Client side of billing: reads the plan from Supabase and hands the user to Stripe.

async function authHeaders() {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (!session) throw new Error('ログインが必要です。');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

async function openStripePage(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: 'POST',
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = (await response.json()) as { url?: string } & ApiErrorBody;
  if (!response.ok || !result.url) throw new Error(result.error || 'ページを開けませんでした。');
  if (Platform.OS === 'web') {
    window.location.assign(result.url);
  } else {
    await Linking.openURL(result.url);
  }
}

/** Sends the user to Stripe Checkout for the chosen plan. */
export function startCheckout(plan: BillingPlan) {
  return openStripePage('/billing/checkout', { plan });
}

/** Sends the user to the Stripe billing portal to cancel or update payment details. */
export function openBillingPortal() {
  return openStripePage('/billing/portal');
}

export async function fetchPlan(): Promise<Plan> {
  if (!supabase) return 'free';
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 'free';
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  return data?.plan === 'premium' ? 'premium' : 'free';
}

/** The signed-in user's plan. `plan` is null until the first read completes. */
export function usePlan() {
  const [plan, setPlan] = useState<Plan | null>(null);

  const refresh = useCallback(() => {
    let active = true;
    fetchPlan()
      .then((value) => {
        if (active) setPlan(value);
      })
      .catch(() => {
        if (active) setPlan('free');
      });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [refresh]);

  return { plan, isPremium: plan === 'premium', isLoading: plan === null, refresh };
}
