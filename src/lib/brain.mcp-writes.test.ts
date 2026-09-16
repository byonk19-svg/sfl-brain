import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { BrainService } from "@/lib/brain";

const requestId = "a0000000-0000-4000-8000-000000000001";
const opportunityId = "a0000000-0000-4000-8000-000000000002";
const destinationId = "a0000000-0000-4000-8000-000000000003";

function service() {
  const rpc = vi.fn().mockResolvedValue({ data: { opportunity_id: opportunityId }, error: null });
  const brain = new BrainService(
    { rpc } as unknown as SupabaseClient,
    "workspace-a",
    { userId: "user-a", source: "chatgpt_connector" },
  );
  return { brain, rpc };
}

describe("audited conversational writes", () => {
  it("passes actor identity to content-opportunity creation", async () => {
    const { brain, rpc } = service();
    await brain.createPilotContentOpportunity({
      request_id: requestId,
      title: "Corinne box refresh",
      status: "idea",
      content_type: "comparison",
    });
    expect(rpc).toHaveBeenCalledWith("create_mcp_content_opportunity", expect.objectContaining({
      p_actor_user_id: "user-a",
      p_source: "chatgpt_connector",
    }));
  });

  it("passes actor identity to content-opportunity updates", async () => {
    const { brain, rpc } = service();
    await brain.updatePilotContentOpportunity({
      request_id: requestId,
      opportunity_id: opportunityId,
      expected_updated_at: "2026-09-13T12:00:00.000Z",
      status: "ready",
    });
    expect(rpc).toHaveBeenCalledWith("update_mcp_content_opportunity", expect.objectContaining({
      p_actor_user_id: "user-a",
      p_source: "chatgpt_connector",
    }));
  });

  it("passes actor identity to publication recording", async () => {
    const { brain, rpc } = service();
    await brain.recordPilotPost({
      request_id: requestId,
      opportunity_id: opportunityId,
      destination_id: destinationId,
      published_at: "2026-09-13T12:00:00.000Z",
      asset_ids: [],
      performance_label: "unknown",
    });
    expect(rpc).toHaveBeenCalledWith("record_mcp_post", expect.objectContaining({
      p_actor_user_id: "user-a",
      p_source: "chatgpt_connector",
    }));
  });

  it("passes request and actor context to hold placement", async () => {
    const { brain, rpc } = service();
    await brain.placeContentOpportunityOnHold({
      opportunity_id: opportunityId,
      request_id: requestId,
      hold_reason: "Affiliate access unavailable",
      release_condition: "Affiliate access becomes available",
      review_on: null,
    });
    expect(rpc).toHaveBeenCalledWith("place_content_opportunity_on_hold", expect.objectContaining({
      p_actor_user_id: "user-a",
      p_source: "chatgpt_connector",
      p_request_id: requestId,
    }));
  });

  it("passes optimistic concurrency to hold updates and releases", async () => {
    const { brain, rpc } = service();
    await brain.updateContentOpportunityHold({
      hold_id: "a0000000-0000-4000-8000-000000000004",
      request_id: requestId,
      expected_updated_at: "2026-09-13T12:00:00.000Z",
      hold_reason: "Updated reason",
      release_condition: "Updated condition",
      review_on: "2026-10-01",
    });
    await brain.releaseContentOpportunityHold({
      hold_id: "a0000000-0000-4000-8000-000000000004",
      request_id: requestId,
      expected_updated_at: "2026-09-13T12:00:00.000Z",
      release_note: "Condition met",
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "update_content_opportunity_hold", expect.objectContaining({
      p_expected_updated_at: "2026-09-13T12:00:00.000Z",
      p_source: "chatgpt_connector",
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, "release_content_opportunity_hold", expect.objectContaining({
      p_expected_updated_at: "2026-09-13T12:00:00.000Z",
      p_source: "chatgpt_connector",
    }));
  });

  it("passes connector request, actor, and optimistic context to package writes", async () => {
    const { brain, rpc } = service();
    const packageId = "a0000000-0000-4000-8000-000000000004";
    const variantId = "a0000000-0000-4000-8000-000000000005";
    const assetId = "a0000000-0000-4000-8000-000000000006";
    const distributionItemId = "a0000000-0000-4000-8000-000000000007";
    const updatedAt = "2026-09-16T12:00:00.000Z";
    await brain.createPostPackage({ request_id: requestId, opportunity_id: opportunityId });
    await brain.updatePostPackage({ request_id: requestId, package_id: packageId, expected_updated_at: updatedAt, base_caption: "Caption", working_angle: null, notes: null });
    await brain.upsertPostPackageVariant({ request_id: requestId, package_id: packageId, expected_updated_at: updatedAt, audience: "sfl_page", body: "Caption", status: "approved" });
    await brain.setPostPackageAssets({ request_id: requestId, package_id: packageId, expected_updated_at: updatedAt, assets: [{ asset_id: assetId, role: "hero", position: 0 }] });
    await brain.setPostPackageDestinations({ request_id: requestId, package_id: packageId, expected_updated_at: updatedAt, destinations: [{ destination_id: destinationId, caption_variant_id: variantId }] });
    await brain.skipPostPackageDestination({ request_id: requestId, package_id: packageId, distribution_item_id: distributionItemId, expected_updated_at: updatedAt, skip_reason: "Not relevant today" });
    await brain.finishPostPackage({ request_id: requestId, package_id: packageId, expected_updated_at: updatedAt, outcome: "closed" });

    expect(rpc).toHaveBeenNthCalledWith(1, "create_post_package", expect.objectContaining({
      p_request_id: requestId,
      p_actor_user_id: "user-a",
      p_source: "chatgpt_connector",
    }));
    expect(rpc).toHaveBeenNthCalledWith(2, "update_post_package", expect.objectContaining({
      p_expected_updated_at: updatedAt,
      p_actor_user_id: "user-a",
      p_source: "chatgpt_connector",
    }));
    expect(rpc).toHaveBeenNthCalledWith(3, "upsert_post_package_caption_variant", expect.objectContaining({
      p_request_id: requestId,
      p_actor_user_id: "user-a",
      p_source: "chatgpt_connector",
    }));
    expect(rpc).toHaveBeenNthCalledWith(4, "set_post_package_assets", expect.objectContaining({
      p_request_id: requestId,
      p_expected_updated_at: updatedAt,
    }));
    expect(rpc).toHaveBeenNthCalledWith(5, "set_post_package_destinations", expect.objectContaining({
      p_request_id: requestId,
      p_expected_updated_at: updatedAt,
    }));
    expect(rpc).toHaveBeenNthCalledWith(6, "skip_post_package_destination", expect.objectContaining({
      p_request_id: requestId,
      p_distribution_item_id: distributionItemId,
    }));
    expect(rpc).toHaveBeenNthCalledWith(7, "finish_post_package", expect.objectContaining({
      p_outcome: "closed",
      p_request_id: requestId,
    }));
  });
});
