"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminCreditAdjust({userId,email}:{userId:string;email:string}){
  const router=useRouter();
  const [open,setOpen]=useState(false),[amount,setAmount]=useState(""),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function submit(){
    setBusy(true);setMessage("");
    try{
      const cents=Math.round(Number(amount)*100);
      const res=await fetch("/api/admin/credits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:userId,amount_cents:cents,reason})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Adjustment failed.");
      setMessage(`Balance updated to $${(data.balance_cents/100).toFixed(2)}.`);setAmount("");setReason("");setOpen(false);router.refresh();
    }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
  }
  return <div style={{minWidth:170}}>{!open?<button className="quiet" type="button" onClick={()=>setOpen(true)}>Adjust credits</button>:<div style={{display:"grid",gap:6}}><strong style={{fontSize:12}}>Adjust {email}</strong><input type="number" step="0.01" placeholder="+10 or -5" value={amount} onChange={e=>setAmount(e.target.value)}/><input placeholder="Reason (required)" value={reason} onChange={e=>setReason(e.target.value)}/><div className="row"><button type="button" disabled={busy||!amount||reason.trim().length<3} onClick={submit}>{busy?"Saving…":"Apply"}</button><button className="quiet" type="button" onClick={()=>setOpen(false)}>Cancel</button></div></div>}{message&&<small className="muted">{message}</small>}</div>
}
