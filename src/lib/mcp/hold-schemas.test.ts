import { describe, expect, it } from "vitest";
import { placeHoldSchema, releaseHoldSchema, updateHoldSchema } from "./hold-schemas";

describe("hold tool schemas", () => {
  it("requires reason and release condition", () => {
    expect(() => placeHoldSchema.parse({ request_id: crypto.randomUUID(), opportunity_id: crypto.randomUUID() })).toThrow();
  });
  it("accepts a manual hold lifecycle", () => {
    const common = { request_id: crypto.randomUUID(), hold_id: crypto.randomUUID(), expected_updated_at: new Date().toISOString() };
    expect(updateHoldSchema.parse({ ...common, hold_reason: "Reason", release_condition: "Condition" })).toBeTruthy();
    expect(releaseHoldSchema.parse(common)).toBeTruthy();
  });
});
