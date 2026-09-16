import { describe, expect, it } from "vitest";

import * as route from "./route";

describe("MCP Next route contract", () => {
  it("exports only supported Next route handlers and configuration", () => {
    expect(Object.keys(route).sort()).toEqual([
      "DELETE",
      "GET",
      "POST",
      "dynamic",
    ]);
  });

  it("exposes the supported MCP HTTP methods", () => {
    expect(route.GET).toBeTypeOf("function");
    expect(route.POST).toBeTypeOf("function");
    expect(route.DELETE).toBeTypeOf("function");
  });
});
