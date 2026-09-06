# SFL Brain

SFL Brain is the private memory and recommendation backend for the Styled For Less content workflow. It stores products, retailer listings, affiliate links, private assets, previous posts, performance, and manually entered Revival Radar events. Its deterministic Today engine explains what may be worth posting.

ChatGPT remains the conversational assistant. SFL Brain does **not** call the OpenAI API and does not require an OpenAI API key.

> [!WARNING]
> This MVP uses a server-side Supabase service-role credential and has no end-user authentication or authorization. It is for private, local development only. Do not deploy it publicly until authentication and workspace-level authorization have been added.

## What is included

- `/today` — ranked, explainable posting opportunities with effort filters
- `/library` — search by product, brand, retailer, or tag
- `/add` — add a product with an optional listing and affiliate link
- `/record-post` — record one publication to one destination and immediately rerank Today
- `/products/[id]` — complete product context plus edit, listing, link, asset, post, and manual Radar actions
- `/mcp` — stateless Streamable HTTP MCP endpoint with exactly five read-only tools
- Reproducible Supabase migrations and fictional HOME-DECOR seed data

Retailer scraping, monitoring jobs, publishing integrations, AI tagging, OCR, notifications, authentication, public deployment, and write-capable MCP tools are intentionally out of scope for v0.1.

## Prerequisites

- Node.js 20 or newer (the project is verified with Node 24)
- pnpm 11 or newer
- Docker Desktop with the Linux engine running
- Supabase CLI; scripts use the pinned `2.116.0` CLI through `pnpm dlx`

## Local setup

Install packages:

```powershell
pnpm install
```

Start the local Supabase stack:

```powershell
pnpm supabase:start
```

Create the local environment file:

```powershell
Copy-Item .env.example .env.local
```

Set these values in `.env.local` using the values reported by your local Supabase stack:

```dotenv
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
SFL_WORKSPACE_ID=11111111-1111-4111-8111-111111111111
```

The service-role key is server-only. Never rename it with a `NEXT_PUBLIC_` prefix, expose it in browser code, paste it into chat, or commit `.env.local`.

Reset the database so the migration and seed apply from scratch:

```powershell
pnpm supabase:reset
```

Start Next.js:

```powershell
pnpm dev
```

The development and production scripts bind to `127.0.0.1` so this unauthenticated MVP is not exposed to other devices on the local network.

Open:

- Today: [http://localhost:3000/today](http://localhost:3000/today)
- Library: [http://localhost:3000/library](http://localhost:3000/library)
- MCP: [http://localhost:3000/mcp](http://localhost:3000/mcp)
- Supabase Studio: [http://127.0.0.1:54323](http://127.0.0.1:54323)

Stop the local stack when finished:

```powershell
pnpm supabase:stop
```

## Verification

Run the full quality gate:

```powershell
pnpm verify
```

It runs ESLint, TypeScript, Vitest, and the production Next.js build in sequence. Individual commands are also available:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For database verification, keep Docker Desktop running and execute:

```powershell
pnpm supabase:reset
pnpm dlx supabase@2.116.0 migration list --local
```

The seed uses stable UUIDs and dates relative to reset time. Brown Swivel Chair should initially rank first. Recording a post for it dated today should apply the recent-post penalty and raise Decorative Box Set or another eligible candidate.

## Recommendation model

`src/lib/recommendations.ts` is a pure TypeScript module shared by the UI and MCP. Each score contribution creates a matching reason. Results sort by score, then effort, name, and ID for deterministic ties.

The engine uses active manual Radar events, post recency and winner history, unused/existing assets, active affiliate links, and the primary listing's availability. Archived and discontinued products are excluded. Out-of-stock products retain a `-100` score factor for explanation but are suppressed from normal Today results.

Effort is intentionally simple:

- 5 minutes — an asset and active affiliate link are ready
- 15 minutes — an asset exists but publishing preparation is missing
- 30 minutes — no usable asset exists, so new content is required

## MCP tools

All MCP tools carry `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, and `openWorldHint: false`. Each successful call returns human-readable text and `structuredContent`.

- `get_today_candidates`
- `search_sfl_library`
- `get_product_context`
- `get_recent_posts`
- `get_revival_events`

No write MCP tools exist in v0.1. Raw private Storage paths and service credentials are removed from MCP product-context output.

### ChatGPT connection

ChatGPT must be able to reach an HTTPS MCP endpoint; it cannot call `localhost` directly. During development, use OpenAI's supported Secure MCP Tunnel flow instead of publishing this application to the internet, then connect the MCP app in ChatGPT Developer Mode. Follow the current [OpenAI Developer mode and MCP apps documentation](https://help.openai.com/en/articles/12584461) rather than copying old tunnel or Apps SDK commands from tutorials.

The MCP endpoint itself is read-only, but its content is private. Keep the tunnel scoped to your development session and do not treat it as application authentication.

## Data and storage security

- Every application table has RLS enabled.
- No `anon` or `authenticated` policies are created; those roles have table access revoked.
- The web server uses the service role through `src/lib/brain.ts` only.
- `sfl-assets` is a private bucket with a 25 MB limit and an explicit MIME allowlist.
- Uploads run server-side, associate to an explicit product, and clean up the object if metadata persistence fails.
- Product pages use ten-minute signed URLs for stored asset previews.

## Seed fixtures

The demo URLs use reserved `.example` domains and do not represent real retailers.

- Brown Swivel Chair — restocked, previous winner, ready unused photo, affiliate link, last posted about 46 days ago
- Decorative Box Set — never posted, ready photo and affiliate link
- Travertine Accent Table — previous winner posted about four days ago
- Woven Vase — previous winner but currently out of stock
- Fall Wreath Collection — old enough to revive with a seasonal event and ready graphic
- Linen Table Lamp — limited stock and no asset, requiring new content

After the acceptance flow works, replace the fixtures with roughly ten real Elaine products and test: “What should I post today? I only have 10 minutes and don't want new pictures.” Do not add automated Revival Radar monitoring until those stored facts prove useful.
