# SFL Brain

SFL Brain is the private content-memory and recommendation backend for the Styled For Less workflow. It stores an editorial backlog as **Content Opportunities**, then connects each opportunity to products, retailer listings, affiliate links, private assets, destination publications, performance, and manually entered Revival Radar events.

Durable product direction lives in [the product vision](docs/PRODUCT_VISION.md). A new maintainer or agent should also read the [latest dated handoff](docs/handoffs/2026-09-15-local-acceptance-complete.md) and verify its time-sensitive claims.

ChatGPT remains the conversational assistant. SFL Brain makes **no OpenAI API calls** and requires no OpenAI API key.

> [!WARNING]
> The website and production MCP connector require an authenticated Supabase account with exactly one explicit `workspace_members` row. The service-role credential remains server-only and is used only after that membership is verified. Hosted `/mcp` requests require Supabase OAuth 2.1 bearer authentication; the unauthenticated local endpoint remains a development-only tunnel target.

## Product model

Content Opportunity is the editorial unit Elaine works with:

```text
Content Opportunity: “Corinne box dupes”
├── Stage: Needs caption
├── Content type: Comparison
├── Products: McGee boxes + affordable alternative
├── Prepared assets: styled photos + comparison graphic
├── Links: derived from attached product listings
└── Posts: one row per destination, all under this opportunity
```

An opportunity may start with no products or assets. That makes quick capture possible without weakening the factual product database underneath it.

Stages are Idea, Needs assets, Needs links, Needs caption, Ready, Posted, and Revival candidate. Recording the first destination publication changes the opportunity to Posted. Multiple cross-post rows still count as one piece in the recent editorial mix.

## App surfaces

- `/today` — opportunity recommendations with Best, 5-minute, 15-minute, Closest to done, No new pictures, and Revive filters
- `/library` — active Content Backlog by default, with separate On hold and Product Catalog views
- `/add` — ten-second content capture: title, stage, type, optional note
- `/products/new` — secondary product-administration form
- `/opportunities/[id]` — stage, next action, products, links, assets, destination history, and reversible archive state
- `/products/[id]` — product/listing/link/asset/Radar facts plus related opportunities
- `/record-post` — one publication to one destination, attached to one content opportunity
- `/mcp` — stateless Streamable HTTP MCP endpoint with eight reads and six confirmed, non-destructive writes when hosted

Retailer scraping, stock monitoring, publishing integrations, AI tagging, OCR, notifications, destructive MCP actions, and full website write parity remain out of scope.

## Prerequisites

- Node.js 20 or newer
- pnpm 11 or newer
- Docker Desktop with its Linux engine running
- Supabase CLI; project scripts pin `2.116.0`

## Local setup

```powershell
pnpm install
pnpm supabase:start
Copy-Item .env.example .env.local
```

Set these values in `.env.local` using the values from the local Supabase stack:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
SFL_WORKSPACE_ID=11111111-1111-4111-8111-111111111111
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-local-publishable-key
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

Never give the service-role key a `NEXT_PUBLIC_` prefix, paste it into chat, or commit `.env.local`. Public sign-up is disabled in local configuration: create an approved account through the Supabase Auth admin path, then add its actual Auth user ID to `workspace_members`. See [private account provisioning](docs/private-account-provisioning.md).

Apply both migrations and restore the Elaine-style seed:

```powershell
pnpm supabase:reset
pnpm dev
```

The app binds to `127.0.0.1` so the unauthenticated MVP is not exposed to other local-network devices.

Open:

