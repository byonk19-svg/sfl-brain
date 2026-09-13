import "server-only";

import {
  OAuthError,
  OAuthErrorCode,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { createClient } from "@supabase/supabase-js";

type ConnectorClaims = {
  sub?: unknown;
  exp?: unknown;
  iss?: unknown;
  client_id?: unknown;
  scope?: unknown;
};

type ClaimsResult = {
  data: { claims: ConnectorClaims } | null;
  error: unknown;
};

export type ConnectorTokenVerifierOptions = {
  supabaseUrl: string;
  getClaims: (token: string) => Promise<ClaimsResult>;
};

function invalidToken() {
  return new OAuthError(OAuthErrorCode.InvalidToken, "The access token is invalid.");
}

export function createConnectorTokenVerifier(
  options: ConnectorTokenVerifierOptions,
): OAuthTokenVerifier {
  const expectedIssuer = `${options.supabaseUrl.replace(/\/$/, "")}/auth/v1`;

  return {
    async verifyAccessToken(token) {
      const { data, error } = await options.getClaims(token);
      const claims = data?.claims;
      if (
        error ||
        typeof claims?.sub !== "string" ||
        !claims.sub ||
        typeof claims.exp !== "number" ||
        typeof claims.iss !== "string" ||
        claims.iss !== expectedIssuer
      ) {
        throw invalidToken();
      }

      return {
        token,
        clientId:
          typeof claims.client_id === "string" && claims.client_id
            ? claims.client_id
            : "unknown-client",
        scopes:
          typeof claims.scope === "string"
            ? claims.scope.split(/\s+/).filter(Boolean)
            : [],
        expiresAt: claims.exp,
        extra: { userId: claims.sub },
      };
    },
  };
}

function connectorAuthEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Hosted connector authentication is not configured.");
  }
  return { supabaseUrl, publishableKey };
}

export function createSupabaseConnectorTokenVerifier() {
  const { supabaseUrl, publishableKey } = connectorAuthEnv();
  const auth = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return createConnectorTokenVerifier({
    supabaseUrl,
    getClaims: (token) => auth.auth.getClaims(token),
  });
}
