import { readFile, readdir } from "node:fs/promises";
import { db, transaction } from "../lib/db";
await transaction(async (c) => {
  await c.query("select pg_advisory_xact_lock(982451653)");
  await c.query(
    "create table if not exists public.replyradar_migrations(name text primary key,applied_at timestamptz default now()); alter table public.replyradar_migrations enable row level security; revoke all on public.replyradar_migrations from anon,authenticated",
  );
  for (const name of (await readdir("supabase/migrations"))
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    if (
      (
        await c.query(
          "select 1 from public.replyradar_migrations where name=$1",
          [name],
        )
      ).rowCount
    )
      continue;
    await c.query(await readFile("supabase/migrations/" + name, "utf8"));
    await c.query("insert into public.replyradar_migrations(name) values($1)", [
      name,
    ]);
    console.log("Applied", name);
  }
});
await db().end();
