import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { getServerEnv } from "@/lib/env";
import {
  getTodayContentCandidates,
  type TodayContentFilters,
} from "@/lib/content-recommendations";
import { OpportunityRepository } from "@/lib/opportunity-repository";
import {
  type RecommendationInput,
} from "@/lib/recommendations";
import type {
  affiliateLinkSchema,
  createOpportunitySchema,
  createProductSchema,
  editOpportunitySchema,
  editProductSchema,
  listingSchema,
  opportunityAssetSchema,
  opportunityProductSchema,
  radarEventSchema,
  recordPostSchema,
} from "@/lib/validation";
import { validateUpload } from "@/lib/validation";

type JsonRecord = Record<string, unknown>;

interface ProductGraphRow {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  lifecycle_status: RecommendationInput["lifecycleStatus"];
  experience_level?: string;
  tags?: string[];
  notes?: string | null;
  listings?: Array<{
    id: string;
    retailer: string;
    current_price: number | string | null;
    currency: string;
    stock_status: RecommendationInput["listings"][number]["stockStatus"];
    is_primary: boolean;
    affiliate_links?: Array<{
      id: string;
      network: string;
      url: string;
      is_active: boolean;
    }>;
  }>;
  asset_products?: Array<{
    assets: {
      id: string;
      title: string | null;
      asset_type: RecommendationInput["assets"][number]["assetType"];
      post_assets?: Array<{ post_id: string }>;
    } | null;
  }>;
  post_products?: Array<{
    posts: {
      published_at: string;
      performance_label: RecommendationInput["posts"][number]["performanceLabel"];
    } | null;
  }>;
  radar_events?: Array<{
    id: string;
    event_type: RecommendationInput["radarEvents"][number]["eventType"];
    happened_at: string;
    expires_at: string | null;
    dismissed_at: string | null;
  }>;
}

