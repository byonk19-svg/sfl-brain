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
  const product = await client.callTool({
    name: "get_product_context",
    arguments: { product_id: first.product_id },
  });
  if (product.isError || !product.structuredContent?.product) {
    throw new Error("get_product_context did not return structured product context");
  }
  const search = await client.callTool({
    name: "search_sfl_library",
    arguments: { query: "chair", limit: 10 },
  });
  const recent = await client.callTool({
    name: "get_recent_posts",
    arguments: { days: 90, product_id: first.product_id },
  });
  const revival = await client.callTool({
    name: "get_revival_events",
    arguments: { active_only: true, limit: 10 },
  });
  if (search.isError || !Array.isArray(search.structuredContent?.products)) {
    throw new Error("search_sfl_library did not return structured products");
  }
  if (recent.isError || !Array.isArray(recent.structuredContent?.posts)) {
    throw new Error("get_recent_posts did not return structured posts");
  }
  if (revival.isError || !Array.isArray(revival.structuredContent?.events)) {
    throw new Error("get_revival_events did not return structured events");
  }

  console.log(`MCP tools: ${names.join(", ")}`);
  console.log(`Top candidate: ${first.name}`);
  console.log(`Product context: ${product.structuredContent.product.name}`);
  console.log(`Library matches: ${search.structuredContent.products.length}`);
  console.log(`Recent posts: ${recent.structuredContent.posts.length}`);
  console.log(`Active revival events: ${revival.structuredContent.events.length}`);
} finally {
  await Promise.race([
    client.close(),
    new Promise((resolve) => setTimeout(resolve, 1_000)),
  ]);
}

process.exit(0);
