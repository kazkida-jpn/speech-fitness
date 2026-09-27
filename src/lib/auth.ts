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

/**
 * Synchronous hint for web. Supabase keeps the session in localStorage under
 * "sb-<project>-auth-token", so its presence means this browser was signed in last time. The
 * root screen uses it to pick the home screen before the first paint instead of flashing the
 * landing page at returning members; the real session read then confirms or corrects it.
 */
export function hasStoredSessionSync() {
  if (!supabase || typeof window === 'undefined') return false;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) return true;
    }
  } catch {
    // Storage can be blocked in private browsing; the async read decides instead.
  }
  return false;
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
