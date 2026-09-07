import { redirect } from "next/navigation";
import { user } from "@/lib/auth";
import { db } from "@/lib/db";

export async function adminUser() {
  const u = await user();
  const row = (
    await db().query(
      "select role,email from admin_users where user_id=$1 limit 1",
      [u.id],
    )
  ).rows[0];
  if (!row) throw new Error("Admin access required.");
  return { ...u, adminRole: row.role as "admin" | "viewer" };
}

export async function requireAdminPage() {
  try {
    return await adminUser();
  } catch {
    redirect("/overview");
  }
}

export async function isAdminUser(userId: string) {
  return Boolean(
    (
      await db().query(
        "select 1 from admin_users where user_id=$1 limit 1",
        [userId],
      )
    ).rowCount,
  );
}
