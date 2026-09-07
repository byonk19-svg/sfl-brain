import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createSflMcpServer, type BrainReader } from "@/lib/mcp/server";

const candidate = {
  opportunity_id: "90000000-0000-4000-8000-000000000009",
  title: "Walmart swivel chair",
  status: "revival_candidate" as const,
  content_type: "sale_restock" as const,
  media_format: "single_image" as const,
  score: 150,
  candidate_type: "revival" as const,
  estimated_effort_minutes: 10,
  requires_new_photos: false,
  next_action: "Refresh the caption",
  notes: "Previously published winner with a current restock reason.",
  reasons: [{ code: "radar_restock", label: "Back in stock", points: 40 }],
  last_published_at: "2026-07-22T12:00:00.000Z",
  active_radar_events: [
    { id: "event", event_type: "restock" as const, happened_at: "2026-09-05T12:00:00Z", product_name: "Brown Swivel Chair" },
  ],
  asset_summary: { total: 2, unused: 1, types: ["photo"] },
  product_summary: [{ id: "30000000-0000-4000-8000-000000000001", name: "Brown Swivel Chair", role: "primary" as const, retailer: "Demo Walmart", stock_status: "in_stock" as const }],
  link_summary: { active: 1, networks: ["later_creator"] },
  publication_summary: { post_count: 1, destination_count: 1, has_winner: true },
};

describe("SFL Brain MCP server", () => {
  let client: Client;
  let server: ReturnType<typeof createSflMcpServer>;

  beforeEach(async () => {
    const reader: BrainReader = {
      getTodayCandidates: async () => [candidate],
      searchContentBacklog: async () => [{ id: candidate.opportunity_id, title: candidate.title }],
      searchLibrary: async () => [{ id: candidate.product_summary[0].id, name: candidate.product_summary[0].name }],
      getProductContext: async (id) => ({ id, name: candidate.product_summary[0].name, assets: [{ id: "asset", title: "Chair photo" }] }),
      getRecentPosts: async () => [{ id: "post", published_at: "2026-09-01T12:00:00Z" }],
      getRevivalEvents: async () => [{ id: "event", event_type: "restock", product: { id: candidate.product_summary[0].id, name: candidate.product_summary[0].name } }],
    };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "sfl-test-client", version: "1.0.0" });
    server = createSflMcpServer(reader);
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("registers exactly the five read-only, closed-world tools", async () => {
    const listed = await client.listTools();

    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "get_today_candidates",
      "search_sfl_library",
      "get_product_context",
      "get_recent_posts",
      "get_revival_events",
    ]);
    for (const tool of listed.tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    }
  });

  it("validates tool input schemas", async () => {
    const result = await client.callTool({
      name: "get_today_candidates",
      arguments: { max_effort_minutes: -1, limit: 0 },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "text" })]),
    );
  });

  it("returns readable text and structured output", async () => {
    const result = await client.callTool({
      name: "get_today_candidates",
      arguments: { no_new_photos: true, limit: 5 },
    });

    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: expect.stringContaining("Walmart swivel chair") }),
      ]),
    );
    expect(result.structuredContent).toEqual({ candidates: [candidate] });
  });

  it("searches content opportunities and underlying products together", async () => {
    const result = await client.callTool({
      name: "search_sfl_library",
      arguments: { query: "chair", limit: 10 },
    });

    expect(result.structuredContent).toEqual({
      opportunities: [{ id: candidate.opportunity_id, title: candidate.title }],
      products: [{ id: candidate.product_summary[0].id, name: candidate.product_summary[0].name }],
    });
  });

  it("does not expose storage paths from product context", async () => {
    const result = await client.callTool({
      name: "get_product_context",
      arguments: { product_id: candidate.product_summary[0].id },
    });

    expect(JSON.stringify(result.structuredContent)).not.toContain("storage_path");
    expect(result.structuredContent).toMatchObject({ product: { id: candidate.product_summary[0].id } });
  });
});
