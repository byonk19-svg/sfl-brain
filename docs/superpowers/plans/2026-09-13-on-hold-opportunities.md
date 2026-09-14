# On-Hold Content Opportunities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual, auditable On hold workflow that removes paused opportunities from active attention while preserving searchability, stage, history, and confirmed ChatGPT management.

**Architecture:** Store each hold period in `content_opportunity_holds` with one active hold per opportunity, transactionally authorized website/connector RPCs, and immutable release history. Repository queries explicitly select active, held, or all opportunities; Today consumes only active data, while direct search retains held results. Website and MCP surfaces share the same `BrainService` lifecycle operations and actor context.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, Next.js 16.3 App Router, React 19, TypeScript, Zod, MCP 2.0, Vitest, Vercel.

---

### Task 1: Add the hold-period data model and lifecycle functions

**Files:**
- Create via CLI: exact migration path emitted by `supabase migration new content_opportunity_holds`
- Create: `supabase/tests/content_opportunity_holds.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write the failing database contract**

Create `supabase/tests/content_opportunity_holds.sql` as a transaction that seeds two workspaces, three fake member IDs using the existing test-only replication-role pattern, and two opportunities. Assert the wished-for functions and behavior:

```sql
select public.place_content_opportunity_on_hold(
  v_workspace_a,
  v_opportunity_a,
  v_actor_a,
  'website',
  null,
  'Retailer is not commissionable',
  'Retailer becomes commissionable through an available affiliate channel',
  null
);

if (select status from public.content_opportunities where id = v_opportunity_a) <> 'idea' then
  raise exception 'Placing a hold changed the editorial stage';
end if;

if (select count(*) from public.content_opportunity_holds where opportunity_id = v_opportunity_a and released_at is null) <> 1 then
  raise exception 'Expected one active hold';
end if;
```

Also prove required reason/condition validation, one-active-hold uniqueness, cross-workspace rejection, stale update/release rejection, release history, re-hold history, authenticated/anon privilege denial, and archive/restore retaining an active hold.

- [ ] **Step 2: Run the SQL test and verify RED**

Run the SQL file against the existing isolated local Supabase validation stack or a fresh uniquely named stack through `psql -v ON_ERROR_STOP=1`.

Expected: failure because `content_opportunity_holds` and its lifecycle functions do not exist.

- [ ] **Step 3: Generate and implement the migration**

Run:

```powershell
pnpm dlx supabase@2.116.0 migration new content_opportunity_holds
```

Use the exact emitted path. Create:

```sql
create table public.content_opportunity_holds (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null,
  hold_reason text not null check (length(trim(hold_reason)) > 0),
  release_condition text not null check (length(trim(release_condition)) > 0),
  review_on date,
  held_at timestamptz not null default now(),
  held_by uuid not null,
  held_source text not null check (held_source in ('website', 'chatgpt_connector', 'migration')),
  released_at timestamptz,
  released_by uuid,
  released_source text check (released_source in ('website', 'chatgpt_connector', 'migration')),
  release_note text,
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (opportunity_id, workspace_id)
    references public.content_opportunities(id, workspace_id) on delete cascade,
  check ((released_at is null) = (released_by is null)),
  check ((released_at is null) = (released_source is null))
);

create unique index one_active_hold_per_opportunity
  on public.content_opportunity_holds(opportunity_id)
  where released_at is null;
