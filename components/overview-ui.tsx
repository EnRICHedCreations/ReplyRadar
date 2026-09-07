"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Radio, RefreshCw, Pause, Play } from "lucide-react";
import { api } from "@/components/app-ui";
import { inSchedule } from "@/lib/domain";

function ago(value?: string) {
  if (!value) return "Not yet";
  const s = Math.max(0, Math.floor((Date.now() - +new Date(value)) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
}

function duration(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes ? `${hours}h ${minutes}m` : `${hours} hr`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.round((seconds % 86400) / 3600);
  return hours ? `${days}d ${hours}h` : `${days} days`;
}

export default function OverviewUI() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const refresh = useCallback(async () => { try { setData(await api("snapshot")); setError(""); } catch (e) { setError((e as Error).message); } }, []);
  useEffect(() => { void refresh(); const poll=setInterval(refresh,5000); const clock=setInterval(()=>setNow(Date.now()),1000); return()=>{clearInterval(poll);clearInterval(clock)}; }, [refresh]);
  async function action(r:any,verb:string){setBusy(r.id);setMessage("");try{const d=await api(`radars/${r.id}/${verb}`,"POST",verb==="toggle"?{enabled:!r.enabled}:{});setMessage(d.message||"Radar updated.");await refresh()}catch(e){setMessage((e as Error).message)}finally{setBusy("")}}
  if (!data && !error) return <div className="loading">Loading your workspace…</div>;
  return <>
    <div className="page-head row between wrap"><div><h1>Overview</h1><p>The conversations that matter, at a glance.</p></div><Link className="button primary" href="/radars/new"><Plus size={15}/>New radar</Link></div>
    {error && <div className="notice">{error}</div>}{message && <div className="notice">{message}</div>}
    {data && <>
      {!data.worker && <div className="notice">Worker unavailable. Scans and notifications are waiting.</div>}
      <div className="stats">
        {[["Active radars",data.stats.active_radars,"Listening for new posts"],["Matches today",data.stats.matches_today,"Since midnight UTC"],["High opportunity",data.stats.high_opportunity,"Score of 80 or higher"],["Avg detection time",duration(data.stats.avg_detection),"Post published → detected"]].map(([label,value,hint])=><div className="panel stat" key={String(label)}><span className="eyebrow">{label}</span><strong>{value}</strong><small>{hint}</small></div>)}
      </div>
      <div className="panel"><div className="row between"><h3>Your monitoring network</h3><span className="muted">{data.radars.length} {data.radars.length===1?"radar":"radars"}</span></div>
        {!data.radars.length ? <div className="empty"><Radio size={34}/><h2>Your first signal starts here.</h2><p>Create a radar to monitor a conversation.</p><Link className="button primary" href="/radars/new"><Plus size={15}/>Create your first radar</Link></div> : data.radars.map((r:any)=><article className="radar-row" key={r.id}>
          <div className="row between"><div className="row"><Radio size={18} color="#b6ef6d"/><h3 style={{margin:0}}>{r.name}</h3></div><span className={"tag "+(!r.enabled?"neutral":r.last_error?"warn":"")}>{!r.enabled?"Paused":!inSchedule(new Date(now),r.timezone,r.active_schedule_json)?"Outside active hours":r.last_error?.replaceAll("_"," ")||"Active"}</span></div>
          <div className="query mono">{r.query}</div><div className="radar-meta"><span>Last scan <b>{ago(r.last_scan_at)}</b></span><span>Next scan <b>{!r.enabled?"Paused":+new Date(r.next_scan_at)<now?"Due now":new Date(r.next_scan_at).toLocaleTimeString()}</b></span><span>Provider <b>{r.provider==="mock"?"Mock data":"X API"}</b></span></div>
          <div className="row wrap"><Link className="button quiet" href={`/matches?radar=${r.id}`}>View matches</Link><button className="quiet" disabled={busy===r.id||!r.enabled} onClick={()=>action(r,"scan")}><RefreshCw size={13}/>Scan now</button><Link className="button quiet" href={`/radars/${r.id}`}>Edit</Link><button className="quiet" disabled={busy===r.id} onClick={()=>action(r,"toggle")}>{r.enabled?<Pause size={13}/>:<Play size={13}/>} {r.enabled?"Pause":"Resume"}</button><Link className="muted" href={`/radars/${r.id}/history`}>Scan history →</Link></div>
        </article>)}
      </div>
    </>}
  </>;
}
