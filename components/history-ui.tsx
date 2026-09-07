"use client";
import { useEffect,useState } from "react";
import Link from "next/link";

const label=(code:string|null)=>code==="PROVIDER_DELAYED"?"Provider temporarily unavailable":code==="CREDITS_REQUIRED"?"Credits required":code?code.replaceAll("_"," ").toLowerCase():"—";
const money=(c:number)=>`$${(Number(c||0)/100).toFixed(2)}`;

export default function HistoryUI({id}:{id:string}){
 const [data,setData]=useState<any[]|null>(null),[error,setError]=useState("");
 useEffect(()=>{const load=()=>fetch(`/api/app/radars/${id}/history`,{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load history");setData(d);setError("")}).catch(e=>setError(e.message));void load();const t=setInterval(load,10000);return()=>clearInterval(t)},[id]);
 return <><div className="page-head row between wrap"><div><h1>Scan history</h1><p>Usage, results, and customer-safe scan status.</p></div><Link className="button" href={`/radars/${id}`}>Edit radar</Link></div>{error&&<div className="notice">{error}</div>}<div className="panel table-wrap">{data?.length?<table><thead><tr><th>Started</th><th>Status</th><th>Results</th><th>Matches</th><th>Cost</th><th>Duration</th><th>Detail</th></tr></thead><tbody>{data.map((s:any)=><tr key={s.id}><td>{new Date(s.started_at).toLocaleString()}</td><td>{s.status}</td><td>{s.results_count||0}</td><td>{s.new_matches_count||0}</td><td>{money(s.cost_cents||0)}</td><td>{s.duration_ms?`${s.duration_ms} ms`:"—"}</td><td>{label(s.error_code)}</td></tr>)}</tbody></table>:data?<p className="muted">No scans yet.</p>:<div className="loading">Loading scan history…</div>}</div><p className="muted" style={{marginTop:16}}>Internal provider responses, credentials, billing diagnostics, and X request details are never exposed here.</p></>
}
