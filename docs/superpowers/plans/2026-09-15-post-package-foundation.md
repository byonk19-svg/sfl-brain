# Post Package Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add versioned Post Packages that preserve caption variants, reusable asset selections, exact distribution plans, and immutable Publication snapshots across the website and hosted ChatGPT connector.

**Architecture:** Post Packages are normalized children of Content Opportunities with one active package at a time. Server-owned transactional RPCs enforce lifecycle, workspace, approval, ordering, idempotency, and snapshot rules; a focused repository/service module feeds both Server Components and MCP tools. Existing Posts remain the publication source of truth and historical Posts are conservatively linked to closed legacy packages.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components and server actions, TypeScript, Zod 4, Supabase/Postgres/Auth/Storage/RLS, MCP SDK 2.0, Vitest, Playwright

---

### Task 1: Create the Post Package database model and invariants

**Files:**
- Create via CLI: the migration path printed by `supabase migration new post_package_foundation`
- Create: `supabase/tests/post_packages.sql`
- Modify: `supabase/tests/content_opportunities.sql`

- [ ] **Step 1: Create the migration through the pinned CLI**

Run:

```powershell
pnpm dlx supabase@2.116.0 migration new post_package_foundation
```

Record the exact generated filename and use it for every later command. Do not create the timestamp manually.

- [ ] **Step 2: Write the failing SQL lifecycle suite**

Create `supabase/tests/post_packages.sql` as one `begin; do $test$ ... end; $test$; rollback;` transaction. Insert two workspaces, two Auth users, memberships, destinations, opportunities, and assets. Use explicit `begin ... exception when others ... end` blocks and sentinel `raise exception` messages to prove: second-active-package rejection; copy-then-diverge caption behavior; approved-edit demotion to draft; one hero; unique positions; every cross-workspace rejection; draft-publication rejection; atomic caption/asset snapshot; close rejection with Planned rows; abandonment rejection after a Post; closed immutability; next-sequence creation; and denial of table/RPC access to `anon` and `authenticated`.

- [ ] **Step 3: Run the SQL suite and verify RED**

Run:

```powershell
Get-Content -Raw supabase/tests/post_packages.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

Expected: FAIL because package enums, tables, and RPCs do not exist.

- [ ] **Step 4: Implement enums, tables, constraints, and triggers**

The CLI-generated migration must add:

```sql
create type public.post_package_status as enum ('draft', 'publishing', 'closed', 'abandoned');
create type public.caption_variant_status as enum ('draft', 'approved');
create type public.caption_audience as enum ('sfl_page', 'sfl_groups', 'personal_groups', 'instagram', 'custom');
create type public.package_asset_role as enum ('hero', 'supporting', 'comparison');
create type public.distribution_item_status as enum ('planned', 'published', 'skipped');
```

Create `post_packages`, `post_package_caption_variants`, `post_package_assets`, and `post_package_destinations` with UUID/workspace composite keys, audit actor/source fields, `updated_at` triggers, RLS, service-role-only grants, and the constraints from the design. Add nullable `post_package_id` and `caption_variant_id` composite foreign keys to `posts`.

Implement database enforcement triggers that reject child-table insert/update/delete whenever the parent package is Closed or Abandoned. Add a partial unique index for one Draft/Publishing package per opportunity and another for one hero per package.

- [ ] **Step 5: Implement transactional RPCs and conservative backfill**

Add service-role-only functions for:

```text
create_post_package
update_post_package
upsert_post_package_caption_variant
set_post_package_assets
set_post_package_destinations
skip_post_package_destination
record_post_from_package
finish_post_package
```

Every function accepts workspace and actor/source context, verifies current membership for website/connector sources, uses advisory locks where request idempotency or sequence allocation can race, and returns JSONB saved state. Connector calls require a request ID and write `mcp_mutation_requests`; website calls may omit it.

Backfill one Closed legacy package for each opportunity with historical Posts, assign sequence 1, and update only `posts.post_package_id`. Do not infer variants, asset selections, or distribution items.

- [ ] **Step 6: Reset the local stack and verify GREEN**

Run:

```powershell
pnpm supabase:reset
Get-Content -Raw supabase/tests/post_packages.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
pnpm dlx supabase@2.116.0 db lint --local --level warning
```

Expected: migration reset succeeds; SQL prints `BEGIN`, `DO`, `ROLLBACK`; lint reports no schema errors.

- [ ] **Step 7: Commit the schema slice**

```powershell
git add -- supabase/migrations supabase/tests/post_packages.sql supabase/tests/content_opportunities.sql
git commit -m "feat: add post package domain model"
```

### Task 2: Add typed package repository, validation, and service boundary

**Files:**
- Create: `src/lib/post-package.ts`
- Create: `src/lib/post-package.test.ts`
- Create: `src/lib/post-package-repository.ts`
- Create: `src/lib/post-package-repository.test.ts`
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/validation.test.ts`
- Modify: `src/lib/brain.ts`
- Modify: `src/lib/brain.integration.test.ts`

