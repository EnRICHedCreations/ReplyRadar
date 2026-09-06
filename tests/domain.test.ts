import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inSchedule,
  scorePost,
  validateQuery,
  entitlement,
  radarSchema,
} from "../lib/domain";
import { MockProvider, ProviderError, normalizeX } from "../lib/provider";
import { encrypt, decrypt, discordURL } from "../lib/security";
test("schedule follows DST and overnight shifts", () => {
  const schedule = { days: [1], start: "08:00", end: "17:00" };
  assert.equal(
    inSchedule(new Date("2026-03-09T12:00:00Z"), "America/New_York", schedule),
    true,
  );
  assert.equal(
    inSchedule(new Date("2026-03-02T12:00:00Z"), "America/New_York", schedule),
    false,
  );
  assert.equal(
    inSchedule(new Date("2026-03-10T02:00:00Z"), "UTC", {
      days: [1],
      start: "22:00",
      end: "06:00",
    }),
    true,
  );
  assert.equal(
    inSchedule(new Date("2026-03-10T06:00:00Z"), "UTC", {
      days: [1],
      start: "22:00",
      end: "06:00",
    }),
    false,
  );
});
test("paid entitlements require active unexpired subscription", () => {
  assert.equal(entitlement({ plan: "growth", status: "canceled" }), "free");
  assert.equal(
    entitlement({
      plan: "growth",
      status: "active",
      current_period_end: "2020-01-01",
    }),
    "free",
  );
  assert.equal(entitlement({ plan: "pro", status: "active" }), "pro");
  assert.equal(entitlement({ plan: "admin", status: "active" }), "free");
});
test("query and schedule input rejects malformed values", () => {
  assert.throws(() => validateQuery('"unclosed'));
  assert.throws(() => validateQuery("((foo)"));
  assert.throws(() => validateQuery("foo)("));
  assert.throws(() =>
    radarSchema.parse({
      name: "Test",
      query: "foo",
      timezone: "Invalid/Zone",
      scan_interval_seconds: 600,
    }),
  );
  assert.equal(
    validateQuery('"deployment" -is:retweet'),
    '"deployment" -is:retweet',
  );
});
test("mock is deterministic and intentionally repeats posts; supports failures", async () => {
  const p = new MockProvider(),
    now = new Date("2026-08-01T10:00:00Z");
  const a = await p.search({ query: "deployment", now }),
    b = await p.search({ query: "deployment", now });
  assert.deepEqual(a, b);
  assert.equal((await p.search({ query: "[empty]" })).posts.length, 0);
  await assert.rejects(
    () => p.search({ query: "[rate-limit]" }),
    ProviderError,
  );
  const later = await p.search({
    query: "deployment",
    now: new Date(+now + 60000),
  });
  assert.equal(later.posts[1].externalId, a.posts[0].externalId);
});
test("scoring is bounded, explainable, and penalizes age and saturation", async () => {
  const now = new Date(),
    p = (await new MockProvider().search({ query: "deployment", now }))
      .posts[0],
    fresh = scorePost(p, now),
    old = scorePost(
      {
        ...p,
        createdAt: new Date(+now - 86400000),
        metrics: { ...p.metrics, replies: 500 },
      },
      now,
    );
  assert.ok(fresh.score > old.score);
  assert.ok(fresh.score >= 0 && fresh.score <= 100);
  assert.equal(
    fresh.score,
    Object.values(fresh.components).reduce((a, b) => a + b, 0),
  );
  assert.equal(fresh.intent, "BUYING_INTENT");
});
test("X normalization keeps provider fields out of domain", () => {
  const p = normalizeX(
    {
      id: "123",
      author_id: "456",
      created_at: "2026-01-01T00:00:00Z",
      text: "hello",
      public_metrics: { like_count: 9 },
    },
    [{ id: "456", username: "dev", public_metrics: { followers_count: 100 } }],
  );
  assert.equal(p.url, "https://x.com/i/status/123");
  assert.equal(p.metrics.likes, 9);
  assert.equal(p.author.followers, 100);
});
test("authenticated encryption detects tampering and SSRF URLs are rejected", () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = "a".repeat(64);
  const cipher = encrypt("secret-value");
  assert.equal(decrypt(cipher), "secret-value");
  const b = Buffer.from(cipher, "base64");
  b[15] ^= 1;
  assert.throws(() => decrypt(b.toString("base64")));
  for (const url of [
    "http://discord.com/api/webhooks/123/abc",
    "https://discord.com.evil.test/api/webhooks/123/abc",
    "https://127.0.0.1/",
    "https://discord.com/api/webhooks/123/abc?redirect=x",
  ])
    assert.throws(() => discordURL(url));
  assert.equal(
    discordURL("https://discord.com/api/webhooks/123/abc"),
    "https://discord.com/api/webhooks/123/abc",
  );
});
