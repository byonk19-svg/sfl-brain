import { describe, expect, it } from "vitest";

import { createBrainService } from "@/lib/brain";

const integration = describe.runIf(process.env.SFL_INTEGRATION === "1");

integration("local Supabase integration", () => {
  it("loads the seeded ranking and Library through the real repository", async () => {
    const brain = createBrainService();

    const candidates = await brain.getTodayCandidates();
    const library = await brain.searchLibrary("chair", 10);

    expect(candidates[0]).toMatchObject({
      name: "Brown Swivel Chair",
      candidate_type: "revival",
      estimated_effort_minutes: 5,
    });
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({ name: "Brown Swivel Chair", retailer: "Demo Target" });
  });

  it("returns complete product context without requiring quantitative metrics", async () => {
    const context = await createBrainService().getProductContext(
      "30000000-0000-4000-8000-000000000001",
    );

    expect(context).toMatchObject({
      name: "Brown Swivel Chair",
      listings: expect.arrayContaining([
        expect.objectContaining({ retailer: "Demo Target" }),
      ]),
      radar_events: expect.arrayContaining([
        expect.objectContaining({ event_type: "restock" }),
      ]),
    });
  });
});
