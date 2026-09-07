"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Bell, CheckCheck } from "lucide-react";

type Notification = { id:string; score:number; intent:string; detected_at:string; read_at:string|null; username:string; display_name:string|null; text:string; url:string; radar_name:string };

async function load() {
  const r = await fetch("/api/notifications", { cache: "no-store" });
  if (!r.ok) throw new Error("Could not load notifications.");
  return r.json();
}

export function NotificationBell() {
  const [unread,setUnread]=useState(0);
  useEffect(()=>{ let live=true; const tick=()=>load().then(d=>live&&setUnread(d.unread)).catch(()=>{}); tick(); const t=setInterval(tick,10000); return()=>{live=false;clearInterval(t)}; },[]);
  return <Link href="/notifications" className="button quiet" aria-label={`${unread} unread notifications`} style={{position:"relative"}}><Bell size={16}/>{unread>0&&<span className="tag" style={{marginLeft:6}}>{unread>99?"99+":unread}</span>}</Link>;
}

export default function Notifications() {
  const [data,setData]=useState<{items:Notification[];unread:number}|null>(null), [error,setError]=useState("");
  const refresh=useCallback(()=>load().then(setData).catch(e=>setError(e.message)),[]);
  useEffect(()=>{refresh();const t=setInterval(refresh,10000);return()=>clearInterval(t)},[refresh]);
  async function mark(body:unknown){await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});await refresh()}
  return <>
    <div className="page-head row between wrap"><div><h1>Notifications</h1><p>New ReplyRadar matches, right here. No inboxes, bots, or webhooks.</p></div><button className="quiet" disabled={!data?.unread} onClick={()=>mark({all:true})}><CheckCheck size={15}/> Mark all as read</button></div>
    {error&&<div className="notice">{error}</div>}
    <div className="panel" style={{padding:"0 20px"}}>
      {data?.items.length ? data.items.map(n=><article className="match" key={n.id} style={{opacity:n.read_at?.length?0.72:1}}>
        <div className="score"><span>{n.score}<small>SCORE</small></span></div>
        <div style={{width:"100%"}}><div className="row between wrap"><div><strong>{n.display_name||n.username}</strong> <span className="muted">@{n.username} · {n.radar_name}</span></div>{!n.read_at&&<span className="tag">New</span>}</div><p>{n.text}</p><div className="match-actions"><a className="button primary" href={n.url} target="_blank" rel="noreferrer" onClick={()=>mark({id:n.id})}>Open on X <ArrowUpRight size={13}/></a>{!n.read_at&&<button className="quiet" onClick={()=>mark({id:n.id})}>Mark read</button>}</div></div>
      </article>) : data ? <div className="empty"><Bell size={34}/><h2>You’re caught up.</h2><p>New qualifying matches will appear here automatically.</p></div> : <div className="loading">Loading notifications…</div>}
    </div>
  </>;
}