function assertResult<T>(result: { data: T | null; error: { message: string } | null }, action: string): T {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${action}: no data returned`);
  return result.data;
}

function toRecommendationInput(row: ProductGraphRow): RecommendationInput {
  const listings = row.listings ?? [];
  return {
    productId: row.id,
    name: row.name,
    lifecycleStatus: row.lifecycle_status,
    listings: listings.map((listing) => ({
      id: listing.id,
      retailer: listing.retailer,
      currentPrice:
        listing.current_price === null ? null : Number(listing.current_price),
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
    assets: (row.asset_products ?? []).flatMap(({ assets }) =>
      assets
        ? [
            {
              id: assets.id,
              title: assets.title,
              assetType: assets.asset_type,
              hasBeenUsed: (assets.post_assets ?? []).length > 0,
            },
          ]
        : [],
    ),
    posts: (row.post_products ?? []).flatMap(({ posts }) =>
      posts
        ? [
            {
              publishedAt: posts.published_at,
              performanceLabel: posts.performance_label,
            },
          ]
        : [],
    ),
    radarEvents: (row.radar_events ?? []).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      happenedAt: event.happened_at,
      expiresAt: event.expires_at,
      dismissedAt: event.dismissed_at,
    })),
  };
}

export class BrainService {
  constructor(
    private readonly client: SupabaseClient,
    private readonly workspaceId: string,
  ) {}

  private opportunityRepository() {
    return new OpportunityRepository(this.client, this.workspaceId);
  }

  private async productGraph() {
    const result = await this.client
      .from("products")
      .select(
        "id,name,brand,category,lifecycle_status,experience_level,tags,notes,listings(id,retailer,current_price,currency,stock_status,is_primary,affiliate_links(id,network,url,is_active)),asset_products(assets(id,title,asset_type,post_assets(post_id))),post_products(posts(published_at,performance_label)),radar_events(id,event_type,happened_at,expires_at,dismissed_at)",
      )
      .eq("workspace_id", this.workspaceId);
    return assertResult(result, "Load recommendation inputs") as unknown as ProductGraphRow[];
  }

  async getRecommendationInputs() {
    return (await this.productGraph()).map(toRecommendationInput);
  }

  async getContentOpportunityInputs() {
    return this.opportunityRepository().inputs();
  }

  async getRecentContentMix(limit = 5) {
    return this.opportunityRepository().recentMix(limit);
  }

  async getTodayCandidates(filters: TodayContentFilters = {}) {
    return getTodayContentCandidates(
      await this.getContentOpportunityInputs(),
      filters,
    );
  }

  async searchContentBacklog(query = "", limit = 100) {
    return this.opportunityRepository().search(query, limit);
  }

  async getOpportunityContext(opportunityId: string) {
    return this.opportunityRepository().context(opportunityId);
  }

  async searchLibrary(query = "", limit = 50): Promise<JsonRecord[]> {
    const normalized = query.trim().toLowerCase();
    const rows = await this.productGraph();
    const inputs = rows.map(toRecommendationInput);
    return rows
      .map((row, index) => {
        const input = inputs[index]!;
        const latest = [...input.posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
        const activeEvents = input.radarEvents.filter(
          (event) =>
            !event.dismissedAt &&
            new Date(event.happenedAt) <= new Date() &&
            (!event.expiresAt || new Date(event.expiresAt) >= new Date()),
        );
        const primary = input.listings.find((listing) => listing.isPrimary) ?? input.listings[0] ?? null;
        const haystack = [
          row.name,
          row.brand,
          ...(row.tags ?? []),
          ...input.listings.map((listing) => listing.retailer),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return {
          id: row.id,
          name: row.name,
          brand: row.brand ?? null,
          category: row.category ?? null,
          tags: row.tags ?? [],
          lifecycle_status: row.lifecycle_status,
          experience_level: row.experience_level,
          retailer: primary?.retailer ?? null,
          stock_status: primary?.stockStatus ?? "unknown",
          current_price: primary?.currentPrice ?? null,
          currency: primary?.currency ?? "USD",
          assets_count: input.assets.length,
          last_posted_at: latest?.publishedAt ?? null,
          performance: input.posts.some((post) => post.performanceLabel === "winner") ? "winner" : latest?.performanceLabel ?? "unknown",
          active_radar_event: activeEvents[0]?.eventType ?? null,
          matches: !normalized || haystack.includes(normalized),
        };
      })
      .filter((row) => row.matches)
      .slice(0, Math.min(Math.max(limit, 1), 100))
      .map((row) => {
        const output: Omit<typeof row, "matches"> & { matches?: boolean } = { ...row };
        delete output.matches;
        return output;
      });
  }

  async getProductContext(productId: string): Promise<JsonRecord | null> {
    const result = await this.client
      .from("products")
      .select(
        "*,listings(*,affiliate_links(*)),asset_products(role,assets(*)),post_products(role,posts(*,destinations(*),post_assets(position,assets(id,title,asset_type,source,captured_at)),post_metrics(*))),radar_events(*),content_opportunity_products(role,content_opportunities(id,title,status,content_type,next_action,estimated_minutes_remaining,archived_at))",
      )
      .eq("workspace_id", this.workspaceId)
      .eq("id", productId)
      .maybeSingle();
    if (result.error) throw new Error(`Load product context: ${result.error.message}`);
    if (!result.data) return null;

    const product = result.data as JsonRecord;
    const joins = (product.asset_products as Array<JsonRecord> | undefined) ?? [];
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
    return { ...product, asset_products: signedAssets };
  }

  async getRecentPosts(options: {
    days: number;
    productId?: string;
    destinationId?: string;
    contentOpportunityId?: string;
  }): Promise<JsonRecord[]> {
    const productSelection = options.productId
      ? "post_products!inner(product_id,products(id,name))"
      : "post_products(product_id,products(id,name))";
    let query = this.client
      .from("posts")
      .select(`id,published_at,caption,angle,performance_label,notes,destination_id,content_opportunity_id,content_opportunities(id,title,status,content_type),destinations(id,name,platform),${productSelection},post_assets(asset_id,position,assets(id,title,asset_type))`)
      .eq("workspace_id", this.workspaceId)
      .gte("published_at", new Date(Date.now() - options.days * 86_400_000).toISOString())
      .order("published_at", { ascending: false });
    if (options.destinationId) query = query.eq("destination_id", options.destinationId);
    if (options.productId) query = query.eq("post_products.product_id", options.productId);
    if (options.contentOpportunityId) {
      query = query.eq("content_opportunity_id", options.contentOpportunityId);
    }
    return assertResult(await query, "Load recent posts") as unknown as JsonRecord[];
  }

  async getRevivalEvents(activeOnly = true, limit = 20): Promise<JsonRecord[]> {
    let query = this.client
      .from("radar_events")
      .select("id,event_type,source,happened_at,expires_at,dismissed_at,metadata,products(id,name,content_opportunity_products(role,content_opportunities(id,title,status,content_type,archived_at))),listings(id,retailer,current_price,currency,stock_status)")
      .eq("workspace_id", this.workspaceId)
      .lte("happened_at", new Date().toISOString())
      .order("happened_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (activeOnly) {
      query = query.is("dismissed_at", null).or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);
    }
    return assertResult(await query, "Load Revival Radar events") as unknown as JsonRecord[];
  }

  async getFormOptions() {
    const [products, destinations, assets, opportunities] = await Promise.all([
      this.client.from("products").select("id,name").eq("workspace_id", this.workspaceId).eq("lifecycle_status", "active").order("name"),
      this.client.from("destinations").select("id,name,platform").eq("workspace_id", this.workspaceId).eq("is_active", true).order("name"),
      this.client.from("assets").select("id,title,asset_type").eq("workspace_id", this.workspaceId).order("created_at", { ascending: false }),
      this.client.from("content_opportunities").select("id,title,status,content_type,content_opportunity_products(product_id),content_opportunity_assets(asset_id)").eq("workspace_id", this.workspaceId).is("archived_at", null).order("title"),
    ]);
    return {
      products: assertResult(products, "Load products"),
      destinations: assertResult(destinations, "Load destinations"),
      assets: assertResult(assets, "Load assets"),
      opportunities: assertResult(opportunities, "Load content opportunities"),
    };
  }

  async createContentOpportunity(
    input: z.infer<typeof createOpportunitySchema>,
  ) {
    return this.opportunityRepository().create(input);
  }

  async updateContentOpportunity(
    input: z.infer<typeof editOpportunitySchema>,
  ) {
    return this.opportunityRepository().update(input);
  }

  async attachOpportunityProduct(
    input: z.infer<typeof opportunityProductSchema>,
  ) {
    return this.opportunityRepository().attachProduct(input);
  }

  async attachOpportunityAsset(
    input: z.infer<typeof opportunityAssetSchema>,
  ) {
    return this.opportunityRepository().attachAsset(input);
  }

  async detachOpportunityProduct(opportunityId: string, productId: string) {
    return this.opportunityRepository().detachProduct(opportunityId, productId);
  }

  async detachOpportunityAsset(opportunityId: string, assetId: string) {
    return this.opportunityRepository().detachAsset(opportunityId, assetId);
  }

  async setContentOpportunityArchived(
    opportunityId: string,
    archived: boolean,
  ) {
    return this.opportunityRepository().setArchived(opportunityId, archived);
  }

  async createProduct(input: z.infer<typeof createProductSchema>) {
    return assertResult(
      await this.client.rpc("create_product", {
        p_workspace_id: this.workspaceId,
        p_name: input.name,
        p_experience_level: input.experience_level,
        p_brand: input.brand ?? null,
        p_category: input.category ?? null,
        p_tags: input.tags,
        p_notes: input.notes ?? null,
        p_retailer: input.retailer ?? null,
        p_canonical_url: input.canonical_url ?? null,
        p_current_price: input.current_price ?? null,
        p_stock_status: input.stock_status,
        p_affiliate_network: input.affiliate_network ?? null,
        p_affiliate_url: input.affiliate_url ?? null,
      }),
      "Create product",
    ) as unknown as string;
  }

  async updateProduct(input: z.infer<typeof editProductSchema>) {
    assertResult(
      await this.client
        .from("products")
        .update({
          name: input.name,
          brand: input.brand ?? null,
          category: input.category ?? null,
          lifecycle_status: input.lifecycle_status,
          experience_level: input.experience_level,
          tags: input.tags,
          notes: input.notes ?? null,
        })
        .eq("workspace_id", this.workspaceId)
        .eq("id", input.id)
        .select("id")
        .single(),
      "Update product",
    );
  }

  async addListing(input: z.infer<typeof listingSchema>) {
    return assertResult(
      await this.client.rpc("add_listing", {
        p_workspace_id: this.workspaceId,
        p_product_id: input.product_id,
        p_retailer: input.retailer,
        p_canonical_url: input.canonical_url,
        p_variant_label: input.variant_label ?? null,
        p_current_price: input.current_price ?? null,
        p_stock_status: input.stock_status,
        p_is_primary: input.is_primary,
      }),
      "Add listing",
    );
  }

  async addAffiliateLink(input: z.infer<typeof affiliateLinkSchema>) {
    return assertResult(
      await this.client
        .from("affiliate_links")
        .insert({
          workspace_id: this.workspaceId,
          listing_id: input.listing_id,
          network: input.network,
          url: input.url,
        })
        .select("id")
        .single(),
      "Add affiliate link",
    );
  }

  async addRadarEvent(input: z.infer<typeof radarEventSchema>) {
    return assertResult(
      await this.client
        .from("radar_events")
        .insert({
          workspace_id: this.workspaceId,
          product_id: input.product_id,
          listing_id: input.listing_id ?? null,
          event_type: input.event_type,
          source: input.source ?? "manual",
          happened_at: input.happened_at,
          expires_at: input.expires_at ?? null,
        })
        .select("id")
        .single(),
      "Add Radar event",
    );
  }

  async recordPost(input: z.infer<typeof recordPostSchema>) {
    return assertResult(
      await this.client.rpc("record_post", {
        p_workspace_id: this.workspaceId,
        p_content_opportunity_id: input.content_opportunity_id,
        p_destination_id: input.destination_id,
        p_published_at: input.published_at,
        p_product_ids: input.product_ids,
        p_asset_ids: input.asset_ids,
        p_caption: input.caption ?? null,
        p_angle: input.angle ?? null,
        p_performance_label: input.performance_label,
        p_notes: input.notes ?? null,
      }),
      "Record post",
    );
  }

  async uploadAsset(options: {
    productId?: string;
    opportunityId?: string;
    title?: string;
    source: "home" | "in_store" | "canva" | "web" | "other";
    file: File;
  }) {
    if (!options.productId && !options.opportunityId) {
      throw new Error("Choose a product or content opportunity for this asset.");
    }
    if (!["home", "in_store", "canva", "web", "other"].includes(options.source)) {
      throw new Error("Choose a valid asset source.");
    }
    const validationError = validateUpload(options.file);
    if (validationError) throw new Error(validationError);
    const extension = options.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const ownerPath = options.productId
      ? `products/${options.productId}`
      : `opportunities/${options.opportunityId}`;
    const storagePath = `${this.workspaceId}/${ownerPath}/${crypto.randomUUID()}.${extension}`;
    const upload = await this.client.storage.from("sfl-assets").upload(storagePath, options.file, {
      contentType: options.file.type,
      upsert: false,
    });
    if (upload.error) throw new Error(`Upload asset: ${upload.error.message}`);

    try {
      const assetType = options.file.type.startsWith("video/") ? "video" : "photo";
      const asset = assertResult(
        await this.client
          .from("assets")
          .insert({
            workspace_id: this.workspaceId,
            title: options.title?.trim() || null,
            asset_type: assetType,
            source: options.source,
            storage_path: storagePath,
            original_filename: options.file.name,
            captured_at: new Date().toISOString(),
          })
          .select("id")
          .single(),
        "Save asset metadata",
      ) as { id: string };
      if (options.productId) {
        const join = await this.client.from("asset_products").insert({
          asset_id: asset.id,
          product_id: options.productId,
          role: "primary",
        });
        if (join.error) {
          throw new Error(`Associate asset with product: ${join.error.message}`);
        }
      }
      if (options.opportunityId) {
        await this.attachOpportunityAsset({
          opportunity_id: options.opportunityId,
          asset_id: asset.id,
          role: "primary",
        });
      }
      return asset.id;
    } catch (error) {
      await this.client.from("assets").delete().eq("storage_path", storagePath);
      await this.client.storage.from("sfl-assets").remove([storagePath]);
      throw error;
    }
  }
}

export function createBrainService() {
  const env = getServerEnv();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return new BrainService(client, env.SFL_WORKSPACE_ID);
}
