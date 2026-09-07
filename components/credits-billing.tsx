"use client";
import { useEffect, useState } from "react";

const packs=[1000,2500,5000,10000];
const money=(c:number)=>`${c<0?"-":""}$${(Math.abs(Number(c||0))/100).toFixed(2)}`;
const maxScanCost=(posts:number)=>posts;

export default function CreditsBilling(){
  const [data,setData]=useState<any>(null),[error,setError]=useState(""),[busy,setBusy]=useState<number|null>(null),[saving,setSaving]=useState("");
  async function load(){try{const r=await fetch("/api/credits/summary",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load credits");setData(d);setError("")}catch(e){setError((e as Error).message)}}
  useEffect(()=>{void load()},[]);
  async function buy(amount:number){setBusy(amount);try{const r=await fetch("/api/credits/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount_cents:amount})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Checkout failed");location.assign(d.url)}catch(e){setError((e as Error).message);setBusy(null)}}
  async function budget(id:string,n:number){setSaving(id);try{const r=await fetch("/api/credits/radar-budget",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({radar_id:id,max_results_per_scan:n})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save");await load()}catch(e){setError((e as Error).message)}finally{setSaving("")}}
  if(!data&&!error)return <div className="loading">Loading credits…</div>;
  return <>
    <div className="page-head"><h1>Credits</h1><p>ReplyRadar is usage-based. Buy credits once, then spend only when X is actually queried.</p></div>
    {error&&<div className="notice">{error}</div>}
    {data&&<>
      <div className="stats">
        <div className="panel stat"><span className="eyebrow">AVAILABLE BALANCE</span><strong>{money(data.account.balance_cents)}</strong><small>Monitoring pauses before a scan you cannot cover.</small></div>
        <div className="panel stat"><span className="eyebrow">SPENT THIS MONTH</span><strong>{money(data.month_spent_cents)}</strong><small>Usage debited only after successful X scans.</small></div>
        <div className="panel stat"><span className="eyebrow">LIFETIME SPEND</span><strong>{money(data.account.lifetime_spent_cents)}</strong><small>Across all radars.</small></div>
      </div>
      <section className="panel" style={{marginTop:24}}><h2>Add credits</h2><p className="muted">No subscription. No automatic renewal. Credits remain until used.</p><div className="row wrap">{packs.map(p=><button key={p} className={p===2500?"primary":""} disabled={busy!==null} onClick={()=>buy(p)}>{busy===p?"Opening checkout…":`Add ${money(p)}`}</button>)}</div></section>
      <section className="panel" style={{marginTop:24}}><h2>Per-radar cost controls</h2><p className="muted">Each scan performs one X Recent Search request. At the current launch rate, each returned post consumes 1¢ of ReplyRadar credit. The amount charged can be lower than the ceiling when X returns fewer posts.</p>{data.radars.length?data.radars.map((r:any)=><div className="breakdown-row" key={r.id}><div><strong>{r.name}</strong><div className="muted">{r.enabled?"Active":"Paused"} · max {r.max_results_per_scan} posts · worst-case {money(maxScanCost(r.max_results_per_scan))} / scan</div></div><select aria-label={`Maximum results for ${r.name}`} value={r.max_results_per_scan} disabled={saving===r.id} onChange={e=>budget(r.id,Number(e.target.value))}>{[10,25,50,75,100].map(n=><option value={n} key={n}>{n} posts · max {money(maxScanCost(n))}</option>)}</select></div>):<p className="muted">Create a radar to set its scan budget.</p>}</section>
      <section className="panel" style={{marginTop:24}}><h2>Recent credit activity</h2>{data.ledger.length?<div className="table-wrap"><table><thead><tr><th>When</th><th>Type</th><th>Amount</th></tr></thead><tbody>{data.ledger.map((x:any)=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString()}</td><td>{x.kind}</td><td>{x.amount_cents>=0?"+":""}{money(x.amount_cents)}</td></tr>)}</tbody></table></div>:<p className="muted">No credit activity yet.</p>}</section>
    </>}
  </>;
}
