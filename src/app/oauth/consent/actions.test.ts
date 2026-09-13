import { describe, expect, it, vi } from "vitest";

import {
  WorkspaceAuthorizationError,
} from "@/lib/website-auth";
import {
  decideOAuthConsent,
  validateOAuthRedirect,
} from "./actions";

function dependencies() {
  return {
    resolveWebsiteWorkspace: vi.fn().mockResolvedValue("workspace-a"),
    approveAuthorization: vi.fn().mockResolvedValue({
      data: { redirect_url: "https://chatgpt.com/oauth/callback?code=code-a" },
      error: null,
    }),
    denyAuthorization: vi.fn().mockResolvedValue({
      data: { redirect_url: "https://chatgpt.com/oauth/callback?error=access_denied" },
      error: null,
    }),
  };
}

describe("OAuth consent decisions", () => {
  it("approves only after rechecking workspace membership", async () => {
    const deps = dependencies();
    await expect(decideOAuthConsent({
      authorizationId: "authorization-a",
      decision: "approve",
    }, deps)).resolves.toEqual({
      redirectUrl: "https://chatgpt.com/oauth/callback?code=code-a",
    });
    expect(deps.resolveWebsiteWorkspace).toHaveBeenCalledOnce();
    expect(deps.approveAuthorization).toHaveBeenCalledWith("authorization-a", {
      skipBrowserRedirect: true,
    });
  });

  it("does not approve a signed-in non-member", async () => {
    const deps = dependencies();
    deps.resolveWebsiteWorkspace.mockRejectedValue(
      new WorkspaceAuthorizationError("denied"),
    );
    await expect(decideOAuthConsent({
      authorizationId: "authorization-a",
      decision: "approve",
    }, deps)).rejects.toThrow(WorkspaceAuthorizationError);
    expect(deps.approveAuthorization).not.toHaveBeenCalled();
  });

  it("lets an authenticated user deny without granting workspace access", async () => {
    const deps = dependencies();
    await expect(decideOAuthConsent({
      authorizationId: "authorization-a",
      decision: "deny",
    }, deps)).resolves.toEqual({
      redirectUrl: "https://chatgpt.com/oauth/callback?error=access_denied",
    });
    expect(deps.resolveWebsiteWorkspace).not.toHaveBeenCalled();
    expect(deps.denyAuthorization).toHaveBeenCalledWith("authorization-a", {
      skipBrowserRedirect: true,
    });
  });

  it("rejects malformed decisions and provider failures", async () => {
    const deps = dependencies();
    await expect(decideOAuthConsent({
      authorizationId: "",
      decision: "approve",
    }, deps)).rejects.toThrow();
    deps.approveAuthorization.mockResolvedValue({ data: null, error: new Error("failed") });
    await expect(decideOAuthConsent({
      authorizationId: "authorization-a",
      decision: "approve",
    }, deps)).rejects.toThrow("Unable to complete OAuth consent");
  });
});

describe("OAuth provider redirects", () => {
  it("accepts HTTPS and local development callbacks", async () => {
    await expect(validateOAuthRedirect("https://chatgpt.com/oauth/callback?code=abc")).resolves.toBe(
      "https://chatgpt.com/oauth/callback?code=abc",
    );
    await expect(validateOAuthRedirect("http://127.0.0.1:3456/callback")).resolves.toBe(
      "http://127.0.0.1:3456/callback",
    );
  });

  it.each(["javascript:alert(1)", "http://evil.example/callback", "not a url"])(
    "rejects unsafe provider redirect %s",
    async (value) => expect(validateOAuthRedirect(value)).rejects.toThrow("redirect"),
  );
});
