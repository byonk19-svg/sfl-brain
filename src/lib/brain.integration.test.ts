import { describe, expect, it } from "vitest";

import { createBrainService } from "@/lib/brain";

const integration = describe.runIf(process.env.SFL_INTEGRATION === "1");

integration("local Supabase integration", () => {
  it("loads the seeded ranking and Library through the real repository", async () => {
    const brain = createBrainService();

    const candidates = await brain.getTodayCandidates();
    const library = await brain.searchContentBacklog("Corinne", 10);

    expect(candidates[0]).toMatchObject({
      title: "Walmart swivel chair",
      candidate_type: "revival",
      estimated_effort_minutes: 10,
    });
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({
      title: "Corinne box dupes",
      status: "needs_caption",
    });
  });

  it("returns complete opportunity context with products, assets, and distributions", async () => {
    const context = await createBrainService().getOpportunityContext(
      "90000000-0000-4000-8000-000000000003",
    );

    expect(context).toMatchObject({
      title: "Corinne box dupes",
      content_opportunity_products: expect.arrayContaining([
        expect.objectContaining({ products: expect.objectContaining({ name: "McGee Corinne Boxes" }) }),
      ]),
      content_opportunity_assets: expect.arrayContaining([
        expect.objectContaining({ assets: expect.objectContaining({ title: "Corinne comparison image" }) }),
      ]),
    });
  });

  it("deduplicates cross-posts in the recent editorial mix", async () => {
    const inputs = await createBrainService().getContentOpportunityInputs();
    const antonia = inputs.find(
      (item) => item.title === "At Home Antonia comparison",
    );
    expect(antonia?.posts).toHaveLength(2);

    const mix = await createBrainService().getRecentContentMix();
    expect(
      mix.filter((item) => item.opportunity_id === antonia?.opportunityId),
    ).toHaveLength(1);
  });

  it("offers caption-ready work for a short no-photo session", async () => {
    const candidates = await createBrainService().getTodayCandidates({
      max_effort_minutes: 15,
      no_new_photos: true,
    });
    expect(candidates.some((item) => item.title === "Corinne box dupes")).toBe(true);
    expect(candidates.some((item) => item.title === "Home Depot hallway light")).toBe(false);
  });

  it("moves a captured opportunity to posted when its first distribution is recorded", async () => {
    const brain = createBrainService();
    const id = await brain.createContentOpportunity({
      title: `Integration ready ${crypto.randomUUID()}`,
      status: "ready",
      content_type: "standalone_product",
      media_format: undefined,
      notes: undefined,
      next_action: "Publish",
      estimated_minutes_remaining: 5,
      product_ids: [],
      asset_ids: [],
    });

    await brain.recordPost({
      content_opportunity_id: id,
      destination_id: "20000000-0000-4000-8000-000000000001",
      published_at: new Date().toISOString(),
      product_ids: [],
      asset_ids: [],
      performance_label: "unknown",
    });

    expect(await brain.getOpportunityContext(id)).toMatchObject({ status: "posted" });
    expect(
      (await brain.getTodayCandidates()).some((item) => item.opportunity_id === id),
    ).toBe(false);
  });

  it("supports reversible backlog archiving", async () => {
    const brain = createBrainService();
    const title = `Archive integration ${crypto.randomUUID()}`;
    const id = await brain.createContentOpportunity({
      title,
      status: "idea",
      content_type: "standalone_product",
      media_format: undefined,
      notes: undefined,
      next_action: "Decide the next step",
      estimated_minutes_remaining: undefined,
      product_ids: [],
      asset_ids: [],
    });

    await brain.setContentOpportunityArchived(id, true);
    expect(await brain.searchContentBacklog(title, 10)).toEqual([]);
    await brain.setContentOpportunityArchived(id, false);
    expect(await brain.searchContentBacklog(title, 10)).toHaveLength(1);
  });
});
