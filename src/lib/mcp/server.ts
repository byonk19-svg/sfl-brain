import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createPilotOpportunitySchema, recordPilotPostSchema, updatePilotOpportunitySchema, type CreatePilotOpportunityInput, type RecordPilotPostInput, type UpdatePilotOpportunityInput } from "@/lib/mcp/pilot-write-schemas";

import type {
  TodayContentCandidate,
  TodayContentFilters,
} from "@/lib/content-recommendations";

type JsonRecord = Record<string, unknown>;

export interface BrainReader {
  getTodayCandidates(filters: TodayContentFilters): Promise<TodayContentCandidate[]>;
  searchContentBacklog(query: string, limit: number): Promise<JsonRecord[]>;
  searchLibrary(query: string, limit: number): Promise<JsonRecord[]>;
  getProductContext(productId: string): Promise<JsonRecord | null>;
  getOpportunityContext(opportunityId: string): Promise<JsonRecord | null>;
  createDevelopmentTestOpportunity?(requestId: string): Promise<string>;
  getAvailableDestinations?(): Promise<JsonRecord[]>;
  createPilotContentOpportunity?(input: CreatePilotOpportunityInput): Promise<JsonRecord>;
  updatePilotContentOpportunity?(input: UpdatePilotOpportunityInput): Promise<JsonRecord>;
  recordPilotPost?(input: RecordPilotPostInput): Promise<JsonRecord>;
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
  options: { enableDevelopmentTestWrite?: boolean; enablePilotWrites?: boolean } = {},
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

  if (options.enablePilotWrites) {
    const unavailable = (name: string) => failure(new Error(`${name} is not configured`));
    server.registerTool("create_content_opportunity", { title: "Save Content Idea", description: "Save a real content idea. Use only when the user asks to save it; products, links, and assets are optional.", inputSchema: createPilotOpportunitySchema, annotations: developmentWriteAnnotations }, async (args) => {
      try { if (!reader.createPilotContentOpportunity) return unavailable("Create content opportunity"); const result = await reader.createPilotContentOpportunity(args); const id = String(result.opportunity_id); const saved = await reader.getOpportunityContext(id); return success("opportunity", { id, saved_state: sanitize(saved) }, "Content idea saved."); } catch (error) { return failure(error); }
    });
    server.registerTool("update_content_opportunity", { title: "Update Content Progress", description: "Update explicitly supplied progress fields on a verified content opportunity. Use its latest updated_at from context; omitted fields remain unchanged and null clears only that field.", inputSchema: updatePilotOpportunitySchema, annotations: developmentWriteAnnotations }, async (args) => {
      try { if (!reader.updatePilotContentOpportunity) return unavailable("Update content opportunity"); const result = await reader.updatePilotContentOpportunity(args); const id = String(result.opportunity_id); const saved = await reader.getOpportunityContext(id); return success("opportunity", { id, changed_fields: result.changed_fields, saved_state: sanitize(saved) }, "Content progress saved."); } catch (error) { return failure(error); }
    });
    server.registerTool("record_post", { title: "Record Actual Publication", description: "Record one publication that already happened to one verified destination. This never publishes externally.", inputSchema: recordPilotPostSchema, annotations: developmentWriteAnnotations }, async (args) => {
      try { if (!reader.recordPilotPost) return unavailable("Record post"); return success("publication", await reader.recordPilotPost(args), "Actual publication recorded."); } catch (error) { return failure(error); }
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
          reader.searchContentBacklog(query, limit),
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
