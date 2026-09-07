"use client";
import { useEffect, useState } from "react";

export default function ProfileSettings({title="Settings"}:{title?:string}){
  const [form,setForm]=useState<any>({display_name:"",timezone:"UTC",preferences:{}}),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{fetch("/api/app/account",{cache:"no-store"}).then(r=>r.json()).then(d=>setForm({...d,preferences:{}})).catch(()=>setMsg("Unable to load settings."))},[]);
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg("");try{const r=await fetch("/api/app/account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({display_name:form.display_name||"",timezone:form.timezone||"UTC",preferences:{}})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save settings");setMsg("Settings saved.")}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}}
  return <><div className="page-head"><h1>{title}</h1><p>Your workspace preferences. Notifications are built into ReplyRadar and do not require external channels.</p></div>{msg&&<div className="notice">{msg}</div>}<form className="panel form" onSubmit={save}><div className="field"><label>Display name</label><input value={form.display_name||""} onChange={e=>setForm((f:any)=>({...f,display_name:e.target.value}))}/></div><div className="field"><label>Default timezone</label><input value={form.timezone||"UTC"} onChange={e=>setForm((f:any)=>({...f,timezone:e.target.value}))} placeholder="America/New_York"/></div><div className="notice">New matches appear in the in-app notification center. External email, Telegram, and Discord delivery have been removed.</div><button className="primary" disabled={busy}>{busy?"Saving…":"Save settings"}</button></form></>
}