- Today: [http://127.0.0.1:3000/today](http://127.0.0.1:3000/today)
- Backlog: [http://127.0.0.1:3000/library](http://127.0.0.1:3000/library)
- Add Content: [http://127.0.0.1:3000/add](http://127.0.0.1:3000/add)
- MCP: [http://127.0.0.1:3000/mcp](http://127.0.0.1:3000/mcp)
- Supabase Studio: [http://127.0.0.1:54323](http://127.0.0.1:54323)

Stop local services with `pnpm supabase:stop`.

## Deterministic recommendations

`src/lib/content-recommendations.ts` is shared by UI and MCP. It combines:

- explicit opportunity stage and effort remaining
- opportunity-specific prepared assets
- active affiliate links and availability from attached products
- previous performance and publication recency
- active manual Radar events
- the last five distinct published opportunities for content variety

Cross-posts are deduplicated by opportunity before variety is calculated. A content type receives no penalty for zero or one recent appearance, then a soft penalty for repetition. Strong sales, restocks, readiness, or past performance can outweigh it. Every score factor has a matching human-readable reason.

Posted content is excluded from ordinary Today results. It returns only when a Radar signal or explicit Revival candidate stage makes resurfacing relevant. Archived opportunities are excluded everywhere except their direct detail page, where they can be restored.

## MCP tools

The eight read tools carry `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, and `openWorldHint: false`:

- `get_today_candidates` — opportunity-centered recommendations
- `get_available_destinations` — lists active destinations before recording a publication
- `get_on_hold_opportunities` — lists retained ideas in manual review order
- `search_sfl_library` — searches opportunities and underlying products together
- `get_product_context` — includes related content opportunities
- `get_content_opportunity_context` — returns the complete sanitized opportunity context
- `get_recent_posts` — includes and can filter by content opportunity
- `get_revival_events` — includes affected opportunity relationships

Every successful call returns readable text and `structuredContent`. Raw Storage paths and service credentials are removed from output.

The hosted connector additionally exposes three non-destructive write tools: `create_content_opportunity`, `update_content_opportunity`, and `record_post`. ChatGPT presents these as writes and requires user confirmation. Each call is idempotent, checks current workspace membership, and records the authenticated actor plus `chatgpt_connector` source without storing conversation text.

It also exposes confirmed hold management: `place_content_opportunity_on_hold`, `update_content_opportunity_hold`, and `release_content_opportunity_hold`. Holds remain manual; the connector does not monitor release conditions or send automatic notifications.

For production, connect ChatGPT directly to the deployed `https://YOUR_DOMAIN/mcp` endpoint using OAuth. In Supabase Authentication → OAuth Server, enable OAuth 2.1, set the authorization path to `/oauth/consent`, enable dynamic client registration, and retain disabled public signup. The production connector then works independently of this computer.

During development, the existing Secure MCP Tunnel may continue to target `http://127.0.0.1:3000/mcp`. It is optional test infrastructure, not a production dependency. Follow the current [OpenAI Developer mode and MCP apps documentation](https://help.openai.com/en/articles/12584461).

## Verification

```powershell
pnpm verify
pnpm dlx supabase@2.116.0 db lint --local --level warning
Get-Content -Raw supabase\tests\content_opportunities.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
pnpm mcp:smoke
```

To smoke-test a deployed connector without printing its token, set `SFL_MCP_URL`, `SFL_MCP_MODE=hosted`, and `SFL_MCP_ACCESS_TOKEN` in the current process. To verify only the unauthenticated OAuth challenge, set `SFL_MCP_CHECK_UNAUTHENTICATED=1`; a healthy hosted endpoint returns `401` with a `resource_metadata` challenge.

`pnpm verify` runs ESLint, TypeScript, Vitest, and the production build. Live integration tests run when `SFL_INTEGRATION=1` and the three server environment variables are present.

## Seed content

The seed includes the ten workflow-shaped opportunities from the v0.2 review:

- Home Depot hallway light — Needs assets
- Coffee bar — Posted
- Corinne box dupes — Needs caption
- Five fall wreaths under $35 — Needs caption
- Target taper candle sale — Needs caption with an active sale signal
- At Home Antonia comparison — Posted to two destinations as one opportunity
- Styled Target table — Posted
- At Home rice-stem vase styling — Needs assets
- Walmart swivel chair — Revival candidate with a restock signal
- At Home travertine table — Recently posted

All demo URLs use reserved `.example` domains. Do not add automated Revival Radar monitoring until the opportunity backlog and Today recommendations prove useful with Elaine’s real workflow.
