import "server-only";

import {
  type AuthInfo,
  OAuthError,
  OAuthErrorCode,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { createClient } from "@supabase/supabase-js";

import {
  WorkspaceAuthorizationError,
  resolveSingleWorkspaceMembership,
} from "@/lib/website-auth";

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

type WorkspaceMembership = { workspace_id: string; user_id: string };

export type ConnectorMember = {
  authInfo: AuthInfo;
  userId: string;
  workspaceId: string;
};

type ConnectorMemberDependencies = {
  findMemberships: (
    userId: string,
    token: string,
  ) => Promise<WorkspaceMembership[]>;
};

async function findMemberships(userId: string, token: string) {
  const { supabaseUrl, publishableKey } = connectorAuthEnv();
  const auth = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const result = await auth
    .from("workspace_members")
    .select("workspace_id,user_id")
    .eq("user_id", userId)
    .limit(2);
  if (result.error) {
    throw new WorkspaceAuthorizationError("Unable to verify workspace access.");
  }
  return result.data ?? [];
}

export async function resolveConnectorMember(
  authInfo: AuthInfo,
  dependencies: ConnectorMemberDependencies = { findMemberships },
): Promise<ConnectorMember | Response> {
  const userId = authInfo.extra?.userId;
  if (typeof userId !== "string" || !userId) {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  try {
    const memberships = await dependencies.findMemberships(userId, authInfo.token);
    const workspaceId = resolveSingleWorkspaceMembership(userId, memberships);
    return {
      userId,
      workspaceId,
      authInfo: {
        ...authInfo,
        extra: { ...authInfo.extra, userId, workspaceId },
      },
    };
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) {
      return Response.json({ error: "workspace_access_denied" }, { status: 403 });
    }
    throw error;
  }
}
