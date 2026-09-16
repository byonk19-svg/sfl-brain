# Post Package Foundation Handoff

## Delivered locally

Branch `codex/post-package-foundation` implements the approved Post Package foundation beneath Content Opportunities. It includes the normalized database model and transactional lifecycle RPCs, typed repository and validation boundary, responsive website workspace and destination management, atomic package-driven Publication recording, and one read plus seven confirmed Post Package tools on the hosted ChatGPT connector.

The product contract remains intentionally manual: SFL Brain records publications that already happened, never publishes externally, never monitors retailers, and does not infer that an On Hold or package condition has been met.

## Local acceptance evidence

The final local gate ran against a fresh database reset on 2026-09-16:

- ESLint passed with `node node_modules/eslint/bin/eslint.js .`.
- TypeScript passed with `node node_modules/typescript/bin/tsc --noEmit`.
- Vitest passed 34 test files with 1 skipped; 153 tests passed with 12 skipped.
- The Next.js 16 production build passed with webpack, including TypeScript, page-data collection, and all 11 static pages.
- `node node_modules/supabase/dist/supabase.js db reset` recreated the local database and applied every migration through `20260916004346_post_package_foundation.sql`.
- `post_packages.sql`, `content_opportunities.sql`, `content_opportunity_holds.sql`, `hosted_connector_audit.sql`, and `workspace_members.sql` each completed `BEGIN`, `DO`, `ROLLBACK` with `ON_ERROR_STOP=1`.
- Supabase CLI 2.116.0 database lint at warning level returned `No schema errors found`.
- `local-post-package-acceptance.mjs` passed a real password-authenticated browser flow at desktop and 390px widths: package creation/editing, private asset upload and hero selection, draft-to-approved copy, two-destination plan, atomic package publication, skip, close, read-only archive retrieval, persisted snapshots, actor/source provenance, and terminal immutability.
- `local-hosted-post-package-acceptance.mjs` passed through the real locally hosted/authenticated MCP route with a ten-minute local bearer token: tool inventory/annotations, initial read, all seven package writes, repeated-request idempotency, fresh-client reread, saved state, actor/source audit, and output sanitization.
- Eight focused Node helper tests passed for single-source local Supabase configuration, mismatch refusal, trigger-scoped/FK-ordered cleanup SQL, explicit absence semantics, occupied-port refusal, paginated/nested Storage-prefix recovery, Storage listing-error enforcement, and deletion-scope refusal for foreign metadata paths.
- Both acceptance programs derive the API URL, publishable/anonymous/service keys, JWT secret, and database endpoint from one `supabase status` result; they verify it against the configured URL/keys, `project_id`, Docker project/worktree labels, and mapped database port without logging secrets.
- Server startup first proves the loopback port is unused, then requires the spawned child to remain alive, emit its ready marker, and return the expected SFL login or OAuth challenge. Startup failure and normal teardown terminate and await the exact process tree.
- Both acceptance programs recover committed fixtures from their unique run marker before cleanup, even if an ID was not captured. Cleanup disables only the six terminal-immutability triggers inside one transaction, deletes exact recovered UUIDs in FK-safe order, restores every trigger, and never changes `session_replication_role`.
- The website flow paginates and recursively lists every object under each exact disposable `${workspaceId}/opportunities/${opportunityId}/` prefix before metadata deletion, so it recovers an upload even if its Asset row was never committed. Before any delete, every candidate path—including `assets.storage_path` fallbacks—must be nested under one of those validated prefixes; a corrupted or foreign path fails cleanup without deleting it. It removes every in-scope object and then proves every prefix empty. Final marker-and-ID checks additionally require explicit Auth `user_not_found` and exact-object Storage `NoSuchKey` results; listing, connection, authorization, and other errors fail the proof. Zero opportunities, packages, variants, package asset selections, distribution items, publications, assets, destinations, memberships, Auth users, Storage objects, and request-audit rows remained.

## Security review

- Every package table has RLS enabled; `public`, `anon`, and `authenticated` grants are revoked, while the server-only service role owns the data boundary.
- Package, opportunity, destination, caption, asset, and Publication relationships use workspace-qualified composite keys.
- Every website/connector RPC transaction verifies current workspace membership; connector mutations require request IDs and persist actor/source context for idempotency and audit.
- Closed and abandoned packages and their Publication snapshots are database-enforced immutable. The browser acceptance attempted and rejected a closed-package update.
- Package asset previews use ten-minute signed URLs. Raw Storage paths, workspace IDs, actor IDs, credentials, and untrusted signed URLs are removed from MCP output.
- Browser acceptance uploads to the private `sfl-assets` bucket and proves the exact object is unavailable after cleanup.
- Legacy backfill creates only conservative Closed package history and links existing Posts; it does not invent variants, asset selections, or distribution plans.
- Connector descriptions and documentation make no automatic-publishing or ChatGPT binary-upload claim.

## Local dependency-layout note

This worktree intentionally reuses a verified dependency tree through a `node_modules` junction and retains an excluded `node_modules.partial` directory from an interrupted install. In this layout, `pnpm verify` and `pnpm acceptance:*` try to purge/reinstall the shared dependency target before running; allowing that would risk the other worktree. The final gate therefore invoked the exact underlying ESLint, TypeScript, Vitest, Next, Supabase, and Node acceptance commands directly. `node_modules.partial` was temporarily moved outside the source tree while ESLint/TypeScript ran and was restored afterward. Next dev/build used `--webpack` because Turbopack rejects a `node_modules` junction outside the worktree root. The browser acceptance used the existing Codex Playwright package through `CODEX_PLAYWRIGHT_PACKAGE`; no dependency or lockfile was changed.

On a normal independent install, use the committed scripts:

```powershell
pnpm verify
pnpm supabase:reset
pnpm dlx supabase@2.116.0 db lint --local --level warning
pnpm acceptance:test-support
pnpm acceptance:post-package
pnpm acceptance:mcp-post-package
```

## Consequential steps not performed

No hosted Supabase migration was applied. No production or preview deployment occurred. The ChatGPT custom app was not refreshed. No hosted-data acceptance ran. Nothing was pushed, no pull request was opened or merged, and no branch or worktree was removed. Each remains a separate consequential action requiring explicit authorization.