- [ ] **Step 1: Write failing pure-domain and validation tests**

Tests must define the public TypeScript contract and prove:

```ts
expect(canFinishPackage({ status: "publishing", items: [{ status: "planned" }] })).toBe(false);
expect(canFinishPackage({ status: "publishing", items: [{ status: "published" }, { status: "skipped" }] })).toBe(true);
expect(copyBaseCaption("  Caption text  ")).toBe("Caption text");
expect(postPackageVariantSchema.parse({ audience: "sfl_groups", body: "Caption", status: "approved" })).toMatchObject({ audience: "sfl_groups" });
expect(() => packageAssetSelectionSchema.parse([{ asset_id: crypto.randomUUID(), role: "hero", position: 0 }, { asset_id: crypto.randomUUID(), role: "hero", position: 1 }])).toThrow(/hero/i);
```

Add explicit optimistic-version, destination-override, skip-reason, and duplicate-position cases.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm vitest run src/lib/post-package.test.ts src/lib/validation.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because the types/helpers/schemas are absent.

- [ ] **Step 3: Implement typed domain helpers and Zod schemas**

`post-package.ts` owns enums, typed package context, `canFinishPackage`, source labels, and ordering helpers. `validation.ts` exports schemas for create/update package, variant, asset selection, distribution plan, skip, finish, and destination management. Keep file uploads on the existing validated upload path.

- [ ] **Step 4: Write failing repository contract tests**

Mock Supabase query/RPC boundaries and prove that the repository:

- loads active package plus closed/abandoned summaries;
- creates 10-minute signed URLs without exposing `storage_path`;
- sends exact RPC names/arguments including actor/source and request IDs;
- returns typed saved state instead of `Record<string, unknown>` at package boundaries.

- [ ] **Step 5: Implement `PostPackageRepository` and `BrainService` methods**

Keep package queries and mutations in `post-package-repository.ts`. `BrainService` delegates through a small `postPackageRepository()` seam and exposes package context/mutation methods used by website actions and MCP. Do not add package logic to `OpportunityRepository`.

- [ ] **Step 6: Run focused and live integration tests**

```powershell
pnpm vitest run src/lib/post-package.test.ts src/lib/post-package-repository.test.ts src/lib/validation.test.ts --maxWorkers=1 --no-file-parallelism
$env:SFL_INTEGRATION='1'; pnpm vitest run src/lib/brain.integration.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: focused contracts and real local Supabase lifecycle reads/writes pass.

- [ ] **Step 7: Commit the service slice**

```powershell
git add -- src/lib/post-package.ts src/lib/post-package.test.ts src/lib/post-package-repository.ts src/lib/post-package-repository.test.ts src/lib/validation.ts src/lib/validation.test.ts src/lib/brain.ts src/lib/brain.integration.test.ts
git commit -m "feat: add post package service boundary"
```

### Task 3: Build destination management and the website package workspace

**Files:**
- Create: `src/app/destinations/page.tsx`
- Create: `src/components/post-package-workspace.tsx`
- Create: `src/components/post-package-workspace.test.tsx`
- Create: `src/components/caption-variant-editor.tsx`
- Create: `src/components/caption-variant-editor.test.tsx`
- Create: `src/components/package-asset-editor.tsx`
- Create: `src/components/distribution-plan-editor.tsx`
- Modify: `src/app/actions.ts`
- Modify: `src/app/opportunities/[id]/page.tsx`
- Modify: `src/app/record-post/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/lib/brain.ts`
- Modify: `src/lib/brain.integration.test.ts`

- [ ] **Step 1: Write failing component interaction tests**

Using Testing Library, prove the components render and submit:

- Start package when none is active;
- Base caption and working context;
- copied independent variants with Draft/Approved status;
- destination override selection;
- asset upload/attach, one hero, ordered rows, and signed preview;
- Planned/Published/Skipped distribution rows;
- disabled close with remaining Planned rows;
- read-only prior packages.

Use real labels and button names that browser acceptance will target.

- [ ] **Step 2: Run component tests and verify RED**

```powershell
pnpm vitest run src/components/post-package-workspace.test.tsx src/components/caption-variant-editor.test.tsx --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because components/actions do not exist.

