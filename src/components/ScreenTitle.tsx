import Head from 'expo-router/head';

import { SITE_NAME } from '@/constants/site';

/** Sets the browser tab title for one screen, e.g. "料金 | 発話フィットネス". */
export function ScreenTitle({ title }: { title: string }) {
  return (
    <Head>
      <title>{`${title} | ${SITE_NAME}`}</title>
    </Head>
  );
}
