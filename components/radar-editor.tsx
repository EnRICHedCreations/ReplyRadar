"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

async function api(path:string,method="GET",body?:unknown){const r=await fetch("/api/app/"+path,{method,headers:method==="GET"?{}:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Request failed");return d}

export default function RadarEditor({id}:{id?:string}){
 const router=useRouter();
 const [form,setForm]=useState<any>({name:"",description:"",query:"",enabled:true,scan_interval_seconds:600,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,active_schedule_json:null,minimum_score:70,integration_ids:[]});
 const [maxResults,setMaxResults]=useState(25),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 useEffect(()=>{if(id)api("radars/"+id).then((r:any)=>{setForm({...r,integration_ids:[]});setMaxResults(r.max_results_per_scan||25)}).catch((e:any)=>setMsg(e.message))},[id]);
 const set=(k:string,v:any)=>setForm((f:any)=>({...f,[k]:v}));
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg("");try{const r=await api("radars"+(id?"/"+id:""),id?"PUT":"POST",{...form,scan_interval_seconds:Number(form.scan_interval_seconds),minimum_score:Number(form.minimum_score),integration_ids:[]});await fetch("/api/credits/radar-budget",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({radar_id:r.id,max_results_per_scan:maxResults})});router.push("/overview");router.refresh()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}}
 return <><div className="page-head"><h1>{id?"Edit radar":"Create a radar"}</h1><p>Define the X conversation to monitor and put a hard ceiling on each paid scan.</p></div>{msg&&<div className="notice">{msg}</div>}<form className="panel form" onSubmit={save}>
 <div className="field"><label>Radar name</label><input value={form.name} onChange={e=>set("name",e.target.value)} required placeholder="Deployment leads"/></div>
 <div className="field"><label>Description</label><textarea value={form.description} onChange={e=>set("description",e.target.value)} placeholder="What this radar is looking for"/></div>
 <div className="field"><label>X search query</label><textarea className="mono" value={form.query} onChange={e=>set("query",e.target.value)} required placeholder={'("looking for" OR recommend) deployment -is:retweet'}/><small className="hint">Keep queries narrow. Broader searches consume more paid results.</small></div>
 <div className="grid2"><div className="field"><label>Scan interval</label><select value={form.scan_interval_seconds} onChange={e=>set("scan_interval_seconds",Number(e.target.value))}>{[600,1800,3600,21600,43200,86400].map(n=><option key={n} value={n}>{n<3600?`${n/60} minutes`:n<86400?`${n/3600} hours`:"24 hours"}</option>)}</select></div><div className="field"><label>Maximum paid results / scan</label><select value={maxResults} onChange={e=>setMaxResults(Number(e.target.value))}>{[10,25,50,75,100].map(n=><option key={n} value={n}>{n} posts max</option>)}</select></div></div>
 <div className="grid2"><div className="field"><label>Minimum opportunity score</label><input type="number" min="0" max="100" value={form.minimum_score} onChange={e=>set("minimum_score",Number(e.target.value))}/></div><div className="field"><label>Timezone</label><input value={form.timezone} onChange={e=>set("timezone",e.target.value)}/></div></div>
 <label className="row" style={{marginBottom:20}}><input type="checkbox" checked={form.enabled} onChange={e=>set("enabled",e.target.checked)}/> Active</label>
 <div className="notice">Cost protection: ReplyRadar makes at most one X API request per scan, never more than your result cap, never more often than every 10 minutes, and pauses automatically when your credit balance is exhausted.</div>
 <button className="primary" disabled={busy}>{busy?"Saving…":id?"Save radar":"Activate radar"}</button>
 </form></>
}
