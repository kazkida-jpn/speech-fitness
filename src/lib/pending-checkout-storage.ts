import AsyncStorage from '@react-native-async-storage/async-storage';

import { decodePendingCheckout, encodePendingCheckout } from '@/lib/pending-checkout';
import type { BillingPlan } from '@/lib/plans';

// Storage side of the pending checkout; kept apart from the codec so the codec stays
// importable in plain Node tests.

const PENDING_KEY = 'speech-fitness:pending-checkout';

export async function rememberPendingCheckout(plan: BillingPlan) {
  try {
    await AsyncStorage.setItem(PENDING_KEY, encodePendingCheckout(plan));
  } catch {
    // Without storage the visitor simply lands on the pricing page again after sign-in.
  }
}

/** Reads and clears the remembered plan in one step. */
export async function takePendingCheckout(): Promise<BillingPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (raw !== null) await AsyncStorage.removeItem(PENDING_KEY);
    return decodePendingCheckout(raw);
  } catch {
    return null;
  }
}
