import { z } from "zod";

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
  destination_id: z.uuid(),
  product_ids: z.array(z.uuid()).min(1, "Choose at least one product"),
  asset_ids: z.array(z.uuid()).default([]),
  published_at: z.string().min(1).transform((value) => new Date(value).toISOString()),
  caption: optionalText,
  angle: optionalText,
  performance_label: z.enum(["unknown", "weak", "normal", "winner"]).default("unknown"),
  notes: optionalText,
});

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
