import { describe, expect, it } from "vitest";

import {
  canFinishPackage,
  copyBaseCaption,
  sortPackageAssets,
  sourceLabel,
} from "@/lib/post-package";

describe("post package domain", () => {
  it("requires every publishing destination to be resolved before closing", () => {
    expect(
      canFinishPackage({ status: "publishing", items: [{ status: "planned" }] }),
    ).toBe(false);
    expect(
      canFinishPackage({
        status: "publishing",
        items: [{ status: "published" }, { status: "skipped" }],
      }),
    ).toBe(true);
    expect(canFinishPackage({ status: "draft", items: [] })).toBe(false);
  });

  it("copies a trimmed base caption without retaining live inheritance", () => {
    const baseCaption = "  Caption text  ";
    const copied = copyBaseCaption(baseCaption);
    expect(copied).toBe("Caption text");
    expect(copyBaseCaption("   ")).toBe("");
  });

  it("orders selected assets by position without mutating the input", () => {
    const assets = [
      { asset_id: "b", position: 1 },
      { asset_id: "a", position: 0 },
    ];
    expect(sortPackageAssets(assets).map((asset) => asset.asset_id)).toEqual(["a", "b"]);
    expect(assets[0]?.asset_id).toBe("b");
  });

  it("provides human-readable mutation source labels", () => {
    expect(sourceLabel("website")).toBe("Website");
    expect(sourceLabel("chatgpt_connector")).toBe("ChatGPT");
    expect(sourceLabel("development_tunnel")).toBe("Development tunnel");
    expect(sourceLabel("migration")).toBe("Migration");
  });
});
