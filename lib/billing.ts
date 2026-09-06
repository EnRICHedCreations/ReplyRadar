import Stripe from "stripe";
let instance: Stripe | undefined;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error("Billing is not configured yet.");
  return (instance ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    timeout: 10000,
    maxNetworkRetries: 1,
  }));
}
export function prices() {
  return {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    growth: process.env.STRIPE_PRICE_GROWTH,
  };
}
