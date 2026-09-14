import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import {
  getRecentContentMix as buildRecentContentMix,
  scoreContentOpportunity,
  type ContentOpportunityInput,
  type ContentType,
  type MediaFormat,
  type OpportunityAssetInput,
  type OpportunityHoldInput,
  type OpportunityProductInput,
  type OpportunityStatus,
} from "@/lib/content-recommendations";
import type {
  createOpportunitySchema,
  editOpportunitySchema,
  opportunityAssetSchema,
  opportunityProductSchema,
} from "@/lib/validation";

type JsonRecord = Record<string, unknown>;

export type OpportunityAttentionScope = "active" | "on_hold" | "all";

type AttentionScopedOpportunity = { currentHold?: unknown | null };

export function filterOpportunitiesForScope<T extends AttentionScopedOpportunity>(
  opportunities: T[],
  scope: OpportunityAttentionScope,
) {
  if (scope === "all") return opportunities;
  return opportunities.filter((opportunity) =>
    scope === "on_hold" ? Boolean(opportunity.currentHold) : !opportunity.currentHold,
  );
}

type HoldListRow = { id: string; review_on: string | null; held_at: string };

export function sortOnHoldRows<T extends HoldListRow>(rows: T[], now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return [...rows].sort((a, b) => {
    const aDue = a.review_on !== null && a.review_on <= today;
    const bDue = b.review_on !== null && b.review_on <= today;
    if (aDue !== bDue) return aDue ? -1 : 1;
    if (a.review_on !== null && b.review_on !== null) {
      return a.review_on.localeCompare(b.review_on) || a.id.localeCompare(b.id);
    }
    if (a.review_on !== null || b.review_on !== null) return a.review_on !== null ? -1 : 1;
    return b.held_at.localeCompare(a.held_at) || a.id.localeCompare(b.id);
  });
}

interface OpportunityGraphRow {
  id: string;
  title: string;
  status: OpportunityStatus;
  content_type: ContentType;
  media_format: MediaFormat | null;
  notes: string | null;
  next_action: string | null;
  estimated_minutes_remaining: number | null;
  archived_at: string | null;
  content_opportunity_holds?: Array<{
    id: string;
    hold_reason: string;
    release_condition: string;
    review_on: string | null;
    held_at: string;
    updated_at: string;
    released_at: string | null;
  }>;
  content_opportunity_products?: Array<{
    role: OpportunityProductInput["role"];
    products: {
      id: string;
      name: string;
      lifecycle_status: OpportunityProductInput["lifecycleStatus"];
      listings?: Array<{
        id: string;
        retailer: string;
        current_price: number | string | null;
        currency: string;
        stock_status: OpportunityProductInput["listings"][number]["stockStatus"];
        is_primary: boolean;
        affiliate_links?: Array<{
          id: string;
          network: string;
          url: string;
          is_active: boolean;
        }>;
      }>;
      radar_events?: Array<{
        id: string;
        event_type: OpportunityProductInput["radarEvents"][number]["eventType"];
        happened_at: string;
        expires_at: string | null;
        dismissed_at: string | null;
      }>;
    } | null;
  }>;
  content_opportunity_assets?: Array<{
    role: OpportunityAssetInput["role"];
    assets: {
      id: string;
      title: string | null;
      asset_type: OpportunityAssetInput["assetType"];
      post_assets?: Array<{ post_id: string }>;
    } | null;
  }>;
  posts?: Array<{
    id: string;
    destination_id: string;
    published_at: string;
    performance_label: ContentOpportunityInput["posts"][number]["performanceLabel"];
    destinations: { name: string } | null;
  }>;
}

