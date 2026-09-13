import { describe, expect, it } from "vitest";

import * as inviteFlow from "./invite-flow";

type InviteFlow = {
  destinationAfterAuthCallback: (hasSession: boolean) => string;
};

describe("invite callback flow", () => {
  it("sends a verified invitation session to password setup", async () => {
    const flow = inviteFlow as Partial<InviteFlow>;

    expect(flow.destinationAfterAuthCallback).toBeTypeOf("function");
    expect(flow.destinationAfterAuthCallback?.(true)).toBe("/auth/set-password");
    expect(flow.destinationAfterAuthCallback?.(false)).toBe("/login?error=link");
  });

  it("preserves the verified email-link fragment through password setup", () => {
    const flow = inviteFlow as unknown as Partial<InviteFlow & {
      passwordSetupUrl: (hash: string) => string;
    }>;

    expect(flow.passwordSetupUrl).toBeTypeOf("function");
    expect(flow.passwordSetupUrl?.("#access_token=token&refresh_token=refresh")).toBe(
      "/auth/set-password#access_token=token&refresh_token=refresh",
    );
  });
});
