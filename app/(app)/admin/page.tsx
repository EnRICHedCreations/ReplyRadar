import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin";
import AdminCreditAdjust from "@/components/admin-credit-adjust";

export const dynamic="force-dynamic";
const money=(c:number|string|null|undefined)=>`$${(Number(c||0)/100).toFixed(2)}`;
const dt=(v:any)=>v?new Date(v).toLocaleString():"—";
const ago=(v:any)=>{if(!v)return"never";const s=Math.max(0,Math.floor((Date.now()-+new Date(v))/1000));return s<60?`${s}s ago`:s<3600?`${Math.floor(s/60)}m ago`:s<86400?`${Math.floor(s/3600)}h ago`:`${Math.floor(s/86400)}d ago`};
const tableStyle={width:"100%",borderCollapse:"collapse" as const,fontSize:13};
const th={textAlign:"left" as const,padding:"9px 10px",borderBottom:"1px solid #242a31",whiteSpace:"nowrap" as const};
const td={padding:"10px",borderBottom:"1px solid #1b2026",verticalAlign:"top" as const};

export default async function AdminPage(){
 const admin=await requireAdminPage();
 const [metrics,users,radars,scans,ledger,audit]=await Promise.all([
  db().query(`select
   (select count(*) from auth.users) total_users,
   (select count(*) from auth.users where created_at>=now()-interval '24 hours') new_users_24h,
   (select count(*) from auth.users where last_sign_in_at>=now()-interval '24 hours') active_users_24h,
   (select count(*) from radars) total_radars,
   (select count(*) from radars where enabled) active_radars,
   (select count(*) from scan_jobs) queued_scans,
   (select count(*) from scan_runs where started_at>=current_date) scans_today,
   (select coalesce(sum(billable_posts),0) from scan_runs where started_at>=current_date and status='completed') x_posts_today,
   (select coalesce(sum(cost_cents),0) from scan_runs where started_at>=current_date and status='completed') customer_scan_charges_today,
   (select count(*) from matches where detected_at>=current_date) matches_today,
   (select count(*) from scan_runs where started_at>=now()-interval '24 hours' and status='failed') failed_scans_24h,
   (select coalesce(sum(balance_cents),0) from credit_accounts) outstanding_credit_cents,
   (select coalesce(sum(amount_cents),0) from credit_ledger where kind='purchase') lifetime_purchases_cents,
   (select coalesce(sum(billable_posts),0) from scan_runs where status='completed') lifetime_x_posts,
   (select max(last_seen_at) from worker_heartbeats) worker_last_seen`),
  db().query(`select u.id,u.email,u.created_at,u.last_sign_in_at,coalesce(p.display_name,'') display_name,
   coalesce(c.balance_cents,0) balance_cents,coalesce(c.lifetime_purchased_cents,0) purchased_cents,coalesce(c.lifetime_spent_cents,0) spent_cents,
   (select count(*) from radars r where r.user_id=u.id) radars,
   (select count(*) from matches m where m.user_id=u.id) matches,
   (select count(*) from scan_runs s where s.user_id=u.id) scans,
   (select coalesce(sum(s.billable_posts),0) from scan_runs s where s.user_id=u.id and s.status='completed') x_posts
   from auth.users u left join profiles p on p.id=u.id left join credit_accounts c on c.user_id=u.id order by u.created_at desc limit 200`),
  db().query(`select r.id,r.name,r.query,r.enabled,r.last_error,r.last_scan_at,r.next_scan_at,r.max_results_per_scan,r.scan_interval_seconds,u.email,
   s.status latest_status,s.results_count latest_results,s.new_matches_count latest_matches,s.cost_cents latest_cost,s.started_at latest_started
   from radars r join auth.users u on u.id=r.user_id left join lateral(select * from scan_runs sr where sr.radar_id=r.id order by sr.started_at desc limit 1)s on true
   order by r.updated_at desc limit 200`),
  db().query(`select s.id,s.started_at,s.completed_at,s.status,s.results_count,s.new_matches_count,s.billable_posts,s.cost_cents,s.error_code,u.email,r.name radar_name
   from scan_runs s join auth.users u on u.id=s.user_id join radars r on r.id=s.radar_id order by s.started_at desc limit 100`),
  db().query(`select l.created_at,l.kind,l.amount_cents,l.metadata,u.email,r.name radar_name from credit_ledger l join auth.users u on u.id=l.user_id left join radars r on r.id=l.radar_id order by l.created_at desc limit 100`),
  db().query(`select a.created_at,a.action,au.email admin_email,tu.email target_email,a.metadata from admin_audit_log a join auth.users au on au.id=a.admin_user_id left join auth.users tu on tu.id=a.target_user_id order by a.created_at desc limit 50`),
 ]);
 const m=metrics.rows[0];
 const estimatedProviderToday=Math.round(Number(m.x_posts_today)*0.5);
 const estimatedProviderLifetime=Math.round(Number(m.lifetime_x_posts)*0.5);
 const workerHealthy=m.worker_last_seen&&Date.now()-+new Date(m.worker_last_seen)<90000;
 const marginToday=Number(m.customer_scan_charges_today)-estimatedProviderToday;
 return <>
  <div className="page-head row between wrap"><div><h1>Admin</h1><p>Operations, customers, usage, billing, and provider health.</p></div><div className="tag">{admin.adminRole.toUpperCase()}</div></div>

  <div className="stats">
   {[
    ["Users",m.total_users,`${m.new_users_24h} joined in 24h`],
    ["Active users",m.active_users_24h,"Signed in during last 24h"],
    ["Active radars",m.active_radars,`${m.total_radars} total`],
    ["Scans today",m.scans_today,`${m.queued_scans} queued`],
    ["X posts today",m.x_posts_today,`Est. provider cost ${money(estimatedProviderToday)}`],
    ["Matches today",m.matches_today,`${m.failed_scans_24h} failed scans / 24h`],
    ["Scan revenue today",money(m.customer_scan_charges_today),`Est. margin ${money(marginToday)}`],
    ["Credits outstanding",money(m.outstanding_credit_cents),"Customer prepaid liability"],
   ].map(([label,value,hint])=><div className="panel stat" key={String(label)}><span className="eyebrow">{label}</span><strong>{value}</strong><small>{hint}</small></div>)}
  </div>

  <div className="panel" style={{marginBottom:18}}><div className="row between wrap"><div><h3 style={{marginBottom:4}}>System & X economics</h3><p className="muted" style={{margin:0}}>Provider cost is estimated at 0.5¢ per X post from observed billing. X does not expose an authoritative remaining-credit balance through the API integration used by ReplyRadar.</p></div><span className={"tag "+(workerHealthy?"":"warn")}>{workerHealthy?"Worker healthy":"Worker stale"}</span></div><div className="grid2" style={{marginTop:14}}><div><span className="eyebrow">Worker heartbeat</span><div><strong>{ago(m.worker_last_seen)}</strong></div></div><div><span className="eyebrow">Lifetime economics</span><div><strong>{Number(m.lifetime_x_posts).toLocaleString()} X posts</strong> · est. X cost {money(estimatedProviderLifetime)} · purchases {money(m.lifetime_purchases_cents)}</div></div></div></div>

  <div className="panel" style={{marginBottom:18}}><div className="row between"><h3>Users</h3><span className="muted">Up to 200 newest</span></div><div style={{overflowX:"auto"}}><table style={tableStyle}><thead><tr>{["User","Joined / last sign-in","Balance","Purchased","Spent","Radars","Scans","X posts","Matches","Admin action"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{users.rows.map((u:any)=><tr key={u.id}><td style={td}><strong>{u.email}</strong>{u.display_name&&<><br/><span className="muted">{u.display_name}</span></>}</td><td style={td}>{dt(u.created_at)}<br/><span className="muted">{u.last_sign_in_at?`last ${ago(u.last_sign_in_at)}`:"never signed in"}</span></td><td style={td}><strong>{money(u.balance_cents)}</strong></td><td style={td}>{money(u.purchased_cents)}</td><td style={td}>{money(u.spent_cents)}</td><td style={td}>{u.radars}</td><td style={td}>{u.scans}</td><td style={td}>{u.x_posts}</td><td style={td}>{u.matches}</td><td style={td}>{admin.adminRole==="admin"?<AdminCreditAdjust userId={u.id} email={u.email}/>:<span className="muted">Read only</span>}</td></tr>)}</tbody></table></div></div>

  <div className="panel" style={{marginBottom:18}}><div className="row between"><h3>Radars</h3><span className="muted">Newest activity first</span></div><div style={{overflowX:"auto"}}><table style={tableStyle}><thead><tr>{["Radar","Owner","Status","Schedule","Cap","Latest scan","Results","Matches","Charge"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{radars.rows.map((r:any)=><tr key={r.id}><td style={td}><strong>{r.name}</strong><br/><code style={{fontSize:11}}>{String(r.query).slice(0,90)}{String(r.query).length>90?"…":""}</code></td><td style={td}>{r.email}</td><td style={td}><span className={"tag "+(!r.enabled?"neutral":r.last_error?"warn":"")}>{!r.enabled?"Paused":r.last_error||"Active"}</span></td><td style={td}>{Math.round(r.scan_interval_seconds/60)}m<br/><span className="muted">next {dt(r.next_scan_at)}</span></td><td style={td}>{r.max_results_per_scan}</td><td style={td}>{r.latest_status||"—"}<br/><span className="muted">{ago(r.latest_started)}</span></td><td style={td}>{r.latest_results??"—"}</td><td style={td}>{r.latest_matches??"—"}</td><td style={td}>{r.latest_cost==null?"—":money(r.latest_cost)}</td></tr>)}</tbody></table></div></div>

  <div className="panel" style={{marginBottom:18}}><div className="row between"><h3>Recent scan runs</h3><span className="muted">Last 100</span></div><div style={{overflowX:"auto"}}><table style={tableStyle}><thead><tr>{["Time","User / radar","Status","Posts","Matches","Charge","Error"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{scans.rows.map((s:any)=><tr key={s.id}><td style={td}>{dt(s.started_at)}</td><td style={td}>{s.email}<br/><span className="muted">{s.radar_name}</span></td><td style={td}><span className={"tag "+(s.status==="failed"?"warn":"")}>{s.status}</span></td><td style={td}>{s.billable_posts}</td><td style={td}>{s.new_matches_count}</td><td style={td}>{money(s.cost_cents)}</td><td style={td}>{s.error_code||"—"}</td></tr>)}</tbody></table></div></div>

  <div className="grid2">
   <div className="panel"><div className="row between"><h3>Credit ledger</h3><span className="muted">Last 100</span></div><div style={{maxHeight:520,overflow:"auto"}}>{ledger.rows.map((l:any,i:number)=><div key={i} style={{padding:"10px 0",borderBottom:"1px solid #1b2026"}}><div className="row between"><strong>{l.email}</strong><strong>{l.amount_cents>=0?"+":""}{money(l.amount_cents)}</strong></div><div className="muted" style={{fontSize:12}}>{l.kind}{l.radar_name?` · ${l.radar_name}`:""} · {dt(l.created_at)}</div></div>)}</div></div>
   <div className="panel"><div className="row between"><h3>Admin audit</h3><span className="muted">Last 50</span></div><div style={{maxHeight:520,overflow:"auto"}}>{audit.rows.length?audit.rows.map((a:any,i:number)=><div key={i} style={{padding:"10px 0",borderBottom:"1px solid #1b2026"}}><strong>{a.action}</strong><div className="muted" style={{fontSize:12}}>{a.admin_email}{a.target_email?` → ${a.target_email}`:""} · {dt(a.created_at)}</div><code style={{fontSize:11,whiteSpace:"pre-wrap"}}>{JSON.stringify(a.metadata)}</code></div>):<p className="muted">No admin actions yet.</p>}</div></div>
  </div>
 </>;
}
