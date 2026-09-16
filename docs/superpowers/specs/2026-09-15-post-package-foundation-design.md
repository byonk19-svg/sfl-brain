# Post Package Foundation Design

## Goal

Make each Content Opportunity a durable archive of the copy and creative used for every publishing cycle. Elaine can prepare, retrieve, publish, and later revisit a complete package from the website or ChatGPT without searching old conversations, notes, or her camera roll.

## Domain boundary

A Content Opportunity is the long-lived editorial idea. A Post Package is one versioned execution of that idea. An opportunity may have many packages over time but at most one active package in Draft or Publishing state.

A revival never reopens a prior package. It starts the next package sequence so historical copy, selected assets, destination plan, and Publications remain unchanged.

Package states are:

- `draft`: preparation before the first Publication;
- `publishing`: begins with the first Publication and permits remaining planned destinations;
- `closed`: every Distribution item is Published or Skipped and Elaine explicitly finishes the cycle;
- `abandoned`: the package is stopped before any Publication.

Closed and Abandoned packages are immutable. A Draft package cannot be abandoned after a Publication; a Publishing package finishes by resolving every remaining destination and closing.

## Copy model

Each package has one Base caption. Creating a Caption variant copies the current Base caption once; subsequent edits are independent and never use live inheritance.

Reusable Audience variants cover the ordinary copy patterns:

- SFL Page;
- SFL groups;
- personal-profile groups;
- Instagram;
- custom audience.

A Destination override is optional and applies only when one exact Destination has rules that require different copy. A package has at most one current variant for each audience and at most one override for each exact destination.

Variants are `draft` or `approved`. A Distribution item may be planned against a draft variant, but an actual Publication requires an approved variant. Approval is explicit and attributable; later edits return the variant to draft.

## Asset model

Assets remain canonical workspace records backed by the private `sfl-assets` bucket. A package references an existing Asset instead of copying its file.

Package asset selections have:

- role: `hero`, `supporting`, or `comparison`;
- zero-based display/publication position;
- optional package-specific note.

Only one hero is allowed per package. Asset type already distinguishes photo, Canva graphic, video, and screenshot, so media type is not duplicated in the package role.

The website may upload a new private Asset and attach it to the package in one flow. ChatGPT may attach existing assets and retrieve sanitized metadata plus short-lived signed links, but binary upload from a ChatGPT attachment is deferred: [current official OpenAI MCP documentation](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) defines JSON tool arguments and does not establish automatic forwarding of a conversation attachment to an arbitrary MCP tool.

## Distribution plan

Each Distribution item targets one exact active Destination and selects an Audience variant or Destination override. Its state is:

- `planned`;
- `published`, linked to exactly one Publication;
- `skipped`, with an optional reason.

A package closes manually only when no item remains Planned. It does not close automatically because destinations may be added late or intentionally omitted.

The existing Destination catalog remains the exact endpoint model. The foundation adds a small website management surface to create, edit, and deactivate destinations because a distribution plan is unusable when the hosted workspace has none. Destination deletion remains out of scope; historical Publications keep their referenced destination.

## Publication snapshots

`posts` remains the durable Publication table. It gains nullable package and caption-variant references for compatibility with historical rows.

Recording from a package atomically:

1. verifies the package, destination, variant, and assets share the authorized workspace;
2. requires an approved variant;
3. copies the exact variant body into `posts.caption`;
4. copies the ordered package asset selection into `post_assets`;
5. links the Post Package and Caption variant;
6. marks the matching Distribution item Published;
7. moves the package from Draft to Publishing on its first Publication;
8. preserves existing opportunity-stage behavior.

The snapshot columns remain authoritative for what actually went out. Package records explain how it was prepared; they never replace publication evidence.

## Data model

Add:

- `post_packages`: workspace, opportunity, sequence, status, base caption, working angle, notes, creator/updater identity and source, timestamps, optional closed/abandoned timestamps;
- `post_package_caption_variants`: workspace, package, audience kind, optional exact destination, body, draft/approved status, creator/updater identity and source, timestamps;
- `post_package_assets`: workspace, package, asset, role, position, note;
- `post_package_destinations`: workspace, package, destination, selected variant, planned/published/skipped status, optional Post, skip reason, timestamps.