- [ ] **Step 3: Implement destination server actions and management page**

Add focused BrainService methods plus membership-authorized actions for add/edit/deactivate destination. `/destinations` shows active and inactive destinations, platform, posting identity, and notes. Link it from Record Post and the distribution editor; do not add primary navigation.

- [ ] **Step 4: Implement package actions and Server Components**

Add actions for all package lifecycle operations, using validation schemas and success/error query messages. Revalidate `/today`, `/library`, the opportunity detail, Record Post, and `/destinations` only where affected.

Render the active package workspace on opportunity detail and prior packages in a collapsed read-only archive. Keep opportunity-level Products, links, and Assets intact; package selections reference those canonical records.

- [ ] **Step 5: Implement accessible responsive styling**

At narrow width, variant copy, asset order/role, and distribution status remain visible. Every disclosure and action is keyboard reachable, focus-visible, and labeled. Respect reduced motion and preserve the existing editorial visual system.

- [ ] **Step 6: Run component, accessibility-oriented, type, and build checks**

```powershell
pnpm vitest run src/components/post-package-workspace.test.tsx src/components/caption-variant-editor.test.tsx --maxWorkers=1 --no-file-parallelism
pnpm typecheck
pnpm build
```

- [ ] **Step 7: Commit the website slice**

```powershell
git add -- src/app/destinations src/app/actions.ts src/app/opportunities/[id]/page.tsx src/app/record-post/page.tsx src/app/globals.css src/components/post-package-workspace.tsx src/components/post-package-workspace.test.tsx src/components/caption-variant-editor.tsx src/components/caption-variant-editor.test.tsx src/components/package-asset-editor.tsx src/components/distribution-plan-editor.tsx
git commit -m "feat: manage post packages on the website"
```

### Task 4: Integrate atomic package-driven Publication recording

**Files:**
- Modify: `src/app/record-post/page.tsx`
- Modify: `src/app/actions.ts`
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/brain.integration.test.ts`
- Modify: `supabase/tests/post_packages.sql`

- [ ] **Step 1: Add failing publication snapshot tests**

Prove one package-driven Record Post submission:

- rejects draft caption copy;
- snapshots approved body and ordered assets;
- links package and variant IDs;
- publishes exactly one matching Distribution item;
- changes Draft to Publishing only once;
- preserves existing opportunity Posted behavior;
- leaves manual legacy Record Post working.

- [ ] **Step 2: Verify RED in SQL and integration tests**

Run the package SQL suite and `brain.integration.test.ts`; expect snapshot/link assertions to fail before the RPC/UI integration is complete.

- [ ] **Step 3: Implement package-driven Record Post**

When `distribution_item_id` is present, reject manually supplied caption/asset overrides and call `record_post_from_package`. When absent, keep the current legacy `record_post` path. Redirect to the opportunity detail with the Publication and package state visible.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
Get-Content -Raw supabase/tests/post_packages.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
$env:SFL_INTEGRATION='1'; pnpm vitest run src/lib/brain.integration.test.ts --maxWorkers=1 --no-file-parallelism
git add -- src/app/record-post/page.tsx src/app/actions.ts src/lib/validation.ts src/lib/brain.integration.test.ts supabase/tests/post_packages.sql
git commit -m "feat: record publications from post packages"
```

### Task 5: Expose Post Packages through the hosted connector

