# On-Hold Content Opportunities Design

## Goal

Keep temporarily unsuitable content ideas without allowing them to compete for Elaine's current attention. An on-hold opportunity disappears from the active Content backlog and Today recommendations, remains easy to find in a separate On hold view or an explicit search, and returns only through a deliberate manual release.

The left navigation label changes from Library to Backlog so it matches the page heading. The Backlog page contains three views: Content backlog, On hold, and Product catalog.

## Domain behavior

On hold is independent of editorial stage. An opportunity retains Idea, Needs assets, Needs links, Needs caption, Ready, Posted, or Revival candidate while held. Releasing it restores active attention at that unchanged stage.

Every hold requires two separate facts:

- Hold reason: why the opportunity should not receive attention now.
- Release condition: what must become true before it is worth reconsidering.

A review date is optional and date-only. Reaching it marks the hold Due for review but does not release the opportunity or put it in Today.

The current release is fully manual. SFL Brain does not infer that conditions have been met, monitor affiliate programs, release opportunities automatically, or issue background notifications. Future monitoring may accept only an explicit factual statement made while SFL Brain Hosted is active or evidence from a trusted integration. Intent, applications, expectations, or speculation do not satisfy a future monitored condition. Automatic release and its notification remain a later feature.

## Hold history

Each hold period is durable history rather than mutable columns on the opportunity. `content_opportunity_holds` contains:

- ID, workspace ID, and opportunity ID
- non-empty hold reason and release condition
- optional review date
- held timestamp, actor user ID, and source (`website`, `chatgpt_connector`, or `migration`)
- optional released timestamp, actor user ID, source, and release note
- updated timestamp for optimistic concurrency

A partial unique index allows at most one unreleased hold per opportunity. Workspace-scoped composite foreign keys prevent cross-workspace relationships. The table uses RLS and remains service-role-only; website and connector callers reach it through authorized application operations, never direct browser writes.

Placing, editing, and releasing a hold runs through database functions that verify the actor's current `workspace_members` membership inside the transaction. Duplicate connector requests remain idempotent and actor-bound. Placing an already-held opportunity, editing a released hold, releasing an inactive hold, or using a stale `updated_at` fails without changing data.

Archiving remains independent. An archived opportunity is absent from all backlog views even if it has an active hold; restoring it returns to On hold when that hold is still active. Recording a publication may change the preserved editorial stage to Posted but does not silently release a hold.

## Query and recommendation behavior

Opportunity loading includes the current hold and hold history where required. The repository exposes explicit scopes rather than filtering by UI convention:

- `active`: unarchived opportunities without an active hold
- `on_hold`: unarchived opportunities with an active hold
- `all`: all unarchived opportunities, including holds

Today and recent candidate inputs use `active`; held opportunities never enter scoring. The Content backlog uses `active` when no query is present. A non-empty search from the Content backlog uses `all` so a specifically requested held item remains discoverable and visibly labeled On hold. The On hold tab uses `on_hold`, including for its own searches. MCP search and direct opportunity lookup use `all` and include the current reason, condition, review date, and due state.

The On hold tab ordering is:

1. Due review dates, oldest first
2. Upcoming review dates, soonest first
3. Holds without dates, most recently held first

The active backlog retains its existing alphabetical ordering.

## Website experience

The left navigation item reads Backlog. On `/library`, the view switcher reads Content backlog, On hold, and Product catalog; the page heading matches the selected view.

Each active backlog row has a quick Put on hold action. It opens a compact form requiring Hold reason and Release condition, with an optional Review date. The row remains a normal link to the opportunity; the hold control must be keyboard accessible and must not accidentally navigate when submitted.

The opportunity detail page shows:

- an On hold status treatment when a current hold exists;
- editable reason, release condition, and review date;
- the current hold's held date and source;
- Return to backlog;
- prior hold periods in chronological history.

Return to backlog ends the current hold, preserves the editorial stage, and shows immediate success feedback. It does not send a separate notification because the member initiated the release. Editing title, notes, stage, next action, and hold details does not release the item.

The On hold tab shows reason and release condition prominently. Due items receive a Due for review label. Empty-state copy explains that held ideas are retained without competing for today's work.

## ChatGPT connector experience

SFL Brain Hosted gains one read and three write tools:

- `get_on_hold_opportunities`: list held opportunities in review order.
- `place_content_opportunity_on_hold`: require reason and release condition, accept an optional review date, and require a unique request ID.
- `update_content_opportunity_hold`: edit the current hold using its latest `updated_at` value.
- `release_content_opportunity_hold`: end the current hold using its latest `updated_at` value and an optional release note.

The three writes are non-destructive, closed-world, idempotent, and marked as writes so ChatGPT requests confirmation. They return the re-read saved opportunity and hold state. Existing opportunity-progress edits remain available while held and do not change the hold. Search and direct context clearly disclose On hold status so ChatGPT does not recommend held content casually.

## Initial Arhaus migration

The existing `Arhaus vases under $50` opportunity is placed On hold when the feature is deployed. Its stage remains Idea and its existing Next step is cleared because that prose is being normalized into:

- Hold reason: `Arhaus is not currently commissionable through Elaine's available affiliate channels.`
- Release condition: `Arhaus becomes available through Mavely, or Elaine is approved for ShopMy and Arhaus is available there.`
- Review date: none

The migration applies only to the exact unarchived title in a workspace with exactly one member, does nothing if an active hold already exists, and records source `migration`. It must not infer holds from other free-text Next step values. Current hosted inspection found no other explicit deprioritization or revisit wording to migrate.

## Failure behavior

- Missing reason or release condition: show field-level validation and make no change.
- Review date in the past: allow it and mark the item Due for review immediately.
- Membership revoked: deny website and connector hold operations.
- Duplicate connector request with matching actor and payload: return the original result.
- Duplicate request with another actor or payload: reject as a context conflict.
- Stale hold edit or release: require a fresh read before retrying.
- Explicit search: return the held record with its hold metadata rather than hiding it.
- Monitoring unavailable: leave the hold unchanged; never imply that SFL Brain is watching the condition.

## Acceptance criteria

Automated database and application tests must prove:

1. A hold preserves stage and excludes the opportunity from active backlog and Today scoring.
2. The On hold view contains only current, unarchived holds and follows the agreed review ordering.
3. Explicit search and direct context still find held items and expose sanitized hold facts.
4. Reason and release condition are required; review date is optional and date-only.
5. Only one active hold exists per opportunity, history survives release and re-hold, and stale operations fail.
6. Every website and connector hold mutation verifies current workspace membership transactionally and records actor/source.
7. ChatGPT lists the new read tool and three confirmed write tools without exposing destructive hold deletion.
8. Manual release restores the item to the active backlog at its current stage and displays success feedback without generating a separate notification.
9. The exact Arhaus record is held with the approved text, no review date, Idea preserved, and Next step cleared.
10. Existing content, product, publication, authentication, and hosted connector behavior remains green.

Browser acceptance must verify desktop and narrow layouts, keyboard access to the quick hold form, active-plus-held Content backlog search, On hold-only search, due-review styling, detail editing, manual release, and the equivalent confirmed ChatGPT hold flow. Canonical lint, typecheck, unit/integration tests, production build, hosted migration verification, and persisted-state checks remain required.

## Deferred scope

Affiliate-program monitoring, cross-chat passive observation, automatic condition satisfaction, automatic release, release notifications, email or push delivery, and full product-management parity in ChatGPT are explicitly deferred. They should build on hold history and release conditions rather than changing the current manual semantics.
