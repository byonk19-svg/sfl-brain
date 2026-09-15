# SFL Brain Handoff — Local Acceptance Complete

Verified on September 15, 2026. This handoff supersedes the local-environment blocker in `2026-09-14-hosted-connector-and-on-hold.md`; hosted deployment state remains a dated observation and must be rechecked before mutation.

## Current state

- Branch: `codex/hosted-chatgpt-connector`
- Pull request: [#1 — Add hosted SFL Brain connector and On hold workflow](https://github.com/byonk19-svg/sfl-brain/pull/1)
- Production remains on the previously deployed revision. The review corrections and acceptance-harness changes in this branch have not been deployed or merged.
- Docker Desktop's Linux engine is healthy again. SFL Brain's local Supabase stack passed a complete reset without restarting the shared Docker engine or disturbing other projects.

## Completed local acceptance

- All migrations applied from scratch through `20260914031049_content_opportunity_holds.sql`.
- `content_opportunities.sql`, `content_opportunity_holds.sql`, `hosted_connector_audit.sql`, and `workspace_members.sql` each completed inside a transaction and rolled back successfully.
- Supabase database lint reported no schema errors.
- Database-backed local MCP smoke returned eight read tools and valid structured opportunity, product, post, and Radar context.
- The live Supabase integration suite passed 8 tests.
- `pnpm acceptance:hold` verified a real password-authenticated website flow: login, capture, hold placement, due state, narrow-layout facts, hold edit, manual release, website provenance, and preserved Idea stage.
- `pnpm acceptance:mcp-hold` verified the hosted route locally with a short-lived scoped bearer token: OAuth scope enforcement, workspace authorization, tool annotations, create, place, list, update, release, and `chatgpt_connector` actor/source audit.
- Both acceptance scripts generate credentials only in memory and delete their disposable opportunity, membership, and Auth user in `finally`.
- Final cleanup queries returned zero acceptance opportunities and zero acceptance users.

## Supporting corrections

- `supabase/tests/content_opportunities.sql` now calls the actor/source-aware connector RPC signatures installed by the audit migration.
- Local Auth keeps global `auth.enable_signup = false` while setting `auth.email.enable_signup = true`. Public registration remains blocked, while owner-provisioned email/password members can sign in.
- `docs/private-account-provisioning.md` records that distinction.

## Final verification

- ESLint: zero errors and one existing `@next/next/no-img-element` warning.
- TypeScript: passed.
- Vitest: 106 passed, 8 skipped across 25 test files.
- Next.js production build: passed with all expected routes.
- SQL suites: four passed.
- Supabase schema lint: passed.
- `git diff --check`: passed.

## Remaining boundary

The local acceptance run does not deploy, merge, or mutate hosted data. The production ChatGPT app's OAuth consent and action inventory were verified previously; this run exercised the same hosted request handler, scoped bearer verification, workspace resolution, and audited hold RPCs against local Supabase. A production deployment and post-deploy read-only visual check still require explicit authorization.

## Resume commands

```powershell
git status --short --branch
git log -6 --oneline --decorate
gh pr view 1 --json state,mergeable,headRefOid,statusCheckRollup,url
docker version --format 'server={{.Server.Os}} {{.Server.Version}}'
pnpm dlx supabase@2.116.0 status
```

Before merging or deploying, confirm the branch is pushed, the pull-request head matches local HEAD, and the full verification evidence above still applies to that exact commit.
