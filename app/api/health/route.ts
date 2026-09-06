import { db } from "@/lib/db";
import { cache } from "@/lib/security";
export const dynamic = "force-dynamic";
export async function GET() {
  const checks = { database: false, redis: false, worker: false };
  await Promise.allSettled([
    (async () => {
      await db().query("select 1 from radars limit 1");
      checks.database = true;
      checks.worker = (
        await db().query(
          "select exists(select 1 from worker_heartbeats where last_seen_at>now()-interval '60 seconds') healthy",
        )
      ).rows[0].healthy;
    })(),
    (async () => {
      checks.redis = (await cache().ping()) === "PONG";
    })(),
  ]);
  const healthy = Object.values(checks).every(Boolean);
  return Response.json(
    {
      service: "replyradar",
      status: healthy ? "healthy" : "setup_required",
      checks,
      provider: process.env.SOCIAL_PROVIDER || "mock",
    },
    { status: healthy ? 200 : 503 },
  );
}
