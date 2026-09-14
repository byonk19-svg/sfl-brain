import { z } from "zod";

const base = { request_id: z.uuid(), hold_id: z.uuid(), expected_updated_at: z.iso.datetime({ offset: true }) };
export const placeHoldSchema = z.object({ request_id: z.uuid(), opportunity_id: z.uuid(), hold_reason: z.string().trim().min(1).max(2000), release_condition: z.string().trim().min(1).max(2000), review_on: z.iso.date().nullable().optional() });
export const updateHoldSchema = z.object({ ...base, hold_reason: z.string().trim().min(1).max(2000), release_condition: z.string().trim().min(1).max(2000), review_on: z.iso.date().nullable().optional() });
export const releaseHoldSchema = z.object({ ...base, release_note: z.string().trim().min(1).max(2000).nullable().optional() });
export type PlaceHoldInput = z.infer<typeof placeHoldSchema>;
export type UpdateHoldInput = z.infer<typeof updateHoldSchema>;
export type ReleaseHoldInput = z.infer<typeof releaseHoldSchema>;
