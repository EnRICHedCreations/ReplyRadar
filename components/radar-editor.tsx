"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

async function api(path:string,method="GET",body?:unknown){const r=await fetch("/api/app/"+path,{method,headers:method==="GET"?{}:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Request failed");return d}

const examples=[
 {title:"Find buyers",query:'("looking for" OR "need a" OR recommend) (deployment OR hosting) -is:retweet',note:"People actively asking for recommendations."},
 {title:"Track a brand",query:'"Deploy Hatch" -is:retweet',note:"Posts mentioning an exact brand or phrase."},
 {title:"Watch competitors",query:'(Vercel OR Railway OR Render) (expensive OR alternative OR switching) -is:retweet',note:"People discussing competitor pain or alternatives."},
 {title:"Find questions",query:'(deploy OR hosting) ? -is:retweet',note:"Questions around a topic."},
];
const operators=[
 ["words","All words","deployment hosting","Both words must appear"],
 ["phrase","Exact phrase",'"looking for"',"Words together in this exact order"],
 ["or","Either / OR","Vercel OR Railway","Match either term"],
 ["group","Group choices","(Vercel OR Railway) alternative","Combine alternatives with another requirement"],
 ["exclude","Exclude","hosting -jobs","Remove posts containing a term"],
 ["retweet","Hide reposts","-is:retweet","Usually worth adding to every radar"],
 ["author","From account","from:username","Only posts from one account"],
 ["language","Language","lang:en","Only posts in a language"],
];

export default function RadarEditor({id}:{id?:string}){
 const router=useRouter();
 const [form,setForm]=useState<any>({name:"",description:"",query:"",enabled:true,scan_interval_seconds:600,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,active_schedule_json:null,minimum_score:70,integration_ids:[]});
 const [maxResults,setMaxResults]=useState(25),[busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[showHelp,setShowHelp]=useState(false);
 useEffect(()=>{if(id)api("radars/"+id).then((r:any)=>{setForm({...r,integration_ids:[]});setMaxResults(r.max_results_per_scan||25)}).catch((e:any)=>setMsg(e.message))},[id]);
 const set=(k:string,v:any)=>setForm((f:any)=>({...f,[k]:v}));
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg("");try{const r=await api("radars"+(id?"/"+id:""),id?"PUT":"POST",{...form,scan_interval_seconds:Number(form.scan_interval_seconds),minimum_score:Number(form.minimum_score),integration_ids:[]});await fetch("/api/credits/radar-budget",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({radar_id:r.id,max_results_per_scan:maxResults})});router.push("/overview");router.refresh()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}}
 return <><div className="page-head"><h1>{id?"Edit radar":"Create a radar"}</h1><p>Tell ReplyRadar what conversations on X are valuable to you. You can start from an example instead of learning X search syntax.</p></div>{msg&&<div className="notice">{msg}</div>}<form className="panel form" onSubmit={save}>
 <div className="field"><label>Radar name</label><input value={form.name} onChange={e=>set("name",e.target.value)} required placeholder="Deployment leads"/></div>
 <div className="field"><label>What are you looking for?</label><textarea value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Example: Founders looking for a simpler way to deploy their apps"/><small className="hint">Describe the opportunity in plain English. ReplyRadar uses this context when scoring matches.</small></div>
 <div className="field"><label>X search query</label><textarea className="mono" value={form.query} onChange={e=>set("query",e.target.value)} required placeholder={'("looking for" OR recommend) deployment -is:retweet'}/><small className="hint">This decides which posts X sends to ReplyRadar. Keep it focused so you spend credits on relevant posts.</small></div>
 <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{examples.map(x=><button key={x.title} type="button" className="secondary" onClick={()=>set("query",x.query)} title={x.note}>{x.title}</button>)}<button type="button" className="secondary" onClick={()=>setShowHelp(v=>!v)}>{showHelp?"Hide query guide":"How do X queries work?"}</button></div>
 {showHelp&&<div className="notice" style={{marginBottom:20}}><strong>Quick query guide</strong><p style={{marginTop:6}}>Think of the query as a filter. Normal words are required, quotes match an exact phrase, <code>OR</code> gives alternatives, parentheses group choices, and a minus sign excludes something.</p><div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}><tbody>{operators.map(([k,label,syntax,meaning])=><tr key={k}><td style={{padding:"7px 12px 7px 0",whiteSpace:"nowrap"}}><strong>{label}</strong></td><td style={{padding:"7px 12px 7px 0"}}><code>{syntax}</code></td><td style={{padding:"7px 0"}}>{meaning}</td></tr>)}</tbody></table></div><p style={{marginBottom:0}}><strong>Example:</strong> <code>(Vercel OR Railway) "too expensive" -is:retweet lang:en</code> finds English posts mentioning either competitor plus the exact phrase “too expensive,” while excluding reposts.</p></div>}
 {form.query&&<div className="notice" style={{marginBottom:20}}><strong>Your search means:</strong> X will search for posts matching <code>{form.query}</code>. ReplyRadar then scores those posts against your description and only surfaces matches scoring at least <strong>{form.minimum_score}/100</strong>.</div>}
 <div className="grid2"><div className="field"><label>How often should we check?</label><select value={form.scan_interval_seconds} onChange={e=>set("scan_interval_seconds",Number(e.target.value))}>{[600,1800,3600,21600,43200,86400].map(n=><option key={n} value={n}>{n<3600?`Every ${n/60} minutes`:n<86400?`Every ${n/3600} hours`:"Every 24 hours"}</option>)}</select></div><div className="field"><label>Maximum posts checked per scan</label><select value={maxResults} onChange={e=>setMaxResults(Number(e.target.value))}>{[10,25,50,75,100].map(n=><option key={n} value={n}>{n} posts · up to ${(n/100).toLocaleString("en-US",{style:"currency",currency:"USD"})}</option>)}</select><small className="hint">A hard spending ceiling, not a guaranteed charge. You pay only for posts returned.</small></div></div>
 <div className="grid2"><div className="field"><label>How strong should a match be?</label><input type="number" min="0" max="100" value={form.minimum_score} onChange={e=>set("minimum_score",Number(e.target.value))}/><small className="hint">70 is a good starting point. Raise it for fewer, stronger matches.</small></div><div className="field"><label>Timezone</label><input value={form.timezone} onChange={e=>set("timezone",e.target.value)}/></div></div>
 <label className="row" style={{marginBottom:20}}><input type="checkbox" checked={form.enabled} onChange={e=>set("enabled",e.target.checked)}/> Start monitoring immediately</label>
 <div className="notice">Cost protection: each scan makes at most one X request and checks no more than the limit above. Scans never run more often than every 10 minutes and automatically pause when your credit balance runs out.</div>
 <button className="primary" disabled={busy}>{busy?"Saving…":id?"Save radar":"Activate radar"}</button>
 </form></>
}