```

Enable RLS, revoke all access from `public`, `anon`, and `authenticated`, and grant table access only to `service_role`. Add `updated_at` maintenance using the existing project trigger convention.

Add `place_content_opportunity_on_hold`, `update_content_opportunity_hold`, and `release_content_opportunity_hold`. Every function accepts workspace, opportunity, actor, and source; trims text; verifies `workspace_members` in the same transaction; locks the opportunity; and returns the current hold as JSON. Update and release require `p_expected_updated_at` and match it in the mutation predicate.

Each function also accepts `p_request_id uuid default null`. Website and migration calls pass null. `chatgpt_connector` calls require a non-null request ID and use `mcp_mutation_requests` for idempotent actor/workspace/action/payload binding. Replace that table's action check constraint with one that adds `place_content_opportunity_on_hold`, `update_content_opportunity_hold`, and `release_content_opportunity_hold` without weakening the existing actions.

- [ ] **Step 4: Add the exact Arhaus migration data**

In the same migration, place only the exact unarchived `Arhaus vases under $50` opportunity on hold when its workspace has exactly one member and no active hold. Preserve `status`, clear `next_action`, and store:

```text
Hold reason: Arhaus is not currently commissionable through Elaine's available affiliate channels.
Release condition: Arhaus becomes available through Mavely, or Elaine is approved for ShopMy and Arhaus is available there.
Review date: null
Source: migration
```

Update the matching local seed entry so a fresh reset represents the same state without creating duplicate holds.

- [ ] **Step 5: Run database tests and verify GREEN**

Run existing SQL suites plus `content_opportunity_holds.sql`, then run `supabase db lint --local --level warning`.

Expected: all SQL transactions roll back without exceptions and schema lint returns no errors.

- [ ] **Step 6: Commit the database lifecycle**

Stage only the CLI-created migration, `supabase/tests/content_opportunity_holds.sql`, and `supabase/seed.sql`; commit as `feat: add content opportunity holds`.

### Task 2: Make opportunity attention scope explicit

**Files:**
- Modify: `src/lib/content-recommendations.ts`
- Modify: `src/lib/content-recommendations.test.ts`
- Modify: `src/lib/opportunity-repository.ts`
- Modify: `src/lib/opportunity-repository.test.ts`
- Modify: `src/lib/brain.ts`
- Modify: `src/lib/brain.integration.test.ts`
- Modify: `src/lib/website-auth.ts`
- Modify: `src/lib/website-auth.test.ts`

- [ ] **Step 1: Write failing attention-scope and ordering tests**

Extend the opportunity input with a current hold:

```ts
type OpportunityHoldInput = {
  id: string;
  holdReason: string;
  releaseCondition: string;
  reviewOn: string | null;
  heldAt: string;
  updatedAt: string;
};
```

Add tests proving `getTodayContentCandidates` rejects any input with `currentHold`, while direct scoring remains deterministic. Add repository tests for:

```ts
await repository.search("", 100, "active");
await repository.search("", 100, "on_hold");
await repository.search("Arhaus", 100, "all");
```

Assert due review dates first, future dates second, undated holds last, and explicit all-scope search returns hold metadata.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
pnpm vitest run src/lib/content-recommendations.test.ts src/lib/opportunity-repository.test.ts
```

Expected: failures because hold inputs and attention scopes are absent.

- [ ] **Step 3: Implement hold mapping and scoped queries**

Join `content_opportunity_holds` in `OpportunityRepository.inputs()` and map the unreleased row to `currentHold`. Add:

```ts
export type OpportunityAttentionScope = "active" | "on_hold" | "all";
```

Make `search(query, limit, scope = "active")` filter by current hold before mapping. Include `hold_reason`, `release_condition`, `review_on`, `held_at`, `hold_updated_at`, and `review_due` in held/all results. Search haystacks include hold text. Implement the agreed date ordering with stable ID tie-breaking; preserve alphabetical ordering for active results.

Filter held opportunities at the start of `getTodayContentCandidates` so they cannot enter any Today mode. Keep `context(id)` unscoped and include full hold history ordered by `held_at desc`.

- [ ] **Step 4: Add BrainService lifecycle methods**

Generalize the request actor type:

```ts
export type MutationActor = {
  userId: string;
  source: "website" | "chatgpt_connector";
};
```

Add `searchOnHoldOpportunities`, `placeContentOpportunityOnHold`, `updateContentOpportunityHold`, and `releaseContentOpportunityHold`, each calling the corresponding RPC with the service workspace and actor. The mutations accept an optional request ID; connector calls supply it and website calls do not. Update `createWebsiteBrainService()` to preserve the verified user ID in a `website` actor after membership resolution; hosted MCP keeps the connector actor. Local development writes remain explicitly labeled and never impersonate a user.

