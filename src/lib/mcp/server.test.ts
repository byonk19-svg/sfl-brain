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
      getOpportunityContext: async (id) => ({ id, title: candidate.title, content_type: candidate.content_type, content_opportunity_assets: [{ assets: { id: "asset", storage_path: "private/chair.jpg", signed_url: "https://example.test/signed" } }] }),
      getPostPackageContext: async (id) => ({ opportunity_id: id, active_package: null, prior_packages: [] }),
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

  it("registers the nine read-only tools locally", async () => {
    const listed = await client.listTools();

    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "get_today_candidates",
      "get_available_destinations",
      "get_on_hold_opportunities",
      "get_post_package_context",
      "search_sfl_library",
      "get_product_context",
      "get_content_opportunity_context",
      "get_recent_posts",
      "get_revival_events",
    ]);
    for (const tool of listed.tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    }
  });

  it("keeps Post Package writes out of legacy local pilot-write mode", async () => {
    const reader: BrainReader = {
      getTodayCandidates: async () => [],
      searchContentBacklog: async () => [],
      searchLibrary: async () => [],
      getProductContext: async () => null,
      getOpportunityContext: async () => null,
      getPostPackageContext: async (id) => ({ opportunity_id: id, active_package: null, prior_packages: [] }),
      getRecentPosts: async () => [],
      getRevivalEvents: async () => [],
    };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const hostedClient = new Client({ name: "local-pilot-client", version: "1.0.0" });
    const hostedServer = createSflMcpServer(reader, { enablePilotWrites: true });
    await hostedServer.connect(serverTransport);
    await hostedClient.connect(clientTransport);

    try {
      const tools = (await hostedClient.listTools()).tools;
      expect(tools.filter((tool) => tool.annotations?.readOnlyHint === false).map((tool) => tool.name)).toEqual([
        "create_content_opportunity",
        "update_content_opportunity",
        "record_post",
        "place_content_opportunity_on_hold",
        "update_content_opportunity_hold",
        "release_content_opportunity_hold",
      ]);
      expect(tools.map((tool) => tool.name)).not.toContain("create_post_package");
      expect(tools.map((tool) => tool.name)).not.toContain("finish_post_package");
      expect(tools.map((tool) => tool.name)).not.toContain("create_development_test_opportunity");
    } finally {
      await hostedClient.close();
      await hostedServer.close();
    }
  });

  it("adds Post Package writes only with hosted package enablement", async () => {
    const reader: BrainReader = {
      getTodayCandidates: async () => [],
      searchContentBacklog: async () => [],
      searchLibrary: async () => [],
      getProductContext: async () => null,
      getOpportunityContext: async () => null,
      getPostPackageContext: async (id) => ({ opportunity_id: id, active_package: null, prior_packages: [] }),
      getRecentPosts: async () => [],
      getRevivalEvents: async () => [],
    };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const hostedClient = new Client({ name: "hosted-sfl-client", version: "1.0.0" });
    const hostedServer = createSflMcpServer(reader, {
      enablePilotWrites: true,
      enablePostPackageWrites: true,
      trustedStorageOrigin: "https://project.supabase.co",
    });
    await hostedServer.connect(serverTransport);
    await hostedClient.connect(clientTransport);
    try {
      const writable = (await hostedClient.listTools()).tools
        .filter((tool) => tool.annotations?.readOnlyHint === false)
        .map((tool) => tool.name);
      expect(writable).toEqual([
        "create_content_opportunity",
        "update_content_opportunity",
        "record_post",
        "place_content_opportunity_on_hold",
        "update_content_opportunity_hold",
        "release_content_opportunity_hold",
        "create_post_package",
        "update_post_package",
        "upsert_post_package_caption_variant",
        "set_post_package_assets",
        "set_post_package_destinations",
        "skip_post_package_destination",
        "finish_post_package",
      ]);
    } finally {
      await hostedClient.close();
      await hostedServer.close();
    }
  });

  it("re-reads and sanitizes saved package state after a confirmed write", async () => {
    const calls: string[] = [];
    const opportunityId = candidate.opportunity_id;
    const packageId = "a0000000-0000-4000-8000-000000000003";
    let includeSavedPackage = true;
    const reader: BrainReader = {
      getTodayCandidates: async () => [],
      searchContentBacklog: async () => [],
      searchLibrary: async () => [],
      getProductContext: async () => null,
      getOpportunityContext: async () => null,
      getPostPackageContext: async (id) => ({ opportunity_id: id, active_package: null, prior_packages: [] }),
      getPostPackageContextByPackage: async (id) => {
        calls.push(`read-package:${id}`);
        return {
          opportunity_id: opportunityId,
          active_package: includeSavedPackage ? {
            id: packageId,
            storage_path: "private/secret.jpg",
            created_by: "internal-user-id",
            access_token: "credential-must-not-leak",
            assets: [
              { asset: { signed_url: "https://project.supabase.co/storage/v1/object/sign/sfl-assets/folder/good.jpg?token=signed-jwt" } },
              { asset: { signed_url: "https://other.supabase.co/storage/v1/object/sign/sfl-assets/folder/bad.jpg?token=signed-jwt" } },
              { asset: { signed_url: "https://project.supabase.co/storage/v1/object/sign/sfl-assets/folder/missing-token.jpg" } },
              { asset: { signed_url: "http://project.supabase.co/storage/v1/object/sign/sfl-assets/folder/insecure.jpg?token=signed-jwt" } },
            ],
          } : null,
          prior_packages: [],
        } as never;
      },
      getRecentPosts: async () => [],
      getRevivalEvents: async () => [],
      createPostPackage: async () => {
        calls.push("write");
        return { id: packageId, opportunity_id: opportunityId } as never;
      },
    };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const hostedClient = new Client({ name: "package-write-client", version: "1.0.0" });
    const hostedServer = createSflMcpServer(reader, {
      enablePostPackageWrites: true,
      trustedStorageOrigin: "https://project.supabase.co",
    });
    await hostedServer.connect(serverTransport);
    await hostedClient.connect(clientTransport);

    try {
      const result = await hostedClient.callTool({
        name: "create_post_package",
        arguments: {
          request_id: "a0000000-0000-4000-8000-000000000001",
          opportunity_id: opportunityId,
          base_caption: "Caption",
        },
      });
      expect(calls).toEqual(["write", `read-package:${packageId}`]);
      expect(result.structuredContent).toMatchObject({
        post_package_context: { opportunity_id: opportunityId },
      });
      const serialized = JSON.stringify(result.structuredContent);
      expect(serialized).not.toContain("storage_path");
      expect(serialized).not.toContain("created_by");
      expect(serialized).not.toContain("credential-must-not-leak");
      expect(result.structuredContent).toMatchObject({
        post_package_context: {
          active_package: {
            assets: [
              { asset: { signed_url: expect.stringContaining("?token=signed-jwt") } },
              { asset: { signed_url: null } },
              { asset: { signed_url: null } },
              { asset: { signed_url: null } },
            ],
          },
        },
      });

      includeSavedPackage = false;
      const unverified = await hostedClient.callTool({
        name: "create_post_package",
        arguments: {
          request_id: "a0000000-0000-4000-8000-000000000002",
          opportunity_id: opportunityId,
        },
      });
      expect(unverified.isError).toBe(true);
      expect(unverified.content).toEqual(expect.arrayContaining([
        expect.objectContaining({ text: expect.stringMatching(/could not be verified/i) }),
      ]));
    } finally {
      await hostedClient.close();
      await hostedServer.close();
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

  it("returns sanitized complete context for a content opportunity", async () => {
    const result = await client.callTool({
      name: "get_content_opportunity_context",
      arguments: { opportunity_id: candidate.opportunity_id },
    });

    expect(result.structuredContent).toMatchObject({
      opportunity: { id: candidate.opportunity_id, title: candidate.title },
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain("storage_path");
    expect(JSON.stringify(result.structuredContent)).toContain("signed_url");
  });

  it("exposes an idempotent development test writer only when explicitly enabled", async () => {
    let calls = 0;
    const requestId = "a0000000-0000-4000-8000-000000000001";
    const reader: BrainReader = {
      getTodayCandidates: async () => [candidate],
      searchContentBacklog: async () => [],
      searchLibrary: async () => [],
      getProductContext: async () => null,
      getOpportunityContext: async () => null,
      getPostPackageContext: async (id) => ({ opportunity_id: id, active_package: null, prior_packages: [] }),
      getRecentPosts: async () => [],
      getRevivalEvents: async () => [],
      createDevelopmentTestOpportunity: async () => {
        calls++;
        return "development-test-opportunity";
      },
    };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const developmentClient = new Client({ name: "sfl-development-test-client", version: "1.0.0" });
    const developmentServer = createSflMcpServer(reader, {
      enableDevelopmentTestWrite: true,
    });
    await developmentServer.connect(serverTransport);
    await developmentClient.connect(clientTransport);

    try {
      expect((await developmentClient.listTools()).tools.map((tool) => tool.name)).toContain(
        "create_development_test_opportunity",
      );
      const first = await developmentClient.callTool({
        name: "create_development_test_opportunity",
        arguments: { request_id: requestId },
      });
      const retry = await developmentClient.callTool({
        name: "create_development_test_opportunity",
        arguments: { request_id: requestId },
      });

      expect(first.structuredContent).toEqual({
        opportunity: expect.objectContaining({
          id: "development-test-opportunity",
        }),
      });
      expect(retry.structuredContent).toEqual(first.structuredContent);
      expect(calls).toBe(2);
      expect((await developmentClient.listTools()).tools.find(
        (tool) => tool.name === "create_development_test_opportunity",
      )?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      });
    } finally {
      await developmentClient.close();
      await developmentServer.close();
    }
  });
});
