export default function Loading() {
  return (
    <div role="status" className="loading-state">
      <span className="loading-spinner" />
      <p>Preparing your UCSA workspace…</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
