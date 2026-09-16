import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createPilotOpportunitySchema, recordPilotPostSchema, updatePilotOpportunitySchema, type CreatePilotOpportunityInput, type RecordPilotPostInput, type UpdatePilotOpportunityInput } from "@/lib/mcp/pilot-write-schemas";
import { placeHoldSchema, releaseHoldSchema, updateHoldSchema, type PlaceHoldInput, type ReleaseHoldInput, type UpdateHoldInput } from "@/lib/mcp/hold-schemas";
import {
  createPostPackageToolSchema,
  finishPostPackageToolSchema,
  setPostPackageAssetsToolSchema,
  setPostPackageDestinationsToolSchema,
  skipPostPackageDestinationToolSchema,
  updatePostPackageToolSchema,
  upsertPostPackageCaptionVariantToolSchema,
  type CreatePostPackageToolInput,
  type FinishPostPackageToolInput,
  type SetPostPackageAssetsToolInput,
  type SetPostPackageDestinationsToolInput,
  type SkipPostPackageDestinationToolInput,
  type UpdatePostPackageToolInput,
  type UpsertPostPackageCaptionVariantToolInput,
} from "@/lib/mcp/post-package-schemas";
import type { PostPackageContext, PostPackageSummary, PostPackageCaptionVariant } from "@/lib/post-package";

import type {
  TodayContentCandidate,
  TodayContentFilters,
} from "@/lib/content-recommendations";

type JsonRecord = Record<string, unknown>;

export interface BrainReader {
  getTodayCandidates(filters: TodayContentFilters): Promise<TodayContentCandidate[]>;
  searchContentBacklog(query: string, limit: number, scope?: "active" | "on_hold" | "all"): Promise<JsonRecord[]>;
  searchOnHoldOpportunities?(query: string, limit: number): Promise<JsonRecord[]>;
  searchLibrary(query: string, limit: number): Promise<JsonRecord[]>;
  getProductContext(productId: string): Promise<JsonRecord | null>;
  getOpportunityContext(opportunityId: string): Promise<JsonRecord | null>;
  getPostPackageContext(opportunityId: string): Promise<PostPackageContext>;
  getPostPackageContextByPackage?(packageId: string): Promise<PostPackageContext>;
  createDevelopmentTestOpportunity?(requestId: string): Promise<string>;
  getAvailableDestinations?(): Promise<JsonRecord[]>;
  createPilotContentOpportunity?(input: CreatePilotOpportunityInput): Promise<JsonRecord>;
  updatePilotContentOpportunity?(input: UpdatePilotOpportunityInput): Promise<JsonRecord>;
  recordPilotPost?(input: RecordPilotPostInput): Promise<JsonRecord>;
  placeContentOpportunityOnHold?(input: PlaceHoldInput): Promise<JsonRecord>;
  updateContentOpportunityHold?(input: UpdateHoldInput): Promise<JsonRecord>;
  releaseContentOpportunityHold?(input: ReleaseHoldInput): Promise<JsonRecord>;
  createPostPackage?(input: CreatePostPackageToolInput): Promise<PostPackageSummary>;
  updatePostPackage?(input: UpdatePostPackageToolInput): Promise<PostPackageSummary>;
  upsertPostPackageVariant?(input: UpsertPostPackageCaptionVariantToolInput): Promise<PostPackageCaptionVariant>;
  setPostPackageAssets?(input: SetPostPackageAssetsToolInput): Promise<PostPackageSummary>;
  setPostPackageDestinations?(input: SetPostPackageDestinationsToolInput): Promise<PostPackageSummary>;
  skipPostPackageDestination?(input: SkipPostPackageDestinationToolInput): Promise<PostPackageSummary>;
  finishPostPackage?(input: Omit<FinishPostPackageToolInput, "action"> & { outcome: "closed" | "abandoned" }): Promise<PostPackageSummary>;
  getRecentPosts(options: {
    days: number;
    productId?: string;
    destinationId?: string;
    contentOpportunityId?: string;
  }): Promise<JsonRecord[]>;
  getRevivalEvents(activeOnly: boolean, limit: number): Promise<JsonRecord[]>;
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const developmentWriteAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !["storage_path", "SUPABASE_SERVICE_ROLE_KEY"].includes(key))
        .map(([key, child]) => [key, sanitize(child)]),
    );
  }
  return value;
}

