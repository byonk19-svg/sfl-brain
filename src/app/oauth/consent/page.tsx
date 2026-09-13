import { redirect } from "next/navigation";

import { submitOAuthConsent, validateOAuthRedirect } from "./actions";
import { createAuthServerClient } from "@/lib/supabase/server";
import { resolveWebsiteWorkspace } from "@/lib/website-auth";

type ConsentPageProps = {
  searchParams: Promise<{ authorization_id?: string }>;
};

function consentPath(authorizationId: string) {
  return `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
}

export default async function OAuthConsentPage({ searchParams }: ConsentPageProps) {
  const authorizationId = (await searchParams).authorization_id?.trim();
  if (!authorizationId) {
    return <div className="page-shell narrow-shell"><section className="setup-state" role="alert"><span className="eyebrow">Authorization unavailable</span><h1>This request is incomplete</h1><p>Return to ChatGPT and start the SFL Brain connection again.</p></section></div>;
  }

  const auth = await createAuthServerClient();
  const claims = await auth.auth.getClaims();
  if (claims.error || !claims.data?.claims?.sub) {
    redirect(`/login?next=${encodeURIComponent(consentPath(authorizationId))}`);
  }
  await resolveWebsiteWorkspace();

  const result = await auth.auth.oauth.getAuthorizationDetails(authorizationId);
  if (result.error || !result.data) {
    return <div className="page-shell narrow-shell"><section className="setup-state" role="alert"><span className="eyebrow">Authorization unavailable</span><h1>This request could not be verified</h1><p>Return to ChatGPT and start the SFL Brain connection again.</p></section></div>;
  }
  if ("redirect_url" in result.data) {
    redirect(await validateOAuthRedirect(result.data.redirect_url));
  }

  const clientName = result.data.client.name || "ChatGPT";
  const redirectHost = new URL(result.data.redirect_uri).host;
  const scopes = result.data.scope.split(/\s+/).filter(Boolean);

  return <div className="page-shell narrow-shell"><header className="page-header"><div><span className="eyebrow">Private connector</span><h1>Connect {clientName} to SFL Brain?</h1><p>This lets {clientName} use SFL Brain for your authorized workspace.</p></div></header><section className="setup-state"><p><strong>Returning to:</strong> {redirectHost}</p><p><strong>Requested access:</strong> {scopes.join(", ") || "SFL Brain access"}</p><p>ChatGPT will ask you to confirm each database change. SFL Brain does not store your conversation.</p><div className="button-row"><form action={submitOAuthConsent}><input type="hidden" name="authorization_id" value={authorizationId} /><button className="button" type="submit" name="decision" value="approve">Allow access</button></form><form action={submitOAuthConsent}><input type="hidden" name="authorization_id" value={authorizationId} /><button className="button secondary" type="submit" name="decision" value="deny">Deny</button></form></div></section></div>;
}
