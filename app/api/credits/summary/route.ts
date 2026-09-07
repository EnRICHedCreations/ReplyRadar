import { NextResponse } from "next/server";
import { user } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const u = await user();
  const [account, ledger, radars, month] = await Promise.all([
    db().query("select balance_cents,lifetime_purchased_cents,lifetime_spent_cents from credit_accounts where user_id=$1", [u.id]),
    db().query("select id,amount_cents,kind,radar_id,metadata,created_at from credit_ledger where user_id=$1 order by created_at desc limit 50", [u.id]),
    db().query("select id,name,max_results_per_scan,enabled,last_scan_at,last_error from radars where user_id=$1 order by created_at", [u.id]),
    db().query("select coalesce(sum(-amount_cents),0) spent from credit_ledger where user_id=$1 and kind='scan' and created_at>=date_trunc('month',now())", [u.id]),
  ]);
  return NextResponse.json({
    account: account.rows[0] || { balance_cents: 0, lifetime_purchased_cents: 0, lifetime_spent_cents: 0 },
    month_spent_cents: Number(month.rows[0].spent || 0),
    ledger: ledger.rows,
    radars: radars.rows,
  });
}