const internalPackageKeys = new Set([
  "storage_path",
  "SUPABASE_SERVICE_ROLE_KEY",
  "workspace_id",
  "actor_user_id",
  "created_by",
  "updated_by",
  "approved_by",
]);

function isTrustedSignedAssetUrl(value: string, trustedStorageOrigin?: string) {
  try {
    const url = new URL(value);
    const expected = trustedStorageOrigin ? new URL(trustedStorageOrigin) : null;
    return Boolean(
      expected &&
      expected.protocol === "https:" &&
      url.protocol === "https:" &&
      url.origin === expected.origin &&
      /^\/storage\/v1\/object\/sign\/sfl-assets\/.+/.test(url.pathname) &&
      Boolean(url.searchParams.get("token")),
    );
  } catch {
    return false;
  }
}

function sanitizePostPackage(value: unknown, trustedStorageOrigin?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizePostPackage(item, trustedStorageOrigin));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, child]) => {
        if (
          internalPackageKeys.has(key) ||
          /(^|_)(access_token|refresh_token|password|credential|secret|api_key|private_key)$/i.test(key)
        ) return [];
        if (key === "signed_url" && typeof child === "string" && !isTrustedSignedAssetUrl(child, trustedStorageOrigin)) {
          return [[key, null]];
        }
        return [[key, sanitizePostPackage(child, trustedStorageOrigin)]];
      }),
    );
  }
  return value;
}

