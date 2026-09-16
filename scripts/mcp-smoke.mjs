import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { validateToolContract } from "./mcp-smoke-contract.mjs";

const endpoint = new URL(process.env.SFL_MCP_URL ?? "http://127.0.0.1:3000/mcp");
const accessToken = process.env.SFL_MCP_ACCESS_TOKEN;
const mode = process.env.SFL_MCP_MODE === "hosted" ? "hosted" : "local";

if (process.env.SFL_MCP_CHECK_UNAUTHENTICATED === "1") {
  const response = await fetch(endpoint);
  const challenge = response.headers.get("www-authenticate") ?? "";
  if (response.status !== 401 || !challenge.includes("resource_metadata=")) {
    throw new Error("Hosted MCP did not return the expected OAuth challenge");
  }
  console.log("Hosted MCP authentication challenge: valid");
  process.exit(0);
}

const client = new Client({ name: "sfl-brain-smoke", version: "0.1.0" });

try {
  await client.connect(new StreamableHTTPClientTransport(endpoint, {
    authProvider: accessToken ? { token: async () => accessToken } : undefined,
  }));
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  validateToolContract(listed.tools, mode);

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
  const opportunity = await client.callTool({
    name: "get_content_opportunity_context",
    arguments: { opportunity_id: first.opportunity_id },
  });
  if (opportunity.isError || !opportunity.structuredContent?.opportunity) {
    throw new Error("get_content_opportunity_context did not return structured opportunity context");
  }
  if (JSON.stringify(opportunity.structuredContent).includes("storage_path")) {
    throw new Error("Content opportunity context exposed a private storage path");
  }
  const postPackage = await client.callTool({
    name: "get_post_package_context",
    arguments: { opportunity_id: first.opportunity_id },
  });
  if (postPackage.isError || !postPackage.structuredContent?.post_package_context) {
    throw new Error("get_post_package_context did not return structured package context");
  }
  const serializedPackage = JSON.stringify(postPackage.structuredContent);
  if (/storage_path|created_by|updated_by|approved_by|SUPABASE_SERVICE_ROLE_KEY/.test(serializedPackage)) {
    throw new Error("Post Package context exposed private storage or internal actor data");
  }
  for (const match of serializedPackage.matchAll(/"signed_url":"([^"]+)"/g)) {
    if (match[1] === "null") continue;
    const signed = new URL(match[1]);
    const local = ["127.0.0.1", "localhost"].includes(signed.hostname) && signed.protocol === "http:";
    const hosted = signed.protocol === "https:" && signed.hostname.endsWith(".supabase.co");
    if ((!local && !hosted) || !signed.pathname.includes("/storage/v1/object/sign/")) {
      throw new Error("Post Package context exposed an untrusted signed asset URL");
    }
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
  console.log(`Opportunity context: ${opportunity.structuredContent.opportunity.title}`);
  console.log(`Post Package context: ${postPackage.structuredContent.post_package_context.active_package ? "active" : "no active package"}`);
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
