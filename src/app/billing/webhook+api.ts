import type Stripe from 'stripe';

import type { Plan } from '@/lib/plans';
import { getStripe } from '@/server/stripe';
import { setUserPlan } from '@/server/supabase-admin';

// Stripe calls this after checkout and on every subscription change. The user id travels in
// the metadata we set when creating the Checkout session, and is copied onto the customer so
// later events can be mapped even without subscription metadata.

const PREMIUM_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];

function planForStatus(status: Stripe.Subscription.Status): Plan {
  return PREMIUM_STATUSES.includes(status) ? 'premium' : 'free';
}

async function userIdForSubscription(stripe: Stripe, subscription: Stripe.Subscription) {
  if (subscription.metadata?.userId) return subscription.metadata.userId;
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  return customer.deleted ? null : (customer.metadata?.userId ?? null);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json({ error: 'Webhook is not configured' }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error('webhook signature failed', error);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId ?? session.client_reference_id;
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (userId && customerId) {
          await stripe.customers.update(customerId, { metadata: { userId } });
        }
        if (userId && session.mode === 'subscription') {
          await setUserPlan(userId, 'premium');
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = await userIdForSubscription(stripe, subscription);
        if (!userId) {
          console.warn('subscription without user id', subscription.id);
          break;
        }
        const plan =
          event.type === 'customer.subscription.deleted'
            ? 'free'
            : planForStatus(subscription.status);
        await setUserPlan(userId, plan);
        break;
      }
      case 'invoice.payment_failed':
        // Stripe retries and, if it gives up, sends subscription.updated/deleted.
        console.warn('payment failed for invoice', event.data.object.id);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error('webhook handling failed', event.type, error);
    return Response.json({ error: 'Handler failed' }, { status: 500 });
  }

  return Response.json({ received: true });
}
