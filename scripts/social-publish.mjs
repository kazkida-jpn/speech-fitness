// Triggers the deployed publish endpoint by hand. Dry run by default; pass --send to publish.
//
//   SOCIAL_ENDPOINT=https://<domain>/social/publish CRON_SECRET=... node scripts/social-publish.mjs
//   SOCIAL_ENDPOINT=... CRON_SECRET=... node scripts/social-publish.mjs --send
const endpoint = process.env.SOCIAL_ENDPOINT;
const secret = process.env.CRON_SECRET;
if (!endpoint || !secret) {
  console.error('Set SOCIAL_ENDPOINT and CRON_SECRET.');
  process.exit(1);
}
const send = process.argv.includes('--send');
const url = new URL(endpoint);
if (!send) url.searchParams.set('dry', '1');

const response = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
const body = await response.json();
console.log(JSON.stringify(body, null, 2));
process.exit(response.ok ? 0 : 1);