function success(key: string, value: unknown, summary: string) {
  return {
    content: [{ type: "text" as const, text: `${summary}\n\n${JSON.stringify(value, null, 2)}` }],
    structuredContent: { [key]: value },
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected SFL Brain error";
  return {
    isError: true,
    content: [{ type: "text" as const, text: `SFL Brain could not complete the read: ${message}` }],
  };
}

export function createSflMcpServer(
  reader: BrainReader,
  options: {
    enableDevelopmentTestWrite?: boolean;
    enablePilotWrites?: boolean;
    enablePostPackageWrites?: boolean;
    trustedStorageOrigin?: string;
  } = {},
) {
  const server = new McpServer(
    { name: "sfl-brain", version: "0.2.1" },
    {
      instructions:
        "Read-only facts and deterministic recommendations for Styled For Less. Use these tools to ground editorial judgment; never imply that the Brain publishes or monitors retailers.",
    },
  );

  server.registerTool(
    "get_today_candidates",
    {
      title: "Get Today Candidates",
      description:
        "Use when the user asks what to post today, wants a quick or low-effort post, asks what is worth resurfacing, or wants to compare available posting opportunities.",
      inputSchema: z.object({
        max_effort_minutes: z.number().int().positive().max(480).optional(),
        no_new_photos: z.boolean().optional(),
        candidate_type: z.literal("revival").optional(),
        sort: z.enum(["best", "closest_to_done"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async (args) => {
      try {
        const candidates = await reader.getTodayCandidates(args);
        return success(
          "candidates",
          candidates,
          candidates.length
            ? `${candidates.length} posting candidate${candidates.length === 1 ? "" : "s"}, ranked by stored facts.`
            : "No posting candidates match those filters.",
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  if (options.enableDevelopmentTestWrite) {
    server.registerTool(
      "create_development_test_opportunity",
      {
        title: "Create Development Test Opportunity",
        description:
          "Development-only write test. Creates one clearly labeled demo content opportunity for a caller-provided request ID; repeat calls with the same ID return the same record.",
        inputSchema: z.object({ request_id: z.uuid() }),
        annotations: developmentWriteAnnotations,
      },
      async ({ request_id }) => {
        try {
          if (!reader.createDevelopmentTestOpportunity) {
            return failure(new Error("Development test writing is not configured"));
          }
          const opportunity = {
            id: await reader.createDevelopmentTestOpportunity(request_id),
          };
          return success(
            "opportunity",
            opportunity,
            "Development test opportunity saved. Use its ID with get_content_opportunity_context.",
          );
        } catch (error) {
          return failure(error);
        }
      },
    );
  }

  server.registerTool("get_available_destinations", {
    title: "Get Available Destinations", description: "Read active posting destinations before recording an actual publication.", inputSchema: z.object({}), annotations: readOnlyAnnotations,
  }, async () => { try { return success("destinations", await reader.getAvailableDestinations?.() ?? [], "Active posting destinations."); } catch (error) { return failure(error); } });

  server.registerTool("get_on_hold_opportunities", { title: "Get On-Hold Opportunities", description: "List retained opportunities that are excluded from active work, ordered for manual review.", inputSchema: z.object({ query: z.string().trim().max(200).default(""), limit: z.number().int().min(1).max(100).default(20) }), annotations: readOnlyAnnotations }, async ({ query, limit }) => {
    try { return success("opportunities", await reader.searchOnHoldOpportunities?.(query, limit) ?? [], "On-hold content opportunities."); } catch (error) { return failure(error); }
  });

  server.registerTool("get_post_package_context", {
    title: "Get Post Package Context",
    description: "Read the active Post Package and prior package history for one verified content opportunity before proposing or confirming any package change.",
    inputSchema: z.object({ opportunity_id: z.uuid() }),
    annotations: readOnlyAnnotations,
  }, async ({ opportunity_id }) => {
    try {
      return success(
        "post_package_context",
        sanitizePostPackage(await reader.getPostPackageContext(opportunity_id), options.trustedStorageOrigin),
        "Current Post Package context.",
      );
    } catch (error) {
      return failure(error);
    }
  });

  const unavailable = (name: string) => failure(new Error(`${name} is not configured`));
  if (options.enablePilotWrites) {
    server.registerTool("create_content_opportunity", { title: "Save Content Idea", description: "Save a real content idea. Use only when the user asks to save it; products, links, and assets are optional.", inputSchema: createPilotOpportunitySchema, annotations: developmentWriteAnnotations }, async (args) => {
      try { if (!reader.createPilotContentOpportunity) return unavailable("Create content opportunity"); const result = await reader.createPilotContentOpportunity(args); const id = String(result.opportunity_id); const saved = await reader.getOpportunityContext(id); return success("opportunity", { id, saved_state: sanitize(saved) }, "Content idea saved."); } catch (error) { return failure(error); }
    });
    server.registerTool("update_content_opportunity", { title: "Update Content Progress", description: "Update explicitly supplied progress fields on a verified content opportunity. Use its latest updated_at from context; omitted fields remain unchanged and null clears only that field.", inputSchema: updatePilotOpportunitySchema, annotations: developmentWriteAnnotations }, async (args) => {
      try { if (!reader.updatePilotContentOpportunity) return unavailable("Update content opportunity"); const result = await reader.updatePilotContentOpportunity(args); const id = String(result.opportunity_id); const saved = await reader.getOpportunityContext(id); return success("opportunity", { id, changed_fields: result.changed_fields, saved_state: sanitize(saved) }, "Content progress saved."); } catch (error) { return failure(error); }
    });
    server.registerTool("record_post", { title: "Record Actual Publication", description: "Record one publication that already happened to one verified destination. This never publishes externally.", inputSchema: recordPilotPostSchema, annotations: developmentWriteAnnotations }, async (args) => {
      try { if (!reader.recordPilotPost) return unavailable("Record post"); return success("publication", await reader.recordPilotPost(args), "Actual publication recorded."); } catch (error) { return failure(error); }
    });
    server.registerTool("place_content_opportunity_on_hold", { title: "Put Content On Hold", description: "Put a verified opportunity on hold only after the user confirms the reason and release condition.", inputSchema: placeHoldSchema, annotations: developmentWriteAnnotations }, async (args) => { try { if (!reader.placeContentOpportunityOnHold) return unavailable("Place hold"); const hold = await reader.placeContentOpportunityOnHold(args); return success("hold", hold, "Content opportunity moved to On hold."); } catch (error) { return failure(error); } });
    server.registerTool("update_content_opportunity_hold", { title: "Update Content Hold", description: "Update the current hold after an explicit user request and fresh read.", inputSchema: updateHoldSchema, annotations: developmentWriteAnnotations }, async (args) => { try { if (!reader.updateContentOpportunityHold) return unavailable("Update hold"); return success("hold", await reader.updateContentOpportunityHold(args), "Hold details updated."); } catch (error) { return failure(error); } });
    server.registerTool("release_content_opportunity_hold", { title: "Return Content To Backlog", description: "Manually release the current hold only after the user confirms.", inputSchema: releaseHoldSchema, annotations: developmentWriteAnnotations }, async (args) => { try { if (!reader.releaseContentOpportunityHold) return unavailable("Release hold"); return success("hold", await reader.releaseContentOpportunityHold(args), "Content opportunity returned to the active backlog."); } catch (error) { return failure(error); } });
  }

  if (options.enablePostPackageWrites) {
    const rereadPackage = async (packageId: string) => {
      if (!reader.getPostPackageContextByPackage) {
        throw new Error("Post Package lookup is not configured");
      }
      const context = await reader.getPostPackageContextByPackage(packageId);
      const packages = [context.active_package, ...context.prior_packages].filter(Boolean);
      if (!packages.some((item) => item?.id === packageId)) {
        throw new Error("Saved Post Package could not be verified in fresh context");
      }
      return sanitizePostPackage(context, options.trustedStorageOrigin);
    };
    server.registerTool("create_post_package", {
      title: "Start Post Package",
      description: "Start a Post Package only after an explicit workspace-member request and a fresh get_post_package_context read confirms there is no active package.",
      inputSchema: createPostPackageToolSchema,
      annotations: developmentWriteAnnotations,
    }, async (args) => {
      try {
        if (!reader.createPostPackage) return unavailable("Create Post Package");
        const saved = await reader.createPostPackage(args);
        return success("post_package_context", await rereadPackage(saved.id), "Post Package started and re-read.");
      } catch (error) { return failure(error); }
    });
    server.registerTool("update_post_package", {
      title: "Update Post Package",
      description: "Update package copy or working context only after an explicit workspace-member request and a fresh package read; supply the latest updated_at.",
      inputSchema: updatePostPackageToolSchema,
      annotations: developmentWriteAnnotations,
    }, async (args) => {
      try {
        if (!reader.updatePostPackage) return unavailable("Update Post Package");
        await reader.updatePostPackage(args);
        return success("post_package_context", await rereadPackage(args.package_id), "Post Package updated and re-read.");
      } catch (error) { return failure(error); }
    });
    server.registerTool("upsert_post_package_caption_variant", {
      title: "Save Post Package Caption Variant",
      description: "Create or update one caption variant only after an explicit workspace-member request and a fresh package read; supply the latest package or variant updated_at.",
      inputSchema: upsertPostPackageCaptionVariantToolSchema,
      annotations: developmentWriteAnnotations,
    }, async (args) => {
      try {
        if (!reader.upsertPostPackageVariant) return unavailable("Save Post Package caption variant");
        await reader.upsertPostPackageVariant(args);
        return success("post_package_context", await rereadPackage(args.package_id), "Caption variant saved and package re-read.");
      } catch (error) { return failure(error); }
    });
    server.registerTool("set_post_package_assets", {
      title: "Set Post Package Assets",
      description: "Replace the exact ordered package asset selection only after an explicit workspace-member request and a fresh package read; supply the latest updated_at.",
      inputSchema: setPostPackageAssetsToolSchema,
      annotations: developmentWriteAnnotations,
    }, async (args) => {
      try {
        if (!reader.setPostPackageAssets) return unavailable("Set Post Package assets");
        await reader.setPostPackageAssets(args);
        return success("post_package_context", await rereadPackage(args.package_id), "Package assets saved and package re-read.");
      } catch (error) { return failure(error); }
    });
    server.registerTool("set_post_package_destinations", {
      title: "Set Post Package Destinations",
      description: "Replace the exact destination-to-approved-caption plan only after an explicit workspace-member request and a fresh package read; supply the latest updated_at.",
      inputSchema: setPostPackageDestinationsToolSchema,
      annotations: developmentWriteAnnotations,
    }, async (args) => {
      try {
        if (!reader.setPostPackageDestinations) return unavailable("Set Post Package destinations");
        await reader.setPostPackageDestinations(args);
        return success("post_package_context", await rereadPackage(args.package_id), "Distribution plan saved and package re-read.");
      } catch (error) { return failure(error); }
    });
    server.registerTool("skip_post_package_destination", {
      title: "Skip Post Package Destination",
      description: "Skip one planned destination with a reason only after an explicit workspace-member request and a fresh package read; supply the latest updated_at.",
      inputSchema: skipPostPackageDestinationToolSchema,
      annotations: developmentWriteAnnotations,
    }, async (args) => {
      try {
        if (!reader.skipPostPackageDestination) return unavailable("Skip Post Package destination");
        await reader.skipPostPackageDestination(args);
        return success("post_package_context", await rereadPackage(args.package_id), "Destination skipped and package re-read.");
      } catch (error) { return failure(error); }
    });
    server.registerTool("finish_post_package", {
      title: "Finish Post Package",
      description: "Close or abandon a package only after an explicit workspace-member request and a fresh package read confirms the chosen finish action is valid; supply the latest updated_at.",
      inputSchema: finishPostPackageToolSchema,
      annotations: developmentWriteAnnotations,
    }, async ({ action, ...args }) => {
      try {
        if (!reader.finishPostPackage) return unavailable("Finish Post Package");
        await reader.finishPostPackage({ ...args, outcome: action === "close" ? "closed" : "abandoned" });
        return success("post_package_context", await rereadPackage(args.package_id), "Post Package finished and re-read.");
      } catch (error) { return failure(error); }
    });
  }

  server.registerTool(
    "search_sfl_library",
    {
      title: "Search SFL Library",
      description:
        "Search content opportunities and underlying products by opportunity title, stage, next action, product name, brand, retailer, or tag.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200),
        limit: z.number().int().min(1).max(100).default(20),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ query, limit }) => {
      try {
        const [opportunities, products] = await Promise.all([
          reader.searchContentBacklog(query, limit, "all"),
          reader.searchLibrary(query, limit),
        ]);
        const safeResults = sanitize({ opportunities, products }) as {
          opportunities: JsonRecord[];
          products: JsonRecord[];
        };
        return {
          content: [
            {
              type: "text" as const,
              text: `Library matches for “${query}”: ${opportunities.length} content opportunities and ${products.length} products.\n\n${JSON.stringify(safeResults, null, 2)}`,
            },
          ],
          structuredContent: safeResults,
        };
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_product_context",
    {
      title: "Get Product Context",
      description:
        "Get a product's listings, affiliate links, asset metadata, post and destination history, performance, metrics, and Radar events.",
      inputSchema: z.object({ product_id: z.uuid() }),
      annotations: readOnlyAnnotations,
    },
    async ({ product_id }) => {
      try {
        const product = await reader.getProductContext(product_id);
        if (!product) return failure(new Error("Product not found"));
        const safeProduct = sanitize(product);
        return success("product", safeProduct, `Complete stored context for ${String(product.name ?? "this product")}.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_content_opportunity_context",
    {
      title: "Get Content Opportunity Context",
      description:
        "Get a content opportunity's stage, editorial notes, attached products and links, prepared assets, publication and destination history, metrics, and Revival Radar events.",
      inputSchema: z.object({ opportunity_id: z.uuid() }),
      annotations: readOnlyAnnotations,
    },
    async ({ opportunity_id }) => {
      try {
        const opportunity = await reader.getOpportunityContext(opportunity_id);
        if (!opportunity) return failure(new Error("Content opportunity not found"));
        const safeOpportunity = sanitize(opportunity);
        return success(
          "opportunity",
          safeOpportunity,
          `Complete stored context for ${String(opportunity.title ?? "this content opportunity")}.`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_recent_posts",
    {
      title: "Get Recent Posts",
      description: "Read recent publication history, optionally filtered by product or destination.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(3650).default(30),
        product_id: z.uuid().optional(),
        destination_id: z.uuid().optional(),
        content_opportunity_id: z.uuid().optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ days, product_id, destination_id, content_opportunity_id }) => {
      try {
        const posts = sanitize(
          await reader.getRecentPosts({
            days,
            productId: product_id,
            destinationId: destination_id,
            contentOpportunityId: content_opportunity_id,
          }),
        );
        return success("posts", posts, `Posts published in the last ${days} days.`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_revival_events",
    {
      title: "Get Revival Events",
      description: "Read current or historical manually recorded Revival Radar events.",
      inputSchema: z.object({
        active_only: z.boolean().default(true),
        limit: z.number().int().min(1).max(100).default(20),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ active_only, limit }) => {
      try {
        const events = sanitize(await reader.getRevivalEvents(active_only, limit));
        return success("events", events, `${(events as unknown[]).length} Revival Radar event(s).`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  return server;
}
