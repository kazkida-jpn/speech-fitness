import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { palette } from '@/constants/palette';
import { SITE_NAME, SITE_URL } from '@/constants/site';

// Root HTML for every statically rendered page. Runs only in Node during export, so no
// browser APIs here. Title and description come from <Head> in _layout.tsx and each screen;
// Expo appends the favicon.ico link itself from app.json.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content={palette.cream} />
        <meta name="application-name" content={SITE_NAME} />
        <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="ja_JP" />
        <meta name="twitter:card" content="summary_large_image" />
        <ScrollViewStyleReset />
        <style>{`body{background:${palette.cream}}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
