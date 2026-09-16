"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createWebsiteBrainService } from "@/lib/website-auth";
import {
  affiliateLinkSchema,
  createDestinationSchema,
  createPostPackageSchema,
  createOpportunitySchema,
  createProductSchema,
  editOpportunitySchema,
  editProductSchema,
  formString,
  formStrings,
  listingSchema,
  opportunityAssetSchema,
  opportunityProductSchema,
  packageAssetSelectionSchema,
  placeOpportunityHoldSchema,
  postPackageVariantSchema,
  radarEventSchema,
  recordPostSchema,
  recordPostFromPackageWebsiteSchema,
  releaseOpportunityHoldSchema,
  setPostPackageAssetsSchema,
  setPostPackageDestinationsSchema,
  skipPostPackageDestinationSchema,
  finishPostPackageSchema,
  updateDestinationSchema,
  updatePostPackageSchema,
  updateOpportunityHoldSchema,
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
    const id = await (await createWebsiteBrainService()).createProduct(input);
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
    const id = await (await createWebsiteBrainService()).createContentOpportunity(input);
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
    await (await createWebsiteBrainService()).updateContentOpportunity(input);
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
    await (await createWebsiteBrainService()).attachOpportunityProduct(input);
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
    await (await createWebsiteBrainService()).detachOpportunityProduct(
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
    await (await createWebsiteBrainService()).attachOpportunityAsset(input);
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
    await (await createWebsiteBrainService()).detachOpportunityAsset(
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
    await (await createWebsiteBrainService()).setContentOpportunityArchived(validId, archived);
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

export async function placeOpportunityOnHoldAction(formData: FormData) {
  const opportunityId = formString(formData, "opportunity_id");
  let destination = `/opportunities/${opportunityId}`;
  try {
    const input = placeOpportunityHoldSchema.parse({
      opportunity_id: opportunityId,
      hold_reason: formString(formData, "hold_reason"),
      release_condition: formString(formData, "release_condition"),
      review_on: formString(formData, "review_on"),
    });
    await (await createWebsiteBrainService()).placeContentOpportunityOnHold(input);
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Moved to On hold.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function updateOpportunityHoldAction(formData: FormData) {
  const opportunityId = formString(formData, "opportunity_id");
  let destination = `/opportunities/${opportunityId}`;
  try {
    const input = updateOpportunityHoldSchema.parse({
      hold_id: formString(formData, "hold_id"),
      expected_updated_at: formString(formData, "expected_updated_at"),
      hold_reason: formString(formData, "hold_reason"),
      release_condition: formString(formData, "release_condition"),
      review_on: formString(formData, "review_on"),
    });
    await (await createWebsiteBrainService()).updateContentOpportunityHold(input);
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Hold details updated.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function releaseOpportunityHoldAction(formData: FormData) {
  const opportunityId = formString(formData, "opportunity_id");
  let destination = `/opportunities/${opportunityId}`;
  try {
    const input = releaseOpportunityHoldSchema.parse({
      hold_id: formString(formData, "hold_id"),
      expected_updated_at: formString(formData, "expected_updated_at"),
      release_note: formString(formData, "release_note"),
    });
    await (await createWebsiteBrainService()).releaseContentOpportunityHold(input);
    revalidatePath("/today");
    revalidatePath("/library");
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Returned to the active backlog.");
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
    await (await createWebsiteBrainService()).updateProduct(input);
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
    await (await createWebsiteBrainService()).addListing(input);
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
    await (await createWebsiteBrainService()).addAffiliateLink(input);
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
    await (await createWebsiteBrainService()).addRadarEvent(input);
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
    await (await createWebsiteBrainService()).uploadAsset({
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
    await (await createWebsiteBrainService()).uploadAsset({
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
    if (formString(formData, "distribution_item_id")) {
      const input = recordPostFromPackageWebsiteSchema.parse({
        opportunity_id: formString(formData, "content_opportunity_id"),
        package_id: formString(formData, "package_id"),
        distribution_item_id: formString(formData, "distribution_item_id"),
        expected_updated_at: formString(formData, "expected_updated_at"),
        published_at: formString(formData, "published_at"),
        notes: formString(formData, "notes"),
        caption_override: formData.has("caption") ? formData.get("caption") : undefined,
        angle_override: formData.has("angle") ? formData.get("angle") : undefined,
        destination_override: formData.has("destination_id") ? formData.get("destination_id") : undefined,
        product_override_ids: formData.has("product_ids") ? formStrings(formData, "product_ids") : undefined,
        asset_override_ids: formData.has("asset_ids") ? formStrings(formData, "asset_ids") : undefined,
      });
      destination = `/opportunities/${input.opportunity_id}`;
      const publication = await (await createWebsiteBrainService()).recordPostFromPackage({
        package_id: input.package_id,
        distribution_item_id: input.distribution_item_id,
        expected_updated_at: input.expected_updated_at,
        published_at: input.published_at,
        notes: input.notes,
      });
      destination = `/opportunities/${publication.content_opportunity_id}`;
      revalidatePackageViews(destination);
      destination = messageUrl(destination, "success", "Publication recorded from the approved Post Package snapshot.");
    } else {
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
      await (await createWebsiteBrainService()).recordPost(input);
      revalidatePath("/today");
      revalidatePath("/library");
      for (const id of input.product_ids) revalidatePath(`/products/${id}`);
      revalidatePath(`/opportunities/${input.content_opportunity_id}`);
      destination = messageUrl("/today", "success", "Post recorded. Recommendations have been reranked.");
    }
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

function packageOpportunityPath(formData: FormData) {
  return `/opportunities/${formString(formData, "opportunity_id")}`;
}

function revalidatePackageViews(opportunityPath: string) {
  revalidatePath(opportunityPath);
  revalidatePath("/today");
  revalidatePath("/library");
  revalidatePath("/record-post");
}

export async function createPostPackageAction(formData: FormData) {
  let destination = packageOpportunityPath(formData);
  try {
    const input = createPostPackageSchema.parse({
      opportunity_id: formString(formData, "opportunity_id"),
      base_caption: formString(formData, "base_caption"),
      working_angle: formString(formData, "working_angle"),
      notes: formString(formData, "notes"),
    });
    await (await createWebsiteBrainService()).createPostPackage(input);
    revalidatePackageViews(destination);
    destination = messageUrl(destination, "success", "Post Package started.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function updatePostPackageAction(formData: FormData) {
  let destination = packageOpportunityPath(formData);
  try {
    const nullable = (key: string) => formString(formData, key).trim() || null;
    const input = updatePostPackageSchema.parse({
      package_id: formString(formData, "package_id"),
      expected_updated_at: formString(formData, "expected_updated_at"),
      base_caption: nullable("base_caption"),
      working_angle: nullable("working_angle"),
      notes: nullable("notes"),
    });
    await (await createWebsiteBrainService()).updatePostPackage(input);
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Package context saved.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function upsertPostPackageVariantAction(formData: FormData) {
  let destination = packageOpportunityPath(formData);
  try {
    const input = postPackageVariantSchema.parse({
      package_id: formString(formData, "package_id"),
      variant_id: formString(formData, "variant_id") || undefined,
      expected_updated_at: formString(formData, "expected_updated_at"),
      audience: formString(formData, "audience"),
      destination_id: formString(formData, "destination_id") || undefined,
      body: formString(formData, "body"),
      status: formString(formData, "status") || "draft",
    });
    await (await createWebsiteBrainService()).upsertPostPackageVariant(input);
    revalidatePath(destination);
    destination = messageUrl(destination, "success", input.status === "approved" ? "Caption variant approved." : "Caption variant saved as draft.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

function packageAssetsFromForm(formData: FormData) {
  return formStrings(formData, "asset_ids").map((assetId) => ({
    asset_id: assetId,
    role: formString(formData, `asset_role_${assetId}`) || "supporting",
    position: Number(formString(formData, `asset_position_${assetId}`)),
    note: formString(formData, `asset_note_${assetId}`),
  }));
}

export async function setPostPackageAssetsAction(formData: FormData) {
  let destination = packageOpportunityPath(formData);
  try {
    const input = setPostPackageAssetsSchema.parse({
      package_id: formString(formData, "package_id"),
      expected_updated_at: formString(formData, "expected_updated_at"),
      assets: packageAssetsFromForm(formData),
    });
    await (await createWebsiteBrainService()).setPostPackageAssets(input);
    revalidatePath(destination);
    destination = messageUrl(destination, "success", "Package asset selection saved.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function uploadPostPackageAssetAction(formData: FormData) {
  let destination = packageOpportunityPath(formData);
  try {
    const opportunityId = editOpportunitySchema.shape.id.parse(formString(formData, "opportunity_id"));
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file to upload.");
    const currentAssets = packageAssetSelectionSchema.parse(JSON.parse(formString(formData, "current_assets") || "[]"));
    const brain = await createWebsiteBrainService();
    await brain.uploadPostPackageAsset({
      opportunityId,
      packageId: formString(formData, "package_id"),
      expectedUpdatedAt: formString(formData, "expected_updated_at"),
      currentAssets,
      title: formString(formData, "title"),
      source: formString(formData, "source") as "home" | "in_store" | "canva" | "web" | "other",
      file,
    });
    revalidatePackageViews(destination);
    destination = messageUrl(destination, "success", "Private asset uploaded and attached to the package.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function setPostPackageDestinationsAction(formData: FormData) {
  let destination = packageOpportunityPath(formData);
  try {
    const items = formStrings(formData, "destination_ids").map((destinationId) => ({
      destination_id: destinationId,
      caption_variant_id: formString(formData, `caption_variant_${destinationId}`),
    }));
    const input = setPostPackageDestinationsSchema.parse({
      package_id: formString(formData, "package_id"),
      expected_updated_at: formString(formData, "expected_updated_at"),
      destinations: items,
    });
    await (await createWebsiteBrainService()).setPostPackageDestinations(input);
    revalidatePath(destination);
    revalidatePath("/record-post");
    destination = messageUrl(destination, "success", "Distribution plan saved.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function skipPostPackageDestinationAction(formData: FormData) {
  let destination = packageOpportunityPath(formData);
  try {
    const input = skipPostPackageDestinationSchema.parse({
      package_id: formString(formData, "package_id"),
      distribution_item_id: formString(formData, "distribution_item_id"),
      expected_updated_at: formString(formData, "expected_updated_at"),
      skip_reason: formString(formData, "skip_reason"),
    });
    await (await createWebsiteBrainService()).skipPostPackageDestination(input);
    revalidatePath(destination);
    revalidatePath("/record-post");
    destination = messageUrl(destination, "success", "Destination marked skipped.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function finishPostPackageAction(formData: FormData) {
  let destination = packageOpportunityPath(formData);
  try {
    const input = finishPostPackageSchema.parse({
      package_id: formString(formData, "package_id"),
      expected_updated_at: formString(formData, "expected_updated_at"),
      outcome: formString(formData, "outcome"),
    });
    await (await createWebsiteBrainService()).finishPostPackage(input);
    revalidatePackageViews(destination);
    destination = messageUrl(destination, "success", input.outcome === "closed" ? "Post Package closed." : "Post Package abandoned.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function createDestinationAction(formData: FormData) {
  let destination = "/destinations";
  try {
    const input = createDestinationSchema.parse({
      name: formString(formData, "name"),
      platform: formString(formData, "platform"),
      posting_identity: formString(formData, "posting_identity"),
      notes: formString(formData, "notes"),
      is_active: true,
    });
    await (await createWebsiteBrainService()).createDestination(input);
    revalidatePath("/destinations");
    revalidatePath("/record-post");
    destination = messageUrl(destination, "success", "Destination added.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}

export async function updateDestinationAction(formData: FormData) {
  let destination = "/destinations";
  try {
    const input = updateDestinationSchema.parse({
      id: formString(formData, "id"),
      name: formString(formData, "name"),
      platform: formString(formData, "platform"),
      posting_identity: formString(formData, "posting_identity"),
      notes: formString(formData, "notes"),
      is_active: formString(formData, "is_active") === "true",
    });
    await (await createWebsiteBrainService()).updateDestination(input);
    revalidatePath("/destinations");
    revalidatePath("/record-post");
    destination = messageUrl(destination, "success", input.is_active ? "Destination updated." : "Destination deactivated.");
  } catch (error) {
    destination = messageUrl(destination, "error", errorMessage(error));
  }
  redirect(destination);
}
