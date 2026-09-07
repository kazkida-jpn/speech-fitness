import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';

import { AnalyticsTracker } from '@/components/AnalyticsTracker';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '@/constants/site';

export default function RootLayout() {
  return (
    <>
      {/* Defaults for every page; a screen's own <Head> overrides these. */}
      <Head>
        <title>{`${SITE_NAME} | ${SITE_TAGLINE}`}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta property="og:title" content={`${SITE_NAME} | ${SITE_TAGLINE}`} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
      </Head>
      <StatusBar style="dark" />
      <AnalyticsTracker />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
