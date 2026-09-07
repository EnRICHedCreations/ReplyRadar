import { NextResponse } from "next/server";
import { user } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await user();
  const [radars, stats, sub, worker] = await Promise.all([
    db().query("select * from radars where user_id=$1 order by created_at", [u.id]),
    db().query(
      `with first_completed as (
         select radar_id,min(completed_at) first_completed_at
         from scan_runs
         where user_id=$1 and status='completed' and completed_at is not null
         group by radar_id
       )
       select
         (select count(*) from radars where user_id=$1 and enabled) active_radars,
         (select count(*) from matches where user_id=$1 and detected_at>=current_date) matches_today,
         (select count(*) from matches where user_id=$1 and detected_at>=current_date and score>=80) high_opportunity,
         (
           select round(avg(extract(epoch from (m.detected_at-p.posted_at))))
           from matches m
           join posts p on p.id=m.post_id
           join first_completed f on f.radar_id=m.radar_id
           where m.user_id=$1
             and m.detected_at>=current_date
             and p.posted_at>=f.first_completed_at
         ) avg_detection`,
      [u.id],
    ),
    db().query("select * from subscriptions where user_id=$1", [u.id]),
    db().query("select exists(select 1 from worker_heartbeats where last_seen_at>now()-interval '60 seconds') healthy"),
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
