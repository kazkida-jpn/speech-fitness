import { router } from 'expo-router';
import { useEffect } from 'react';

import { takePendingCheckout } from '@/lib/pending-checkout-storage';
import { supabase } from '@/lib/supabase';

/**
 * After Google sign-in brings the browser back to the site root, sends a visitor who had
 * already chosen a plan on to the pricing page, which then opens Stripe. Renders nothing.
 */
export function CheckoutResume() {
  useEffect(() => {
    if (!supabase) return;
    let handled = false;
    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (handled || !session) return;
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
      handled = true;
      takePendingCheckout().then((plan) => {
        if (plan) router.replace({ pathname: '/pricing', params: { plan } });
      });
    });
    return () => subscription.data.subscription.unsubscribe();
  }, []);
  return null;
}
