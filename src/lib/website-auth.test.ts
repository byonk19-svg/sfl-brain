import { describe, expect, it, vi } from "vitest";

const authClient = vi.hoisted(() => ({
  auth: {
    getClaims: vi.fn(),
  },
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAuthServerClient: vi.fn(async () => authClient),
}));

vi.mock("@/lib/brain", () => ({
  createBrainService: vi.fn(() => ({
    clientForAuthorization: () => {
      throw new Error("Website authorization must not use the service-role client.");
    },
  })),
}));

import { WebsiteAuthenticationError, WorkspaceAuthorizationError, resolveWorkspaceFromMembership } from "@/lib/website-auth";
import { resolveWebsiteWorkspace } from "@/lib/website-auth";

describe("website workspace authorization", () => {
  it("denies an unauthenticated identity", () => {
    expect(() => resolveWorkspaceFromMembership(null, null)).toThrow(WebsiteAuthenticationError);
  });
  it("denies an authenticated user with no membership", () => {
    expect(() => resolveWorkspaceFromMembership("user-a", null)).toThrow(WorkspaceAuthorizationError);
  });
  it("resolves only the membership workspace", () => {
    expect(resolveWorkspaceFromMembership("user-a", { workspace_id: "workspace-a", user_id: "user-a" })).toBe("workspace-a");
    expect(() => resolveWorkspaceFromMembership("user-a", { workspace_id: "workspace-b", user_id: "user-b" })).toThrow(WorkspaceAuthorizationError);
  });

  it("looks up membership through the verified user's SSR client", async () => {
    authClient.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { workspace_id: "workspace-a", user_id: "user-a" },
      error: null,
    });
    const eqUserId = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: eqUserId }));
    authClient.from.mockReturnValue({ select });

    await expect(resolveWebsiteWorkspace()).resolves.toBe("workspace-a");
    expect(authClient.from).toHaveBeenCalledWith("workspace_members");
    expect(eqUserId).toHaveBeenCalledWith("user_id", "user-a");
  });
});
