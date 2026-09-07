import { Platform } from 'react-native';

// Google Analytics 4 on the web build only. The tag itself is injected by src/app/+html.tsx
// when EXPO_PUBLIC_GA_MEASUREMENT_ID is set at build time; these helpers are no-ops otherwise.

export const GA_MEASUREMENT_ID = process.env.EXPO_PUBLIC_GA_MEASUREMENT_ID ?? '';

type Gtag = (...args: unknown[]) => void;

function gtag(): Gtag | null {
  if (Platform.OS !== 'web' || !GA_MEASUREMENT_ID || typeof window === 'undefined') return null;
  const fn = (window as unknown as { gtag?: Gtag }).gtag;
  return typeof fn === 'function' ? fn : null;
}

/** Records a page view; called on every route change because the app is a single page. */
export function trackPageView(path: string) {
  gtag()?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** Records a named event, e.g. `begin_checkout`, `check_completed`. */
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  gtag()?.('event', name, params);
}
