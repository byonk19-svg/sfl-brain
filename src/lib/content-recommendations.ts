import type {
  LifecycleStatus,
  PerformanceLabel,
  RadarEventType,
  RecommendationAffiliateLink,
  RecommendationListing,
} from "@/lib/recommendations";

export type OpportunityStatus =
  | "idea"
  | "needs_assets"
  | "needs_links"
  | "needs_caption"
  | "ready"
  | "posted"
  | "revival_candidate";

export type ContentType =
  | "comparison"
  | "in_store_find"
  | "styled_at_home"
  | "sale_restock"
  | "collection_roundup"
  | "standalone_product"
  | "lifestyle_shop_the_look"
  | "recommendation_response"
  | "unspecified";

export type MediaFormat =
  | "single_image"
  | "carousel"
  | "canva_graphic"
  | "reel_video"
  | "other";

export interface OpportunityProductInput {
  productId: string;
  name: string;
  lifecycleStatus: LifecycleStatus;
  role: "primary" | "supporting" | "comparison";
  listings: RecommendationListing[];
  affiliateLinks: RecommendationAffiliateLink[];
  radarEvents: Array<{
    id: string;
    eventType: RadarEventType;
    happenedAt: string;
    expiresAt: string | null;
    dismissedAt: string | null;
  }>;
}

export interface OpportunityAssetInput {
  id: string;
  title: string | null;
  assetType: "photo" | "canva_graphic" | "video" | "screenshot";
  role: "primary" | "supporting" | "comparison";
  hasBeenUsed: boolean;
}

export interface OpportunityPostInput {
  id: string;
  destinationId: string;
  destinationName: string;
  publishedAt: string;
  performanceLabel: PerformanceLabel;
}

export interface ContentOpportunityInput {
  opportunityId: string;
  title: string;
  status: OpportunityStatus;
  contentType: ContentType;
  mediaFormat: MediaFormat | null;
  notes: string | null;
  nextAction: string | null;
  estimatedMinutesRemaining: number | null;
  archivedAt: string | null;
  products: OpportunityProductInput[];
  assets: OpportunityAssetInput[];
  posts: OpportunityPostInput[];
}

export interface RecentContentMixItem {
  opportunity_id: string;
  content_type: ContentType;
  published_at: string;
}

export interface ContentScoreReason {
  code: string;
  label: string;
  points: number;
}

export interface TodayContentCandidate {
  opportunity_id: string;
  title: string;
  status: OpportunityStatus;
  content_type: ContentType;
  media_format: MediaFormat | null;
  score: number;
  candidate_type: "fresh" | "ready" | "revival";
  estimated_effort_minutes: number;
  requires_new_photos: boolean;
  next_action: string | null;
  notes: string | null;
  reasons: ContentScoreReason[];
  last_published_at: string | null;
  product_summary: Array<{
    id: string;
    name: string;
    role: OpportunityProductInput["role"];
    retailer: string | null;
    stock_status: RecommendationListing["stockStatus"] | "unknown";
  }>;
  asset_summary: { total: number; unused: number; types: string[] };
  link_summary: { active: number; networks: string[] };
  publication_summary: {
    post_count: number;
    destination_count: number;
    has_winner: boolean;
  };
  active_radar_events: Array<{
    id: string;
    event_type: RadarEventType;
    happened_at: string;
    product_name: string;
  }>;
}

export interface TodayContentFilters {
  max_effort_minutes?: number;
  no_new_photos?: boolean;
  candidate_type?: "revival";
  sort?: "best" | "closest_to_done";
  limit?: number;
}

const STATUS_POINTS: Partial<Record<OpportunityStatus, number>> = {
  ready: 30,
  needs_caption: 25,
  revival_candidate: 20,
  needs_links: 12,
};

const STATUS_LABELS: Record<OpportunityStatus, string> = {
  idea: "Captured idea",
  needs_assets: "Needs assets",
  needs_links: "Assets ready; links remain",
  needs_caption: "Only the caption remains",
  ready: "Ready to publish",
  posted: "Already published",
  revival_candidate: "Marked for revival",
};

