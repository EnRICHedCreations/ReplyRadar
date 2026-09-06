import { db } from "../lib/db";
// Operator-only CLI: requires server database credentials, never a public route.
for (const [name, sql] of Object.entries({
  users: "select count(*) from profiles",
  subscriptions:
    "select plan,status,count(*) from subscriptions group by plan,status",
  radars: "select enabled,count(*) from radars group by enabled",
  scan_failures:
    "select radar_id,started_at,error_code from scan_runs where status='failed' order by started_at desc limit 20",
  queue_depth: "select count(*) from scan_jobs",
  notification_failures:
    "select id,status,last_error from notification_deliveries where status in ('failed','uncertain') order by queued_at desc limit 20",
  usage:
    "select type,sum(quantity) from usage_events where occurred_at>now()-interval '30 days' group by type",
  worker: "select max(last_seen_at) last_seen_at from worker_heartbeats",
})) {
  console.log(name, (await db().query(sql)).rows);
}
await db().end();
