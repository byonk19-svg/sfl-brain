"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page-shell">
      <section className="setup-state" role="alert">
        <span className="eyebrow">Could not load this view</span>
        <h1>The Brain hit a snag.</h1>
        <p>Your data has not been changed. Check that the local Supabase stack is running, then try again.</p>
        <button className="button" type="button" onClick={reset}>Try again</button>
      </section>
    </div>
  );
}
