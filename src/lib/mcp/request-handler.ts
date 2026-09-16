import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  requireBearerAuth,
  type AuthInfo,
} from "@modelcontextprotocol/server";

import { createBrainService } from "@/lib/brain";
import {
  createSupabaseConnectorTokenVerifier,
  resolveConnectorMember,
  type ConnectorMember,
} from "@/lib/mcp/connector-auth";
import { createSflMcpServer } from "@/lib/mcp/server";

type McpHandler = {
  fetch: (
    request: Request,
    options?: { authInfo?: AuthInfo },
  ) => Promise<Response>;
};

export type McpRequestDependencies = {
  isHosted: () => boolean;
  localHandler: McpHandler;
  requireAuth: (request: Request) => Promise<AuthInfo | Response>;
  resolveConnectorMember: (
    authInfo: AuthInfo,
  ) => Promise<ConnectorMember | Response>;
  createHandler: (member: ConnectorMember) => McpHandler;
};

function localWritesEnabled() {
  return process.env.NODE_ENV === "development" &&
    process.env.SFL_ENABLE_PILOT_WRITES === "1";
}

const localHandler = createMcpHandler(
  () => createSflMcpServer(createBrainService(), {
    enablePilotWrites: localWritesEnabled(),
    trustedStorageOrigin: process.env.SUPABASE_URL,
  }),
  { legacy: "stateless" },
);

function hostedSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("Hosted connector site URL is not configured.");
  return new URL("/mcp", siteUrl);
}

async function requireHostedAuth(request: Request) {
  const resourceUrl = hostedSiteUrl();
  return requireBearerAuth({
    verifier: createSupabaseConnectorTokenVerifier(),
    requiredScopes: ["openid"],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
  })(request);
}

function createHostedHandler(member: ConnectorMember) {
  return createMcpHandler(
    () => createSflMcpServer(createBrainService(member.workspaceId, {
      userId: member.userId,
      source: "chatgpt_connector",
    }), {
      enablePilotWrites: true,
      enablePostPackageWrites: true,
      trustedStorageOrigin: process.env.SUPABASE_URL,
    }),
    { legacy: "stateless" },
  );
}

const realDependencies: McpRequestDependencies = {
  isHosted: () => process.env.VERCEL === "1",
  localHandler,
  requireAuth: requireHostedAuth,
  resolveConnectorMember,
  createHandler: createHostedHandler,
};

export async function handleMcpRequest(
  request: Request,
  dependencies: McpRequestDependencies = realDependencies,
) {
  if (!dependencies.isHosted()) {
    return dependencies.localHandler.fetch(request);
  }
  const authInfo = await dependencies.requireAuth(request);
  if (authInfo instanceof Response) return authInfo;
  const member = await dependencies.resolveConnectorMember(authInfo);
  if (member instanceof Response) return member;
  return dependencies.createHandler(member).fetch(request, {
    authInfo: member.authInfo,
  });
}
