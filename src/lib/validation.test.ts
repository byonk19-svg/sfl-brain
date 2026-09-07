import { describe, expect, it } from "vitest";

import {
  createOpportunitySchema,
  createProductSchema,
  editOpportunitySchema,
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
        published_at: "2026-09-06T09:00",
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