**Files:**
- Create: `src/lib/mcp/post-package-schemas.ts`
- Create: `src/lib/mcp/post-package-schemas.test.ts`
- Modify: `src/lib/mcp/server.ts`
- Modify: `src/lib/mcp/server.test.ts`
- Modify: `src/lib/mcp/smoke-contract.test.ts`
- Modify: `scripts/mcp-smoke-contract.mjs`
- Modify: `scripts/mcp-smoke.mjs`
- Modify: `src/lib/brain.mcp-writes.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing schema and MCP inventory tests**

Define schemas with UUID request IDs, package/row IDs, latest `updated_at`, bounded copy/notes, unique ordered asset selections, exact destinations, and explicit finish action (`close` or `abandon`).

Update hosted inventory expectations for one package read plus seven confirmed writes. Assert all writes have `readOnlyHint: false`, `destructiveHint: false`, `openWorldHint: false`, and remain absent from local read-only mode.

- [ ] **Step 2: Run MCP tests and verify RED**

```powershell
pnpm vitest run src/lib/mcp/post-package-schemas.test.ts src/lib/mcp/server.test.ts src/lib/mcp/smoke-contract.test.ts src/lib/brain.mcp-writes.test.ts --maxWorkers=1 --no-file-parallelism
```

- [ ] **Step 3: Implement package tools and sanitized output**

Register:

```text
get_post_package_context
create_post_package
update_post_package
upsert_post_package_caption_variant
set_post_package_assets
set_post_package_destinations
skip_post_package_destination
finish_post_package
```

Every write description requires an explicit member request and fresh read. Return re-read saved state, omit storage paths and credentials, and include only short-lived signed links from the trusted SFL domain.

- [ ] **Step 4: Extend smoke coverage and documentation**

Local smoke remains read-only. Hosted smoke validates the expanded annotations and exercises read context; disposable hosted acceptance exercises the confirmed writes and cleanup. Update README counts and capability boundaries without claiming ChatGPT binary upload.

- [ ] **Step 5: Verify and commit**

```powershell
pnpm vitest run src/lib/mcp/post-package-schemas.test.ts src/lib/mcp/server.test.ts src/lib/mcp/smoke-contract.test.ts src/lib/brain.mcp-writes.test.ts --maxWorkers=1 --no-file-parallelism
pnpm typecheck
git add -- src/lib/mcp src/lib/brain.mcp-writes.test.ts scripts/mcp-smoke-contract.mjs scripts/mcp-smoke.mjs README.md
git commit -m "feat: expose post packages to ChatGPT"
```

### Task 6: Complete full local acceptance and delivery evidence

**Files:**
- Create: `scripts/local-post-package-acceptance.mjs`
- Create: `scripts/local-hosted-post-package-acceptance.mjs`
- Modify: `package.json`
- Create: `docs/handoffs/2026-09-15-post-package-foundation.md`

- [ ] **Step 1: Build self-cleaning website acceptance**

The script generates disposable credentials in memory, provisions membership, creates an opportunity, package, variants, assets, destinations, and plan, then verifies desktop/narrow editing, approval, publication, skip, close, archive retrieval, and immutability. Cleanup in `finally` removes only IDs it created and proves zero fixtures remain.

- [ ] **Step 2: Build self-cleaning hosted-handler acceptance**

Run the app locally in hosted mode with a short-lived scoped local token. Exercise every package MCP write, re-read through a fresh client, verify actor/source audit and idempotency, and remove all disposable records.

- [ ] **Step 3: Run the complete local gate**

```powershell
pnpm verify
pnpm supabase:reset
Get-Content -Raw supabase/tests/post_packages.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content -Raw supabase/tests/content_opportunities.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content -Raw supabase/tests/content_opportunity_holds.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content -Raw supabase/tests/hosted_connector_audit.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content -Raw supabase/tests/workspace_members.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
pnpm dlx supabase@2.116.0 db lint --local --level warning
pnpm acceptance:post-package
pnpm acceptance:mcp-post-package
```

Expected: canonical app gate, all SQL suites, both browser/MCP flows, and cleanup checks pass. Shared Docker remains running; do not restart its engine or affect other project containers.

- [ ] **Step 4: Review security and the complete diff**

Check RLS/grants, workspace composite keys, closed-package immutability, member checks inside RPC transactions, connector idempotency, private Storage cleanup, signed-link expiry, absence of raw paths/secrets, exact backfill behavior, and no automatic-publishing claims.

- [ ] **Step 5: Commit the acceptance evidence**

```powershell
git add -- scripts/local-post-package-acceptance.mjs scripts/local-hosted-post-package-acceptance.mjs package.json docs/handoffs
git commit -m "test: verify post package foundation"
```

Hosted migration, production deployment, custom-app refresh, hosted-data acceptance, pushing, opening/merging a PR, and cleanup of worktrees or branches are separate consequential actions requiring explicit authorization.
