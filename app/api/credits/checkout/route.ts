import { NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { stripe } from "@/lib/billing";
import { rateLimit, sameOrigin } from "@/lib/security";

const packs = { 1000: 1000, 2500: 2500, 5000: 5000, 10000: 10000 } as const;

export async function POST(req: Request) {
  const u = await user();
  sameOrigin(req);
  await rateLimit(`credit-checkout:${u.id}`, 5, 60);
  const { amount_cents } = z.object({ amount_cents: z.union([z.literal(1000), z.literal(2500), z.literal(5000), z.literal(10000)]) }).parse(await req.json());
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (!app) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: u.id,
    customer_email: u.email || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: packs[amount_cents],
        product_data: { name: `ReplyRadar $${(amount_cents / 100).toFixed(0)} usage credits` },
      },
    }],
    metadata: { user_id: u.id, credits_cents: String(amount_cents) },
    payment_intent_data: { metadata: { user_id: u.id, credits_cents: String(amount_cents) } },
    success_url: app + "/billing?credits=added",
    cancel_url: app + "/billing",
  });
  return NextResponse.json({ url: session.url });
}
