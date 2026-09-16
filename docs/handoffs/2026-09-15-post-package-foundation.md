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
- Both acceptance programs removed only their validated UUID fixtures in `finally`. The website flow also removed its exact private Storage object. Final checks proved zero opportunities, packages, variants, package asset selections, distribution items, publications, assets, destinations, memberships, Auth users, and request-audit rows remained.

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
pnpm acceptance:post-package
pnpm acceptance:mcp-post-package
```

## Consequential steps not performed

No hosted Supabase migration was applied. No production or preview deployment occurred. The ChatGPT custom app was not refreshed. No hosted-data acceptance ran. Nothing was pushed, no pull request was opened or merged, and no branch or worktree was removed. Each remains a separate consequential action requiring explicit authorization.
