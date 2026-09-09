import { describe, expect, it } from "vitest";

import {
  createPilotOpportunitySchema,
  recordPilotPostSchema,
  updatePilotOpportunitySchema,
} from "@/lib/mcp/pilot-write-schemas";

const REQUEST_ID = "a0000000-0000-4000-8000-000000000001";
const OPPORTUNITY_ID = "90000000-0000-4000-8000-000000000003";

describe("pilot conversational write schemas", () => {
  it("defaults a new idea to Idea and Unspecified without product facts", () => {
    expect(
      createPilotOpportunitySchema.parse({
        request_id: REQUEST_ID,
        title: "Hallway light idea",
      }),
    ).toMatchObject({
      status: "idea",
      content_type: "unspecified",
    });
  });

  it("requires a current version and an explicit field change for progress updates", () => {
    expect(() =>
      updatePilotOpportunitySchema.parse({
        request_id: REQUEST_ID,
        opportunity_id: OPPORTUNITY_ID,
        expected_updated_at: "2026-09-09T15:00:00.000Z",
      }),
    ).toThrow(/change/i);

    expect(
      updatePilotOpportunitySchema.parse({
        request_id: REQUEST_ID,
        opportunity_id: OPPORTUNITY_ID,
        expected_updated_at: "2026-09-09T15:00:00.000Z",
        notes: null,
      }),
    ).toMatchObject({ notes: null });
  });

  it("requires an offset-aware actual publication time", () => {
    expect(() =>
      recordPilotPostSchema.parse({
        request_id: REQUEST_ID,
        opportunity_id: OPPORTUNITY_ID,
        destination_id: "20000000-0000-4000-8000-000000000001",
        published_at: "2026-09-09T10:00:00",
      }),
    ).toThrow();

    expect(
      recordPilotPostSchema.parse({
        request_id: REQUEST_ID,
        opportunity_id: OPPORTUNITY_ID,
        destination_id: "20000000-0000-4000-8000-000000000001",
        published_at: "2026-09-09T10:00:00-05:00",
      }),
    ).toMatchObject({ performance_label: "unknown" });
  });
});
