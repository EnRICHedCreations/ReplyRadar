import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { user } from "@/lib/auth";
import { db, transaction, accountLock } from "@/lib/db";
import { radarSchema, entitlement, suggestQuery } from "@/lib/domain";
import { readLimits } from "@/lib/scanner";
import { rateLimit, sameOrigin, encrypt, discordURL } from "@/lib/security";
import { stripe, prices } from "@/lib/billing";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const uuid = z.uuid();
async function route(req: Request, ctx: Context) {
  try {
    const u = await user(),
      path = (await ctx.params).path,
      resource = path[0],
      id = path[1];
    if (req.method !== "GET") {
      sameOrigin(req);
      await rateLimit(`write:${u.id}`, 60, 60);
    }
    if (req.method === "GET") {
      if (resource === "snapshot") {
        const [radars, stats, sub, worker] = await Promise.all([
          db().query(
            "select * from radars where user_id=$1 order by created_at",
            [u.id],
          ),
          db().query(
            `select (select count(*) from radars where user_id=$1 and enabled) active_radars,(select count(*) from matches where user_id=$1 and detected_at>=current_date) matches_today,(select count(*) from matches where user_id=$1 and detected_at>=current_date and score>=80) high_opportunity,(select round(avg(extract(epoch from(m.detected_at-p.posted_at)))) from matches m join posts p on p.id=m.post_id where m.user_id=$1 and m.detected_at>=current_date) avg_detection`,
            [u.id],
          ),
          db().query("select * from subscriptions where user_id=$1", [u.id]),
          db().query(
            "select exists(select 1 from worker_heartbeats where last_seen_at>now()-interval '60 seconds') healthy",
          ),
        ]);
        return NextResponse.json({
          radars: radars.rows,
          stats: stats.rows[0],
          subscription: sub.rows[0] || { plan: "free", status: "active" },
          worker: worker.rows[0].healthy,
          provider: process.env.SOCIAL_PROVIDER || "mock",
          email: u.email,
        });
      }
      if (resource === "matches") {
        const q = new URL(req.url).searchParams,
          page = Math.max(0, Math.min(10000, Number(q.get("page")) || 0)),
          filter = q.get("filter") || "all",
          radar = q.get("radar") || null,
          score = Math.max(0, Math.min(100, Number(q.get("score")) || 0));
        if (radar) uuid.parse(radar);
        const rows = await db().query(
          `select m.*,p.username,p.display_name,p.author_id,p.text,p.url,p.posted_at,p.likes,p.replies,p.reposts,p.followers,r.name radar_name,r.query from matches m join posts p on p.id=m.post_id join radars r on r.id=m.radar_id where m.user_id=$1 and ($2::uuid is null or m.radar_id=$2) and m.score >= $3 and p.text ilike $4 and (($5='archived' and m.archived_at is not null) or ($5<>'archived' and m.archived_at is null)) and ($5 in ('all','archived') or ($5='high' and m.score>=80) or m.intent=$5) and not exists(select 1 from muted_authors a where a.user_id=$1 and a.author_id=p.author_id) order by m.detected_at desc limit 31 offset $6`,
          [
            u.id,
            radar,
            score,
            "%" + (q.get("q") || "").slice(0, 200) + "%",
            filter,
            page * 30,
          ],
        );
        return NextResponse.json({
          items: rows.rows.slice(0, 30),
          more: rows.rows.length > 30,
        });
      }
      if (resource === "deliveries") {
        if (id) uuid.parse(id);
        return NextResponse.json(
          (
            await db().query(
              "select d.id,d.match_id,d.status,d.attempt_count,d.sent_at,d.last_error,i.type from notification_deliveries d join integrations i on i.id=d.integration_id where d.user_id=$1 and ($2::uuid is null or d.match_id=$2) order by d.queued_at desc limit 100",
              [u.id, id || null],
            )
          ).rows,
        );
      }
      if (resource === "radars" && id) {
        uuid.parse(id);
        const radar = (
          await db().query("select * from radars where id=$1 and user_id=$2", [
            id,
            u.id,
          ])
        ).rows[0];
        if (!radar)
          return NextResponse.json(
            { error: "Radar not found." },
            { status: 404 },
          );
        if (path[2] === "history")
          return NextResponse.json(
            (
              await db().query(
                "select * from scan_runs where radar_id=$1 and user_id=$2 order by started_at desc limit 100",
                [id, u.id],
              )
            ).rows,
          );
        radar.integration_ids = (
          await db().query(
            "select integration_id from radar_integrations where radar_id=$1",
            [id],
          )
        ).rows.map((x) => x.integration_id);
        return NextResponse.json(radar);
      }
      if (resource === "integrations")
        return NextResponse.json(
          (
            await db().query(
              "select id,type,enabled,configuration_json,last_success_at,last_error from integrations where user_id=$1 order by created_at",
              [u.id],
            )
          ).rows,
        );
      if (resource === "usage") {
        const rows = await db().query(
          "select type,coalesce(sum(quantity),0) quantity from usage_events where user_id=$1 and occurred_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' group by type",
          [u.id],
        );
        const days = await db().query(
          "select to_char(occurred_at at time zone 'UTC','YYYY-MM-DD') day,sum(quantity) scans from usage_events where user_id=$1 and type='scan' and occurred_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' group by day order by day",
          [u.id],
        );
        return NextResponse.json({ totals: rows.rows, days: days.rows });
      }
      if (resource === "account") {
        return NextResponse.json(
          (await db().query("select * from profiles where id=$1", [u.id]))
            .rows[0] || {
            email: u.email,
            display_name: "",
            timezone: "UTC",
            preferences: {},
          },
        );
      }
    }
    const body = req.method === "DELETE" ? {} : await req.json();
    if (
      (resource === "radars" && req.method === "POST" && !id) ||
      (resource === "radars" && req.method === "PUT" && id)
    ) {
      const input = radarSchema.parse(body);
      if (id) uuid.parse(id);
      const radar = await transaction(async (c) => {
        await accountLock(c, u.id);
        const limits = await readLimits(c, u.id);
        if (input.scan_interval_seconds < limits.interval)
          throw new Error(
            `Your plan scans at most every ${limits.interval} seconds.`,
          );
        if (
          !id &&
          Number(
            (
              await c.query("select count(*) n from radars where user_id=$1", [
                u.id,
              ])
            ).rows[0].n,
          ) >= limits.radars
        )
          throw new Error("Radar limit reached. Upgrade or delete a radar.");
        for (const integration of input.integration_ids)
          if (
            !(
              await c.query(
                "select 1 from integrations where id=$1 and user_id=$2 and enabled",
                [integration, u.id],
              )
            ).rowCount
          )
            throw new Error("Integration not found.");
        let result;
        if (id) {
          result = (
            await c.query(
              "update radars set name=$3,description=$4,query=$5,enabled=$6,scan_interval_seconds=$7,timezone=$8,active_schedule_json=$9,minimum_score=$10,provider_cursor=case when query<>$5 then null else provider_cursor end,updated_at=now(),last_error=null,next_scan_at=now() where id=$1 and user_id=$2 returning *",
              [
                id,
                u.id,
                input.name,
                input.description,
                input.query,
                input.enabled,
                input.scan_interval_seconds,
                input.timezone,
                input.active_schedule_json,
                input.minimum_score,
              ],
            )
          ).rows[0];
          if (!result) throw new Error("Radar not found.");
        } else {
          result = (
            await c.query(
              "insert into radars(user_id,name,description,query,enabled,scan_interval_seconds,timezone,active_schedule_json,minimum_score,provider) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *",
              [
                u.id,
                input.name,
                input.description,
                input.query,
                input.enabled,
                input.scan_interval_seconds,
                input.timezone,
                input.active_schedule_json,
                input.minimum_score,
                process.env.SOCIAL_PROVIDER || "mock",
              ],
            )
          ).rows[0];
          await c.query(
            "insert into usage_events(user_id,radar_id,type) values($1,$2,'radar_created')",
            [u.id, result.id],
          );
        }
        await c.query("delete from radar_integrations where radar_id=$1", [
          result.id,
        ]);
        for (const integration of input.integration_ids)
          await c.query("insert into radar_integrations values($1,$2)", [
            result.id,
            integration,
          ]);
        if (result.enabled)
          await c.query(
            "insert into scan_jobs(radar_id) values($1) on conflict do nothing",
            [result.id],
          );
        return result;
      });
      return NextResponse.json(radar);
    }
    if (resource === "radars" && id) {
      uuid.parse(id);
      if (req.method === "DELETE") {
        await db().query("delete from radars where id=$1 and user_id=$2", [
          id,
          u.id,
        ]);
        return NextResponse.json({ ok: true });
      }
      if (path[2] === "scan") {
        await rateLimit("scan:" + u.id, 3, 60);
        await transaction(async (c) => {
          await accountLock(c, u.id);
          const r = (
            await c.query(
              "select * from radars where id=$1 and user_id=$2 for update",
              [id, u.id],
            )
          ).rows[0];
          if (!r || !r.enabled)
            throw new Error("Activate this radar before scanning.");
          const limits = await readLimits(c, u.id);
          const used = Number(
            (
              await c.query(
                "select coalesce(sum(quantity),0) n from usage_events where user_id=$1 and type='scan' and occurred_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'",
                [u.id],
              )
            ).rows[0].n,
          );
          if (used >= limits.scans)
            throw new Error("Monthly scan quota exhausted.");
          if (
            r.last_scan_at &&
            +new Date(r.last_scan_at) +
              Math.max(limits.interval, r.scan_interval_seconds) * 1000 >
              Date.now()
          )
            throw new Error("Wait until the next scan interval.");
          await c.query(
            "insert into scan_jobs(radar_id) values($1) on conflict do nothing",
            [id],
          );
        });
        return NextResponse.json(
          {
            message:
              "Scan queued. Results will appear after the worker processes it.",
          },
          { status: 202 },
        );
      }
      if (path[2] === "toggle") {
        const { enabled } = z.object({ enabled: z.boolean() }).parse(body);
        await transaction(async (c) => {
          await accountLock(c, u.id);
          await c.query(
            "update radars set enabled=$3,next_scan_at=now(),last_error=null where id=$1 and user_id=$2",
            [id, u.id, enabled],
          );
          if (enabled)
            await c.query(
              "insert into usage_events(user_id,radar_id,type) select user_id,id,'radar_activated' from radars where id=$1 and user_id=$2",
              [id, u.id],
            );
        });
        return NextResponse.json({ ok: true });
      }
    }
    if (resource === "query") {
      await rateLimit("query:" + u.id, 15, 60);
      const v = z
        .object({
          description: z.string().min(3).max(1000),
          goal: z.string().max(50).optional(),
        })
        .parse(body);
      return NextResponse.json({
        query: suggestQuery(v.description, v.goal),
        method: "template",
      });
    }
    if (resource === "matches" && id) {
      uuid.parse(id);
      if (path[2] === "mute") {
        await db().query(
          "insert into muted_authors(user_id,author_id) select $2,p.author_id from matches m join posts p on p.id=m.post_id where m.id=$1 and m.user_id=$2 on conflict do nothing",
          [id, u.id],
        );
      } else {
        const { archived } = z.object({ archived: z.boolean() }).parse(body);
        await db().query(
          "update matches set archived_at=case when $3 then now() else null end where id=$1 and user_id=$2",
          [id, u.id, archived],
        );
      }
      return NextResponse.json({ ok: true });
    }
    if (resource === "integrations") {
      if (req.method === "DELETE" && id) {
        uuid.parse(id);
        await db().query(
          "delete from integrations where id=$1 and user_id=$2",
          [id, u.id],
        );
        return NextResponse.json({ ok: true });
      }
      if (id && path[2] === "test") {
        uuid.parse(id);
        await rateLimit("test:" + u.id, 3, 60);
        const d = (
          await db().query(
            "insert into notification_deliveries(user_id,integration_id) select user_id,id from integrations where id=$1 and user_id=$2 and enabled returning id",
            [id, u.id],
          )
        ).rows[0];
        if (!d) throw new Error("Integration not found.");
        return NextResponse.json(
          { message: "Test queued. Delivery status updates below." },
          { status: 202 },
        );
      }
      const v = z
        .object({
          type: z.enum(["telegram", "discord", "email"]),
          webhook: z.string().max(300).optional(),
          mode: z.enum(["instant", "high"]).default("instant"),
        })
        .parse(body);
      if (v.type === "telegram") {
        if (
          !process.env.TELEGRAM_BOT_USERNAME ||
          !process.env.TELEGRAM_BOT_TOKEN ||
          !process.env.TELEGRAM_WEBHOOK_SECRET
        )
          throw new Error("Telegram has not been configured by the operator.");
        const token = randomBytes(24).toString("hex");
        await db().query(
          "insert into telegram_links(token_hash,user_id,expires_at) values($1,$2,now()+interval '10 minutes')",
          [createHash("sha256").update(token).digest("hex"), u.id],
        );
        return NextResponse.json({
          url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`,
        });
      }
      if (v.type === "discord") {
        const s = (
          await db().query("select * from subscriptions where user_id=$1", [
            u.id,
          ])
        ).rows[0];
        if (entitlement(s) !== "growth")
          throw new Error("Discord requires the Growth plan.");
      }
      if (
        v.type === "email" &&
        (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
      )
        throw new Error(
          "Email delivery has not been configured by the operator.",
        );
      const secret =
        v.type === "discord" ? discordURL(v.webhook || "") : u.email;
      if (!secret || (v.type === "email" && !u.email_confirmed_at))
        throw new Error("Verify your account email first.");
      await db().query(
        "insert into integrations(user_id,type,encrypted_credentials,configuration_json) values($1,$2,$3,$4) on conflict(user_id,type) do update set encrypted_credentials=excluded.encrypted_credentials,enabled=true,configuration_json=excluded.configuration_json,last_error=null",
        [u.id, v.type, encrypt(secret), JSON.stringify({ mode: v.mode })],
      );
      await db().query(
        "insert into usage_events(user_id,type) values($1,'integration_connected')",
        [u.id],
      );
      return NextResponse.json({ ok: true });
    }
    if (resource === "billing") {
      await rateLimit("billing:" + u.id, 3, 60);
      const client = stripe(),
        app = process.env.NEXT_PUBLIC_APP_URL!;
      if (id === "portal") {
        const s = (
          await db().query(
            "select stripe_customer_id from subscriptions where user_id=$1",
            [u.id],
          )
        ).rows[0];
        if (!s?.stripe_customer_id)
          throw new Error("No billing account yet. Choose a paid plan first.");
        return NextResponse.json(
          await client.billingPortal.sessions.create({
            customer: s.stripe_customer_id,
            return_url: app + "/billing",
          }),
        );
      }
      const v = z
          .object({ plan: z.enum(["starter", "pro", "growth"]) })
          .parse(body),
        price = prices()[v.plan];
      if (!price) throw new Error("This plan is not configured yet.");
      const current = (
        await db().query("select * from subscriptions where user_id=$1", [u.id])
      ).rows[0];
      if (
        current?.stripe_subscription_id &&
        ["active", "trialing", "past_due"].includes(current.status)
      )
        throw new Error(
          "Use Manage billing to change your existing subscription.",
        );
      const session = await client.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        client_reference_id: u.id,
        ...(current?.stripe_customer_id
          ? { customer: current.stripe_customer_id }
          : { customer_email: u.email }),
        subscription_data: { metadata: { user_id: u.id } },
        success_url: app + "/billing?checkout=complete",
        cancel_url: app + "/billing",
      });
      await db().query(
        "insert into usage_events(user_id,type) values($1,'upgrade_started')",
        [u.id],
      );
      return NextResponse.json({ url: session.url });
    }
    if (resource === "account") {
      const v = z
        .object({
          display_name: z.string().max(80),
          timezone: z.string().refine((x) => {
            try {
              new Intl.DateTimeFormat("en", { timeZone: x });
              return true;
            } catch {
              return false;
            }
          }),
          preferences: z
            .object({
              default_mode: z.enum(["instant", "high"]).optional(),
              compact: z.boolean().optional(),
            })
            .default({}),
        })
        .parse(body);
      await db().query(
        "insert into profiles(id,email,display_name,timezone,preferences) values($1,$2,$3,$4,$5) on conflict(id) do update set display_name=excluded.display_name,timezone=excluded.timezone,preferences=excluded.preferences,updated_at=now()",
        [u.id, u.email, v.display_name, v.timezone, v.preferences],
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
    const message = e instanceof Error ? e.message : "";
    const safe =
      /^(Sign in|Supabase|Database is not configured|Redis is not configured|Rate limit|Request origin|Your plan|Radar |Integration |Use |Activate |Wait |Monthly |Telegram |Discord |Email |Verify |Billing |No billing|This plan|Integration encryption)/.test(
        message,
      );
    return NextResponse.json(
      {
        error: safe
          ? message
          : "Unable to complete this request. Check service configuration and try again.",
      },
      {
        status: message.startsWith("Sign in")
          ? 401
          : message.startsWith("Rate limit")
            ? 429
            : 400,
      },
    );
  }
}
export const GET = route,
  POST = route,
  PUT = route,
  DELETE = route;
