import { NextResponse } from "next/server";
import { user } from "@/lib/auth";
import { db } from "@/lib/db";

const publicError=(code:string|null)=>{
  if(!code)return null;
  if(code==="INSUFFICIENT_CREDITS")return "CREDITS_REQUIRED";
  if(code.startsWith("X_")||code.startsWith("PROVIDER_"))return "PROVIDER_DELAYED";
  return code;
};

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const u=await user();
  const {id}=await params;
  const rows=(await db().query(
    "select id,started_at,completed_at,status,provider,results_count,new_matches_count,duration_ms,error_code,retryable,billable_posts,cost_cents from scan_runs where radar_id=$1 and user_id=$2 order by started_at desc limit 100",
    [id,u.id],
  )).rows.map((r:any)=>({...r,error_code:publicError(r.error_code)}));
  return NextResponse.json(rows);
}
