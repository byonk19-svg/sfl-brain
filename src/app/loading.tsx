export default function Loading() {
  return (
    <div className="page-shell" aria-live="polite" aria-busy="true">
      <div className="loading-line short" />
      <div className="loading-line title" />
      <div className="loading-line" />
      <span className="sr-only">Loading SFL Brain…</span>
    </div>
  );
}
