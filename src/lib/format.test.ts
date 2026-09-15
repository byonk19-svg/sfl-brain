import { describe, expect, it } from "vitest";

import { formatDateOnly } from "@/lib/format";

describe("formatDateOnly", () => {
  it("preserves the recorded calendar date without timezone drift", () => {
    expect(formatDateOnly("2026-09-13")).toBe("Sep 13, 2026");
  });

  it("handles missing and invalid date-only values", () => {
    expect(formatDateOnly(null)).toBe("Never");
    expect(formatDateOnly("not-a-date")).toBe("Unknown");
  });
});
