"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Radio, MessagesSquare, Bell, ChartNoAxesColumn, CreditCard, Settings, LogOut } from "lucide-react";
import Brand from "./brand";
import { NotificationBell } from "./notifications";
const links = [
  ["/overview", "Overview", LayoutDashboard],
  ["/radars", "Radars", Radio],
  ["/matches", "Matches", MessagesSquare],
  ["/notifications", "Notifications", Bell],
  ["/usage", "Usage", ChartNoAxesColumn],
  ["/billing", "Billing", CreditCard],
  ["/settings", "Settings", Settings],
] as const;
export default function Shell({ children, email }: { children: React.ReactNode; email: string }) {
  const path = usePathname(), router = useRouter();
  return <div className="shell">
    <aside className="sidebar"><Brand/><nav>{links.map(([url,title,Icon])=><Link href={url} key={url} className={"nav-link "+(path.startsWith(url)?"active":"")}><Icon size={17}/>{title}</Link>)}</nav><div className="side-bottom"><Link href="/account" className="nav-link" title={email}>{email}</Link><button className="quiet" onClick={async()=>{const r=await fetch("/api/auth/logout",{method:"POST"});if(r.ok)router.push("/login")}}><LogOut size={14}/>Sign out</button></div></aside>
    <div><header className="topbar row between"><span className="muted">Workspace <span style={{padding:"0 12px",color:"#454b53"}}>/</span> {links.find(([url])=>path.startsWith(url))?.[1]||"Account"}</span><div className="row"><NotificationBell/><Link href="/radars/new" className="muted">+ New radar</Link></div></header><div className="content">{children}</div></div>
  </div>;
}
