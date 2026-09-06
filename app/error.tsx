"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth">
      <h1>Something interrupted your workspace.</h1>
      <p className="muted">
        We couldn’t load this page. Retry, or check the database and
        authentication configuration.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
