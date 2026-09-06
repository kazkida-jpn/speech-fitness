// One-time Stripe setup, safe to re-run. Creates the premium product and its two recurring
// prices (looked up by lookup_key so re-runs reuse them) and, when a URL is given, the
// webhook endpoint the app needs.
//
//   STRIPE_SECRET_KEY=sk_... node scripts/stripe-setup.mjs
//   STRIPE_SECRET_KEY=sk_... node scripts/stripe-setup.mjs --webhook https://example.com/billing/webhook
//
// Prints the ids and secrets to copy into the environment. Never commits them anywhere.
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set');
  process.exit(1);
}
const stripe = new Stripe(key);
const mode = key.startsWith('sk_live_') ? 'LIVE' : 'test';

const PRODUCT_NAME = '発話フィットネス プレミアム';
const PRICES = [
  { lookupKey: 'speech_fitness_monthly', amount: 500, interval: 'month', nickname: '月額' },
  { lookupKey: 'speech_fitness_yearly', amount: 3980, interval: 'year', nickname: '年額' },
];
const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
];

async function ensureProduct() {
  const existing = await stripe.products.search({
    query: "active:'true' AND metadata['app']:'speech-fitness'",
  });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({
    name: PRODUCT_NAME,
    description: '8種類のドリル、AIが選ぶ最優先ドリル、測定履歴と推移、練習カレンダーの同期',
    metadata: { app: 'speech-fitness' },
  });
}

async function ensurePrice(productId, spec) {
  const existing = await stripe.prices.list({ lookup_keys: [spec.lookupKey], active: true });
  if (existing.data[0]) return existing.data[0];
  return stripe.prices.create({
    product: productId,
    currency: 'jpy',
    unit_amount: spec.amount,
    recurring: { interval: spec.interval },
    lookup_key: spec.lookupKey,
    nickname: spec.nickname,
  });
}

async function ensureWebhook(url) {
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const found = existing.data.find((endpoint) => endpoint.url === url);
  if (found) {
    console.log(`webhook already exists: ${found.id} (secret is only shown at creation)`);
    return null;
  }
  return stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS });
}

/** The billing portal refuses to open until a configuration exists; create a default one. */
async function ensurePortalConfiguration() {
  const existing = await stripe.billingPortal.configurations.list({ limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.billingPortal.configurations.create({
    business_profile: { headline: '発話フィットネス プレミアム' },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
    },
  });
}

const product = await ensureProduct();
const portal = await ensurePortalConfiguration();
console.log(`[${mode}] billing portal configuration ${portal.id}`);
console.log(`[${mode}] product ${product.id} ${product.name}`);
for (const spec of PRICES) {
  const price = await ensurePrice(product.id, spec);
  const envName = spec.interval === 'month' ? 'STRIPE_PRICE_MONTHLY' : 'STRIPE_PRICE_YEARLY';
  console.log(`[${mode}] ${envName}=${price.id}  (¥${price.unit_amount}/${spec.interval})`);
}

const webhookIndex = process.argv.indexOf('--webhook');
if (webhookIndex > -1) {
  const url = process.argv[webhookIndex + 1];
  const endpoint = await ensureWebhook(url);
  if (endpoint)
    console.log(`[${mode}] STRIPE_WEBHOOK_SECRET=${endpoint.secret}  (${endpoint.url})`);
}
