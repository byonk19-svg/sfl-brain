export function Notice({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <div className={error ? "notice notice-error" : "notice notice-success"} role={error ? "alert" : "status"}>
      {error ?? success}
    </div>
  );
}

export function SetupNotice({ message }: { message: string }) {
  return (
    <section className="setup-state">
      <span className="eyebrow">Local setup needed</span>
      <h2>Connect the private database</h2>
      <p>{message}</p>
      <code>pnpm supabase:start</code>
      <code>pnpm supabase:reset</code>
      <p>Then copy the local API URL and service-role key into <code>.env.local</code>. Never use a <code>NEXT_PUBLIC_</code> service key.</p>
    </section>
  );
}
