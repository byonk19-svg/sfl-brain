import { describe, expect, it } from "vitest";

import {
  getRecentContentMix,
  getTodayContentCandidates,
  scoreContentOpportunity,
  type ContentOpportunityInput,
} from "@/lib/content-recommendations";

const NOW = new Date("2026-09-06T12:00:00.000Z");
const day = (daysAgo: number) =>
  new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

function opportunity(
  overrides: Partial<ContentOpportunityInput> = {},
): ContentOpportunityInput {
  return {
    opportunityId: crypto.randomUUID(),
    title: "Content idea",
    status: "needs_caption",
    contentType: "styled_at_home",
    mediaFormat: "single_image",
    notes: null,
    nextAction: "Write caption",
    estimatedMinutesRemaining: null,
    archivedAt: null,
    products: [
      {
        productId: crypto.randomUUID(),
        name: "Demo product",
        lifecycleStatus: "active",
        role: "primary",
        listings: [
          {
            id: crypto.randomUUID(),
            retailer: "Demo Home",
            currentPrice: 49,
            currency: "USD",
            stockStatus: "in_stock",
            isPrimary: true,
          },
        ],
        affiliateLinks: [
          {
            id: crypto.randomUUID(),
            listingId: "listing",
            network: "demo",
            url: "https://affiliate.example/item",
            isActive: true,
          },
        ],
        radarEvents: [],
      },
    ],
    assets: [
      {
        id: crypto.randomUUID(),
        title: "Ready photo",
        assetType: "photo",
        role: "primary",
        hasBeenUsed: false,
      },
    ],
    posts: [],
    ...overrides,
  };
}

function publishedOpportunity(
  contentType: ContentOpportunityInput["contentType"],
  daysAgo: number,
  postCount = 1,
) {
  return opportunity({
    opportunityId: `${contentType}-${daysAgo}`,
    title: `${contentType} published ${daysAgo}`,
    status: "posted",
    contentType,
    posts: Array.from({ length: postCount }, (_, index) => ({
      id: `${contentType}-${daysAgo}-post-${index}`,
      destinationId: `destination-${index}`,
      destinationName: `Destination ${index}`,
      publishedAt: day(daysAgo),
      performanceLabel: "normal",
    })),
  });
}

