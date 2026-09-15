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
  it("expects eight local reads and six hosted writes", () => {
    expect(expectedToolNames("local")).toHaveLength(8);
    expect(expectedToolNames("hosted")).toEqual([
      ...expectedToolNames("local").slice(0, 3),
      "create_content_opportunity",
      "update_content_opportunity",
      "record_post",
      "place_content_opportunity_on_hold",
      "update_content_opportunity_hold",
      "release_content_opportunity_hold",
      ...expectedToolNames("local").slice(3),
    ]);
  });

  it("accepts truthful annotations for the hosted contract", () => {
    const tools = expectedToolNames("hosted").map((name) =>
      name.startsWith("create_") || name.startsWith("update_") || name.startsWith("place_") || name.startsWith("release_") || name === "record_post"
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
