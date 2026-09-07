import { NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Context) {
  const u = await user();
  const { id } = await ctx.params;
  z.uuid().parse(id);
  const radar = (await db().query("select id from radars where id=$1 and user_id=$2", [id, u.id])).rows[0];
  if (!radar) return NextResponse.json({ error: "Radar not found." }, { status: 404 });
  const run = (await db().query(
    "select id,status,started_at,completed_at,results_count,new_matches_count,billable_posts,cost_cents,error_code from scan_runs where radar_id=$1 and user_id=$2 order by started_at desc limit 1",
    [id, u.id],
  )).rows[0];
  return NextResponse.json({ run: run || null });
}
