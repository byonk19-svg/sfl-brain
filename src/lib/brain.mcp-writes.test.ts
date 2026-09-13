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
});
