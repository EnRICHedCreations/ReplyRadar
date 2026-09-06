"use client";
import { useState } from "react";
import Link from "next/link";
import Brand from "./brand";
export default function AuthForm({
  mode,
  ready,
}: {
  mode: string;
  ready: boolean;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const title =
    mode === "signup"
      ? "Find your first signal."
      : mode === "forgot"
        ? "Reset your password."
        : mode === "reset"
          ? "Choose a new password."
          : "Welcome back.";
  return (
    <main className="auth">
      <Brand />
      <h1>{title}</h1>
      <p className="muted">
        {mode === "signup"
          ? "Create your free account to start listening."
          : "Your next conversation is out there."}
      </p>
      {!ready && (
        <div className="notice">
          Account setup is awaiting Supabase configuration. The operator must
          add the environment values before you can sign in.
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          const f = new FormData(e.currentTarget);
          try {
            const res = await fetch("/api/auth/" + mode, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(Object.fromEntries(f)),
            });
            const d = await res.json();
            if (d.url) location.assign(d.url);
            else setMessage(d.error || d.message);
          } catch {
            setMessage("Unable to reach the server. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode !== "reset" && (
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
            />
          </div>
        )}
        {mode !== "forgot" && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={mode === "login" ? 1 : 10}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
            <small className="hint">
              {mode === "signup" ? "At least 10 characters." : ""}
            </small>
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        <button className="primary" disabled={busy || !ready}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : mode === "forgot"
                ? "Send reset link"
                : mode === "reset"
                  ? "Save password"
                  : "Sign in"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 24, textAlign: "center" }}>
        {mode === "login" ? (
          <>
            <Link href="/signup">Create an account</Link> ·{" "}
            <Link href="/forgot-password">Forgot password?</Link>
          </>
        ) : (
          <Link href="/login">Back to sign in</Link>
        )}
      </p>
    </main>
  );
}