const DEFAULT_EFFORT: Record<OpportunityStatus, number> = {
  idea: 30,
  needs_assets: 30,
  needs_links: 15,
  needs_caption: 10,
  ready: 5,
  posted: 10,
  revival_candidate: 10,
};

const RADAR_POINTS: Record<RadarEventType, number> = {
  restock: 40,
  price_drop: 35,
  sale: 30,
  manual_trend: 25,
  seasonal: 20,
  commission_boost: 20,
};

const RADAR_LABELS: Record<RadarEventType, string> = {
  restock: "Back in stock",
  price_drop: "Price dropped",
  sale: "On sale",
  manual_trend: "Trending now",
  seasonal: "Seasonally relevant",
  commission_boost: "Commission boost",
};

function validDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function latestPost(posts: OpportunityPostInput[]) {
  return [...posts].sort(
    (a, b) =>
      (validDate(b.publishedAt)?.valueOf() ?? 0) -
      (validDate(a.publishedAt)?.valueOf() ?? 0),
  )[0];
}

function firstPost(posts: OpportunityPostInput[]) {
  return [...posts].sort(
    (a, b) =>
      (validDate(a.publishedAt)?.valueOf() ?? 0) -
      (validDate(b.publishedAt)?.valueOf() ?? 0),
  )[0];
}

function daysSince(value: string, now: Date) {
  const date = validDate(value);
  return date ? Math.floor((now.getTime() - date.getTime()) / 86_400_000) : null;
}

function addReason(
  reasons: ContentScoreReason[],
  code: string,
  label: string,
  points: number,
) {
  reasons.push({ code, label, points });
}

function activeRadarEvents(opportunity: ContentOpportunityInput, now: Date) {
  const seen = new Set<string>();
  return opportunity.products.flatMap((product) =>
    product.radarEvents.flatMap((event) => {
      const happenedAt = validDate(event.happenedAt);
      const expiresAt = event.expiresAt ? validDate(event.expiresAt) : null;
      const active =
        !event.dismissedAt &&
        happenedAt !== null &&
        happenedAt <= now &&
        (!event.expiresAt || (expiresAt !== null && expiresAt >= now));
      if (!active || seen.has(event.id)) return [];
      seen.add(event.id);
      return [{ ...event, productName: product.name }];
    }),
  );
}

