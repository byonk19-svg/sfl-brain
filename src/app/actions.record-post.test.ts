import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brain: {
    recordPost: vi.fn(),
    recordPostFromPackage: vi.fn(),
  },
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/website-auth", () => ({
  createWebsiteBrainService: vi.fn(async () => mocks.brain),
}));

import { recordPostAction } from "@/app/actions";

const opportunityId = "90000000-0000-4000-8000-000000000001";
const packageId = "90000000-0000-4000-8000-000000000002";
const distributionId = "90000000-0000-4000-8000-000000000003";
const destinationId = "90000000-0000-4000-8000-000000000004";
const authoritativeOpportunityId = "90000000-0000-4000-8000-000000000009";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordPostAction", () => {
  it("records a package publication with only package-owned snapshot identifiers", async () => {
    mocks.brain.recordPostFromPackage.mockResolvedValue({
      id: "90000000-0000-4000-8000-000000000008",
      content_opportunity_id: authoritativeOpportunityId,
      post_package_id: packageId,
      caption_variant_id: "90000000-0000-4000-8000-000000000007",
      distribution_item_id: distributionId,
      package_updated_at: "2026-09-15T12:31:00.000Z",
    });
    const form = new FormData();
    form.set("content_opportunity_id", opportunityId);
    form.set("package_id", packageId);
    form.set("distribution_item_id", distributionId);
    form.set("expected_updated_at", "2026-09-15T12:00:00.000Z");
    form.set("published_at", "2026-09-15T17:30:00.000Z");
    form.set("notes", "Published from website");

    await expect(recordPostAction(form)).rejects.toMatchObject({
      url: expect.stringContaining(`/opportunities/${authoritativeOpportunityId}?success=`),
    });
    expect(mocks.brain.recordPostFromPackage).toHaveBeenCalledWith({
      package_id: packageId,
      distribution_item_id: distributionId,
      expected_updated_at: "2026-09-15T12:00:00.000Z",
      published_at: "2026-09-15T17:30:00.000Z",
      notes: "Published from website",
    });
    expect(mocks.brain.recordPost).not.toHaveBeenCalled();
  });

  it("rejects manual overrides instead of silently mixing them into a package publication", async () => {
    const form = new FormData();
    form.set("content_opportunity_id", opportunityId);
    form.set("package_id", packageId);
    form.set("distribution_item_id", distributionId);
    form.set("expected_updated_at", "2026-09-15T12:00:00.000Z");
    form.set("published_at", "2026-09-15T17:30:00.000Z");
    form.set("caption", "Unapproved override");
    form.set("asset_ids", "90000000-0000-4000-8000-000000000005");

    await expect(recordPostAction(form)).rejects.toMatchObject({
      url: expect.stringContaining("/record-post?error="),
    });
    expect(mocks.brain.recordPostFromPackage).not.toHaveBeenCalled();
    expect(mocks.brain.recordPost).not.toHaveBeenCalled();
  });

  it("preserves the manual legacy Record Post path when no distribution item is supplied", async () => {
    const form = new FormData();
    form.set("content_opportunity_id", opportunityId);
    form.set("destination_id", destinationId);
    form.set("published_at", "2026-09-15T17:30:00.000Z");
    form.set("caption", "Manual legacy post");
    form.set("performance_label", "unknown");

    await expect(recordPostAction(form)).rejects.toMatchObject({
      url: expect.stringContaining("/today?success="),
    });
    expect(mocks.brain.recordPost).toHaveBeenCalledWith(expect.objectContaining({
      content_opportunity_id: opportunityId,
      destination_id: destinationId,
      caption: "Manual legacy post",
    }));
    expect(mocks.brain.recordPostFromPackage).not.toHaveBeenCalled();
  });
});
