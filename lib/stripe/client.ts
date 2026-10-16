import Stripe from "stripe";
import { getStripeKeys } from "./config";

const globalForStripe = globalThis as unknown as { stripe?: { key: string; client: Stripe } };

// Anahtar admin panelinden değişirse yeni istemci oluşturulur
export async function getStripe(): Promise<Stripe> {
  const { secretKey } = await getStripeKeys();
  if (!secretKey) throw new Error("Stripe is not configured (add the keys in Admin > Integrations)");
  if (globalForStripe.stripe?.key === secretKey) return globalForStripe.stripe.client;
  const client = new Stripe(secretKey);
  globalForStripe.stripe = { key: secretKey, client };
  return client;
}
