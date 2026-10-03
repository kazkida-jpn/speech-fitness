import { getCheckQuota } from '@/server/check-quota';

/** Tells the app whether the caller can start a speech check now, and if not, when. */
export async function GET(request: Request) {
  return Response.json(await getCheckQuota(request), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
