import { describe, expect, it } from "vitest";

import {
  createProductSchema,
  recordPostSchema,
  validateUpload,
} from "@/lib/validation";

describe("form validation", () => {
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

  it("requires a destination and at least one product when recording a post", () => {
    expect(() =>
      recordPostSchema.parse({ destination_id: "", product_ids: [], published_at: "" }),
    ).toThrow();
    expect(
      recordPostSchema.parse({
        destination_id: "20000000-0000-4000-8000-000000000001",
        product_ids: ["30000000-0000-4000-8000-000000000001"],
        asset_ids: [],
        published_at: "2026-09-06T09:00",
        performance_label: "unknown",
      }),
    ).toMatchObject({ performance_label: "unknown" });
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
