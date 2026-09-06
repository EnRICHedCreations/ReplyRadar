import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth">
      <h1>This page isn’t on the radar.</h1>
      <Link className="button primary" href="/overview">
        Return to overview
      </Link>
    </main>
  );
}
