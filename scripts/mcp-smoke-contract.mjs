const localToolNames = [
  "get_today_candidates",
  "get_available_destinations",
  "get_on_hold_opportunities",
  "get_post_package_context",
  "search_sfl_library",
  "get_product_context",
  "get_content_opportunity_context",
  "get_recent_posts",
  "get_revival_events",
];

const hostedWriteNames = [
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
];

/** @param {"local" | "hosted"} mode */
export function expectedToolNames(mode) {
  return mode === "hosted"
    ? [...localToolNames.slice(0, 4), ...hostedWriteNames, ...localToolNames.slice(4)]
    : [...localToolNames];
}

/**
 * @param {Array<{name: string, annotations?: {readOnlyHint?: boolean, destructiveHint?: boolean, openWorldHint?: boolean}}>} tools
 * @param {"local" | "hosted"} mode
 */
export function validateToolContract(tools, mode) {
  const names = tools.map((tool) => tool.name);
  const expected = expectedToolNames(mode);
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected MCP tools: ${names.join(", ")}`);
  }
  for (const tool of tools) {
    const shouldWrite = mode === "hosted" && hostedWriteNames.includes(tool.name);
    if (
      tool.annotations?.readOnlyHint !== !shouldWrite ||
      tool.annotations?.destructiveHint !== false ||
      tool.annotations?.openWorldHint !== false
    ) {
      throw new Error(`Unexpected MCP annotation for ${tool.name}`);
    }
  }
}
