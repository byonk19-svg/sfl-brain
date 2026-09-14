# SFL Brain Handoff — Hosted Connector and On Hold

Verified on September 14, 2026. Treat hosted and branch state as a dated observation and recheck it before mutation.

## Resume here

SFL Brain now has an always-on production website and OAuth-protected ChatGPT connector that do not depend on a local computer or tunnel. The current feature branch also adds a complete manual On hold workflow across the website and connector.

Read these authorities before continuing:

- Product direction: `docs/PRODUCT_VISION.md`
- Domain language: `CONTEXT.md`
- Hosted connector decision: `docs/adr/0001-host-production-mcp-on-vercel.md`
- Hosted connector contract: `docs/superpowers/specs/2026-09-13-hosted-chatgpt-connector-design.md`
- On hold contract: `docs/superpowers/specs/2026-09-13-on-hold-opportunities-design.md`
- Operations and verification: `README.md`

## Repository state

- Repository: `byonk19-svg/sfl-brain`
- Pull request: [#1 — Add hosted SFL Brain connector and On hold workflow](https://github.com/byonk19-svg/sfl-brain/pull/1)
- Feature branch: `codex/hosted-chatgpt-connector`
- Base branch: `main`
- Feature head before this documentation update: `eb0afcf54cca4b2bb7bdc3dbca4e2b5596fe2a54`
- Worktree used for the feature: `C:\Users\byonk\.config\superpowers\worktrees\SFL Brain\hosted-chatgpt-connector`
- The feature branch and remote matched and the worktree was clean at the start of this documentation update.

The production deployment was made from the feature branch before merge. Do not assume `main` contains the live production implementation until the pull request state and deployed revision are checked.

## Hosted state

- Production website: `https://sfl-brain.vercel.app`
- Production MCP resource: `https://sfl-brain.vercel.app/mcp`
- Hosted Supabase project reference: `iyfttmztfhjlqmxjrwgw`
- ChatGPT app: `SFL Brain Hosted`, connected through Supabase OAuth 2.1 to an existing SFL Brain member.
- ChatGPT's cached action definition was refreshed after deployment and displayed the four hold capabilities: list, place, update, and release.
- The development tunnel remains optional development infrastructure; it is not a production dependency.

No credentials, tokens, or private member identifiers belong in this handoff.

## Implemented behavior

- The left navigation calls `/library` Backlog.
- Content backlog contains active opportunities; held opportunities do not appear there without a search.
- A non-empty Backlog search includes matching active and held opportunities and labels held matches with their reason, release condition, and review state.
- The On hold tab lists held opportunities in manual-review order.
- Today ranking excludes held opportunities before scoring.
- Website and ChatGPT can place, edit, and manually release a hold.
- A hold preserves the opportunity's editorial stage and maintains history across release and re-hold.
- Review dates flag an item as due; they do not release it or place it in Today.
- The Arhaus opportunity is held with the approved affiliate-availability condition and no review date. Its next action was cleared while its Idea stage was preserved.

## Verification evidence

The final pre-PR verification produced:

- Vitest: 97 passed, 8 skipped across 21 test files.
- ESLint: zero errors and one existing `@next/next/no-img-element` warning in the opportunity detail page.
- TypeScript: passed.
- Next.js production build: passed and generated all expected routes.
- Hold lifecycle SQL regression: transaction completed and rolled back successfully.
- Supabase database lint: no schema errors.
- `git diff --check`: passed.
- Signed-in production browser acceptance confirmed Backlog exclusion, On hold display, Today exclusion, and held-result discovery from Backlog search.
- ChatGPT plugin management showed the refreshed hold action inventory.

Re-run the canonical gate when code changes:

```powershell
pnpm verify
pnpm dlx supabase@2.116.0 db lint --local --level warning
Get-Content -Raw supabase\tests\content_opportunity_holds.sql | docker exec -i supabase_db_sfl-brain psql -U postgres -d postgres -v ON_ERROR_STOP=1
pnpm mcp:smoke
```

## Known limitations

- Hold release remains manual. Review dates and release conditions are not monitored automatically.
- No cross-chat statement changes a hold unless SFL Brain Hosted is active and an explicit supported mutation is requested and confirmed.
- Separate notification of manual release is intentionally absent; the acting surface provides immediate confirmation.
- The Post Package archive described in the product vision is not yet implemented as a complete asset-and-caption workflow.
- Feature plans retain unchecked boxes from their original authoring and are not current completion trackers.

## Guardrails

- Preserve unrelated changes in the original checkout and any untracked `.omx/` state.
- Never print, commit, request in chat, or expose service-role keys, OAuth tokens, or passwords.
- Keep website session authorization separate from MCP bearer-token authorization.
- Resolve connector identity from verified claims and require exactly one workspace membership before service-role access.
- Use complete Supabase migration files, verify hashes and byte sizes in isolated deployment directories, and target the authorized project reference explicitly.
- Treat production deployment, hosted database mutation, access changes, merges, and additional pushes as consequential actions requiring the user's authorization.
- Keep the local MCP listener loopback-only and retain the old tunnel until removal is explicitly authorized.

## Recommended next work

1. Review and merge pull request #1 when its diff and checks are acceptable.
2. Use `grill-with-docs` to define the first Post Package and content-archive slice from `docs/PRODUCT_VISION.md`.
3. Keep the first slice narrow: durable caption variants and asset metadata/retrieval before broader analytics or automation.
4. Write a new dated handoff when the pull request merges, production changes, or the next feature reaches a stable checkpoint.

## Suggested skills

- `grill-with-docs` for the next product slice and its domain decisions.
- `supabase:supabase` for any database, Auth, RLS, Storage, or migration work.
- `superpowers:systematic-debugging` when behavior diverges from the verified state.
- `superpowers:test-driven-development` for implementation changes.
- `superpowers:verification-before-completion` before completion claims or deployment.
- `handoff` when moving active work into a fresh session; tailor the temporary handoff to the intended next task and reference this repository handoff.

## First commands in a new session

```powershell
git status --short --branch
git log -8 --oneline --decorate
gh pr view 1 --json state,title,url,headRefName,baseRefName,commits,statusCheckRollup
git diff main...HEAD --stat
```

Completion criterion for resumption: the agent has reconciled this dated handoff with current Git, pull-request, local-service, migration, and hosted deployment state before proposing or applying changes.
