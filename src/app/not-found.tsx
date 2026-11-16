import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone-state">
      <p className="eyebrow">UCSA / 404</p>
      <h1>A different path awaits.</h1>
      <p className="muted">
        We couldn’t find this page. Let’s get you back to your community.
      </p>
      <Link className="btn btn-primary" href="/">
        Back to welcome
      </Link>
    </main>
  );
}
