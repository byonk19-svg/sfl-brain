"use client";

import { type EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createAuthBrowserClient } from "@/lib/supabase/client";
import { destinationAfterAuthCallback } from "@/lib/supabase/invite-flow";

export default function ConfirmPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    const auth = createAuthBrowserClient();
    let active = true;

    const { data: { subscription } } = auth.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session) {
        router.replace(destinationAfterAuthCallback(true));
        return;
      }
      if (event === "INITIAL_SESSION") setError(true);
    });

    async function verifyTokenHash() {
      const searchParams = new URLSearchParams(window.location.search);
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as EmailOtpType | null;
      if (!tokenHash || !type) return;

      const { error } = await auth.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        if (active) setError(true);
        return;
      }
      const { data: { session } } = await auth.auth.getSession();
      if (!active) return;
      if (session) router.replace(destinationAfterAuthCallback(true));
      else setError(true);
    }

    void verifyTokenHash();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (error) {
    return <div className="page-shell narrow-shell"><section className="setup-state" role="alert"><span className="eyebrow">Invitation link unavailable</span><h1>Request a new invitation</h1><p>This invitation link is invalid or expired. Ask the SFL Brain owner to send a fresh invitation.</p><Link className="button" href="/login">Return to sign in</Link></section></div>;
  }

  return <div className="page-shell narrow-shell"><section className="setup-state"><span className="eyebrow">Private workspace</span><h1>Finishing your invitation…</h1><p>We are securely connecting your SFL Brain account.</p></section></div>;
}
