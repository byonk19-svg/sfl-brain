import { describe, expect, it } from "vitest";

import {
  getTodayCandidates,
  scoreRecommendation,
  type RecommendationInput,
} from "@/lib/recommendations";

const NOW = new Date("2026-09-06T12:00:00.000Z");

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function product(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    productId: crypto.randomUUID(),
    name: "Demo product",
    lifecycleStatus: "active",
    listings: [
      {
        id: crypto.randomUUID(),
        retailer: "Demo Home",
        currentPrice: 99,
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
    assets: [
      {
        id: crypto.randomUUID(),
        title: "Styled photo",
        assetType: "photo",
        hasBeenUsed: false,
      },
    ],
    posts: [],
    radarEvents: [],
    ...overrides,
  };
}

describe("getTodayCandidates", () => {
  it("ranks the seeded Brown Swivel Chair above other representative products", () => {
    const brownChair = product({
      productId: "brown-chair",
      name: "Brown Swivel Chair",
      posts: [{ publishedAt: daysAgo(46), performanceLabel: "winner" }],
      radarEvents: [
        {
          id: "restock",
          eventType: "restock",
          happenedAt: daysAgo(1),
          expiresAt: null,
          dismissedAt: null,
        },
      ],
    });
    const decorativeBoxes = product({
      productId: "box-set",
      name: "Decorative Box Set",
    });
    const recentTable = product({
      productId: "accent-table",
      name: "Travertine Accent Table",
      posts: [{ publishedAt: daysAgo(4), performanceLabel: "winner" }],
    });

    const results = getTodayCandidates(
      [decorativeBoxes, recentTable, brownChair],
      {},
      NOW,
    );

    expect(results[0]?.product_id).toBe("brown-chair");
    expect(results[0]?.candidate_type).toBe("revival");
  });

  it("applies recent-post penalties at the correct boundaries", () => {
    expect(
      scoreRecommendation(
        product({ posts: [{ publishedAt: daysAgo(6), performanceLabel: "normal" }] }),
        NOW,
      ).reasons,
    ).toContainEqual(expect.objectContaining({ code: "posted_under_7_days", points: -50 }));
    expect(
      scoreRecommendation(
        product({ posts: [{ publishedAt: daysAgo(7), performanceLabel: "normal" }] }),
        NOW,
      ).reasons,
    ).toContainEqual(expect.objectContaining({ code: "posted_7_to_13_days", points: -20 }));
  });

  it("suppresses out-of-stock and non-active products from normal results", () => {
    const outOfStock = product({
      productId: "out",
      listings: [
        {
          id: "out-listing",
          retailer: "Demo Home",
          currentPrice: 20,
          currency: "USD",
          stockStatus: "out_of_stock",
          isPrimary: true,
        },
      ],
    });
    const archived = product({ productId: "archived", lifecycleStatus: "archived" });

    expect(getTodayCandidates([outOfStock, archived], {}, NOW)).toEqual([]);
    expect(scoreRecommendation(outOfStock, NOW).score).toBeLessThan(0);
  });

  it("removes candidates needing new photography", () => {
    const needsPhoto = product({ productId: "needs-photo", assets: [] });
    const ready = product({ productId: "ready" });

    const results = getTodayCandidates(
      [needsPhoto, ready],
      { no_new_photos: true },
      NOW,
    );

    expect(results.map((result) => result.product_id)).toEqual(["ready"]);
  });

  it("returns only five-minute candidates for the quick filter", () => {
    const quick = product({ productId: "quick" });
    const missingLink = product({ productId: "minor-prep", affiliateLinks: [] });
    const newContent = product({ productId: "new-content", assets: [] });

    const results = getTodayCandidates(
      [newContent, missingLink, quick],
      { max_effort_minutes: 5 },
      NOW,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      product_id: "quick",
      estimated_effort_minutes: 5,
      requires_new_photos: false,
    });
  });

  it("awards the winner and active Radar bonuses but ignores inactive events", () => {
    const scored = scoreRecommendation(
      product({
        posts: [{ publishedAt: daysAgo(60), performanceLabel: "winner" }],
        radarEvents: [
          {
            id: "active-sale",
            eventType: "sale",
            happenedAt: daysAgo(1),
            expiresAt: daysAgo(-2),
            dismissedAt: null,
          },
          {
            id: "dismissed-trend",
            eventType: "manual_trend",
            happenedAt: daysAgo(1),
            expiresAt: null,
            dismissedAt: daysAgo(0),
          },
          {
            id: "expired-restock",
            eventType: "restock",
            happenedAt: daysAgo(10),
            expiresAt: daysAgo(1),
            dismissedAt: null,
          },
        ],
      }),
      NOW,
    );

    expect(scored.reasons).toContainEqual(
      expect.objectContaining({ code: "previous_winner", points: 25 }),
    );
    expect(scored.reasons).toContainEqual(
      expect.objectContaining({ code: "radar_sale", points: 30 }),
    );
    expect(scored.reasons).not.toContainEqual(
      expect.objectContaining({ code: "radar_manual_trend" }),
    );
    expect(scored.reasons).not.toContainEqual(
      expect.objectContaining({ code: "radar_restock" }),
    );
  });

  it("keeps reasons exactly aligned with the numerical score", () => {
    const result = scoreRecommendation(
      product({
        posts: [{ publishedAt: daysAgo(50), performanceLabel: "winner" }],
        radarEvents: [
          {
            id: "seasonal",
            eventType: "seasonal",
            happenedAt: daysAgo(1),
            expiresAt: null,
            dismissedAt: null,
          },
        ],
      }),
      NOW,
    );

    expect(result.score).toBe(
      result.reasons.reduce((total, reason) => total + reason.points, 0),
    );
  });

  it("reranks a product after recording a recent post", () => {
    const chair = product({ productId: "chair", name: "Brown Swivel Chair" });
    const boxes = product({ productId: "boxes", name: "Decorative Box Set" });
    const before = getTodayCandidates([chair, boxes], {}, NOW);
    const after = getTodayCandidates(
      [
        { ...chair, posts: [{ publishedAt: NOW.toISOString(), performanceLabel: "unknown" }] },
        boxes,
      ],
      {},
      NOW,
    );

    expect(before[0]?.product_id).toBe("chair");
    expect(after[0]?.product_id).toBe("boxes");
    expect(after.find((candidate) => candidate.product_id === "chair")?.score).toBeLessThan(
      after[0]!.score,
    );
  });
});
