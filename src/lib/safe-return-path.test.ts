import { describe, expect, it } from "vitest";

import { safeReturnPath } from "@/lib/safe-return-path";

describe("safe local return paths", () => {
  it("preserves a local path with query and fragment", () => {
    expect(safeReturnPath("/oauth/consent?authorization_id=abc#review", "/today")).toBe(
      "/oauth/consent?authorization_id=abc#review",
    );
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "javascript:alert(1)",
    "oauth/consent",
    "",
  ])("rejects unsafe return path %s", (value) => {
    expect(safeReturnPath(value, "/today")).toBe("/today");
  });
});
