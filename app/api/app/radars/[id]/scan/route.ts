import { NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { db, transaction, accountLock } from "@/lib/db";
import { rateLimit, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";
const uuid = z.uuid();
type Context = { params: Promise<{ id: string }> };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    const u = await user();
    const { id } = await ctx.params;
    uuid.parse(id);
    await rateLimit("scan:" + u.id, 3, 60);
    const queuedAt = new Date();

    await transaction(async (c) => {
      await accountLock(c, u.id);
      const radar = (
        await c.query(
          "select id,enabled from radars where id=$1 and user_id=$2 for update",
          [id, u.id],
        )
      ).rows[0];
      if (!radar) throw new Error("Radar not found.");
      if (!radar.enabled) throw new Error("Activate this radar before scanning.");

      await c.query(
        `insert into scan_jobs(radar_id,manual,available_at,requested_at)
         values($1,true,now(),now())
         on conflict(radar_id) do update
         set manual=true,available_at=now(),requested_at=now()`,
        [id],
      );
    });

    for (let i = 0; i < 48; i++) {
      await sleep(250);
      const run = (
        await db().query(
          `select status,results_count,new_matches_count,cost_cents,error_code
           from scan_runs
           where radar_id=$1 and user_id=$2 and started_at >= $3
           order by started_at desc limit 1`,
          [id, u.id, queuedAt],
        )
      ).rows[0];
      if (!run) continue;
      if (run.status === "completed") {
        const posts = Number(run.results_count || 0);
        const matches = Number(run.new_matches_count || 0);
        const cents = Number(run.cost_cents || 0);
        const cost = `$${(cents / 100).toFixed(2)} scan charge.`;
        const result = posts === 0
          ? `Scan complete — X returned 0 posts, no new matches found. ${cost}`
          : matches === 0
            ? `Scan complete — X returned ${posts} posts, no new matches found. ${cost}`
            : `Scan complete — X returned ${posts} posts, ${matches} new ${matches === 1 ? "match" : "matches"} found. ${cost}`;
        return NextResponse.json({ message: result, completed: true, posts, matches, cost_cents: cents });
      }
      if (run.status === "failed") {
        return NextResponse.json(
          { error: "Scan failed. Check scan history for details." },
          { status: 502 },
        );
      }
    }

    return NextResponse.json(
      { message: "Scan queued. It is taking longer than usual; results will update automatically.", completed: false },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
