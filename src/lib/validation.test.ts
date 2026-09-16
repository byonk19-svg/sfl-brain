import { describe, expect, it } from "vitest";

import {
  createDestinationSchema,
  createPostPackageSchema,
  createOpportunitySchema,
  createProductSchema,
  distributionPlanSchema,
  editOpportunitySchema,
  finishPostPackageSchema,
  packageAssetSelectionSchema,
  placeOpportunityHoldSchema,
  postPackageVariantSchema,
  recordPostFromPackageSchema,
  recordPostFromPackageWebsiteSchema,
  releaseOpportunityHoldSchema,
  skipPostPackageDestinationSchema,
  updateDestinationSchema,
  updatePostPackageSchema,
  updateOpportunityHoldSchema,
  recordPostSchema,
  validateUpload,
} from "@/lib/validation";

describe("form validation", () => {
  it("accepts a ten-second opportunity capture with no product metadata", () => {
    expect(
      createOpportunitySchema.parse({
        title: "  Home Depot hallway light  ",
        status: "needs_assets",
        content_type: "styled_at_home",
        notes: "Take photos later",
      }),
    ).toMatchObject({
      title: "Home Depot hallway light",
      status: "needs_assets",
      content_type: "styled_at_home",
      next_action: "Take pictures",
      product_ids: [],
      asset_ids: [],
    });
  });

  it("defaults a quick capture to an unspecified editorial type", () => {
    expect(
      createOpportunitySchema.parse({ title: "Home Depot hallway light" }),
    ).toMatchObject({ content_type: "unspecified" });
  });

  it("prevents manually declaring unrecorded content as posted", () => {
    expect(() =>
      createOpportunitySchema.parse({
        title: "Old post",
        status: "posted",
        content_type: "standalone_product",
      }),
    ).toThrow(/Record Post/i);
  });

  it("validates stage edits and explicit effort bounds", () => {
    expect(
      editOpportunitySchema.parse({
        id: "90000000-0000-4000-8000-000000000001",
        title: "Hallway light",
        status: "needs_assets",
        content_type: "styled_at_home",
        estimated_minutes_remaining: "30",
      }),
    ).toMatchObject({ estimated_minutes_remaining: 30 });
    expect(() =>
      editOpportunitySchema.parse({
        id: "90000000-0000-4000-8000-000000000001",
        title: "Hallway light",
        status: "needs_assets",
        content_type: "styled_at_home",
        estimated_minutes_remaining: "900",
      }),
    ).toThrow();
  });

  it("accepts a minimal product without asking for listing details", () => {
    expect(
      createProductSchema.parse({
        name: "  Ceramic Bowl  ",
        experience_level: "owned",
        tags: "kitchen, neutral",
      }),
    ).toMatchObject({ name: "Ceramic Bowl", tags: ["kitchen", "neutral"] });
  });

  it("requires complete listing and affiliate dependencies", () => {
    expect(() =>
      createProductSchema.parse({
        name: "Ceramic Bowl",
        experience_level: "owned",
        retailer: "Demo Store",
      }),
    ).toThrow(/canonical URL/i);
    expect(() =>
      createProductSchema.parse({
        name: "Ceramic Bowl",
        experience_level: "owned",
        affiliate_url: "https://affiliate.example/bowl",
      }),
    ).toThrow(/listing/i);
  });

  it("requires a destination and accepts products derived from the opportunity", () => {
    expect(() =>
      recordPostSchema.parse({ destination_id: "", product_ids: [], published_at: "" }),
    ).toThrow();
    expect(
      recordPostSchema.parse({
        content_opportunity_id: "90000000-0000-4000-8000-000000000003",
        destination_id: "20000000-0000-4000-8000-000000000001",
        product_ids: [],
        asset_ids: [],
        published_at: "2026-09-06T14:00:00.000Z",
        performance_label: "unknown",
      }),
    ).toMatchObject({
      content_opportunity_id: "90000000-0000-4000-8000-000000000003",
      performance_label: "unknown",
    });
  });

  it("requires a content opportunity even when products are supplied", () => {
    expect(() =>
      recordPostSchema.parse({
        destination_id: "20000000-0000-4000-8000-000000000001",
        product_ids: ["30000000-0000-4000-8000-000000000001"],
        published_at: "2026-09-06T09:00",
      }),
    ).toThrow(/opportunity/i);
  });

  it("requires a hold reason and release condition with an optional date", () => {
    expect(placeOpportunityHoldSchema.parse({
      opportunity_id: "90000000-0000-4000-8000-000000000001",
      hold_reason: "Affiliate access unavailable",
      release_condition: "Affiliate access becomes available",
      review_on: "2026-10-01",
    })).toMatchObject({ review_on: "2026-10-01" });
    expect(() => placeOpportunityHoldSchema.parse({
      opportunity_id: "90000000-0000-4000-8000-000000000001",
      hold_reason: "",
      release_condition: "",
    })).toThrow();
  });

  it("requires optimistic concurrency for hold edits and releases", () => {
    const common = {
      hold_id: "90000000-0000-4000-8000-000000000001",
      expected_updated_at: "2026-09-13T12:00:00.000Z",
    };
    expect(updateOpportunityHoldSchema.parse({
      ...common,
      hold_reason: "Reason",
      release_condition: "Condition",
    })).toMatchObject(common);
    expect(releaseOpportunityHoldSchema.parse(common)).toMatchObject(common);
  });
});

