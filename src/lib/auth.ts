import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// Sign-in helpers shared by the header and by screens that need an account before they
// can continue, such as the pricing page.

/** Starts Google sign-in; on web the browser comes back to the site root afterwards. */
export async function signInWithGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
  });
}

/** The signed-in user; `undefined` until the first read completes, `null` when signed out. */
export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  return user;
}
