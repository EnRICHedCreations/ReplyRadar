import { createHash } from "node:crypto";
import { transaction } from "@/lib/db";
import { safeEqual, encrypt } from "@/lib/security";
import { z } from "zod";
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    !secret ||
    !safeEqual(req.headers.get("x-telegram-bot-api-secret-token") || "", secret)
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const v = z
      .object({
        message: z
          .object({
            text: z.string().max(200).optional(),
            chat: z.object({ id: z.number().int(), type: z.string() }),
          })
          .optional(),
      })
      .parse(await req.json());
    const m = v.message,
      token = m?.text?.match(/^\/start ([a-f0-9]{48})$/)?.[1];
    if (!token || m?.chat.type !== "private")
      return Response.json({ ok: true });
    await transaction(async (c) => {
      const row = (
        await c.query(
          "delete from telegram_links where token_hash=$1 and expires_at>now() returning user_id",
          [createHash("sha256").update(token).digest("hex")],
        )
      ).rows[0];
      if (!row) return;
      const integration = (
        await c.query(
          "insert into integrations(user_id,type,encrypted_credentials) values($1,'telegram',$2) on conflict(user_id,type) do update set encrypted_credentials=excluded.encrypted_credentials,enabled=true,last_error=null returning id",
          [row.user_id, encrypt(String(m.chat.id))],
        )
      ).rows[0];
      await c.query(
        "insert into notification_deliveries(user_id,integration_id) values($1,$2)",
        [row.user_id, integration.id],
      );
      await c.query(
        "insert into usage_events(user_id,type) values($1,'integration_connected')",
        [row.user_id],
      );
    });
    return Response.json({ ok: true });
  } catch {
    return new Response("Unable to connect", { status: 500 });
  }
}
