import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { trackPageView } from '@/lib/analytics';

/** Sends a GA4 page view whenever the route changes. Renders nothing. */
export function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);
  return null;
}
