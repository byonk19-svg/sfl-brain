"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createBrainService } from "@/lib/brain";
import {
  affiliateLinkSchema,
  createOpportunitySchema,
  createProductSchema,
  editOpportunitySchema,
  editProductSchema,
  formString,
  formStrings,
  listingSchema,
  opportunityAssetSchema,
  opportunityProductSchema,
  radarEventSchema,
  recordPostSchema,
} from "@/lib/validation";

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: Array<{ message: string }> }).issues;
    if (issues?.length) return issues.map((issue) => issue.message).join(" ");
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

function messageUrl(path: string, kind: "error" | "success", message: string) {
  const params = new URLSearchParams({ [kind]: message });
  return `${path}?${params}`;
}

export async function createProductAction(formData: FormData) {
  let destination = "/products/new";
  try {
    const input = createProductSchema.parse({
      name: formString(formData, "name"),
      brand: formString(formData, "brand"),
      category: formString(formData, "category"),
      experience_level: formString(formData, "experience_level"),
      tags: formString(formData, "tags"),
      notes: formString(formData, "notes"),
      retailer: formString(formData, "retailer"),
      canonical_url: formString(formData, "canonical_url"),
      current_price: formString(formData, "current_price"),
      stock_status: formString(formData, "stock_status") || "unknown",
      affiliate_network: formString(formData, "affiliate_network"),
      affiliate_url: formString(formData, "affiliate_url"),
    });
    const id = await createBrainService().createProduct(input);
    revalidatePath("/today");
    revalidatePath("/library");
    destination = messageUrl(`/products/${id}`, "success", "Product added to the Brain.");
  } catch (error) {
    destination = messageUrl("/products/new", "error", errorMessage(error));
  }
  redirect(destination);
}

export async function createContentOpportunityAction(formData: FormData) {
  let destination = "/add";
  try {
    const input = createOpportunitySchema.parse({
      title: formString(formData, "title"),
      status: formString(formData, "status") || "idea",
      content_type:
        formString(formData, "content_type") || "standalone_product",
      media_format: formString(formData, "media_format"),
      notes: formString(formData, "notes"),
      next_action: formString(formData, "next_action"),
      estimated_minutes_remaining: formString(
        formData,
        "estimated_minutes_remaining",
      ),
      product_ids: formStrings(formData, "product_ids"),
      asset_ids: formStrings(formData, "asset_ids"),
    });
    const id = await createBrainService().createContentOpportunity(input);
    revalidatePath("/today");
    revalidatePath("/library");
    destination = messageUrl(
      `/opportunities/${id}`,
      "success",
      "Content saved to the backlog.",
    );
  } catch (error) {
    destination = messageUrl("/add", "error", errorMessage(error));
  }
  redirect(destination);
}

