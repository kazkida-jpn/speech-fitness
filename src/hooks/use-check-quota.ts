import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { fetchCheckQuota } from '@/lib/api-client';
import type { CheckQuota } from '@/lib/check-quota';
import { supabase } from '@/lib/supabase';

/**
 * Whether the speech check can be started now. `quota` is null until the first answer arrives
 * and stays as it was if a later read fails; the server enforces the limit either way, so a
 * screen can treat null as open.
 */
export function useCheckQuota() {
  const [quota, setQuota] = useState<CheckQuota | null>(null);

  const refresh = useCallback(() => {
    let active = true;
    fetchCheckQuota()
      .then((value) => {
        if (active) setQuota(value);
      })
      .catch(() => {});
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

  return { quota, refresh };
}