- [ ] **Step 5: Run focused and integration tests**

Run the focused tests, then the real isolated Supabase integration suite with `SFL_INTEGRATION=1`.

Expected: held candidates are excluded, all three scopes and ordering pass, context contains history, and lifecycle RPCs persist/re-read the correct state.

- [ ] **Step 6: Commit attention scoping**

Stage only the eight listed files and commit as `feat: scope held opportunities out of active work`.

### Task 3: Add website On hold controls

**Files:**
- Modify: `src/lib/validation.ts`
- Modify: `src/app/actions.ts`
- Modify: `src/app/library/page.tsx`
- Modify: `src/app/opportunities/[id]/page.tsx`
- Modify: `src/components/navigation.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/opportunity-hold-form.tsx`
- Create: `src/components/opportunity-hold-form.test.tsx`
- Create: `src/app/library/page.test.tsx`
- Create: `src/app/opportunities/[id]/page.test.tsx`
- Create: `src/components/navigation.test.tsx`

- [ ] **Step 1: Write failing validation and component tests**

Add schemas:

```ts
export const placeOpportunityHoldSchema = z.object({
  opportunity_id: z.uuid(),
  hold_reason: z.string().trim().min(1).max(2_000),
  release_condition: z.string().trim().min(1).max(2_000),
  review_on: z.iso.date().optional(),
});
```

Create matching update and release schemas with hold ID and expected timestamp. Component tests must prove required labels, optional date input, keyboard-submittable controls, existing-value editing, and an explicit Return to backlog action.

- [ ] **Step 2: Run UI tests and verify RED**

Run validation, hold-form, Library, opportunity-detail, and navigation tests.

Expected: failures because the schemas, controls, and On hold view are absent.

- [ ] **Step 3: Implement authenticated server actions**

Add `placeOpportunityOnHoldAction`, `updateOpportunityHoldAction`, and `releaseOpportunityHoldAction`. Each parses untrusted form data, creates a website Brain service with authenticated actor identity, invokes one lifecycle method, revalidates `/today`, `/library`, and the detail route, then redirects with bounded success/error text.

Manual release success copy is `Returned to the active backlog.` No notification, email, or background job is created.

- [ ] **Step 4: Implement Backlog navigation and lists**

Rename the left navigation item to Backlog. Parse `/library?view=backlog|on-hold|products`; use active, on-hold, and product queries respectively. Render tabs:

```text
Content backlog | On hold | Product catalog
```

Add the compact hold form to active rows without nesting an interactive form inside the row link. Use separate row content and action regions with accessible labels. On hold rows show reason, release condition, review date or No review date, Due for review when applicable, and Return to backlog.

- [ ] **Step 5: Implement opportunity-detail hold management**

Show the current hold above editorial editing, allow reason/condition/date updates, provide Return to backlog, and list released periods beneath it. Editing ordinary opportunity fields never submits a hold mutation.

- [ ] **Step 6: Verify website behavior**

Run focused tests and a real browser pass at desktop and narrow widths. Prove quick hold, tab movement, due ordering, held-item editing, manual release, success messages, keyboard access, explicit search, stage preservation, and no Today appearance.

- [ ] **Step 7: Commit website controls**

Stage only the listed website, validation, style, and test files; commit as `feat: manage on-hold opportunities in backlog`.

### Task 4: Add confirmed ChatGPT hold tools

