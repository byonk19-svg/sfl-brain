"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { createAuthBrowserClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function setPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password.length < 8 || password !== confirmation) {
      setError("Passwords must match and contain at least eight characters.");
      return;
    }

    setSaving(true);
    setError(null);
    const auth = createAuthBrowserClient();
    const { data: { session } } = await auth.auth.getSession();
    if (!session) {
      setSaving(false);
      setError("Open the newest password email in this browser, then try again.");
      return;
    }

    const { error } = await auth.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      setError("We could not save that password. Please try again.");
      return;
    }
    router.replace("/today");
  }

  return (
    <div className="page-shell narrow-shell">
      <header className="page-header"><div><span className="eyebrow">Private workspace</span><h1>Set your password</h1><p>Choose a password with at least eight characters to finish joining SFL Brain.</p></div></header>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={setPassword} className="compact-form">
        <label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" disabled={saving} /></label>
        <label>Confirm password<input name="confirmation" type="password" required minLength={8} autoComplete="new-password" disabled={saving} /></label>
        <button className="button" type="submit" disabled={saving}>{saving ? "Saving…" : "Finish setup"}</button>
      </form>
      <p><Link href="/login">Return to sign in</Link></p>
    </div>
  );
}
