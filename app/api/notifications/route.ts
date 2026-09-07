import { NextResponse } from "next/server";
import { z } from "zod";
import { user } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, sameOrigin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await user();
  const [items, count] = await Promise.all([
    db().query(
      `select m.id,m.score,m.intent,m.detected_at,m.read_at,p.username,p.display_name,p.text,p.url,r.name radar_name
       from matches m join posts p on p.id=m.post_id join radars r on r.id=m.radar_id
       where m.user_id=$1 and m.notification_eligible and m.archived_at is null
       order by m.detected_at desc limit 50`,
      [u.id],
    ),
    db().query(
      `select count(*)::int unread from matches
       where user_id=$1 and notification_eligible and read_at is null and archived_at is null`,
      [u.id],
    ),
  ]);
  return NextResponse.json({ items: items.rows, unread: count.rows[0].unread });
}

export async function PATCH(req: Request) {
  const u = await user();
  sameOrigin(req);
  await rateLimit(`notifications:${u.id}`, 60, 60);
  const body = z.object({ id: z.uuid().optional(), all: z.boolean().optional() }).parse(await req.json());
  if (body.all) {
    await db().query(
      `update matches set read_at=coalesce(read_at,now()) where user_id=$1 and notification_eligible and archived_at is null`,
      [u.id],
    );
  } else if (body.id) {
    await db().query(
      `update matches set read_at=coalesce(read_at,now()) where id=$1 and user_id=$2 and notification_eligible`,
      [body.id, u.id],
    );
  } else {
    return NextResponse.json({ error: "Provide id or all=true." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
