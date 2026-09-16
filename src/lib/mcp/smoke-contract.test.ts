import { describe, expect, it } from "vitest";

import {
  expectedToolNames,
  validateToolContract,
} from "../../../scripts/mcp-smoke-contract.mjs";

const readTool = (name: string) => ({
  name,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
});
const writeTool = (name: string) => ({
  name,
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
});

describe("MCP smoke contract", () => {
  it("expects nine local reads and thirteen hosted writes", () => {
    expect(expectedToolNames("local")).toHaveLength(9);
    expect(expectedToolNames("hosted")).toEqual([
      ...expectedToolNames("local").slice(0, 3),
      "get_post_package_context",
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
      ...expectedToolNames("local").slice(4),
    ]);
  });

  it("accepts truthful annotations for the hosted contract", () => {
    const tools = expectedToolNames("hosted").map((name) =>
      name.startsWith("create_") || name.startsWith("update_") || name.startsWith("upsert_") || name.startsWith("set_") || name.startsWith("skip_") || name.startsWith("finish_") || name.startsWith("place_") || name.startsWith("release_") || name === "record_post"
        ? writeTool(name)
        : readTool(name),
    );
    expect(() => validateToolContract(tools, "hosted")).not.toThrow();
  });

  it("rejects a destructive or unexpectedly writable tool", () => {
    const tools = expectedToolNames("hosted").map(readTool);
    expect(() => validateToolContract(tools, "hosted")).toThrow("annotation");
  });
});
