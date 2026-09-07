# SFL Brain v0.2 Content Opportunities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Content Opportunity the first-class editorial backlog and Today-ranking unit while preserving the v0.1 product database and five read-only MCP tools.

**Architecture:** Add normalized opportunity and relationship tables, link each destination post to one opportunity, and feed a pure opportunity-scoring module from the existing server-only Supabase service. The UI uses quick opportunity capture by default and retains product administration as a secondary catalog.

**Tech Stack:** TypeScript, Next.js 16 App Router and Server Actions, React 19, Supabase/Postgres with RLS and transactional functions, MCP TypeScript SDK v2, Zod v4, Vitest, Playwright CLI.

---

### Task 1: Opportunity recommendation contract

**Files:** `src/lib/recommendations.ts`, `src/lib/recommendations.test.ts`

- [ ] Replace product-only fixtures with opportunity inputs containing stage, type, effort, products, assets, posts, and Radar events.
- [ ] Verify red tests for readiness ordering, effort/no-photo/revival filters, cross-post deduplication, variety penalty, significant-signal override, unavailable suppression, exact reason totals, and post reranking.
- [ ] Implement the minimal deterministic opportunity engine and keep stable sorting.
- [ ] Run the focused suite until green.

### Task 2: Additive database migration

**Files:** `supabase/migrations/*_content_opportunities.sql`, `supabase/seed.sql`

- [ ] Create the migration with the current Supabase CLI.
- [ ] Add opportunity enums, table, product/asset joins, `posts.content_opportunity_id`, indexes, RLS, grants, workspace-integrity triggers, post-status synchronization, and a transactional create-opportunity function.
- [ ] Replace `record_post` with an opportunity-aware transaction that validates workspace ownership and derives product joins.
- [ ] Seed the ten named opportunities, relationships, distinct content types, and cross-post fixtures.
- [ ] Reset locally, lint the schema, and assert counts, privacy, relationships, and lifecycle behavior.

### Task 3: Server validation and service layer

**Files:** `src/lib/validation.ts`, `src/lib/validation.test.ts`, `src/lib/brain.ts`, `src/lib/brain.integration.test.ts`

- [ ] Write red tests for quick capture, stage/type validation, optional product capture, and opportunity-required post recording.
- [ ] Add repository reads for opportunity inputs, recent distinct mix, backlog search, detail context, product/asset attachment, and opportunity-aware form options.
- [ ] Add create/edit/attach methods and update recent posts, product context, and Radar context with opportunity data.
- [ ] Prove the seeded ranking and post lifecycle through live integration tests.

### Task 4: MCP compatibility

**Files:** `src/lib/mcp/server.ts`, `src/lib/mcp/server.test.ts`, `scripts/mcp-smoke.mjs`

- [ ] Keep exactly five read-only tools and update descriptions/output shapes for opportunity-centered Today and dual Library search.
- [ ] Test annotations, schemas, structured output, opportunity product context, recent posts, and revival relationships in memory.
- [ ] Exercise every tool against the live HTTP endpoint.

### Task 5: Quick capture, backlog, and opportunity detail

**Files:** `src/app/add/page.tsx`, `src/app/library/page.tsx`, `src/app/opportunities/[id]/page.tsx`, `src/app/products/new/page.tsx`, `src/app/actions.ts`, `src/components/navigation.tsx`, `src/app/globals.css`

- [ ] Turn Add into the four-field Content capture and move the current product form to `/products/new`.
- [ ] Make Library default to Backlog with a Product Catalog view.
- [ ] Build opportunity detail with stage editing, related products/assets, link/Radar readiness, and distribution history.
- [ ] Preserve restrained responsive styling, clear empty/error/pending states, and keyboard-visible controls.

### Task 6: Opportunity-aware Today and Record Post

**Files:** `src/app/today/page.tsx`, `src/app/record-post/page.tsx`, `src/app/actions.ts`

- [ ] Render opportunity cards and all six filters with score details secondary.
- [ ] Require and preselect a content opportunity when recording a destination publication.
- [ ] Prove same-opportunity cross-posts preserve one content-mix event and recording moves ready content out of the normal queue.

### Task 7: Documentation, browser acceptance, and delivery

**Files:** `README.md`, design and plan docs

- [ ] Document the opportunity model, stages, content types, quick capture, variety semantics, and unchanged non-goals.
- [ ] Run `pnpm verify`, local reset, database lint, integration tests, dependency audit, and MCP smoke.
- [ ] Exercise quick capture, filters, opportunity detail, record post, reranking, backlog/catalog search, desktop/mobile layout, and console cleanliness in Playwright.
- [ ] Inspect the complete diff, exclude pre-existing unrelated changes, commit, push the v0.2 branch, and leave the seed restored.