export async function editContentOpportunityAction(formData: FormData) {
  const id = formString(formData, "id");
  let destination = `/opportunities/${id}`;
  try {
    const input = editOpportunitySchema.parse({
      id,
      title: formString(formData, "title"),
      status: formString(formData, "status"),
      content_type: formString(formData, "content_type"),
      media_format: formString(formData, "media_format"),
      notes: formString(formData, "notes"),
      next_action: formString(formData, "next_action"),
      estimated_minutes_remaining: formString(
        formData,
        "estimated_minutes_remaining",
      ),
    });
    await createBrainService().updateContentOpportunity(input);
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Content stage updated.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function attachOpportunityProductAction(formData: FormData) {
  const opportunityId = formString(formData, "opportunity_id");
  let destination = `/opportunities/${opportunityId}`;
  try {
    const input = opportunityProductSchema.parse({
      opportunity_id: opportunityId,
      product_id: formString(formData, "product_id"),
      role: formString(formData, "role") || "supporting",
    });
    await createBrainService().attachOpportunityProduct(input);
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Product attached.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function detachOpportunityProductAction(formData: FormData) {
  const opportunityId = formString(formData, "opportunity_id");
  let destination = `/opportunities/${opportunityId}`;
  try {
    const input = opportunityProductSchema.parse({
      opportunity_id: opportunityId,
      product_id: formString(formData, "product_id"),
      role: "supporting",
    });
    await createBrainService().detachOpportunityProduct(
      input.opportunity_id,
      input.product_id,
    );
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Product removed.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function attachOpportunityAssetAction(formData: FormData) {
  const opportunityId = formString(formData, "opportunity_id");
  let destination = `/opportunities/${opportunityId}`;
  try {
    const input = opportunityAssetSchema.parse({
      opportunity_id: opportunityId,
      asset_id: formString(formData, "asset_id"),
      role: formString(formData, "role") || "supporting",
    });
    await createBrainService().attachOpportunityAsset(input);
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Asset attached.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function detachOpportunityAssetAction(formData: FormData) {
  const opportunityId = formString(formData, "opportunity_id");
  let destination = `/opportunities/${opportunityId}`;
  try {
    const input = opportunityAssetSchema.parse({
      opportunity_id: opportunityId,
      asset_id: formString(formData, "asset_id"),
      role: "supporting",
    });
    await createBrainService().detachOpportunityAsset(
      input.opportunity_id,
      input.asset_id,
    );
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Asset removed.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function setOpportunityArchivedAction(formData: FormData) {
  const id = formString(formData, "opportunity_id");
  const archived = formString(formData, "archived") === "true";
  let destination = `/opportunities/${id}`;
  try {
    const validId = editOpportunitySchema.shape.id.parse(id);
    await createBrainService().setContentOpportunityArchived(validId, archived);
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(
      destination,
      "success",
      archived ? "Content archived. You can restore it here." : "Content restored to the backlog.",
    );
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function editProductAction(formData: FormData) {
  const id = formString(formData, "id");
  let destination = `/products/${id}`;
  try {
    const input = editProductSchema.parse({
      id,
      name: formString(formData, "name"),
      brand: formString(formData, "brand"),
      category: formString(formData, "category"),
      lifecycle_status: formString(formData, "lifecycle_status"),
      experience_level: formString(formData, "experience_level"),
      tags: formString(formData, "tags"),
      notes: formString(formData, "notes"),
    });
    await createBrainService().updateProduct(input);
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Product details updated.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function addListingAction(formData: FormData) {
  const productId = formString(formData, "product_id");
  let destination = `/products/${productId}`;
  try {
    const input = listingSchema.parse({
      product_id: productId,
      retailer: formString(formData, "retailer"),
      canonical_url: formString(formData, "canonical_url"),
      variant_label: formString(formData, "variant_label"),
      current_price: formString(formData, "current_price"),
      stock_status: formString(formData, "stock_status"),
      is_primary: formData.get("is_primary") === "on",
    });
    await createBrainService().addListing(input);
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Listing added.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function addAffiliateLinkAction(formData: FormData) {
  const productId = formString(formData, "product_id");
  let destination = `/products/${productId}`;
  try {
    const input = affiliateLinkSchema.parse({
      listing_id: formString(formData, "listing_id"),
      network: formString(formData, "network"),
      url: formString(formData, "url"),
    });
    await createBrainService().addAffiliateLink(input);
    revalidatePath("/today");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Affiliate link added.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function addRadarEventAction(formData: FormData) {
  const productId = formString(formData, "product_id");
  let destination = `/products/${productId}`;
  try {
    const input = radarEventSchema.parse({
      product_id: productId,
      listing_id: formString(formData, "listing_id") || undefined,
      event_type: formString(formData, "event_type"),
      happened_at: formString(formData, "happened_at"),
      expires_at: formString(formData, "expires_at"),
      source: "manual",
    });
    await createBrainService().addRadarEvent(input);
    revalidatePath("/today");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Radar event added.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function uploadAssetAction(formData: FormData) {
  const productId = formString(formData, "product_id");
  let destination = `/products/${productId}`;
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file to upload.");
    await createBrainService().uploadAsset({
      productId,
      title: formString(formData, "title"),
      source: formString(formData, "source") as "home" | "in_store" | "canva" | "web" | "other",
      file,
    });
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Private asset uploaded.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function uploadOpportunityAssetAction(formData: FormData) {
  const opportunityId = formString(formData, "opportunity_id");
  let destination = `/opportunities/${opportunityId}`;
  try {
    const validId = editOpportunitySchema.shape.id.parse(opportunityId);
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file to upload.");
    await createBrainService().uploadAsset({
      opportunityId: validId,
      title: formString(formData, "title"),
      source: formString(formData, "source") as "home" | "in_store" | "canva" | "web" | "other",
      file,
    });
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Private asset uploaded and attached.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function recordPostAction(formData: FormData) {
  let destination = "/record-post";
  try {
    const input = recordPostSchema.parse({
      content_opportunity_id: formString(
        formData,
        "content_opportunity_id",
      ),
      destination_id: formString(formData, "destination_id"),
      product_ids: formStrings(formData, "product_ids"),
      asset_ids: formStrings(formData, "asset_ids"),
      published_at: formString(formData, "published_at"),
      caption: formString(formData, "caption"),
      angle: formString(formData, "angle"),
      performance_label: formString(formData, "performance_label") || "unknown",
      notes: formString(formData, "notes"),
    });
    await createBrainService().recordPost(input);
    revalidatePath("/today");
    revalidatePath("/library");
    for (const id of input.product_ids) revalidatePath(`/products/${id}`);
    revalidatePath(`/opportunities/${input.content_opportunity_id}`);
    destination = messageUrl("/today", "success", "Post recorded. Recommendations have been reranked.");
  } catch (error) {
    destination = messageUrl("/record-post", "error", errorMessage(error));
  }
  redirect(destination);
}
