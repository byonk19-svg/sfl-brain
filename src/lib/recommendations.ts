export type LifecycleStatus = "active" | "discontinued" | "archived";
export type StockStatus = "unknown" | "in_stock" | "out_of_stock" | "limited";
export type PerformanceLabel = "unknown" | "weak" | "normal" | "winner";
export type RadarEventType =
  | "restock"
  | "price_drop"
  | "sale"
  | "seasonal"
  | "manual_trend"
  | "commission_boost";

export interface RecommendationListing {
  id: string;
  retailer: string;
  currentPrice: number | null;
  currency: string;
  stockStatus: StockStatus;
  isPrimary: boolean;
}

export interface RecommendationAffiliateLink {
  id: string;
  listingId: string;
  network: string;
  url: string;
  isActive: boolean;
}

export interface RecommendationAsset {
  id: string;
  title: string | null;
  assetType: "photo" | "canva_graphic" | "video" | "screenshot";
  hasBeenUsed: boolean;
}

export interface RecommendationPost {
  publishedAt: string;
  performanceLabel: PerformanceLabel;
}

export interface RecommendationRadarEvent {
  id: string;
  eventType: RadarEventType;
  happenedAt: string;
  expiresAt: string | null;
  dismissedAt: string | null;
}

export interface RecommendationInput {
  productId: string;
  name: string;
  lifecycleStatus: LifecycleStatus;
  listings: RecommendationListing[];
  affiliateLinks: RecommendationAffiliateLink[];
  assets: RecommendationAsset[];
  posts: RecommendationPost[];
  radarEvents: RecommendationRadarEvent[];
}

export interface ScoreReason {
  code: string;
  label: string;
  points: number;
}

export interface TodayCandidate {
  product_id: string;
  name: string;
  score: number;
  candidate_type: "fresh" | "revival" | "ready";
  estimated_effort_minutes: 5 | 15 | 30;
  requires_new_photos: boolean;
  reasons: ScoreReason[];
  last_posted_at: string | null;
  active_radar_events: Array<{ id: string; event_type: RadarEventType; happened_at: string }>;
  asset_summary: { total: number; unused: number; types: string[] };
  primary_listing: {
    id: string;
    retailer: string;
    current_price: number | null;
    currency: string;
    stock_status: StockStatus;
  } | null;
  active_affiliate_links: Array<{ id: string; network: string; url: string }>;
  previous_performance: {
    post_count: number;
    has_winner: boolean;
    best_label: PerformanceLabel;
  };
}

export interface TodayFilters {
  max_effort_minutes?: number;
  no_new_photos?: boolean;
  limit?: number;
}

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

const PERFORMANCE_ORDER: PerformanceLabel[] = ["unknown", "weak", "normal", "winner"];

function validDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function daysSince(value: string, now: Date) {
  const date = validDate(value);
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

function getActiveRadarEvents(product: RecommendationInput, now: Date) {
  return product.radarEvents.filter((event) => {
    const happenedAt = validDate(event.happenedAt);
    const expiresAt = event.expiresAt ? validDate(event.expiresAt) : null;
    return (
      !event.dismissedAt &&
      happenedAt !== null &&
      happenedAt <= now &&
      (!event.expiresAt || (expiresAt !== null && expiresAt >= now))
    );
  });
}

function getPrimaryListing(product: RecommendationInput) {
  return product.listings.find((listing) => listing.isPrimary) ?? product.listings[0] ?? null;
}

function latestPost(product: RecommendationInput) {
  return [...product.posts].sort(
    (a, b) => (validDate(b.publishedAt)?.valueOf() ?? 0) - (validDate(a.publishedAt)?.valueOf() ?? 0),
  )[0];
}

function addReason(reasons: ScoreReason[], code: string, label: string, points: number) {
  reasons.push({ code, label, points });
}

export function scoreRecommendation(product: RecommendationInput, now = new Date()): TodayCandidate {
  const reasons: ScoreReason[] = [];
  const activeRadarEvents = getActiveRadarEvents(product, now);

  for (const event of activeRadarEvents) {
    addReason(
      reasons,
      `radar_${event.eventType}`,
      RADAR_LABELS[event.eventType],
      RADAR_POINTS[event.eventType],
    );
  }

  const hasWinner = product.posts.some((post) => post.performanceLabel === "winner");
  if (hasWinner) addReason(reasons, "previous_winner", "A previous post was a winner", 25);

  const lastPost = latestPost(product);
  const lastPostedAt = lastPost?.publishedAt ?? null;
  if (!lastPost) {
    addReason(reasons, "never_posted", "Never posted before", 20);
  } else {
    const days = daysSince(lastPost.publishedAt, now);
    if (days !== null && days >= 45) addReason(reasons, "posted_45_plus_days", "Ready to resurface", 20);
    else if (days !== null && days >= 30) addReason(reasons, "posted_30_to_44_days", "Not posted in over a month", 15);
    else if (days !== null && days >= 14) addReason(reasons, "posted_14_to_29_days", "Not posted recently", 5);
    else if (days !== null && days >= 7) addReason(reasons, "posted_7_to_13_days", "Posted within the last two weeks", -20);
    else if (days !== null) addReason(reasons, "posted_under_7_days", "Posted within the last week", -50);
  }

  const unusedAssets = product.assets.filter((asset) => !asset.hasBeenUsed);
  if (unusedAssets.length > 0) addReason(reasons, "unused_asset", "Unused existing asset is ready", 15);
  if (product.assets.length > 0) addReason(reasons, "existing_asset", "Existing content is available", 5);

  const activeLinks = product.affiliateLinks.filter((link) => link.isActive);
  if (activeLinks.length > 0) addReason(reasons, "active_affiliate_link", "Affiliate link is ready", 10);

  const primaryListing = getPrimaryListing(product);
  if (primaryListing?.stockStatus === "in_stock") addReason(reasons, "in_stock", "Confirmed in stock", 10);
  if (primaryListing?.stockStatus === "limited") addReason(reasons, "limited_stock", "Limited stock", 2);
  if (primaryListing?.stockStatus === "out_of_stock") addReason(reasons, "out_of_stock", "Currently out of stock", -100);

  const requiresNewPhotos = product.assets.length === 0;
  const effort = requiresNewPhotos ? 30 : activeLinks.length > 0 ? 5 : 15;
  const bestLabel = product.posts.reduce<PerformanceLabel>(
    (best, post) =>
      PERFORMANCE_ORDER.indexOf(post.performanceLabel) > PERFORMANCE_ORDER.indexOf(best)
        ? post.performanceLabel
        : best,
    "unknown",
  );

  return {
    product_id: product.productId,
    name: product.name,
    score: reasons.reduce((total, reason) => total + reason.points, 0),
    candidate_type: !lastPost ? "fresh" : activeRadarEvents.length > 0 ? "revival" : "ready",
    estimated_effort_minutes: effort,
    requires_new_photos: requiresNewPhotos,
    reasons,
    last_posted_at: lastPostedAt,
    active_radar_events: activeRadarEvents.map((event) => ({
      id: event.id,
      event_type: event.eventType,
      happened_at: event.happenedAt,
    })),
    asset_summary: {
      total: product.assets.length,
      unused: unusedAssets.length,
      types: [...new Set(product.assets.map((asset) => asset.assetType))].sort(),
    },
    primary_listing: primaryListing
      ? {
          id: primaryListing.id,
          retailer: primaryListing.retailer,
          current_price: primaryListing.currentPrice,
          currency: primaryListing.currency,
          stock_status: primaryListing.stockStatus,
        }
      : null,
    active_affiliate_links: activeLinks.map((link) => ({
      id: link.id,
      network: link.network,
      url: link.url,
    })),
    previous_performance: {
      post_count: product.posts.length,
      has_winner: hasWinner,
      best_label: bestLabel,
    },
  };
}

export function getTodayCandidates(
  products: RecommendationInput[],
  filters: TodayFilters = {},
  now = new Date(),
) {
  const limit = Math.min(Math.max(Math.trunc(filters.limit ?? 20), 1), 100);

  return products
    .filter((product) => product.lifecycleStatus === "active")
    .map((product) => scoreRecommendation(product, now))
    .filter((candidate) => candidate.primary_listing?.stock_status !== "out_of_stock")
    .filter(
      (candidate) =>
        !filters.no_new_photos || candidate.requires_new_photos === false,
    )
    .filter(
      (candidate) =>
        filters.max_effort_minutes === undefined ||
        candidate.estimated_effort_minutes <= filters.max_effort_minutes,
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.estimated_effort_minutes - b.estimated_effort_minutes ||
        a.name.localeCompare(b.name) ||
        a.product_id.localeCompare(b.product_id),
    )
    .slice(0, limit);
}
