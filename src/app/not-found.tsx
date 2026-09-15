import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell">
      <section className="empty-state">
        <span className="eyebrow">Not found</span>
        <h1>That record is not in the Brain.</h1>
        <p>It may have been archived, or the link may be incomplete.</p>
        <Link className="button" href="/library">Return to Library</Link>
      </section>
    </div>
  );
}
