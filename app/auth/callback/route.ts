import { auth } from "@/lib/auth";
export async function GET(req: Request) {
  const u = new URL(req.url),
    code = u.searchParams.get("code"),
    next = u.searchParams.get("next");
  if (code) {
    const s = await auth();
    const { error } = await s.auth.exchangeCodeForSession(code);
    if (!error)
      return Response.redirect(
        new URL(
          next === "/reset-password" ? next : "/onboarding",
          process.env.NEXT_PUBLIC_APP_URL || u.origin,
        ),
      );
  }
  return Response.redirect(
    new URL(
      "/login?error=confirmation",
      process.env.NEXT_PUBLIC_APP_URL || u.origin,
    ),
  );
}
