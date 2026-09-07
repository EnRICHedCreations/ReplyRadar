import { NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, sameOrigin } from "@/lib/security";

export async function POST(req: Request) {
  const u = await user();
  sameOrigin(req);
  await rateLimit(`radar-budget:${u.id}`, 30, 60);
  const body = z.object({ radar_id: z.uuid(), max_results_per_scan: z.number().int().min(10).max(100) }).parse(await req.json());
  const row = (await db().query(
    "update radars set max_results_per_scan=$3,updated_at=now() where id=$1 and user_id=$2 returning id,max_results_per_scan",
    [body.radar_id, u.id, body.max_results_per_scan],
  )).rows[0];
  if (!row) return NextResponse.json({ error: "Radar not found." }, { status: 404 });
  return NextResponse.json(row);
}
