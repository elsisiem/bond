import Stripe from "stripe";
import type { Env } from "../types";

export const stripeClient = (env: Env) =>
  new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 1 });

export async function verifyStripeEvent(env: Env, raw: string, sig: string): Promise<Stripe.Event> {
  const s = stripeClient(env);
  return s.webhooks.constructEventAsync(raw, sig, env.STRIPE_WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider());
}
