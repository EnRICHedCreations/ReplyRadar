import { stripe } from "@/lib/billing";
import { transaction, accountLock } from "@/lib/db";
import { z } from "zod";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });
  const client = stripe();
  let event;
  try {
    event = client.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") || "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    await transaction(async (c) => {
      if ((await c.query("select 1 from stripe_events where id=$1", [event.id])).rowCount) return;
      if (event.type === "checkout.session.completed") {
        const obj = event.data.object as any;
        if (obj.mode === "payment" && obj.payment_status === "paid") {
          const userId = z.uuid().parse(obj.metadata?.user_id || obj.client_reference_id);
          const credits = Number(obj.metadata?.credits_cents || 0);
          if (![1000,2500,5000,10000].includes(credits)) throw new Error("Invalid credit amount");
          await accountLock(c, userId);
          await c.query("insert into credit_accounts(user_id,balance_cents,lifetime_purchased_cents) values($1,$2,$2) on conflict(user_id) do update set balance_cents=credit_accounts.balance_cents+$2,lifetime_purchased_cents=credit_accounts.lifetime_purchased_cents+$2,updated_at=now()", [userId, credits]);
          await c.query("insert into credit_ledger(user_id,amount_cents,kind,stripe_session_id,metadata) values($1,$2,'purchase',$3,$4) on conflict(stripe_session_id) do nothing", [userId, credits, obj.id, JSON.stringify({ payment_intent: obj.payment_intent, amount_total: obj.amount_total })]);
          await c.query("insert into usage_events(user_id,type,quantity) values($1,'credits_purchased',$2)", [userId, credits]);
        }
      }
      await c.query("insert into stripe_events(id) values($1) on conflict do nothing", [event.id]);
    });
    return Response.json({ received: true });
  } catch {
    return new Response("Processing failed; retry required", { status: 500 });
  }
}
