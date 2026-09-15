"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createAuthServerClient } from "@/lib/supabase/server";
import { resolveWebsiteWorkspaceWithClient } from "@/lib/website-auth";

type OAuthRedirectResult = {
  data: { redirect_url: string } | null;
  error: unknown;
};

type ConsentDependencies = {
  resolveWebsiteWorkspace: () => Promise<string>;
  approveAuthorization: (
    authorizationId: string,
    options: { skipBrowserRedirect: true },
  ) => Promise<OAuthRedirectResult>;
  denyAuthorization: (
    authorizationId: string,
    options: { skipBrowserRedirect: true },
  ) => Promise<OAuthRedirectResult>;
};

const consentDecision = z.object({
  authorizationId: z.string().trim().min(1).max(2048),
  decision: z.enum(["approve", "deny"]),
});

export async function validateOAuthRedirect(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("OAuth redirect is not allowed.");
  }
  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error("OAuth redirect is not allowed.");
  }
  return url.toString();
}

type ConsentAuthClient = Awaited<ReturnType<typeof createAuthServerClient>>;

export async function createConsentDependencies(
  auth: ConsentAuthClient,
  resolveWorkspaceWithClient = resolveWebsiteWorkspaceWithClient,
): Promise<ConsentDependencies> {
  return {
    resolveWebsiteWorkspace: () => resolveWorkspaceWithClient(auth),
    approveAuthorization: (authorizationId, options) =>
      auth.auth.oauth.approveAuthorization(authorizationId, options),
    denyAuthorization: (authorizationId, options) =>
      auth.auth.oauth.denyAuthorization(authorizationId, options),
  };
}

async function realConsentDependencies(): Promise<ConsentDependencies> {
  return createConsentDependencies(await createAuthServerClient());
}

export async function decideOAuthConsent(
  input: unknown,
  dependencies?: ConsentDependencies,
) {
  const decision = consentDecision.parse(input);
  const deps = dependencies ?? await realConsentDependencies();
  if (decision.decision === "approve") {
    await deps.resolveWebsiteWorkspace();
  }
  const result = decision.decision === "approve"
    ? await deps.approveAuthorization(decision.authorizationId, {
        skipBrowserRedirect: true,
      })
    : await deps.denyAuthorization(decision.authorizationId, {
        skipBrowserRedirect: true,
      });
  if (result.error || !result.data?.redirect_url) {
    throw new Error("Unable to complete OAuth consent.");
  }
  return { redirectUrl: await validateOAuthRedirect(result.data.redirect_url) };
}

export async function submitOAuthConsent(formData: FormData) {
  const result = await decideOAuthConsent({
    authorizationId: formData.get("authorization_id"),
    decision: formData.get("decision"),
  });
  redirect(result.redirectUrl);
}
