import { auth } from "@/lib/auth";
import { sameOrigin, rateLimit } from "@/lib/security";
import { db } from "@/lib/db";
import { z } from "zod";
import { createHash } from "node:crypto";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(req);
    const { action } = await params;
    const s = await auth();
    if (action === "logout") {
      await s.auth.signOut();
      return Response.json({ ok: true });
    }
    const v = z
      .object({
        email: z.email().optional(),
        password: z.string().min(10).max(128).optional(),
      })
      .parse(await req.json());
    await rateLimit(
      "auth:" +
        createHash("sha256")
          .update(v.email || "reset")
          .digest("hex"),
      5,
      300,
    );
    const app = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    if (action === "forgot") {
      if (!v.email) throw Error();
      await s.auth.resetPasswordForEmail(v.email, {
        redirectTo: app + "/auth/callback?next=/reset-password",
      });
      return Response.json({
        message: "If that address has an account, a reset link is on its way.",
      });
    }
    if (action === "reset") {
      if (!v.password) throw Error();
      const { data } = await s.auth.getUser();
      if (!data.user) throw Error();
      const { error } = await s.auth.updateUser({ password: v.password });
      if (error) throw error;
      return Response.json({ url: "/overview" });
    }
    if (!v.email || !v.password) throw Error();
    const result =
      action === "signup"
        ? await s.auth.signUp({
            email: v.email,
            password: v.password,
            options: {
              emailRedirectTo: app + "/auth/callback?next=/onboarding",
            },
          })
        : await s.auth.signInWithPassword({
            email: v.email,
            password: v.password,
          });
    if (result.error) throw result.error;
    if (action === "signup" && result.data.user) {
      await db().query(
        "insert into profiles(id,email) values($1,$2) on conflict do nothing",
        [result.data.user.id, v.email],
      );
      await db().query(
        "insert into usage_events(user_id,type) values($1,'signup_completed')",
        [result.data.user.id],
      );
    }
    return Response.json(
      result.data.session
        ? { url: action === "signup" ? "/onboarding" : "/overview" }
        : {
            message:
              "Check your email to confirm your account, then return to sign in.",
          },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? e.issues[0].message
            : "Unable to sign in or update your account. Check your details, email confirmation, and service configuration.",
      },
      { status: 400 },
    );
  }
}
