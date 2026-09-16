import { z } from "zod";

import {
  CAPTION_AUDIENCES,
  CAPTION_VARIANT_STATUSES,
  PACKAGE_ASSET_ROLES,
} from "@/lib/post-package";

const requestId = z.uuid();
const rowId = z.uuid();
const optimisticUpdatedAt = z.iso.datetime({ offset: true });
const optionalText = z.string().trim().min(1).max(2_000).optional();
const nullableText = z.string().trim().min(1).max(2_000).nullable();
const nullableCaption = z.string().trim().min(1).max(10_000).nullable();

export const createPostPackageToolSchema = z.object({
  request_id: requestId,
  opportunity_id: rowId,
  base_caption: z.string().trim().min(1).max(10_000).optional(),
  working_angle: optionalText,
  notes: optionalText,
});

export const updatePostPackageToolSchema = z.object({
  request_id: requestId,
  package_id: rowId,
  expected_updated_at: optimisticUpdatedAt,
  base_caption: nullableCaption,
  working_angle: nullableText,
  notes: nullableText,
});

export const upsertPostPackageCaptionVariantToolSchema = z.object({
  request_id: requestId,
  package_id: rowId,
  variant_id: rowId.optional(),
  expected_updated_at: optimisticUpdatedAt,
  audience: z.enum(CAPTION_AUDIENCES),
  destination_id: rowId.nullable().optional(),
  body: z.string().trim().min(1, "Caption body is required").max(10_000),
  status: z.enum(CAPTION_VARIANT_STATUSES).default("draft"),
});

const assetSelections = z.array(z.object({
  asset_id: rowId,
  role: z.enum(PACKAGE_ASSET_ROLES).default("supporting"),
  position: z.number().int().min(0).max(99),
  note: optionalText,
})).max(100).superRefine((assets, context) => {
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

export const setPostPackageAssetsToolSchema = z.object({
  request_id: requestId,
  package_id: rowId,
  expected_updated_at: optimisticUpdatedAt,
  assets: assetSelections,
});

const destinationPlan = z.array(z.object({
  id: rowId.optional(),
  destination_id: rowId,
  caption_variant_id: rowId,
})).max(100).superRefine((items, context) => {
  if (new Set(items.map((item) => item.destination_id)).size !== items.length) {
    context.addIssue({ code: "custom", message: "Distribution destinations must be unique" });
  }
});

export const setPostPackageDestinationsToolSchema = z.object({
  request_id: requestId,
  package_id: rowId,
  expected_updated_at: optimisticUpdatedAt,
  destinations: destinationPlan,
});

export const skipPostPackageDestinationToolSchema = z.object({
  request_id: requestId,
  package_id: rowId,
  distribution_item_id: rowId,
  expected_updated_at: optimisticUpdatedAt,
  skip_reason: z.string().trim().min(1, "Skip reason is required").max(2_000),
});

export const finishPostPackageToolSchema = z.object({
  request_id: requestId,
  package_id: rowId,
  expected_updated_at: optimisticUpdatedAt,
  action: z.enum(["close", "abandon"]),
});

export type CreatePostPackageToolInput = z.infer<typeof createPostPackageToolSchema>;
export type UpdatePostPackageToolInput = z.infer<typeof updatePostPackageToolSchema>;
export type UpsertPostPackageCaptionVariantToolInput = z.infer<typeof upsertPostPackageCaptionVariantToolSchema>;
export type SetPostPackageAssetsToolInput = z.infer<typeof setPostPackageAssetsToolSchema>;
export type SetPostPackageDestinationsToolInput = z.infer<typeof setPostPackageDestinationsToolSchema>;
export type SkipPostPackageDestinationToolInput = z.infer<typeof skipPostPackageDestinationToolSchema>;
export type FinishPostPackageToolInput = z.infer<typeof finishPostPackageToolSchema>;
