import { NextResponse } from "next/server";
import { z } from "zod";
import { adminUser } from "@/lib/admin";
import { transaction, accountLock } from "@/lib/db";
import { sameOrigin, rateLimit } from "@/lib/security";

const schema=z.object({user_id:z.uuid(),amount_cents:z.number().int().min(-100000).max(100000).refine(v=>v!==0),reason:z.string().trim().min(3).max(240)});

export async function POST(req:Request){
  try{
    sameOrigin(req);
    const admin=await adminUser();
    if(admin.adminRole!=="admin")return NextResponse.json({error:"Admin write access required."},{status:403});
    await rateLimit("admin-credit:"+admin.id,20,60);
    const input=schema.parse(await req.json());
    const result=await transaction(async c=>{
      await accountLock(c,input.user_id);
      await c.query("insert into credit_accounts(user_id) values($1) on conflict(user_id) do nothing",[input.user_id]);
      const current=Number((await c.query("select balance_cents from credit_accounts where user_id=$1 for update",[input.user_id])).rows[0].balance_cents);
      const next=current+input.amount_cents;
      if(next<0)throw new Error("Adjustment would make the balance negative.");
      await c.query("update credit_accounts set balance_cents=$2,updated_at=now() where user_id=$1",[input.user_id,next]);
      await c.query("insert into credit_ledger(user_id,amount_cents,kind,metadata) values($1,$2,'adjustment',$3)",[input.user_id,input.amount_cents,JSON.stringify({reason:input.reason,admin_user_id:admin.id})]);
      await c.query("insert into admin_audit_log(admin_user_id,action,target_user_id,metadata) values($1,'credit_adjustment',$2,$3)",[admin.id,input.user_id,JSON.stringify({amount_cents:input.amount_cents,reason:input.reason,balance_before_cents:current,balance_after_cents:next})]);
      return next;
    });
    return NextResponse.json({ok:true,balance_cents:result});
  }catch(error){
    const message=error instanceof Error?error.message:"Request failed.";
    return NextResponse.json({error:message},{status:400});
  }
}
