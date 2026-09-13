import { describe, expect, it, vi } from "vitest";

import {
  createConnectorTokenVerifier,
  resolveConnectorMember,
} from "@/lib/mcp/connector-auth";

const supabaseUrl = "https://project.supabase.co";

function verifierForClaims(claims: Record<string, unknown> | null, error: Error | null = null) {
  return createConnectorTokenVerifier({
    supabaseUrl,
    getClaims: vi.fn().mockResolvedValue({
      data: claims ? { claims } : null,
      error,
    }),
  });
}

describe("hosted MCP token verification", () => {
  it("returns auth info for a verified Supabase OAuth access token", async () => {
    const verifier = verifierForClaims({
      sub: "user-a",
      exp: 2_000_000_000,
      iss: `${supabaseUrl}/auth/v1`,
      client_id: "chatgpt",
      scope: "openid email",
    });

    await expect(verifier.verifyAccessToken("token-a")).resolves.toMatchObject({
      token: "token-a",
      clientId: "chatgpt",
      scopes: ["openid", "email"],
      expiresAt: 2_000_000_000,
      extra: { userId: "user-a" },
    });
  });

  it.each([
    ["missing subject", { exp: 2_000_000_000, iss: `${supabaseUrl}/auth/v1` }, null],
    ["missing expiry", { sub: "user-a", iss: `${supabaseUrl}/auth/v1` }, null],
    ["wrong issuer", { sub: "user-a", exp: 2_000_000_000, iss: "https://other.supabase.co/auth/v1" }, null],
    ["provider failure", null, new Error("provider failed")],
  ])("rejects %s as an invalid token", async (_label, claims, error) => {
    await expect(verifierForClaims(claims, error).verifyAccessToken("bad-token")).rejects.toMatchObject({
      code: "invalid_token",
    });
  });
});

describe("hosted MCP workspace authorization", () => {
  const authInfo = {
    token: "token-a",
    clientId: "chatgpt",
    scopes: ["openid"],
    expiresAt: 2_000_000_000,
    extra: { userId: "user-a" },
  };

  it("resolves exactly one workspace through the authenticated token", async () => {
    await expect(resolveConnectorMember(authInfo, {
      findMemberships: vi.fn().mockResolvedValue([
        { workspace_id: "workspace-a", user_id: "user-a" },
      ]),
    })).resolves.toMatchObject({
      userId: "user-a",
      workspaceId: "workspace-a",
      authInfo: { extra: { userId: "user-a", workspaceId: "workspace-a" } },
    });
  });

  it("denies a verified token without an authorized workspace", async () => {
    const result = await resolveConnectorMember(authInfo, {
      findMemberships: vi.fn().mockResolvedValue([]),
    });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });
});
