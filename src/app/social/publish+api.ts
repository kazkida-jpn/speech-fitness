import { publishNext } from '@/server/social';

// Vercel Cron calls this (see vercel.json) and sends `Authorization: Bearer <CRON_SECRET>`.
// `?dry=1` reports the next post without publishing, which is how to check the queue by hand:
//   curl -H "Authorization: Bearer $CRON_SECRET" "https://<domain>/social/publish?dry=1"

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }
  if (!authorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dry') === '1';
  try {
    const report = await publishNext(url.origin, dryRun);
    const failed = report.results.some((result) => !result.ok);
    return Response.json({ dryRun, ...report }, { status: failed ? 502 : 200 });
  } catch (error) {
    console.error('social publish failed', error);
    const message = error instanceof Error ? error.message : 'publish failed';
    return Response.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
