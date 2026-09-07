import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const endpoint = new URL(process.env.SFL_MCP_URL ?? "http://127.0.0.1:3000/mcp");
const client = new Client({ name: "sfl-brain-smoke", version: "0.1.0" });

try {
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  const listed = await client.listTools();
  const expected = [
    "get_today_candidates",
    "search_sfl_library",
    "get_product_context",
    "get_recent_posts",
    "get_revival_events",
  ];
  const names = listed.tools.map((tool) => tool.name);
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected MCP tools: ${names.join(", ")}`);
  }
  if (listed.tools.some((tool) => !tool.annotations?.readOnlyHint || tool.annotations?.openWorldHint !== false)) {
    throw new Error("Every MCP tool must be read-only and closed-world");
  }

  const today = await client.callTool({ name: "get_today_candidates", arguments: { limit: 5 } });
  if (today.isError || !Array.isArray(today.structuredContent?.candidates)) {
    throw new Error("get_today_candidates did not return structured candidates");
  }
  const first = today.structuredContent.candidates[0];
  const firstProductId = first.product_summary?.[0]?.id;
  if (!first.opportunity_id || !firstProductId) {
    throw new Error("Top opportunity did not include its content and product context");
  }
  const product = await client.callTool({
    name: "get_product_context",
    arguments: { product_id: firstProductId },
  });
  if (product.isError || !product.structuredContent?.product) {
    throw new Error("get_product_context did not return structured product context");
  }
  if (!Array.isArray(product.structuredContent.product.content_opportunity_products)) {
    throw new Error("Product context did not include related content opportunities");
  }
  const search = await client.callTool({
    name: "search_sfl_library",
    arguments: { query: "chair", limit: 10 },
  });
  const recent = await client.callTool({
    name: "get_recent_posts",
    arguments: { days: 90, content_opportunity_id: first.opportunity_id },
  });
  const revival = await client.callTool({
    name: "get_revival_events",
    arguments: { active_only: true, limit: 10 },
  });
  if (
    search.isError ||
    !Array.isArray(search.structuredContent?.opportunities) ||
    !Array.isArray(search.structuredContent?.products)
  ) {
    throw new Error("search_sfl_library did not return both structured result sets");
  }
  if (recent.isError || !Array.isArray(recent.structuredContent?.posts)) {
    throw new Error("get_recent_posts did not return structured posts");
  }
  if (revival.isError || !Array.isArray(revival.structuredContent?.events)) {
    throw new Error("get_revival_events did not return structured events");
  }
  if (
    recent.structuredContent.posts.length > 0 &&
    !recent.structuredContent.posts[0].content_opportunities
  ) {
    throw new Error("Recent post did not include its content opportunity");
  }
  if (!JSON.stringify(revival.structuredContent.events).includes("content_opportunities")) {
    throw new Error("Revival events did not include affected opportunities");
  }

  console.log(`MCP tools: ${names.join(", ")}`);
  console.log(`Top opportunity: ${first.title}`);
  console.log(`Product context: ${product.structuredContent.product.name}`);
  console.log(`Opportunity matches: ${search.structuredContent.opportunities.length}`);
  console.log(`Product matches: ${search.structuredContent.products.length}`);
  console.log(`Recent posts: ${recent.structuredContent.posts.length}`);
  console.log(`Active revival events: ${revival.structuredContent.events.length}`);
} finally {
  await Promise.race([
    client.close(),
    new Promise((resolve) => setTimeout(resolve, 1_000)),
  ]);
}

process.exit(0);
