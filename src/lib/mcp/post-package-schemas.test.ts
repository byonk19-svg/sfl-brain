import { describe, expect, it } from "vitest";

import {
  createPostPackageToolSchema,
  finishPostPackageToolSchema,
  setPostPackageAssetsToolSchema,
  setPostPackageDestinationsToolSchema,
  skipPostPackageDestinationToolSchema,
  updatePostPackageToolSchema,
  upsertPostPackageCaptionVariantToolSchema,
} from "@/lib/mcp/post-package-schemas";

const ids = {
  request: "a0000000-0000-4000-8000-000000000001",
  opportunity: "a0000000-0000-4000-8000-000000000002",
  package: "a0000000-0000-4000-8000-000000000003",
  variant: "a0000000-0000-4000-8000-000000000004",
  asset: "a0000000-0000-4000-8000-000000000005",
  destination: "a0000000-0000-4000-8000-000000000006",
  item: "a0000000-0000-4000-8000-000000000007",
};
const updatedAt = "2026-09-16T12:00:00.000Z";

describe("Post Package MCP schemas", () => {
  it("requires a UUID request ID for every write", () => {
    expect(() => createPostPackageToolSchema.parse({ opportunity_id: ids.opportunity })).toThrow();
    expect(() => createPostPackageToolSchema.parse({ request_id: "not-a-uuid", opportunity_id: ids.opportunity })).toThrow();
  });

  it("requires fresh optimistic versions and bounded copy", () => {
    expect(() => updatePostPackageToolSchema.parse({
      request_id: ids.request,
      package_id: ids.package,
      expected_updated_at: updatedAt,
      base_caption: "x".repeat(10_001),
      working_angle: null,
      notes: null,
    })).toThrow();
    expect(() => upsertPostPackageCaptionVariantToolSchema.parse({
      request_id: ids.request,
      package_id: ids.package,
      audience: "sfl_page",
      body: "Caption",
      status: "approved",
    })).toThrow(/expected_updated_at/i);
  });

  it("accepts unique ordered assets and rejects duplicate identities or positions", () => {
    const base = { request_id: ids.request, package_id: ids.package, expected_updated_at: updatedAt };
    expect(setPostPackageAssetsToolSchema.parse({ ...base, assets: [
      { asset_id: ids.asset, role: "hero", position: 0 },
    ] }).assets).toHaveLength(1);
    expect(() => setPostPackageAssetsToolSchema.parse({ ...base, assets: [
      { asset_id: ids.asset, role: "hero", position: 0 },
      { asset_id: ids.asset, role: "supporting", position: 1 },
    ] })).toThrow(/once/i);
    expect(() => setPostPackageAssetsToolSchema.parse({ ...base, assets: [
      { asset_id: ids.asset, role: "hero", position: 0 },
      { asset_id: crypto.randomUUID(), role: "supporting", position: 0 },
    ] })).toThrow(/position/i);
  });

  it("requires an exact destination plan and non-empty skip reason", () => {
    const base = { request_id: ids.request, package_id: ids.package, expected_updated_at: updatedAt };
    expect(setPostPackageDestinationsToolSchema.parse({ ...base, destinations: [
      { destination_id: ids.destination, caption_variant_id: ids.variant },
    ] }).destinations).toHaveLength(1);
    expect(() => setPostPackageDestinationsToolSchema.parse({ ...base, destinations: [
      { destination_id: ids.destination, caption_variant_id: ids.variant },
      { destination_id: ids.destination, caption_variant_id: ids.variant },
    ] })).toThrow(/destination/i);
    expect(() => skipPostPackageDestinationToolSchema.parse({
      ...base,
      distribution_item_id: ids.item,
      skip_reason: " ",
    })).toThrow(/skip reason/i);
  });

  it("uses the explicit close or abandon finish action", () => {
    const base = { request_id: ids.request, package_id: ids.package, expected_updated_at: updatedAt };
    expect(finishPostPackageToolSchema.parse({ ...base, action: "close" }).action).toBe("close");
    expect(finishPostPackageToolSchema.parse({ ...base, action: "abandon" }).action).toBe("abandon");
    expect(() => finishPostPackageToolSchema.parse({ ...base, action: "closed" })).toThrow();
  });
});