function assertResult<T>(
  result: { data: T | null; error: { message: string } | null },
  action: string,
): T {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${action}: no data returned`);
  return result.data;
}

function mapOpportunity(row: OpportunityGraphRow): ContentOpportunityInput {
  const currentHold = (row.content_opportunity_holds ?? []).find(
    (hold) => hold.released_at === null,
  );
  return {
    opportunityId: row.id,
    title: row.title,
    status: row.status,
    contentType: row.content_type,
    mediaFormat: row.media_format,
    notes: row.notes,
    nextAction: row.next_action,
    estimatedMinutesRemaining: row.estimated_minutes_remaining,
    archivedAt: row.archived_at,
    currentHold: currentHold ? {
      id: currentHold.id,
      holdReason: currentHold.hold_reason,
      releaseCondition: currentHold.release_condition,
      reviewOn: currentHold.review_on,
      heldAt: currentHold.held_at,
      updatedAt: currentHold.updated_at,
    } satisfies OpportunityHoldInput : null,
    products: (row.content_opportunity_products ?? []).flatMap((join) => {
      const product = join.products;
      if (!product) return [];
      const listings = product.listings ?? [];
      return [
        {
          productId: product.id,
          name: product.name,
          lifecycleStatus: product.lifecycle_status,
          role: join.role,
          listings: listings.map((listing) => ({
            id: listing.id,
            retailer: listing.retailer,
            currentPrice:
              listing.current_price === null
                ? null
                : Number(listing.current_price),
            currency: listing.currency,
            stockStatus: listing.stock_status,
            isPrimary: listing.is_primary,
          })),
          affiliateLinks: listings.flatMap((listing) =>
            (listing.affiliate_links ?? []).map((link) => ({
              id: link.id,
              listingId: listing.id,
              network: link.network,
              url: link.url,
              isActive: link.is_active,
            })),
          ),
          radarEvents: (product.radar_events ?? []).map((event) => ({
            id: event.id,
            eventType: event.event_type,
            happenedAt: event.happened_at,
            expiresAt: event.expires_at,
            dismissedAt: event.dismissed_at,
          })),
        },
      ];
    }),
    assets: (row.content_opportunity_assets ?? []).flatMap((join) =>
      join.assets
        ? [
            {
              id: join.assets.id,
              title: join.assets.title,
              assetType: join.assets.asset_type,
              role: join.role,
              hasBeenUsed: (join.assets.post_assets ?? []).length > 0,
            },
          ]
        : [],
    ),
    posts: (row.posts ?? []).map((post) => ({
      id: post.id,
      destinationId: post.destination_id,
      destinationName: post.destinations?.name ?? "Unknown destination",
      publishedAt: post.published_at,
      performanceLabel: post.performance_label,
    })),
  };
}

export class OpportunityRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly workspaceId: string,
  ) {}

  async inputs() {
    const result = await this.client
      .from("content_opportunities")
      .select(
        "id,title,status,content_type,media_format,notes,next_action,estimated_minutes_remaining,archived_at,content_opportunity_holds(id,hold_reason,release_condition,review_on,held_at,updated_at,released_at),content_opportunity_products(role,products(id,name,lifecycle_status,listings(id,retailer,current_price,currency,stock_status,is_primary,affiliate_links(id,network,url,is_active)),radar_events(id,event_type,happened_at,expires_at,dismissed_at))),content_opportunity_assets(role,assets(id,title,asset_type,post_assets(post_id))),posts(id,destination_id,published_at,performance_label,destinations(name))",
      )
      .eq("workspace_id", this.workspaceId);
    return (
      assertResult(result, "Load content opportunities") as unknown as OpportunityGraphRow[]
    ).map(mapOpportunity);
  }

  async recentMix(limit = 5) {
    return buildRecentContentMix(await this.inputs(), limit);
  }

  async search(
    query = "",
    limit = 100,
    scope: OpportunityAttentionScope = "active",
  ): Promise<JsonRecord[]> {
    const normalized = query.trim().toLowerCase();
    const now = new Date();
    const rows = filterOpportunitiesForScope(await this.inputs(), scope)
      .filter((opportunity) => !opportunity.archivedAt)
      .map((opportunity) => {
        const scored = scoreContentOpportunity(opportunity, [], now);
        const haystack = [
          opportunity.title,
          opportunity.notes,
          opportunity.nextAction,
          opportunity.contentType,
          opportunity.currentHold?.holdReason,
          opportunity.currentHold?.releaseCondition,
          ...opportunity.products.flatMap((product) => [
            product.name,
            ...product.listings.map((listing) => listing.retailer),
          ]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return {
          id: opportunity.opportunityId,
          title: opportunity.title,
          status: opportunity.status,
          content_type: opportunity.contentType,
          media_format: opportunity.mediaFormat,
          next_action: opportunity.nextAction,
          estimated_effort_minutes: scored.estimated_effort_minutes,
          products_count: opportunity.products.length,
          assets_count: opportunity.assets.length,
          active_links_count: scored.link_summary.active,
          last_published_at: scored.last_published_at,
          destination_count: scored.publication_summary.destination_count,
          hold_reason: opportunity.currentHold?.holdReason ?? null,
          release_condition: opportunity.currentHold?.releaseCondition ?? null,
          review_on: opportunity.currentHold?.reviewOn ?? null,
          held_at: opportunity.currentHold?.heldAt ?? null,
          hold_updated_at: opportunity.currentHold?.updatedAt ?? null,
          review_due: Boolean(
            opportunity.currentHold?.reviewOn &&
              opportunity.currentHold.reviewOn <= now.toISOString().slice(0, 10),
          ),
          matches: !normalized || haystack.includes(normalized),
        };
      })
      .filter((row) => row.matches);
    const sorted = scope === "on_hold"
      ? sortOnHoldRows(rows.map((row) => ({ ...row, held_at: row.held_at ?? "" })), now)
      : rows.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
    return sorted.slice(0, Math.min(Math.max(limit, 1), 100)).map((row) => {
        const output: Omit<typeof row, "matches"> & { matches?: boolean } = {
          ...row,
        };
        delete output.matches;
        return output;
      });
  }

  async context(opportunityId: string): Promise<JsonRecord | null> {
    const result = await this.client
      .from("content_opportunities")
      .select(
        "*,content_opportunity_holds(*),content_opportunity_products(role,products(*,listings(*,affiliate_links(*)),radar_events(*))),content_opportunity_assets(role,assets(*)),posts(*,destinations(*),post_metrics(*),post_assets(position,assets(id,title,asset_type)))",
      )
      .eq("workspace_id", this.workspaceId)
      .eq("id", opportunityId)
      .maybeSingle();
    if (result.error) {
      throw new Error(`Load content opportunity: ${result.error.message}`);
    }
    if (!result.data) return null;

    const opportunity = result.data as JsonRecord;
    const joins =
      (opportunity.content_opportunity_assets as JsonRecord[] | undefined) ?? [];
    const signedAssets = await Promise.all(
      joins.map(async (join) => {
        const asset = join.assets as JsonRecord | null;
        if (!asset?.storage_path) return join;
        const signed = await this.client.storage
          .from("sfl-assets")
          .createSignedUrl(String(asset.storage_path), 600);
        return {
          ...join,
          assets: {
            ...asset,
            signed_url: signed.error ? null : signed.data.signedUrl,
          },
        };
      }),
    );
    return { ...opportunity, content_opportunity_assets: signedAssets };
  }

  async create(input: z.infer<typeof createOpportunitySchema>) {
    return assertResult(
      await this.client.rpc("create_content_opportunity", {
        p_workspace_id: this.workspaceId,
        p_title: input.title,
        p_status: input.status,
        p_content_type: input.content_type,
        p_media_format: input.media_format ?? null,
        p_notes: input.notes ?? null,
        p_next_action: input.next_action ?? null,
        p_estimated_minutes_remaining:
          input.estimated_minutes_remaining ?? null,
        p_product_ids: input.product_ids,
        p_asset_ids: input.asset_ids,
      }),
      "Create content opportunity",
    ) as unknown as string;
  }

  async createDevelopmentTestOpportunity(requestId: string): Promise<string> {
    return assertResult(
      await this.client.rpc("create_development_test_content_opportunity", {
        p_workspace_id: this.workspaceId,
        p_request_id: requestId,
      }),
      "Create development test opportunity",
    ) as unknown as string;
  }

  async update(input: z.infer<typeof editOpportunitySchema>) {
    assertResult(
      await this.client
        .from("content_opportunities")
        .update({
          title: input.title,
          status: input.status,
          content_type: input.content_type,
          media_format: input.media_format ?? null,
          notes: input.notes ?? null,
          next_action: input.next_action ?? null,
          estimated_minutes_remaining:
            input.estimated_minutes_remaining ?? null,
        })
        .eq("workspace_id", this.workspaceId)
        .eq("id", input.id)
        .select("id")
        .single(),
      "Update content opportunity",
    );
  }

  async attachProduct(input: z.infer<typeof opportunityProductSchema>) {
    return assertResult(
      await this.client.rpc("attach_content_opportunity_product", {
        p_workspace_id: this.workspaceId,
        p_opportunity_id: input.opportunity_id,
        p_product_id: input.product_id,
        p_role: input.role,
      }),
      "Attach product",
    );
  }

  async attachAsset(input: z.infer<typeof opportunityAssetSchema>) {
    return assertResult(
      await this.client.rpc("attach_content_opportunity_asset", {
        p_workspace_id: this.workspaceId,
        p_opportunity_id: input.opportunity_id,
        p_asset_id: input.asset_id,
        p_role: input.role,
      }),
      "Attach asset",
    );
  }

  async detachProduct(opportunityId: string, productId: string) {
    assertResult(
      await this.client.rpc("detach_content_opportunity_product", {
        p_workspace_id: this.workspaceId,
        p_opportunity_id: opportunityId,
        p_product_id: productId,
      }),
      "Remove product from opportunity",
    );
  }

  async detachAsset(opportunityId: string, assetId: string) {
    assertResult(
      await this.client.rpc("detach_content_opportunity_asset", {
        p_workspace_id: this.workspaceId,
        p_opportunity_id: opportunityId,
        p_asset_id: assetId,
      }),
      "Remove asset from opportunity",
    );
  }

  async setArchived(opportunityId: string, archived: boolean) {
    assertResult(
      await this.client
        .from("content_opportunities")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("workspace_id", this.workspaceId)
        .eq("id", opportunityId)
        .select("id")
        .single(),
      archived ? "Archive content opportunity" : "Restore content opportunity",
    );
  }
}
