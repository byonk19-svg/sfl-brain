import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type {
  MutablePostPackageSource,
  PostPackage,
  PostPackageAsset,
  PostPackageCaptionVariant,
  PostPackageContext,
  PostPackageDistributionItem,
  PostPackageSummary,
} from "@/lib/post-package";
import { sortPackageAssets } from "@/lib/post-package";
import type {
  createPostPackageSchema,
  finishPostPackageSchema,
  postPackageVariantSchema,
  recordPostFromPackageSchema,
  setPostPackageAssetsSchema,
  setPostPackageDestinationsSchema,
  skipPostPackageDestinationSchema,
} from "@/lib/validation";
import { updatePostPackageSchema } from "@/lib/validation";

export interface PostPackageMutationActor {
  userId: string;
  source: MutablePostPackageSource;
}

type JsonRecord = Record<string, unknown>;

interface PackageGraphRow extends JsonRecord {
  id: string;
  opportunity_id: string;
  sequence: number;
  status: PostPackageSummary["status"];
  base_caption: string | null;
  working_angle: string | null;
  notes: string | null;
  created_source: PostPackageSummary["created_source"];
  updated_source: PostPackageSummary["updated_source"];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  abandoned_at: string | null;
  post_package_caption_variants?: JsonRecord[];
  post_package_assets?: JsonRecord[];
  post_package_destinations?: JsonRecord[];
}

