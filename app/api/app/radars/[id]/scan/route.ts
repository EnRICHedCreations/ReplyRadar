import { NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { db, transaction, accountLock } from "@/lib/db";
import { rateLimit, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

const uuid = z.uuid();

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Context) {
  try {
    sameOrigin(req);
    const u = await user();
    const { id } = await ctx.params;
    uuid.parse(id);

    // Manual scans intentionally bypass the radar's scheduled interval. Keep a
    // separate anti-spam limit so "Scan now" cannot be hammered indefinitely.
    await rateLimit("scan:" + u.id, 3, 60);

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

      // Credit affordability and the per-scan result cap are enforced by the
      // worker before it makes an X API request. ON CONFLICT also prevents
      // duplicate queued jobs for the same radar.
      await c.query(
        "insert into scan_jobs(radar_id) values($1) on conflict do nothing",
        [id],
      );
    });

    return NextResponse.json(
      { message: "Scan queued. Results will appear shortly." },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