**Files:**
- Create: `src/lib/mcp/hold-schemas.ts`
- Create: `src/lib/mcp/hold-schemas.test.ts`
- Modify: `src/lib/mcp/server.ts`
- Modify: `src/lib/mcp/server.test.ts`
- Modify: `src/lib/brain.mcp-writes.test.ts`
- Modify: `scripts/mcp-smoke-contract.mjs`
- Modify: `src/lib/mcp/smoke-contract.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing MCP schema and inventory tests**

Define wished-for Zod contracts with UUID request IDs, required reason/condition, optional ISO date, and optimistic concurrency for update/release. Assert hosted tools appear in this order near the existing opportunity tools:

```text
get_on_hold_opportunities
place_content_opportunity_on_hold
update_content_opportunity_hold
release_content_opportunity_hold
```

The read has `readOnlyHint: true`; all three writes have `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`, and `openWorldHint: false`. Assert none appear in local read-only mode.

- [ ] **Step 2: Run MCP tests and verify RED**

Run:

```powershell
pnpm vitest run src/lib/mcp/hold-schemas.test.ts src/lib/mcp/server.test.ts src/lib/brain.mcp-writes.test.ts src/lib/mcp/smoke-contract.test.ts
```

Expected: missing schemas, reader methods, and tool inventory failures.

- [ ] **Step 3: Implement hold tools**

Extend `BrainReader` with the four hold methods. Register `get_on_hold_opportunities` for explicit hold review. Register the three writes only when production writes are enabled. Tool descriptions require explicit user intent and a fresh opportunity/hold read; handlers re-read context after mutation and return sanitized saved state.

Pass each schema's `request_id` into the shared lifecycle RPC so the `mcp_mutation_requests` actions added in Task 1 enforce retry idempotency and actor/source binding. Do not add delete, automatic release, monitoring, or notification tools.

- [ ] **Step 4: Update smoke and operator documentation**

Update hosted inventory from ten to fourteen tools while retaining seven local read-only tools. Document website and conversational examples, manual release semantics, factual-statement future rule, and deferred automation.

- [ ] **Step 5: Verify and commit MCP behavior**

Run the four focused files, typecheck, and local protocol smoke. Stage only the listed files and commit as `feat: manage holds through ChatGPT`.

### Task 5: Full verification, hosted rollout, and Arhaus acceptance

**Files/Systems:**
- All files changed since `b8a5b58`
- Supabase project `iyfttmztfhjlqmxjrwgw`
- Existing Vercel project `sfl-brain`
- ChatGPT app `SFL Brain Hosted`

- [ ] **Step 1: Run the canonical local gate**

Run `pnpm verify`, then repeat all SQL suites and `supabase db lint --local --level warning` against an isolated stack. If host pressure causes Vitest worker-start timeouts without assertion failures, rerun with `--maxWorkers=2 --no-file-parallelism` and report the distinction.

- [ ] **Step 2: Review security and final diff**

Verify RLS/grants, transaction-level membership, workspace composite keys, actor/source audit, idempotency, stale-write protection, absence of secret logging, absence of automatic monitoring claims, and no unrelated worktree changes. Confirm every spec criterion maps to a test or browser check.

- [ ] **Step 3: Apply hosted migration safely**

Copy complete migrations into a fresh isolated directory, verify filenames, byte counts, and SHA-256 hashes, link only `iyfttmztfhjlqmxjrwgw`, run migration list and dry run, then apply only the expected hold migration. Require a final dry run with `upToDate: true`.

- [ ] **Step 4: Deploy the verified commit to Vercel**

Deploy to the linked `sfl-brain` production project, require a successful remote build, and verify the OAuth-protected `/mcp` challenge plus metadata before authenticated testing.

- [ ] **Step 5: Verify persisted Arhaus state**

Read the hosted record and require Idea stage, null Next step, one active hold, the exact approved reason/condition, null review date, and migration source. Confirm it is absent from active backlog and Today, present first or appropriately ordered in On hold, and discoverable through explicit Arhaus search.

- [ ] **Step 6: Verify website and ChatGPT hold flows**

Use a uniquely labeled disposable opportunity or a user-approved real record. Confirm website placement/edit/release and the equivalent SFL Brain Hosted calls, including ChatGPT write confirmation and persisted actor/source. Clean only the disposable records created for this acceptance.

- [ ] **Step 7: Complete the delivery gate**

Re-run focused hosted reads, verify no fixtures remain, inspect Git status and deployment state, and report local tests, database tests, browser behavior, ChatGPT behavior, and any provider limitation separately. Do not remove the older development tunnel or connector without explicit cleanup authorization.
