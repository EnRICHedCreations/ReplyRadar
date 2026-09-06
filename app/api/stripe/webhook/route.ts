import { stripe, prices } from "@/lib/billing";
import { transaction, accountLock } from "@/lib/db";
import { z } from "zod";
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });
  const client = stripe();
  let event;
  try {
    event = client.webhooks.constructEvent(
      await req.text(),
      req.headers.get("stripe-signature") || "",
      secret,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    await transaction(async (c) => {
      if (
        (await c.query("select 1 from stripe_events where id=$1", [event.id]))
          .rowCount
      )
        return;
      const obj = event.data.object as any;
      if (event.type.startsWith("customer.subscription.")) {
        const id = z.uuid().parse(obj.metadata?.user_id);
        await accountLock(c, id);
        if (
          (await c.query("select 1 from stripe_events where id=$1", [event.id]))
            .rowCount
        )
          return; // Fetch current state while serialized: old/reordered events cannot restore stale access.
        const sub = await client.subscriptions.retrieve(obj.id);
        const price = sub.items.data[0]?.price.id,
          plan =
            Object.entries(prices()).find(([, p]) => p && p === price)?.[0] ||
            "free";
        const period = sub.items.data[0]?.current_period_end;
        await c.query(
          "insert into subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan,status,current_period_end) values($1,$2,$3,$4,$5,$6,$7) on conflict(user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,stripe_price_id=excluded.stripe_price_id,plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end,updated_at=now()",
          [
            id,
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
            sub.id,
            price,
            plan,
            sub.status,
            period ? new Date(period * 1000) : null,
          ],
        );
        if (event.type === "customer.subscription.created")
          await c.query(
            "insert into usage_events(user_id,type) values($1,'subscription_started')",
            [id],
          );
      }
      await c.query(
        "insert into stripe_events(id) values($1) on conflict do nothing",
        [event.id],
      );
    });
    return Response.json({ received: true });
  } catch {
    return new Response("Processing failed; retry required", { status: 500 });
  }
}
