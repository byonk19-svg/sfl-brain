import { z } from "zod";

import {
  CAPTION_AUDIENCES,
  CAPTION_VARIANT_STATUSES,
  PACKAGE_ASSET_ROLES,
} from "@/lib/post-package";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(2_000).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().max(2_000).optional(),
);

const optionalPrice = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().nonnegative().max(99_999_999).optional(),
);

const optionalMinutes = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined
      ? undefined
      : Number(value),
  z.number().int().min(0).max(480).optional(),
);

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.iso.date().optional(),
);

const uuidList = z.preprocess(
  (value) => (Array.isArray(value) ? value : value ? [value] : []),
  z.array(z.uuid()).max(100).transform((values) => [...new Set(values)]),
);

export const opportunityStatusSchema = z.enum([
  "idea",
  "needs_assets",
  "needs_links",
  "needs_caption",
  "ready",
  "posted",
  "revival_candidate",
]);

export const contentTypeSchema = z.enum([
  "comparison",
  "in_store_find",
  "styled_at_home",
  "sale_restock",
  "collection_roundup",
  "standalone_product",
  "lifestyle_shop_the_look",
  "recommendation_response",
  "unspecified",
]);

export const mediaFormatSchema = z.enum([
  "single_image",
  "carousel",
  "canva_graphic",
  "reel_video",
  "other",
]);

export const createOpportunitySchema = z
  .object({
    title: z.string().trim().min(1, "What are you working on?").max(200),
    status: opportunityStatusSchema.default("idea"),
    content_type: contentTypeSchema.default("unspecified"),
    media_format: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      mediaFormatSchema.optional(),
    ),
    notes: optionalText,
    next_action: optionalText,
    estimated_minutes_remaining: optionalMinutes,
    product_ids: uuidList,
    asset_ids: uuidList,
  })
  .superRefine((value, context) => {
    if (["posted", "revival_candidate"].includes(value.status)) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Use Record Post before choosing a published stage",
      });
    }
  })
  .transform((value) => ({
    ...value,
    next_action:
      value.next_action ??
      {
        idea: "Decide the next step",
        needs_assets: "Take pictures",
        needs_links: "Prepare affiliate links",
        needs_caption: "Write the caption",
        ready: "Publish",
        posted: "",
        revival_candidate: "Refresh the content",
      }[value.status],
  }));

export const editOpportunitySchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  status: opportunityStatusSchema,
  content_type: contentTypeSchema,
  media_format: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    mediaFormatSchema.optional(),
  ),
  notes: optionalText,
  next_action: optionalText,
  estimated_minutes_remaining: optionalMinutes,
});

export const opportunityProductSchema = z.object({
  opportunity_id: z.uuid(),
  product_id: z.uuid(),
  role: z.enum(["primary", "supporting", "comparison"]).default("supporting"),
});

export const opportunityAssetSchema = z.object({
  opportunity_id: z.uuid(),
  asset_id: z.uuid(),
  role: z.enum(["primary", "supporting", "comparison"]).default("supporting"),
});

const tags = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}, z.array(z.string().min(1).max(80)).max(30).transform((values) => [...new Set(values)]));

export const createProductSchema = z
  .object({
    name: z.string().trim().min(1, "Product name is required").max(200),
    brand: optionalText,
    category: optionalText,
    experience_level: z.enum(["online_only", "seen_in_store", "handled_in_store", "owned", "used_at_home"]),
    tags,
    notes: optionalText,
    retailer: optionalText,
    canonical_url: optionalUrl,
    current_price: optionalPrice,
    stock_status: z.enum(["unknown", "in_stock", "out_of_stock", "limited"]).default("unknown"),
    affiliate_network: optionalText,
    affiliate_url: optionalUrl,
  })
  .superRefine((value, context) => {
    const listingStarted = Boolean(value.retailer || value.canonical_url || value.current_price !== undefined);
    if (listingStarted && !value.retailer) {
      context.addIssue({ code: "custom", path: ["retailer"], message: "Retailer is required when adding a listing" });
    }
    if (listingStarted && !value.canonical_url) {
      context.addIssue({ code: "custom", path: ["canonical_url"], message: "Canonical URL is required when adding a listing" });
    }
    if ((value.affiliate_network || value.affiliate_url) && !listingStarted) {
      context.addIssue({ code: "custom", path: ["affiliate_url"], message: "Add a retailer listing before adding an affiliate link" });
    }
    if (value.affiliate_url && !value.affiliate_network) {
      context.addIssue({ code: "custom", path: ["affiliate_network"], message: "Affiliate network is required" });
    }
    if (value.affiliate_network && !value.affiliate_url) {
      context.addIssue({ code: "custom", path: ["affiliate_url"], message: "Affiliate URL is required" });
    }
  });

