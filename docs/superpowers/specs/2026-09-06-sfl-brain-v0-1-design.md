# SFL Brain v0.1 Design

## Goal

Build a private, local-first companion for the Styled For Less workflow. The web app stores products, listings, affiliate links, private assets, post history, performance, and manually entered Radar events. A deterministic recommendation engine ranks what is worth posting, while ChatGPT remains the conversational layer through five read-only MCP tools. The application makes no OpenAI API calls.

## Product surface

The UI has five working surfaces only: Today, Library, Add, Record Post, and Product detail. Today is the default route and emphasizes understandable recommendations rather than analytics. Forms use server actions so service-role credentials and Storage operations remain server-side. Mutations redirect to the affected page and invalidate cached recommendation data.

## Architecture

- Next.js App Router renders server components and hosts server actions plus the `/mcp` Streamable HTTP route.
- Supabase/Postgres is the durable store. SQL migrations define constrained UUID-backed tables, timestamps, foreign keys, indexes, RLS, and a private `sfl-assets` bucket. Seed SQL provides deterministic demo data.
- A small repository layer owns all Supabase queries and maps rows into domain-shaped inputs. UI and MCP call the same services.
- `src/lib/recommendations.ts` is a pure function. It applies documented score factors, derives `fresh`/`revival`/`ready`, estimates effort, filters, sorts deterministically, and emits score-aligned reasons.
- MCP registration is isolated from transport so schemas, annotations, and structured responses can be tested in memory. The HTTP route creates a stateless server per request.
- Tests cover the recommendation rules, post-history reranking, repository contracts, MCP metadata/schema/output, and form validation.

## Data and security

All application tables live in `public`, use UUID primary keys where appropriate, carry workspace foreign keys, and have RLS enabled without anonymous or authenticated policies. Only server code creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY`. Browser bundles never import that client. Assets are uploaded to a private bucket after MIME and size validation; UI previews use short-lived signed URLs. MCP output omits storage paths and credentials.

## Recommendation semantics

Only active products are normal candidates. Each factor contributes once and produces one reason with the same point value. Active Radar events are undismissed, already happened, and unexpired. Asset readiness distinguishes any linked asset from an unused asset, where unused means it has never appeared in `post_assets`. The primary listing determines availability and displayed price; a deterministic fallback is used if no listing is marked primary. A candidate with no asset requires new content and costs 30 minutes; an asset without an active affiliate link costs 15; an asset plus an active link costs 5.

Candidate type is `revival` when the product has a prior post and an active Radar event, `fresh` when never posted, otherwise `ready`. Results sort by score descending, then effort ascending, then product name and product id for stable ties. Out-of-stock items remain explainable but are excluded from the default Today results unless a caller explicitly requests the raw scored set internally; discontinued and archived products are excluded entirely.

## Error and lifecycle behavior

Forms validate with Zod and return actionable errors. Create-product is atomic enough for the local MVP: if a dependent listing or affiliate link fails, server code surfaces the failure and does not claim success. Record Post creates the publication row and joins selected products/assets; immediately afterward Today reads current data and reranks. Upload validation rejects empty, oversized, or unsupported files before Storage writes and removes an uploaded object if subsequent metadata insertion fails.

MCP tools validate inputs, return readable text plus `structuredContent`, and convert expected not-found/validation failures into useful tool errors without exposing stack traces or secrets. Empty, loading, and error states are explicit in the UI.

## Verification

`pnpm verify` runs lint, typecheck, Vitest, and a production build. Supabase verification resets the local database from migrations and seed, then checks seeded ranking against live repository data. Browser acceptance covers Today, recording a post, reranking, Library search, and product detail. MCP acceptance initializes an in-memory client and also smoke-tests the HTTP endpoint when the local stack is available.

## Deliberate non-goals

No AI API, chatbot, public deployment, authentication UI, retailer scraping, monitoring jobs, third-party publishing integrations, OCR, image recognition, automatic affiliate links, notifications, multi-user SaaS, or write-capable MCP tools are included.
