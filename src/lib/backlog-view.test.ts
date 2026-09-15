import { describe, expect, it } from "vitest";

import { backlogRowClassName, opportunityScopeForBacklogView } from "./backlog-view";

describe("opportunityScopeForBacklogView", () => {
  it("keeps the ordinary backlog limited to active work", () => {
    expect(opportunityScopeForBacklogView("backlog", "")).toBe("active");
  });

  it("includes held opportunities in an explicit backlog search", () => {
    expect(opportunityScopeForBacklogView("backlog", "Arhaus")).toBe("all");
  });

  it("keeps the On hold view limited to held work", () => {
    expect(opportunityScopeForBacklogView("on-hold", "Arhaus")).toBe("on_hold");
  });

  it("marks held rows so responsive layouts retain their hold facts", () => {
    expect(backlogRowClassName(true)).toBe("backlog-row is-held");
    expect(backlogRowClassName(false)).toBe("backlog-row");
  });
});