describe("content opportunity recommendation engine", () => {
  it("favors caption-ready work over an idea that still needs photography", () => {
    const caption = opportunity({
      opportunityId: "caption",
      title: "Corinne box dupes",
      status: "needs_caption",
    });
    const photos = opportunity({
      opportunityId: "photos",
      title: "Home Depot hallway light",
      status: "needs_assets",
      assets: [],
      nextAction: "Take pictures",
    });

    const results = getTodayContentCandidates(
      [photos, caption],
      { max_effort_minutes: 15, no_new_photos: true },
      NOW,
    );

    expect(results.map((item) => item.opportunity_id)).toEqual(["caption"]);
    expect(results[0]).toMatchObject({
      estimated_effort_minutes: 10,
      requires_new_photos: false,
    });
  });

  it("counts cross-posts of one opportunity once in recent content mix", () => {
    const comparison = publishedOpportunity("comparison", 1, 5);
    const styled = publishedOpportunity("styled_at_home", 2);

    expect(getRecentContentMix([comparison, styled], 5)).toEqual([
      {
        opportunity_id: comparison.opportunityId,
        content_type: "comparison",
        published_at: day(1),
      },
      {
        opportunity_id: styled.opportunityId,
        content_type: "styled_at_home",
        published_at: day(2),
      },
    ]);
  });

  it("applies a soft variety penalty only after a type repeats", () => {
    const candidate = opportunity({ contentType: "comparison" });
    const oneComparison = getRecentContentMix([
      publishedOpportunity("comparison", 1),
      publishedOpportunity("styled_at_home", 2),
    ]);
    const twoComparisons = getRecentContentMix([
      publishedOpportunity("comparison", 1),
      publishedOpportunity("comparison", 2),
      publishedOpportunity("in_store_find", 3),
    ]);

    expect(scoreContentOpportunity(candidate, oneComparison, NOW).reasons).not.toContainEqual(
      expect.objectContaining({ code: "recent_type_repetition" }),
    );
    expect(scoreContentOpportunity(candidate, twoComparisons, NOW).reasons).toContainEqual(
      expect.objectContaining({ code: "recent_type_repetition", points: -8 }),
    );
  });

  it("allows a significant sale signal to outweigh the variety penalty", () => {
    const history = [
      publishedOpportunity("comparison", 1),
      publishedOpportunity("comparison", 2),
    ];
    const saleComparison = opportunity({
      opportunityId: "sale-comparison",
      title: "Target taper candle sale",
      contentType: "comparison",
      products: [
        {
          ...opportunity().products[0]!,
          radarEvents: [
            {
              id: "sale",
              eventType: "sale",
              happenedAt: day(0),
              expiresAt: day(-2),
              dismissedAt: null,
            },
          ],
        },
      ],
    });
    const varied = opportunity({
      opportunityId: "varied",
      title: "Styled shelf",
      contentType: "styled_at_home",
    });

    const results = getTodayContentCandidates(
      [...history, varied, saleComparison],
      {},
      NOW,
    );

    expect(results[0]?.opportunity_id).toBe("sale-comparison");
    expect(results[0]?.reasons).toContainEqual(
      expect.objectContaining({ code: "radar_sale", points: 30 }),
    );
  });

  it("excludes ordinary posted work but includes a Radar-backed revival", () => {
    const posted = publishedOpportunity("styled_at_home", 50);
    const revival = opportunity({
      opportunityId: "revival",
      status: "posted",
      estimatedMinutesRemaining: 0,
      nextAction: null,
      posts: [
        {
          id: "old-post",
          destinationId: "page",
          destinationName: "SFL Page",
          publishedAt: day(60),
          performanceLabel: "winner",
        },
      ],
      products: [
        {
          ...opportunity().products[0]!,
          radarEvents: [
            {
              id: "restock",
              eventType: "restock",
              happenedAt: day(1),
              expiresAt: null,
              dismissedAt: null,
            },
          ],
        },
      ],
    });

    const results = getTodayContentCandidates([posted, revival], {}, NOW);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      opportunity_id: "revival",
      candidate_type: "revival",
      estimated_effort_minutes: 10,
      next_action: "Refresh the content",
    });
  });

  it("removes a ready opportunity after it is recorded as posted", () => {
    const ready = opportunity({ opportunityId: "ready", status: "ready" });
    expect(getTodayContentCandidates([ready], {}, NOW)).toHaveLength(1);

    const posted = {
      ...ready,
      status: "posted" as const,
      posts: [
        {
          id: "new-post",
          destinationId: "page",
          destinationName: "SFL Page",
          publishedAt: NOW.toISOString(),
          performanceLabel: "unknown" as const,
        },
      ],
    };

    expect(getTodayContentCandidates([posted], {}, NOW)).toEqual([]);
  });

  it("supports five-minute, closest-to-done, and revival filters", () => {
    const ready = opportunity({ opportunityId: "ready", status: "ready" });
    const caption = opportunity({ opportunityId: "caption", status: "needs_caption" });
    const links = opportunity({ opportunityId: "links", status: "needs_links" });
    const revival = opportunity({
      opportunityId: "revival",
      status: "revival_candidate",
      posts: [
        {
          id: "revival-post",
          destinationId: "page",
          destinationName: "SFL Page",
          publishedAt: day(60),
          performanceLabel: "normal",
        },
      ],
    });

    expect(
      getTodayContentCandidates(
        [caption, links, ready],
        { max_effort_minutes: 5 },
        NOW,
      ).map((item) => item.opportunity_id),
    ).toEqual(["ready"]);
    expect(
      getTodayContentCandidates(
        [caption, links, ready],
        { sort: "closest_to_done" },
        NOW,
      ).map((item) => item.opportunity_id),
    ).toEqual(["ready", "caption", "links"]);
    expect(
      getTodayContentCandidates(
        [ready, revival],
        { candidate_type: "revival" },
        NOW,
      ).map((item) => item.opportunity_id),
    ).toEqual(["revival"]);
  });

  it("suppresses all-unavailable product sets but permits one viable product", () => {
    const outOfStockProduct = {
      ...opportunity().products[0]!,
      listings: [
        {
          ...opportunity().products[0]!.listings[0]!,
          stockStatus: "out_of_stock" as const,
        },
      ],
    };
    const unavailable = opportunity({
      opportunityId: "unavailable",
      products: [outOfStockProduct],
    });
    const mixed = opportunity({
      opportunityId: "mixed",
      products: [outOfStockProduct, opportunity().products[0]!],
    });

    expect(getTodayContentCandidates([unavailable], {}, NOW)).toEqual([]);
    expect(getTodayContentCandidates([mixed], {}, NOW)).toHaveLength(1);
  });

  it("keeps every explanation exactly reconciled with the score", () => {
    const result = scoreContentOpportunity(opportunity(), [], NOW);
    expect(result.score).toBe(
      result.reasons.reduce((sum, reason) => sum + reason.points, 0),
    );
  });

  it("uses title and id as deterministic tie-breakers", () => {
    const b = opportunity({ opportunityId: "b", title: "Same" });
    const a = opportunity({ opportunityId: "a", title: "Same" });

    expect(
      getTodayContentCandidates([b, a], {}, NOW).map(
        (item) => item.opportunity_id,
      ),
    ).toEqual(["a", "b"]);
  });
});