export function getRecentContentMix(
  opportunities: ContentOpportunityInput[],
  limit = 5,
): RecentContentMixItem[] {
  return opportunities
    .flatMap((opportunity) => {
      const first = firstPost(opportunity.posts);
      return first
        ? [
            {
              opportunity_id: opportunity.opportunityId,
              content_type: opportunity.contentType,
              published_at: first.publishedAt,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        (validDate(b.published_at)?.valueOf() ?? 0) -
          (validDate(a.published_at)?.valueOf() ?? 0) ||
        a.opportunity_id.localeCompare(b.opportunity_id),
    )
    .slice(0, Math.max(0, limit));
}

export function scoreContentOpportunity(
  opportunity: ContentOpportunityInput,
  recentMix: RecentContentMixItem[],
  now = new Date(),
): TodayContentCandidate {
  const reasons: ContentScoreReason[] = [];
  const radarEvents = activeRadarEvents(opportunity, now);
  const radarTypes = new Set<RadarEventType>();
  for (const event of radarEvents) {
    if (radarTypes.has(event.eventType)) continue;
    radarTypes.add(event.eventType);
    addReason(
      reasons,
      `radar_${event.eventType}`,
      RADAR_LABELS[event.eventType],
      RADAR_POINTS[event.eventType],
    );
  }

  const statusPoints = STATUS_POINTS[opportunity.status];
  if (statusPoints) {
    addReason(
      reasons,
      `status_${opportunity.status}`,
      STATUS_LABELS[opportunity.status],
      statusPoints,
    );
  }

  const lastPost = latestPost(opportunity.posts);
  const isRevival = Boolean(
    lastPost &&
      (radarEvents.length > 0 || opportunity.status === "revival_candidate"),
  );
  const hasWinner = opportunity.posts.some(
    (post) => post.performanceLabel === "winner",
  );
  if (hasWinner) {
    addReason(reasons, "previous_winner", "A previous post was a winner", 25);
  }
  if (!lastPost) {
    addReason(reasons, "never_published", "Never published before", 20);
  } else {
    const days = daysSince(lastPost.publishedAt, now);
    if (days !== null && days >= 45) {
      addReason(reasons, "published_45_plus_days", "Ready to resurface", 20);
    } else if (days !== null && days >= 30) {
      addReason(reasons, "published_30_to_44_days", "Not published in over a month", 15);
    } else if (days !== null && days >= 14) {
      addReason(reasons, "published_14_to_29_days", "Not published recently", 5);
    } else if (days !== null && days >= 7) {
      addReason(reasons, "published_7_to_13_days", "Published within two weeks", -20);
    } else if (days !== null) {
      addReason(reasons, "published_under_7_days", "Published within the last week", -50);
    }
  }

  const unusedAssets = opportunity.assets.filter((asset) => !asset.hasBeenUsed);
  if (unusedAssets.length) {
    addReason(reasons, "unused_asset", "Unused prepared asset is ready", 15);
  }
  if (opportunity.assets.length) {
    addReason(reasons, "existing_asset", "Prepared content is available", 5);
  }

  const activeLinks = opportunity.products.flatMap((product) =>
    product.affiliateLinks.filter((link) => link.isActive),
  );
  if (activeLinks.length) {
    addReason(reasons, "active_affiliate_link", "Affiliate link is ready", 10);
  }

  const activeProducts = opportunity.products.filter(
    (product) => product.lifecycleStatus === "active",
  );
  const listings = activeProducts.flatMap((product) => product.listings);
  if (listings.some((listing) => listing.stockStatus === "in_stock")) {
    addReason(reasons, "in_stock", "At least one product is in stock", 10);
  } else if (listings.some((listing) => listing.stockStatus === "limited")) {
    addReason(reasons, "limited_stock", "At least one product has limited stock", 2);
  } else if (
    listings.length > 0 &&
    listings.every((listing) => listing.stockStatus === "out_of_stock")
  ) {
    addReason(reasons, "out_of_stock", "All attached products are out of stock", -100);
  }

  const estimatedEffort =
    isRevival &&
    opportunity.status === "posted" &&
    (opportunity.estimatedMinutesRemaining === null ||
      opportunity.estimatedMinutesRemaining === 0)
      ? 10
      : opportunity.estimatedMinutesRemaining ?? DEFAULT_EFFORT[opportunity.status];
  if (estimatedEffort <= 5) {
    addReason(reasons, "five_minute_finish", "Can be finished in five minutes", 10);
  } else if (estimatedEffort <= 15) {
    addReason(reasons, "quick_finish", "Can be finished in fifteen minutes", 5);
  }

  const priorMix = recentMix.filter(
    (item) => item.opportunity_id !== opportunity.opportunityId,
  );
  const recentTypeCount = priorMix.filter(
    (item) => item.content_type === opportunity.contentType,
  ).length;
  if (opportunity.contentType !== "unspecified") {
    if (priorMix[0]?.content_type === opportunity.contentType) {
      addReason(
        reasons,
        "variety_immediate_repeat",
        "Matches the most recently published content type",
        -12,
      );
    }
    if (
      priorMix.slice(0, 3).filter(
        (item) => item.content_type === opportunity.contentType,
      ).length >= 2
    ) {
      addReason(
        reasons,
        "variety_two_of_last_three",
        "This content type appears twice in the last three posts",
        -8,
      );
    }
    if (recentTypeCount >= 3) {
      addReason(
        reasons,
        "variety_repeated_last_five",
        "This content type appears repeatedly in the recent mix",
        -16,
      );
    }
  }

  const requiresNewPhotos =
    opportunity.status === "needs_assets" ||
    (opportunity.status === "idea" && opportunity.assets.length === 0);
  const productSummary = opportunity.products.map((product) => {
    const primary =
      product.listings.find((listing) => listing.isPrimary) ??
      product.listings[0] ??
      null;
    return {
      id: product.productId,
      name: product.name,
      role: product.role,
      retailer: primary?.retailer ?? null,
      stock_status: primary?.stockStatus ?? ("unknown" as const),
    };
  });

  return {
    opportunity_id: opportunity.opportunityId,
    title: opportunity.title,
    status: opportunity.status,
    content_type: opportunity.contentType,
    media_format: opportunity.mediaFormat,
    score: reasons.reduce((sum, reason) => sum + reason.points, 0),
    candidate_type: isRevival ? "revival" : lastPost ? "ready" : "fresh",
    estimated_effort_minutes: estimatedEffort,
    requires_new_photos: requiresNewPhotos,
    next_action:
      opportunity.nextAction ?? (isRevival ? "Refresh the content" : null),
    notes: opportunity.notes,
    reasons,
    last_published_at: lastPost?.publishedAt ?? null,
    product_summary: productSummary,
    asset_summary: {
      total: opportunity.assets.length,
      unused: unusedAssets.length,
      types: [...new Set(opportunity.assets.map((asset) => asset.assetType))].sort(),
    },
    link_summary: {
      active: activeLinks.length,
      networks: [...new Set(activeLinks.map((link) => link.network))].sort(),
    },
    publication_summary: {
      post_count: opportunity.posts.length,
      destination_count: new Set(
        opportunity.posts.map((post) => post.destinationId),
      ).size,
      has_winner: hasWinner,
    },
    active_radar_events: radarEvents.map((event) => ({
      id: event.id,
      event_type: event.eventType,
      happened_at: event.happenedAt,
      product_name: event.productName,
    })),
  };
}

export function getTodayContentCandidates(
  opportunities: ContentOpportunityInput[],
  filters: TodayContentFilters = {},
  now = new Date(),
) {
  const recentMix = getRecentContentMix(opportunities, 5);
  const limit = Math.min(Math.max(Math.trunc(filters.limit ?? 20), 1), 100);
  const candidates = opportunities
    .filter((opportunity) => !opportunity.archivedAt)
    .map((opportunity) => ({
      input: opportunity,
      candidate: scoreContentOpportunity(opportunity, recentMix, now),
    }))
    .filter(({ input, candidate }) => {
      const hasActiveRadar = candidate.active_radar_events.length > 0;
      if (input.status === "posted" && !hasActiveRadar) return false;
      if (
        input.products.length > 0 &&
        input.products.every((product) => product.lifecycleStatus !== "active")
      ) {
        return false;
      }
      return candidate.reasons.every((reason) => reason.code !== "out_of_stock");
    })
    .map(({ candidate }) => candidate)
    .filter(
      (candidate) =>
        !filters.no_new_photos || candidate.requires_new_photos === false,
    )
    .filter(
      (candidate) =>
        filters.max_effort_minutes === undefined ||
        candidate.estimated_effort_minutes <= filters.max_effort_minutes,
    )
    .filter(
      (candidate) =>
        filters.candidate_type === undefined ||
        candidate.candidate_type === filters.candidate_type,
    );

  candidates.sort((a, b) => {
    if (filters.sort === "closest_to_done") {
      const effort =
        a.estimated_effort_minutes - b.estimated_effort_minutes;
      if (effort) return effort;
    }
    return (
      b.score - a.score ||
      a.estimated_effort_minutes - b.estimated_effort_minutes ||
      a.title.localeCompare(b.title) ||
      a.opportunity_id.localeCompare(b.opportunity_id)
    );
  });

  return candidates.slice(0, limit);
}
