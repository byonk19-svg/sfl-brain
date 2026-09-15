import { z } from "zod";

const requestId = z.uuid();
const optionalText = z.string().trim().min(1).max(2_000).optional();
const nullableText = z.string().trim().min(1).max(2_000).nullable().optional();

const opportunityStatus = z.enum([
  "idea",
  "needs_assets",
  "needs_links",
  "needs_caption",
  "ready",
]);

const contentType = z.enum([
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

const performanceLabel = z.enum(["unknown", "weak", "normal", "winner"]);

export const createPilotOpportunitySchema = z.object({
  request_id: requestId,
  title: z.string().trim().min(1).max(200),
  status: opportunityStatus.default("idea"),
  content_type: contentType.default("unspecified"),
  notes: optionalText,
  next_action: optionalText,
  estimated_minutes_remaining: z.number().int().min(0).max(480).optional(),
});

export const updatePilotOpportunitySchema = z
  .object({
    request_id: requestId,
    opportunity_id: z.uuid(),
    expected_updated_at: z.string().datetime({ offset: true }),
    title: z.string().trim().min(1).max(200).optional(),
    status: opportunityStatus.optional(),
    content_type: contentType.optional(),
    notes: nullableText,
    next_action: nullableText,
    estimated_minutes_remaining: z.number().int().min(0).max(480).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.title === undefined &&
      value.status === undefined &&
      value.content_type === undefined &&
      value.notes === undefined &&
      value.next_action === undefined &&
      value.estimated_minutes_remaining === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Include at least one field to change",
      });
    }
  });

export const recordPilotPostSchema = z.object({
  request_id: requestId,
  opportunity_id: z.uuid(),
  destination_id: z.uuid(),
  published_at: z.string().datetime({ offset: true }),
  caption: optionalText,
  angle: optionalText,
  asset_ids: z.array(z.uuid()).max(100).default([]),
  performance_label: performanceLabel.default("unknown"),
});

export type CreatePilotOpportunityInput = z.infer<typeof createPilotOpportunitySchema>;
export type UpdatePilotOpportunityInput = z.infer<typeof updatePilotOpportunitySchema>;
export type RecordPilotPostInput = z.infer<typeof recordPilotPostSchema>;
