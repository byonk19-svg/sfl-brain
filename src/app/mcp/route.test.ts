import { describe, expect, it } from "vitest";

import * as route from "./route";

type RouteWithMcpGate = {
  servesMcpHttp: (environment?: { VERCEL?: string }) => boolean;
};

describe("MCP HTTP hosting boundary", () => {
  it("blocks HTTP MCP on Vercel while preserving local MCP", () => {
    const guardedRoute = route as unknown as Partial<RouteWithMcpGate>;

    expect(guardedRoute.servesMcpHttp).toBeTypeOf("function");

    expect(guardedRoute.servesMcpHttp?.({ VERCEL: "1" })).toBe(false);
    expect(guardedRoute.servesMcpHttp?.({})).toBe(true);
  });
});
