import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createSflMcpServer, type BrainReader } from "@/lib/mcp/server";

const candidate = {
  product_id: "30000000-0000-4000-8000-000000000001",
  name: "Brown Swivel Chair",
  score: 125,
  candidate_type: "revival" as const,
  estimated_effort_minutes: 5 as const,
  requires_new_photos: false,
  reasons: [{ code: "radar_restock", label: "Back in stock", points: 40 }],
  last_posted_at: "2026-07-22T12:00:00.000Z",
  active_radar_events: [
    { id: "event", event_type: "restock" as const, happened_at: "2026-09-05T12:00:00Z" },
  ],
  asset_summary: { total: 2, unused: 1, types: ["photo"] },
  primary_listing: {
    id: "listing",
    retailer: "Demo Target",
    current_price: 249.99,
    currency: "USD",
    stock_status: "in_stock" as const,
  },
  active_affiliate_links: [{ id: "link", network: "later_creator", url: "https://affiliate.example/chair" }],
  previous_performance: { post_count: 1, has_winner: true, best_label: "winner" as const },
};

describe("SFL Brain MCP server", () => {
  let client: Client;
  let server: ReturnType<typeof createSflMcpServer>;

  beforeEach(async () => {
    const reader: BrainReader = {
      getTodayCandidates: async () => [candidate],
      searchLibrary: async () => [{ id: candidate.product_id, name: candidate.name }],
      getProductContext: async (id) => ({ id, name: candidate.name, assets: [{ id: "asset", title: "Chair photo" }] }),
      getRecentPosts: async () => [{ id: "post", published_at: "2026-09-01T12:00:00Z" }],
      getRevivalEvents: async () => [{ id: "event", event_type: "restock", product: { id: candidate.product_id, name: candidate.name } }],
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
        expect.objectContaining({ type: "text", text: expect.stringContaining("Brown Swivel Chair") }),
      ]),
    );
    expect(result.structuredContent).toEqual({ candidates: [candidate] });
  });

  it("does not expose storage paths from product context", async () => {
    const result = await client.callTool({
      name: "get_product_context",
      arguments: { product_id: candidate.product_id },
    });

    expect(JSON.stringify(result.structuredContent)).not.toContain("storage_path");
    expect(result.structuredContent).toMatchObject({ product: { id: candidate.product_id } });
  });
});