Constraints enforce:

- workspace-local composite foreign keys;
- unique package sequence per opportunity;
- at most one active package per opportunity;
- one hero and unique asset positions per package;
- one general variant per audience and one override per exact destination;
- one Distribution item per exact destination per package;
- Published items have one Post, while Planned and Skipped items do not;
- closed or abandoned package contents cannot be mutated.

All tables use RLS and remain inaccessible directly to browser roles. Website and connector writes go through server-owned services and transactional RPCs.

## Existing-data migration

For each Content Opportunity with historical Posts, create one Closed legacy package and link those Posts to it. The migration does not invent a Base caption, Caption variants, package asset selections, or Distribution items because the original preparation state is unknowable. Existing `posts.caption` and `post_assets` remain the historical truth.

Opportunities without Posts receive no automatic package. Their existing opportunity-level assets remain available to select when Elaine starts a package.

## Website experience

The opportunity detail page gains a Post Package section:

- start a package when none is active;
- edit Base caption, angle, and notes;
- create, approve, and edit Audience variants and Destination overrides;
- attach, order, role, preview, and upload assets;
- build the Distribution plan;
- record a Publication from a planned item with its copy and assets preselected;
- skip destinations with a reason;
- close or abandon under the lifecycle rules;
- expand prior packages as a read-only archive.

Copy buttons remain available for every approved variant. Record Post continues to support legacy/manual entry, but package-driven recording is the preferred path.

A Destinations management page supports add, edit, and deactivate. It is linked from Record Post and the package distribution planner rather than adding another primary-navigation item.

## ChatGPT connector experience

Add a read tool that returns the active package and prior package summaries for an opportunity, including sanitized caption variants, Distribution items, asset metadata, and signed links without storage paths.

Add confirmed, idempotent, non-destructive write tools for:

- starting a package;
- updating package working copy;
- creating or updating and approving a Caption variant;
- setting ordered package asset selections from existing asset IDs;
- setting Distribution items;
- skipping an item;
- closing or abandoning a package.

Every write requires the latest `updated_at`, verified connector membership, a unique request ID, actor/source audit, and a re-read saved result. The connector cannot delete packages, variants, assets, destinations, or Publications, upload binary files, or publish externally.

## Failure behavior

- A second active package for the same opportunity is rejected.
- A closed or abandoned package rejects every mutation.
- Cross-workspace package relationships are rejected transactionally.
- An unapproved variant cannot be published.
- A destination override must target the same destination as its Distribution item.
- Closing with Planned items is rejected and reports the remaining destinations.
- Abandoning after any Publication is rejected; resolve and close instead.
- Stale edits require a fresh read.
- Duplicate connector requests with the same actor and payload return the original result; context conflicts are rejected.
- Failed uploads remove newly written Storage objects and create no Asset row.

## Acceptance criteria

Automated database and application tests must prove lifecycle transitions, immutability, one-active-package enforcement, variant copy-then-diverge behavior, approval gating, asset ordering, destination constraints, atomic Publication snapshots, backfill safety, workspace isolation, RLS, idempotency, actor/source audit, and cleanup on upload failure.

Real browser acceptance must prove desktop and narrow opportunity views, copy editing and approval, asset upload/reorder/preview, destination planning, staggered Publication recording, skipping, closure, archive retrieval, and no mutation of prior packages.

Hosted connector acceptance must prove the package read tool and every confirmed write, including a re-read from a fresh ChatGPT conversation. Website and connector state must agree. Production deployment requires complete migration verification, no disposable fixtures, and a final read-only archive check.

## Deferred scope

- automatic external publishing;
- binary upload directly from ChatGPT conversation attachments;
- automatic package closure;
- automatic copy generation or approval;
- social-network API integrations;
- analytics ingestion beyond existing Publication metrics;
- automatic destination-rule enforcement beyond stored notes and explicit overrides.
