import type { AuthInfo } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import { handleMcpRequest } from "@/lib/mcp/request-handler";

type Handler = {
  fetch: (request: Request, options?: { authInfo?: AuthInfo }) => Promise<Response>;
};

type HostedMember = {
  authInfo: AuthInfo;
  userId: string;
  workspaceId: string;
};

describe("MCP HTTP hosting boundary", () => {
  const request = new Request("https://brain.example.com/mcp", { method: "POST" });

  it("challenges an unauthenticated hosted request", async () => {
    const challenge = new Response(null, {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer resource_metadata=\"https://brain.example.com/.well-known/oauth-protected-resource/mcp\"" },
    });
    const response = await handleMcpRequest(request, {
      isHosted: () => true,
      localHandler: { fetch: vi.fn() },
      requireAuth: vi.fn().mockResolvedValue(challenge),
      resolveConnectorMember: vi.fn(),
      createHandler: vi.fn(),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  it("passes verified actor and workspace context to a request-scoped handler", async () => {
    const authInfo: AuthInfo = {
      token: "token-a",
      clientId: "chatgpt",
      scopes: ["openid"],
      expiresAt: 2_000_000_000,
      extra: { userId: "user-a" },
    };
    const member: HostedMember = { authInfo, userId: "user-a", workspaceId: "workspace-a" };
    const fetch = vi.fn().mockResolvedValue(new Response("ok"));
    const createHandler = vi.fn((): Handler => ({ fetch }));

    const response = await handleMcpRequest(request, {
      isHosted: () => true,
      localHandler: { fetch: vi.fn() },
      requireAuth: vi.fn().mockResolvedValue(authInfo),
      resolveConnectorMember: vi.fn().mockResolvedValue(member),
      createHandler,
    });

    expect(await response.text()).toBe("ok");
    expect(createHandler).toHaveBeenCalledWith(member);
    expect(fetch).toHaveBeenCalledWith(request, { authInfo });
  });

  it("preserves the unauthenticated local development handler", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("local"));
    const requireAuth = vi.fn();
    const response = await handleMcpRequest(request, {
      isHosted: () => false,
      localHandler: { fetch },
      requireAuth,
      resolveConnectorMember: vi.fn(),
      createHandler: vi.fn(),
    });

    expect(await response.text()).toBe("local");
    expect(fetch).toHaveBeenCalledWith(request);
    expect(requireAuth).not.toHaveBeenCalled();
  });
});
