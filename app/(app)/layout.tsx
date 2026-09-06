import { redirect } from "next/navigation";
import { user, configured } from "@/lib/auth";
import Shell from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured()) redirect("/login");
  let u;
  try {
    u = await user();
  } catch {
    redirect("/login");
  }
  return <Shell email={u.email || "Account"}>{children}</Shell>;
}