export const editProductSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  brand: optionalText,
  category: optionalText,
  lifecycle_status: z.enum(["active", "discontinued", "archived"]),
  experience_level: z.enum(["online_only", "seen_in_store", "handled_in_store", "owned", "used_at_home"]),
  tags,
  notes: optionalText,
});

export const listingSchema = z.object({
  product_id: z.uuid(),
  retailer: z.string().trim().min(1).max(200),
  canonical_url: z.url().max(2_000),
  variant_label: optionalText,
  current_price: optionalPrice,
  stock_status: z.enum(["unknown", "in_stock", "out_of_stock", "limited"]),
  is_primary: z.boolean().default(false),
});

export const affiliateLinkSchema = z.object({
  listing_id: z.uuid(),
  network: z.string().trim().min(1).max(120),
  url: z.url().max(2_000),
});

export const radarEventSchema = z.object({
  product_id: z.uuid(),
  listing_id: z.uuid().optional(),
  event_type: z.enum(["restock", "price_drop", "sale", "seasonal", "manual_trend", "commission_boost"]),
  happened_at: z.string().min(1).transform((value) => new Date(value).toISOString()),
  expires_at: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().transform((value) => new Date(value).toISOString()).optional(),
  ),
  source: optionalText,
});

export const recordPostSchema = z.object({
  content_opportunity_id: z.uuid({
    error: "Choose a content opportunity",
  }),
  destination_id: z.uuid(),
  product_ids: z.array(z.uuid()).default([]),
  asset_ids: z.array(z.uuid()).default([]),
  published_at: z.string().min(1).transform((value) => new Date(value).toISOString()),
  caption: optionalText,
  angle: optionalText,
  performance_label: z.enum(["unknown", "weak", "normal", "winner"]).default("unknown"),
  notes: optionalText,
});

export const placeOpportunityHoldSchema = z.object({
  opportunity_id: z.uuid(),
  hold_reason: z.string().trim().min(1).max(2_000),
  release_condition: z.string().trim().min(1).max(2_000),
  review_on: optionalDate,
});

export const updateOpportunityHoldSchema = z.object({
  hold_id: z.uuid(),
  expected_updated_at: z.iso.datetime({ offset: true }),
  hold_reason: z.string().trim().min(1).max(2_000),
  release_condition: z.string().trim().min(1).max(2_000),
  review_on: optionalDate,
});

export const releaseOpportunityHoldSchema = z.object({
  hold_id: z.uuid(),
  expected_updated_at: z.iso.datetime({ offset: true }),
  release_note: optionalText,
});

const optimisticUpdatedAt = z.iso.datetime({ offset: true });
const nullableBoundedText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(10_000).optional(),
);

export const createPostPackageSchema = z.object({
  opportunity_id: z.uuid(),
  request_id: z.uuid().nullish(),
  base_caption: nullableBoundedText,
  working_angle: optionalText,
  notes: optionalText,
});

export const updatePostPackageSchema = z.object({
  package_id: z.uuid(),
  request_id: z.uuid().nullish(),
  expected_updated_at: optimisticUpdatedAt,
  base_caption: z.string().trim().min(1).max(10_000).nullable(),
  working_angle: z.string().trim().min(1).max(2_000).nullable(),
  notes: z.string().trim().min(1).max(2_000).nullable(),
});