function assertResult<T>(
  result: { data: T | null; error: { message: string } | null },
  action: string,
): T {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${action}: no data returned`);
  return result.data;
}

function mapSummary(row: PackageGraphRow): PostPackageSummary {
  return {
    id: row.id,
    opportunity_id: row.opportunity_id,
    sequence: row.sequence,
    status: row.status,
    base_caption: row.base_caption,
    working_angle: row.working_angle,
    notes: row.notes,
    created_source: row.created_source,
    updated_source: row.updated_source,
    created_at: row.created_at,
    updated_at: row.updated_at,
    closed_at: row.closed_at,
    abandoned_at: row.abandoned_at,
  };
}

function mapSavedPackage(row: JsonRecord): PostPackageSummary {
  return mapSummary(row as PackageGraphRow);
}

function mapCaptionVariant(row: JsonRecord): PostPackageCaptionVariant {
  return {
    id: String(row.id),
    audience: row.audience as PostPackageCaptionVariant["audience"],
    destination_id: (row.destination_id as string | null) ?? null,
    body: String(row.body),
    status: row.status as PostPackageCaptionVariant["status"],
    approved_by: (row.approved_by as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapRecordedPost(row: JsonRecord) {
  return {
    id: String(row.id),
    content_opportunity_id: String(row.content_opportunity_id),
    post_package_id: String(row.post_package_id),
    caption_variant_id: String(row.caption_variant_id),
    distribution_item_id: String(row.distribution_item_id),
    package_updated_at: String(row.package_updated_at),
  };
}

export class PostPackageRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly workspaceId: string,
    private readonly actor?: PostPackageMutationActor,
  ) {}

  private requestId(requestId: string | null | undefined) {
    if (!this.actor) throw new Error("Post package mutation actor is required.");
    if (this.actor.source === "website") {
      if (requestId) throw new Error("Website post package request ID must be omitted.");
      return null;
    }
    if (!requestId) throw new Error("Connector post package request ID is required.");
    return requestId;
  }

  private mutationContext(requestId: string | null | undefined) {
    if (!this.actor) throw new Error("Post package mutation actor is required.");
    return {
      p_actor_user_id: this.actor.userId,
      p_source: this.actor.source,
      p_request_id: this.requestId(requestId),
    };
  }

  private async mapPackage(row: PackageGraphRow): Promise<PostPackage> {
    const captionVariants: PostPackageCaptionVariant[] = (
      row.post_package_caption_variants ?? []
    ).map(mapCaptionVariant);

    const assets = await Promise.all((row.post_package_assets ?? []).map(async (selection) => {
      const asset = selection.assets as JsonRecord;
      const storagePath = asset.storage_path ? String(asset.storage_path) : null;
      let signedUrl: string | null = null;
      if (storagePath) {
        const signed = await this.client.storage
          .from("sfl-assets")
          .createSignedUrl(storagePath, 600);
        if (!signed.error) signedUrl = signed.data.signedUrl;
      }
      return {
        asset_id: String(selection.asset_id),
        role: selection.role as PostPackageAsset["role"],
        position: Number(selection.position),
        note: (selection.note as string | null) ?? null,
        asset: {
          id: String(asset.id),
          title: (asset.title as string | null) ?? null,
          asset_type: String(asset.asset_type),
          source: (asset.source as string | null) ?? null,
          captured_at: (asset.captured_at as string | null) ?? null,
          signed_url: signedUrl,
        },
      } satisfies PostPackageAsset;
    }));

    const distributionItems: PostPackageDistributionItem[] = (
      row.post_package_destinations ?? []
    ).map((item) => {
      const destination = item.destinations as JsonRecord;
      return {
        id: String(item.id),
        destination_id: String(item.destination_id),
        caption_variant_id: String(item.caption_variant_id),
        status: item.status as PostPackageDistributionItem["status"],
        post_id: (item.post_id as string | null) ?? null,
        skip_reason: (item.skip_reason as string | null) ?? null,
        created_at: String(item.created_at),
        updated_at: String(item.updated_at),
        destination: {
          id: String(destination.id),
          name: String(destination.name),
          platform: String(destination.platform),
          posting_identity: String(destination.posting_identity),
          notes: (destination.notes as string | null) ?? null,
          is_active: Boolean(destination.is_active),
        },
      };
    });

    return {
      ...mapSummary(row),
      caption_variants: captionVariants.sort((a, b) =>
        (a.destination_id ?? a.audience).localeCompare(b.destination_id ?? b.audience)),
      assets: sortPackageAssets(assets),
      distribution_items: distributionItems.sort((a, b) =>
        a.destination.name.localeCompare(b.destination.name)),
    };
  }

  async context(opportunityId: string): Promise<PostPackageContext> {
    const result = await this.client
      .from("post_packages")
      .select(
        "id,workspace_id,opportunity_id,sequence,status,base_caption,working_angle,notes,created_source,updated_source,created_at,updated_at,closed_at,abandoned_at,post_package_caption_variants(id,audience,destination_id,body,status,approved_by,approved_at,created_at,updated_at),post_package_assets(asset_id,role,position,note,assets(id,title,asset_type,source,captured_at,storage_path)),post_package_destinations(id,destination_id,caption_variant_id,status,post_id,skip_reason,created_at,updated_at,destinations(id,name,platform,posting_identity,notes,is_active))",
      )
      .eq("workspace_id", this.workspaceId)
      .eq("opportunity_id", opportunityId)
      .order("sequence", { ascending: false });
    const rows = assertResult(result, "Load post package context") as unknown as PackageGraphRow[];
    const packages = await Promise.all(rows.map((row) => this.mapPackage(row)));
    return {
      opportunity_id: opportunityId,
      active_package: packages.find((item) => item.status === "draft" || item.status === "publishing") ?? null,
      prior_packages: packages.filter((item) => item.status === "closed" || item.status === "abandoned"),
    };
  }

  async contextByPackage(packageId: string): Promise<PostPackageContext> {
    const result = await this.client
      .from("post_packages")
      .select("opportunity_id")
      .eq("workspace_id", this.workspaceId)
      .eq("id", packageId)
      .maybeSingle();
    const row = assertResult(result, "Load post package opportunity") as { opportunity_id: string };
    return this.context(row.opportunity_id);
  }

  async create(input: z.infer<typeof createPostPackageSchema>): Promise<PostPackageSummary> {
    const result = await this.client.rpc("create_post_package", {
      p_workspace_id: this.workspaceId,
      p_opportunity_id: input.opportunity_id,
      ...this.mutationContext(input.request_id),
      p_base_caption: input.base_caption ?? null,
      p_working_angle: input.working_angle ?? null,
      p_notes: input.notes ?? null,
    });
    return mapSavedPackage(assertResult(result, "Create post package") as JsonRecord);
  }

  async update(input: z.infer<typeof updatePostPackageSchema>): Promise<PostPackageSummary> {
    const replacement = updatePostPackageSchema.parse(input);
    const result = await this.client.rpc("update_post_package", {
      p_workspace_id: this.workspaceId,
      p_package_id: replacement.package_id,
      ...this.mutationContext(replacement.request_id),
      p_expected_updated_at: replacement.expected_updated_at,
      p_base_caption: replacement.base_caption,
      p_working_angle: replacement.working_angle,
      p_notes: replacement.notes,
    });
    return mapSavedPackage(assertResult(result, "Update post package") as JsonRecord);
  }

  async upsertVariant(input: z.infer<typeof postPackageVariantSchema>): Promise<PostPackageCaptionVariant> {
    const result = assertResult(await this.client.rpc("upsert_post_package_caption_variant", {
      p_workspace_id: this.workspaceId,
      p_package_id: input.package_id,
      ...this.mutationContext(input.request_id),
      p_variant_id: input.variant_id ?? null,
      p_audience: input.audience,
      p_destination_id: input.destination_id ?? null,
      p_body: input.body,
      p_status: input.status,
      p_expected_updated_at: input.expected_updated_at,
    }), "Save caption variant") as JsonRecord;
    return mapCaptionVariant(result);
  }

  async setAssets(input: z.infer<typeof setPostPackageAssetsSchema>): Promise<PostPackageSummary> {
    const result = await this.client.rpc("set_post_package_assets", {
      p_workspace_id: this.workspaceId,
      p_package_id: input.package_id,
      ...this.mutationContext(input.request_id),
      p_expected_updated_at: input.expected_updated_at,
      p_assets: input.assets,
    });
    return mapSavedPackage(assertResult(result, "Save post package assets") as JsonRecord);
  }

  async setDestinations(input: z.infer<typeof setPostPackageDestinationsSchema>): Promise<PostPackageSummary> {
    const result = await this.client.rpc("set_post_package_destinations", {
      p_workspace_id: this.workspaceId,
      p_package_id: input.package_id,
      ...this.mutationContext(input.request_id),
      p_expected_updated_at: input.expected_updated_at,
      p_destinations: input.destinations,
    });
    return mapSavedPackage(assertResult(result, "Save distribution plan") as JsonRecord);
  }

  async skipDestination(input: z.infer<typeof skipPostPackageDestinationSchema>): Promise<PostPackageSummary> {
    const result = await this.client.rpc("skip_post_package_destination", {
      p_workspace_id: this.workspaceId,
      p_package_id: input.package_id,
      p_distribution_item_id: input.distribution_item_id,
      ...this.mutationContext(input.request_id),
      p_expected_updated_at: input.expected_updated_at,
      p_skip_reason: input.skip_reason,
    });
    return mapSavedPackage(assertResult(result, "Skip package destination") as JsonRecord);
  }

  async recordPost(input: z.infer<typeof recordPostFromPackageSchema>) {
    const result = assertResult(await this.client.rpc("record_post_from_package", {
      p_workspace_id: this.workspaceId,
      p_package_id: input.package_id,
      p_distribution_item_id: input.distribution_item_id,
      ...this.mutationContext(input.request_id),
      p_expected_updated_at: input.expected_updated_at,
      p_published_at: input.published_at,
      p_notes: input.notes ?? null,
    }), "Record package publication") as JsonRecord;
    return mapRecordedPost(result);
  }

  async finish(input: z.infer<typeof finishPostPackageSchema>): Promise<PostPackageSummary> {
    const result = await this.client.rpc("finish_post_package", {
      p_workspace_id: this.workspaceId,
      p_package_id: input.package_id,
      ...this.mutationContext(input.request_id),
      p_expected_updated_at: input.expected_updated_at,
      p_outcome: input.outcome,
    });
    return mapSavedPackage(assertResult(result, "Finish post package") as JsonRecord);
  }
}