describe("asset upload validation", () => {
  it("allows supported images and short video formats", () => {
    expect(validateUpload({ name: "room.webp", type: "image/webp", size: 1024 })).toBeNull();
    expect(validateUpload({ name: "reel.mp4", type: "video/mp4", size: 1024 })).toBeNull();
  });

  it("rejects unsupported or oversized files", () => {
    expect(validateUpload({ name: "notes.pdf", type: "application/pdf", size: 1024 })).toMatch(/JPEG/i);
    expect(validateUpload({ name: "huge.mov", type: "video/quicktime", size: 26 * 1024 * 1024 })).toMatch(/25 MB/i);
  });
});

describe("post package validation", () => {
  const uuid = (suffix: number) => `90000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
  const updatedAt = "2026-09-15T12:00:00.000Z";

  it("normalizes package creation and requires optimistic versions for edits", () => {
    expect(createPostPackageSchema.parse({
      opportunity_id: uuid(1),
      base_caption: "  Base copy  ",
    })).toMatchObject({ base_caption: "Base copy" });
    expect(updatePostPackageSchema.parse({
      package_id: uuid(2),
      expected_updated_at: updatedAt,
      base_caption: null,
      working_angle: "Updated angle",
      notes: null,
    })).toMatchObject({
      expected_updated_at: updatedAt,
      base_caption: null,
      working_angle: "Updated angle",
      notes: null,
    });
    expect(() => recordPostSchema.parse({
      content_opportunity_id: "90000000-0000-4000-8000-000000000003",
      destination_id: "20000000-0000-4000-8000-000000000001",
      published_at: "2026-09-06T09:00",
    })).toThrow(/valid publication date/i);
    expect(() => updatePostPackageSchema.parse({
      package_id: uuid(2),
      expected_updated_at: updatedAt,
      base_caption: null,
      working_angle: null,
    })).toThrow();
  });

  it("accepts audience variants and exact destination overrides", () => {
    expect(postPackageVariantSchema.parse({
      package_id: uuid(1),
      expected_updated_at: updatedAt,
      audience: "sfl_groups",
      body: "Caption",
      status: "approved",
    })).toMatchObject({ audience: "sfl_groups" });
    expect(postPackageVariantSchema.parse({
      package_id: uuid(1),
      variant_id: uuid(2),
      expected_updated_at: updatedAt,
      audience: "custom",
      destination_id: uuid(3),
      body: "Exact destination copy",
      status: "draft",
    })).toMatchObject({ destination_id: uuid(3) });
  });

  it("allows only one hero and unique asset positions", () => {
    expect(() => packageAssetSelectionSchema.parse([
      { asset_id: uuid(1), role: "hero", position: 0 },
      { asset_id: uuid(2), role: "hero", position: 1 },
    ])).toThrow(/hero/i);
    expect(() => packageAssetSelectionSchema.parse([
      { asset_id: uuid(1), role: "supporting", position: 0 },
      { asset_id: uuid(2), role: "comparison", position: 0 },
    ])).toThrow(/position/i);
  });

  it("requires unique distribution destinations and explicit caption variants", () => {
    expect(distributionPlanSchema.parse([
      { destination_id: uuid(1), caption_variant_id: uuid(2) },
    ])).toHaveLength(1);
    expect(() => distributionPlanSchema.parse([
      { destination_id: uuid(1), caption_variant_id: uuid(2) },
      { destination_id: uuid(1), caption_variant_id: uuid(3) },
    ])).toThrow(/destination/i);
  });

  it("requires a reason when a planned destination is skipped", () => {
    expect(skipPostPackageDestinationSchema.parse({
      package_id: uuid(1),
      distribution_item_id: uuid(2),
      expected_updated_at: updatedAt,
      skip_reason: "Not suitable for this audience",
    })).toMatchObject({ skip_reason: "Not suitable for this audience" });
    expect(() => skipPostPackageDestinationSchema.parse({
      package_id: uuid(1),
      distribution_item_id: uuid(2),
      expected_updated_at: updatedAt,
      skip_reason: "  ",
    })).toThrow(/reason/i);
  });

  it("accepts only explicit terminal outcomes with an optimistic version", () => {
    expect(finishPostPackageSchema.parse({
      package_id: uuid(1), expected_updated_at: updatedAt, outcome: "closed",
    })).toMatchObject({ outcome: "closed" });
    expect(() => finishPostPackageSchema.parse({
      package_id: uuid(1), outcome: "closed",
    })).toThrow();
  });

  it("reports an invalid package publication date as a normal validation failure", () => {
    expect(recordPostFromPackageSchema.safeParse({
      package_id: uuid(1),
      distribution_item_id: uuid(2),
      expected_updated_at: updatedAt,
      published_at: "not-a-date",
    })).toMatchObject({ success: false });
  });

  it("requires an explicit publication instant and normalizes a Chicago offset", () => {
    const input = {
      package_id: uuid(1),
      distribution_item_id: uuid(2),
      expected_updated_at: updatedAt,
    };

    expect(recordPostFromPackageSchema.safeParse({
      ...input,
      published_at: "2026-09-15T12:30",
    })).toMatchObject({ success: false });
    expect(recordPostFromPackageSchema.parse({
      ...input,
      published_at: "2026-09-15T12:30:00-05:00",
    }).published_at).toBe("2026-09-15T17:30:00.000Z");
  });

  it("rejects manual caption, destination, product, and asset overrides for package publications", () => {
    const publication = {
      opportunity_id: uuid(1),
      package_id: uuid(2),
      distribution_item_id: uuid(3),
      expected_updated_at: updatedAt,
      published_at: "2026-09-15T17:30:00.000Z",
    };

    expect(recordPostFromPackageWebsiteSchema.parse(publication)).toMatchObject({
      package_id: uuid(2),
      distribution_item_id: uuid(3),
    });
    for (const override of [
      { caption_override: "Different copy" },
      { destination_override: uuid(4) },
      { product_override_ids: [uuid(5)] },
      { asset_override_ids: [uuid(6)] },
    ]) {
      expect(() => recordPostFromPackageWebsiteSchema.parse({ ...publication, ...override }))
        .toThrow(/approved caption, destination, products, and ordered assets/i);
    }
  });

  it("validates destination creation and versioned updates", () => {
    expect(createDestinationSchema.parse({
      name: " Groups ", platform: " facebook_group ", posting_identity: " Elaine ",
    })).toMatchObject({ name: "Groups", platform: "facebook_group", is_active: true });
    expect(updateDestinationSchema.parse({
      id: uuid(1), name: "Groups", platform: "facebook_group",
      posting_identity: "Elaine", is_active: false,
    })).toMatchObject({ is_active: false });
    expect(() => createDestinationSchema.parse({
      name: "Unknown", platform: "made_up_network", posting_identity: "Elaine",
    })).toThrow();
  });
});