export const postPackageVariantSchema = z.object({
  package_id: z.uuid(),
  variant_id: z.uuid().nullish(),
  request_id: z.uuid().nullish(),
  expected_updated_at: optimisticUpdatedAt,
  audience: z.enum(CAPTION_AUDIENCES),
  destination_id: z.uuid().nullish(),
  body: z.string().trim().min(1, "Caption body is required").max(10_000),
  status: z.enum(CAPTION_VARIANT_STATUSES).default("draft"),
});

export const packageAssetSelectionSchema = z
  .array(z.object({
    asset_id: z.uuid(),
    role: z.enum(PACKAGE_ASSET_ROLES).default("supporting"),
    position: z.number().int().min(0).max(99),
    note: optionalText,
  }))
  .max(100)
  .superRefine((assets, context) => {
    if (assets.filter((asset) => asset.role === "hero").length > 1) {
      context.addIssue({ code: "custom", message: "Only one hero asset is allowed" });
    }
    if (new Set(assets.map((asset) => asset.asset_id)).size !== assets.length) {
      context.addIssue({ code: "custom", message: "Each asset may be selected only once" });
    }
    if (new Set(assets.map((asset) => asset.position)).size !== assets.length) {
      context.addIssue({ code: "custom", message: "Asset positions must be unique" });
    }
  });

export const setPostPackageAssetsSchema = z.object({
  package_id: z.uuid(),
  request_id: z.uuid().nullish(),
  expected_updated_at: optimisticUpdatedAt,
  assets: packageAssetSelectionSchema,
});

export const distributionPlanSchema = z
  .array(z.object({
    id: z.uuid().optional(),
    destination_id: z.uuid(),
    caption_variant_id: z.uuid(),
  }))
  .max(100)
  .superRefine((items, context) => {
    if (new Set(items.map((item) => item.destination_id)).size !== items.length) {
      context.addIssue({ code: "custom", message: "Distribution destinations must be unique" });
    }
  });

export const setPostPackageDestinationsSchema = z.object({
  package_id: z.uuid(),
  request_id: z.uuid().nullish(),
  expected_updated_at: optimisticUpdatedAt,
  destinations: distributionPlanSchema,
});

export const skipPostPackageDestinationSchema = z.object({
  package_id: z.uuid(),
  distribution_item_id: z.uuid(),
  request_id: z.uuid().nullish(),
  expected_updated_at: optimisticUpdatedAt,
  skip_reason: z.string().trim().min(1, "Skip reason is required").max(2_000),
});

export const finishPostPackageSchema = z.object({
  package_id: z.uuid(),
  request_id: z.uuid().nullish(),
  expected_updated_at: optimisticUpdatedAt,
  outcome: z.enum(["closed", "abandoned"]),
});

export const recordPostFromPackageSchema = z.object({
  package_id: z.uuid(),
  distribution_item_id: z.uuid(),
  request_id: z.uuid().nullish(),
  expected_updated_at: optimisticUpdatedAt,
  published_at: z
    .string()
    .min(1)
    .refine((value) => Number.isFinite(Date.parse(value)), "Enter a valid publication date")
    .transform((value) => new Date(value).toISOString()),
  notes: optionalText,
});

export const createDestinationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  platform: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.enum([
      "facebook_page",
      "facebook_group",
      "facebook_personal",
      "instagram_feed",
      "instagram_reel",
      "instagram_story",
      "other",
    ]),
  ),
  posting_identity: z.string().trim().min(1).max(200),
  notes: optionalText,
  is_active: z.boolean().default(true),
});

export const updateDestinationSchema = createDestinationSchema.extend({ id: z.uuid() });

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function validateUpload(file: { name: string; type: string; size: number }) {
  if (!file.name || file.size <= 0) return "Choose a non-empty file.";
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    return "Use a JPEG, PNG, WebP, MP4, MOV, or WebM file.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Files must be 25 MB or smaller.";
  return null;
}

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function formStrings(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}
