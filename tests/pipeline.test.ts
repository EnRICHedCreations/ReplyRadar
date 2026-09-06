import { test, mock, after, before } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { schedule, scanNext } from "../lib/scanner";
import { deliverNext } from "../lib/notifications";
import { encrypt } from "../lib/security";
import { MockProvider, ProviderError } from "../lib/provider";
const pg = new PGlite(),
  uid = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
let radar: string, integration: string;
async function query(text: string, params?: any[]) {
  const result = await pg.query<any>(text, params);
  return {
    rows: result.rows,
    rowCount: /^select/i.test(text.trim())
      ? result.rows.length
      : (result.affectedRows ?? result.rows.length),
  };
}
before(async () => {
  process.env.DATABASE_URL = "postgres://test:test@localhost/test";
  process.env.INTEGRATION_ENCRYPTION_KEY = "b".repeat(64);
  await pg.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await pg.exec(
    await readFile(
      "supabase/migrations/20260906171725_initial_schema.sql",
      "utf8",
    ),
  );
  mock.method(Pool.prototype, "connect", async () => ({ query, release() {} }));
  mock.method(Pool.prototype, "query", query);
  await query("insert into auth.users values($1),($2)", [uid, other]);
  radar = (
    await query(
      "insert into radars(user_id,name,query,minimum_score) values($1,'Test','deployment',0) returning id",
      [uid],
    )
  ).rows[0].id;
  integration = (
    await query(
      "insert into integrations(user_id,type,encrypted_credentials) values($1,'email',$2) returning id",
      [uid, encrypt("test@example.com")],
    )
  ).rows[0].id;
  await query("insert into radar_integrations values($1,$2)", [
    radar,
    integration,
  ]);
});
after(async () => {
  mock.restoreAll();
  await pg.close();
});
test("migrations apply; scan commits matches and delivery outbox; repeat scan deduplicates", async () => {
  await schedule();
  assert.equal(await scanNext(), true);
  assert.equal((await query("select * from matches")).rows.length, 3);
  assert.equal(
    (await query("select * from notification_deliveries")).rows.length,
    3,
  );
  const cursor = (await query("select provider_cursor from radars")).rows[0]
    .provider_cursor;
  await query(
    "update radars set last_scan_at=now()-interval '20 minutes',next_scan_at=now()",
  );
  await schedule();
  await scanNext();
  assert.equal((await query("select * from matches")).rows.length, 3);
  assert.equal(
    (await query("select * from notification_deliveries")).rows.length,
    3,
  );
  assert.equal(
    (await query("select provider_cursor from radars")).rows[0].provider_cursor,
    cursor,
  );
});
test("tenant RLS isolates matches/posts and denies all direct writes and encrypted credentials", async () => {
  await pg.exec(`set role authenticated;set request.jwt.claim.sub='${other}'`);
  assert.equal((await query("select * from matches")).rows.length, 0);
  assert.equal((await query("select * from posts")).rows.length, 0);
  await assert.rejects(
    () =>
      query("insert into radars(user_id,name,query) values($1,'bad','foo')", [
        other,
      ]),
    /permission denied/,
  );
  await assert.rejects(
    () => query("select encrypted_credentials from integrations"),
    /permission denied/,
  );
  await pg.exec(`set request.jwt.claim.sub='${uid}'`);
  assert.equal((await query("select * from matches")).rows.length, 3);
  await pg.exec("reset role");
});
test("pause and out-of-hours scans consume no quota", async () => {
  const before = (
    await query("select count(*) from usage_events where type='scan'")
  ).rows[0].count;
  await query("update radars set enabled=false,next_scan_at=now()");
  await query("insert into scan_jobs(radar_id) values($1)", [radar]);
  await scanNext();
  assert.equal(
    (await query("select count(*) from usage_events where type='scan'")).rows[0]
      .count,
    before,
  );
  await query(
    "update radars set enabled=true,next_scan_at=now(),active_schedule_json=$1",
    [
      JSON.stringify({
        days: [(new Date().getUTCDay() + 1) % 7],
        start: "00:00",
        end: "23:59",
      }),
    ],
  );
  await schedule();
  await scanNext();
  assert.equal(
    (await query("select count(*) from usage_events where type='scan'")).rows[0]
      .count,
    before,
  );
  await query("update radars set active_schedule_json=null");
});
test("provider failure keeps cursor and records error without matching", async () => {
  const cursor = (await query("select provider_cursor from radars")).rows[0]
    .provider_cursor;
  await query(
    "update radars set last_scan_at=now()-interval '20 minutes',next_scan_at=now()",
  );
  await schedule();
  await scanNext({
    search: async () => {
      throw new ProviderError("X_RATE_LIMIT", true, 900);
    },
  });
  assert.equal(
    (await query("select provider_cursor from radars")).rows[0].provider_cursor,
    cursor,
  );
  assert.equal(
    (await query("select count(*) from scan_runs where status='failed'"))
      .rows[0].count,
    1,
  );
  assert.equal((await query("select * from matches")).rows.length, 3);
});
test("quota exhaustion prevents provider calls", async () => {
  await query(
    "insert into usage_events(user_id,type,quantity) values($1,'scan',100)",
    [uid],
  );
  await query(
    "update radars set next_scan_at=now(),last_scan_at=now()-interval '20 minutes'",
  );
  await schedule();
  let called = false;
  await scanNext({
    search: async () => {
      called = true;
      return new MockProvider().search({ query: "deployment" });
    },
  });
  assert.equal(called, false);
  assert.equal(
    (await query("select last_error from radars")).rows[0].last_error,
    "QUOTA_EXHAUSTED",
  );
});
test("notifications are separate and 429 retries are durable; success suppresses resends", async () => {
  process.env.RESEND_API_KEY = "test";
  process.env.EMAIL_FROM = "test@example.com";
  let calls = 0;
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("", { status: calls === 1 ? 429 : 200 });
  });
  await deliverNext();
  assert.equal(
    (
      await query(
        "select count(*) from notification_deliveries where status='queued' and attempt_count=1",
      )
    ).rows[0].count,
    1,
  );
  await query("update notification_deliveries set next_attempt_at=now()");
  for (let i = 0; i < 4; i++) await deliverNext();
  assert.equal(
    (
      await query(
        "select count(*) from notification_deliveries where status='sent'",
      )
    ).rows[0].count,
    3,
  );
  const sent = calls;
  await deliverNext();
  assert.equal(calls, sent);
  assert.equal(
    (await query("select count(*) from scan_runs where status='completed'"))
      .rows[0].count,
    2,
  );
  fetchMock.mock.restore();
});
test("ambiguous delivery timeout is never automatically retried", async () => {
  await query(
    "insert into notification_deliveries(user_id,integration_id) values($1,$2)",
    [uid, integration],
  );
  const f = mock.method(globalThis, "fetch", async () => {
    throw new Error("timeout");
  });
  await deliverNext();
  assert.equal(
    (
      await query(
        "select count(*) from notification_deliveries where status='uncertain'",
      )
    ).rows[0].count,
    1,
  );
  await deliverNext();
  assert.equal(f.mock.callCount(), 1);
  f.mock.restore();
});
test("Stripe signatures, duplicate events, and current-state reconciliation protect entitlements", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
  process.env.STRIPE_PRICE_PRO = "price_test_pro";
  const { stripe } = await import("../lib/billing");
  const { POST } = await import("../app/api/stripe/webhook/route");
  const client = stripe();
  const current: any = {
    id: "sub_test",
    customer: "cus_test",
    metadata: { user_id: uid },
    status: "active",
    items: {
      data: [
        {
          price: { id: "price_test_pro" },
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
    },
  };
  const retrieve = mock.method(
    client.subscriptions,
    "retrieve",
    async () => current,
  );
  const event = {
    id: "evt_test_1",
    type: "customer.subscription.created",
    data: { object: current },
  };
  async function request(value: unknown, valid = true) {
    const payload = JSON.stringify(value);
    const signature = client.webhooks.generateTestHeaderString({
      payload,
      secret: valid ? "whsec_fixture" : "wrong",
    });
    return POST(
      new Request("https://example.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
  }
  assert.equal((await request(event, false)).status, 400);
  assert.equal((await request(event)).status, 200);
  assert.equal(
    (await query("select plan from subscriptions")).rows[0].plan,
    "pro",
  );
  assert.equal((await request(event)).status, 200);
  assert.equal(retrieve.mock.callCount(), 1);
  current.status = "canceled";
  assert.equal(
    (
      await request({
        ...event,
        id: "evt_old",
        type: "customer.subscription.updated",
        data: { object: { ...current, status: "active" } },
      })
    ).status,
    200,
  );
  assert.equal(
    (await query("select status from subscriptions")).rows[0].status,
    "canceled",
  );
  assert.equal(
    (await query("select count(*) from stripe_events")).rows[0].count,
    2,
  );
  retrieve.mock.restore();
});
