# Hosted ChatGPT Connector Implementation Plan

> **Status:** Implemented on `codex/hosted-chatgpt-connector` and under review in pull request #1. Unchecked boxes preserve the original plan syntax; use Git, the pull request, and the newest file in `docs/handoffs/` for current state.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SFL Brain's authenticated read/write MCP connector available through the existing Vercel deployment without depending on a local computer or tunnel.

**Architecture:** The Next.js `/mcp` route becomes an OAuth 2.1 resource server. It validates Supabase access tokens, resolves the authenticated member's single workspace, and creates a request-scoped `BrainService`; Supabase remains the authorization server and database. The existing three idempotent conversational writes gain actor/source auditing and transactional membership enforcement, while a new consent screen lets an existing SFL Brain member approve ChatGPT access.

**Tech Stack:** Next.js 16.3 App Router, React 19, `@modelcontextprotocol/server` 2.0, Supabase Auth/Postgres, Vitest, Vercel Functions.

---

### Task 1: Add request-scoped connector authentication and workspace authorization

**Files:**
- Create: `src/lib/mcp/connector-auth.ts`
- Create: `src/lib/mcp/connector-auth.test.ts`
- Modify: `src/lib/website-auth.ts`
- Modify: `src/lib/website-auth.test.ts`

- [ ] **Step 1: Write failing tests for token validation and exact membership resolution**

Create tests that inject a fake Supabase auth client and assert:

```ts
it("returns MCP auth info only for a verified Supabase access token", async () => {
  const verifier = createConnectorTokenVerifier({
    supabaseUrl: "https://project.supabase.co",
    getClaims: vi.fn().mockResolvedValue({
      data: { claims: { sub: "user-a", exp: 2_000_000_000, iss: "https://project.supabase.co/auth/v1", client_id: "chatgpt", scope: "openid email" } },
      error: null,
    }),
  });
  await expect(verifier.verifyAccessToken("token-a")).resolves.toMatchObject({
    token: "token-a",
    clientId: "chatgpt",
    scopes: ["openid", "email"],
    expiresAt: 2_000_000_000,
    extra: { userId: "user-a" },
  });
});

it("rejects tokens with invalid claims as invalid_token", async () => {
  const verifier = createConnectorTokenVerifier({
    supabaseUrl: "https://project.supabase.co",
    getClaims: vi.fn().mockResolvedValue({
      data: { claims: { sub: "user-a", exp: 2_000_000_000, iss: "https://other.supabase.co/auth/v1" } },
      error: null,
    }),
  });
  await expect(verifier.verifyAccessToken("bad")).rejects.toMatchObject({ code: "invalid_token" });
});

it("requires exactly one membership for the verified user", () => {
  expect(resolveSingleWorkspaceMembership("user-a", [{ workspace_id: "workspace-a", user_id: "user-a" }])).toBe("workspace-a");
  expect(() => resolveSingleWorkspaceMembership("user-a", [])).toThrow(WorkspaceAuthorizationError);
  expect(() => resolveSingleWorkspaceMembership("user-a", [
    { workspace_id: "workspace-a", user_id: "user-a" },
    { workspace_id: "workspace-b", user_id: "user-a" },
  ])).toThrow(WorkspaceAuthorizationError);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm vitest run src/lib/mcp/connector-auth.test.ts src/lib/website-auth.test.ts`

Expected: failure because `createConnectorTokenVerifier` and `resolveSingleWorkspaceMembership` do not exist.

- [ ] **Step 3: Implement the minimal token verifier and shared membership resolver**

`connector-auth.ts` must export a dependency-injectable verifier using the installed SDK contract:

```ts
export function createConnectorTokenVerifier(options: ConnectorTokenVerifierOptions): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token) {
      const { data, error } = await options.getClaims(token);
      const claims = data?.claims;
      const expectedIssuer = `${options.supabaseUrl.replace(/\/$/, "")}/auth/v1`;
      if (error || !claims?.sub || !claims.exp || claims.iss !== expectedIssuer) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, "The access token is invalid.");
      }
      return {
        token,
        clientId: typeof claims.client_id === "string" ? claims.client_id : "unknown-client",
        scopes: typeof claims.scope === "string" ? claims.scope.split(/\s+/).filter(Boolean) : [],
        expiresAt: claims.exp,
        extra: { userId: claims.sub },
      };
    },
  };
}
```

Create the real verifier with a server-only Supabase client configured with the publishable key, no persisted session, and `auth.getClaims(token)`. Move membership cardinality checking into `resolveSingleWorkspaceMembership`; keep `resolveWorkspaceFromMembership` as a compatibility wrapper for the website tests.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm vitest run src/lib/mcp/connector-auth.test.ts src/lib/website-auth.test.ts`

Expected: both files pass with invalid-token and membership failure cases covered.

- [ ] **Step 5: Commit the authentication seam**

```powershell
git add -- src/lib/mcp/connector-auth.ts src/lib/mcp/connector-auth.test.ts src/lib/website-auth.ts src/lib/website-auth.test.ts
git commit -m "feat: authenticate hosted MCP members"
```

### Task 2: Publish OAuth metadata and protect the hosted MCP route

**Files:**
- Create: `src/lib/mcp/oauth-metadata.ts`
- Create: `src/lib/mcp/oauth-metadata.test.ts`
- Create: `src/app/.well-known/oauth-protected-resource/mcp/route.ts`
- Modify: `src/app/mcp/route.ts`
- Modify: `src/app/mcp/route.test.ts`
- Modify: `src/lib/mcp/server.ts`
- Modify: `src/lib/mcp/server.test.ts`

- [ ] **Step 1: Write failing route and metadata tests**

Cover the public resource document and the authorization gate:

```ts
it("advertises the deployed MCP resource and Supabase authorization server", () => {
  expect(buildConnectorResourceMetadata({
    siteUrl: "https://brain.example.com",
    supabaseUrl: "https://project.supabase.co",
  })).toEqual({
    resource: "https://brain.example.com/mcp",
    authorization_servers: ["https://project.supabase.co/auth/v1"],
    scopes_supported: ["openid", "email"],
    resource_name: "SFL Brain",
  });
});

it("challenges an unauthenticated hosted request", async () => {
  const response = await handleMcpRequest(hostedRequest(), hostedDependencies({ auth: "reject" }));
  expect(response.status).toBe(401);
  expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
});

it("passes verified actor and workspace context to the MCP handler", async () => {
  const response = await handleMcpRequest(hostedRequest("token-a"), hostedDependencies({ workspaceId: "workspace-a", userId: "user-a" }));
  expect(response.status).toBe(200);
  expect(createBrainService).toHaveBeenCalledWith("workspace-a", { userId: "user-a", source: "chatgpt_connector" });
});
```

Update the server contract test to prove authenticated production mode lists the seven current read tools plus `create_content_opportunity`, `update_content_opportunity`, and `record_post`, but not `create_development_test_opportunity` or destructive tools.

- [ ] **Step 2: Run route/server tests and verify RED**

Run: `pnpm vitest run src/lib/mcp/oauth-metadata.test.ts src/app/mcp/route.test.ts src/lib/mcp/server.test.ts`

Expected: failure because hosted metadata and authenticated request handling are absent and Vercel is still blocked.

- [ ] **Step 3: Implement metadata and authenticated request handling**

Build the RFC 9728 response from environment-backed server-only configuration. In `route.ts`, compose the installed MCP SDK directly:

```ts
const requireConnectorAuth = requireBearerAuth({
  verifier: createSupabaseConnectorTokenVerifier(),
  requiredScopes: ["openid"],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(`${siteUrl}/mcp`)),
});

export async function handleMcpRequest(request: Request, dependencies = realDependencies) {
  if (!dependencies.isHosted()) return dependencies.localHandler.fetch(request);
  const auth = await dependencies.requireAuth(request);
  if (auth instanceof Response) return auth;
  const member = await dependencies.resolveConnectorMember(auth);
  if (member instanceof Response) return member;
  return dependencies.createHandler(member).fetch(request, { authInfo: member.authInfo });
}
```

Use a per-request handler factory so `createSflMcpServer` receives a `BrainService` scoped to the verified workspace and enables only the approved production writes. Preserve unauthenticated local MCP behavior and the explicit development write flag for the tunnel. Export GET/POST/DELETE through the same gate.

- [ ] **Step 4: Run route/server tests and verify GREEN**

Run: `pnpm vitest run src/lib/mcp/oauth-metadata.test.ts src/app/mcp/route.test.ts src/lib/mcp/server.test.ts`

Expected: metadata, challenge, membership, hosted tools, and local compatibility tests pass.

- [ ] **Step 5: Commit the protected transport**

```powershell
git add -- src/lib/mcp/oauth-metadata.ts src/lib/mcp/oauth-metadata.test.ts src/app/.well-known/oauth-protected-resource/mcp/route.ts src/app/mcp/route.ts src/app/mcp/route.test.ts src/lib/mcp/server.ts src/lib/mcp/server.test.ts
git commit -m "feat: protect hosted MCP transport with OAuth"
```

### Task 3: Add the Supabase OAuth consent flow

**Files:**
- Create: `src/app/oauth/consent/page.tsx`
- Create: `src/app/oauth/consent/actions.ts`
- Create: `src/app/oauth/consent/actions.test.ts`
- Create: `src/lib/safe-return-path.ts`
- Create: `src/lib/safe-return-path.test.ts`
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Write failing tests for consent decisions and safe login return paths**

```ts
it.each(["https://evil.example", "//evil.example", "javascript:alert(1)"])(
  "rejects unsafe return path %s",
  (value) => expect(safeReturnPath(value, "/today")).toBe("/today"),
);

it("returns Supabase's approved redirect after rechecking membership", async () => {
  const result = await decideOAuthConsent({ authorizationId: "authorization-a", decision: "approve" }, dependencies);
  expect(dependencies.resolveWebsiteWorkspace).toHaveBeenCalledOnce();
  expect(dependencies.approveAuthorization).toHaveBeenCalledWith("authorization-a", { skipBrowserRedirect: true });
  expect(result).toEqual({ redirectUrl: "https://chatgpt.com/oauth/callback?code=code-a" });
});

it("does not approve consent for a signed-in non-member", async () => {
  dependencies.resolveWebsiteWorkspace.mockRejectedValue(new WorkspaceAuthorizationError("denied"));
  await expect(decideOAuthConsent({ authorizationId: "authorization-a", decision: "approve" }, dependencies)).rejects.toThrow(WorkspaceAuthorizationError);
  expect(dependencies.approveAuthorization).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run consent tests and verify RED**

Run: `pnpm vitest run src/app/oauth/consent/actions.test.ts src/lib/safe-return-path.test.ts`

Expected: failure because the consent flow does not exist.

- [ ] **Step 3: Implement the consent page and actions**

The page validates `authorization_id`, obtains authorization details through `createAuthServerClient().auth.oauth.getAuthorizationDetails`, redirects an unauthenticated visitor to `/login` with the encoded consent path in the `next` query parameter, follows Supabase's immediate redirect when consent already exists, and otherwise renders only the client name, redirect host, and requested scopes.

The server action parses this closed input:

```ts
const consentDecision = z.object({
  authorizationId: z.string().trim().min(1).max(2048),
  decision: z.enum(["approve", "deny"]),
});
```

Approval re-verifies website membership before calling `approveAuthorization`; denial calls `denyAuthorization`. Both request `skipBrowserRedirect: true`, validate that the returned redirect uses HTTPS, and then call Next.js `redirect`. Update login to accept only a relative `next` path and return to the pending consent request after successful password authentication.

- [ ] **Step 4: Run consent tests and verify GREEN**

Run: `pnpm vitest run src/app/oauth/consent/actions.test.ts src/lib/safe-return-path.test.ts src/lib/website-auth.test.ts`

Expected: consent approval, denial, non-member rejection, and open-redirect protection pass.

- [ ] **Step 5: Commit the consent flow**

```powershell
git add -- src/app/oauth/consent/page.tsx src/app/oauth/consent/actions.ts src/app/oauth/consent/actions.test.ts src/lib/safe-return-path.ts src/lib/safe-return-path.test.ts src/app/login/page.tsx
git commit -m "feat: add MCP OAuth consent flow"
```

### Task 4: Audit and authorize connector writes transactionally

**Files:**
- Create via CLI: the exact `supabase/migrations/` path emitted by `supabase migration new hosted_connector_audit`
- Create: `supabase/tests/hosted_connector_audit.sql`
- Modify: `src/lib/brain.ts`
- Modify: `src/lib/brain.integration.test.ts`
- Modify: `src/lib/mcp/server.test.ts`

- [ ] **Step 1: Extend failing TypeScript tests with actor/source propagation**

Assert that a request-scoped service calls every conversational RPC with the verified actor and source:

```ts
expect(rpc).toHaveBeenCalledWith("create_mcp_content_opportunity", expect.objectContaining({
  p_actor_user_id: "user-a",
  p_source: "chatgpt_connector",
}));
```

Add equivalent assertions for update and record-post. Assert that hosted writes are unavailable when the service has no verified mutation actor.

- [ ] **Step 2: Run focused TypeScript tests and verify RED**

Run: `pnpm vitest run src/lib/mcp/server.test.ts src/lib/brain.integration.test.ts`

Expected: actor/source assertions fail because `BrainService` does not carry mutation identity.

- [ ] **Step 3: Add request-scoped mutation identity to `BrainService`**

Add the closed type and constructor/factory parameter:

```ts
export type ConnectorMutationActor = {
  userId: string;
  source: "chatgpt_connector";
};

export function createBrainService(workspaceId?: string, mutationActor?: ConnectorMutationActor) {
  return new BrainService(client, workspaceId ?? env.SFL_WORKSPACE_ID, mutationActor);
}
```

Each of the three pilot write methods must refuse to run without a mutation actor in hosted mode and pass `p_actor_user_id` and `p_source` to its RPC. Keep local development compatibility explicitly separate from the hosted actor path.

- [ ] **Step 4: Run focused TypeScript tests and verify GREEN**

Run: `pnpm vitest run src/lib/mcp/server.test.ts src/lib/brain.integration.test.ts`

Expected: actor/source propagation passes; integration tests remain skipped unless `SFL_INTEGRATION=1`.

- [ ] **Step 5: Create the migration using the pinned Supabase CLI**

Run: `pnpm dlx supabase@2.116.0 migration new hosted_connector_audit`

Expected: the CLI prints the exact new file under `supabase/migrations/`. Use that returned path for the SQL below; do not invent or rename the timestamp.

- [ ] **Step 6: Write the migration and database regression test**

The migration must:

```sql
alter table public.mcp_mutation_requests
  add column actor_user_id uuid,
  add column source text not null default 'legacy_mcp'
    check (source in ('legacy_mcp', 'development_tunnel', 'chatgpt_connector'));
```

Replace the three old service-role RPC signatures with versions that accept `p_actor_user_id uuid` and `p_source text`. Each function validates `p_source`, requires a non-null actor for `chatgpt_connector`, checks `workspace_members(workspace_id, user_id)` inside the transaction, includes actor/source in the duplicate-request conflict check, and inserts both audit values. Revoke the old signatures and grant only the new signatures to `service_role`.

`hosted_connector_audit.sql` creates two workspaces, two Auth users, and memberships inside a transaction, then proves:

- an authorized actor can create, update, and record a post;
- each audit row contains the actor and `chatgpt_connector` source;
- a cross-workspace actor is rejected;
- reusing a request ID with another actor or payload is rejected;
- authenticated/anon roles cannot read or mutate audit rows or execute the RPCs;
- the transaction rolls back all fixtures.

- [ ] **Step 7: Run local database validation**

Run:

```powershell
pnpm supabase:start
pnpm supabase:reset
Get-Content supabase/tests/workspace_members.sql | pnpm dlx supabase@2.116.0 db query --local
Get-Content supabase/tests/hosted_connector_audit.sql | pnpm dlx supabase@2.116.0 db query --local
$env:SFL_INTEGRATION='1'; pnpm vitest run src/lib/brain.integration.test.ts; Remove-Item Env:SFL_INTEGRATION
```

Expected: both SQL scripts finish without exceptions and integration tests pass. If Docker remains unavailable, capture the exact environment limitation and continue all non-database verification.

- [ ] **Step 8: Commit the audited write path**

```powershell
git add -- src/lib/brain.ts src/lib/brain.integration.test.ts src/lib/mcp/server.test.ts supabase/migrations/*_hosted_connector_audit.sql supabase/tests/hosted_connector_audit.sql
git commit -m "feat: audit hosted connector writes"
```

### Task 5: Align configuration, smoke tests, and operator documentation

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `scripts/mcp-smoke.mjs`
- Modify: `docs/private-account-provisioning.md`

- [ ] **Step 1: Write the failing hosted smoke contract**

Extend `mcp-smoke.mjs` so `SFL_MCP_URL` may target Vercel and `SFL_MCP_ACCESS_TOKEN` supplies a bearer token without printing it. Hosted tool discovery must expect ten tools; local read-only discovery remains seven. Add a negative mode that requires unauthenticated hosted access to return `401` with a `resource_metadata` challenge.

- [ ] **Step 2: Run smoke contract tests and verify RED**

Run the smoke script's local contract test or its extracted Vitest helper test.

Expected: hosted authentication mode is unsupported before the script change.

- [ ] **Step 3: Update configuration and documentation**

Document only variable names and safe examples:

```dotenv
NEXT_PUBLIC_SITE_URL=https://your-sfl-brain.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=server-only
SFL_WORKSPACE_ID=local-development-only
SFL_ENABLE_PILOT_WRITES=1
```

The README must distinguish the production connector from the development tunnel, explain the three write tools and confirmations, and list the Supabase OAuth dashboard settings: OAuth 2.1 enabled, authorization path `/oauth/consent`, dynamic client registration enabled for ChatGPT, and public signup still disabled. Provisioning docs must require a real Auth user plus `workspace_members` row and describe revoking the OAuth grant or membership.

- [ ] **Step 4: Verify docs and smoke behavior**

Run: `pnpm vitest run src/app/mcp/route.test.ts src/lib/mcp/server.test.ts`

Run local server and: `pnpm mcp:smoke`

Expected: local seven-tool discovery still passes; hosted-mode unit coverage proves ten-tool discovery and unauthenticated challenge without exposing a token.

- [ ] **Step 5: Commit configuration and docs**

```powershell
git add -- .env.example README.md scripts/mcp-smoke.mjs docs/private-account-provisioning.md
git commit -m "docs: operate the hosted SFL connector"
```

### Task 6: Complete local verification and security review

**Files:**
- Review all files changed since commit `92a2b1b`

- [ ] **Step 1: Run the canonical local gate**

Run: `pnpm verify`

Expected: lint, typecheck, all unit tests, and production build exit successfully. The existing HTML image-element lint advisory may remain only if it is unchanged and non-failing.

- [ ] **Step 2: Run protocol-level local acceptance**

Start Next.js on an available loopback port with local development configuration. Verify:

- local tunnel mode still discovers seven read-only tools by default;
- the hosted-mode handler rejects missing/invalid tokens;
- metadata is valid JSON with the exact resource and authorization-server URLs;
- no response or log contains secrets.

- [ ] **Step 3: Review the final diff against the spec**

Inspect `git status`, the full diff from `92a2b1b`, migration grants/RLS, all environment variable references, and built client assets. Confirm every acceptance criterion is represented and unrelated dirty files were neither staged nor reverted.

- [ ] **Step 4: Run a focused security review**

Verify bearer tokens are never logged or persisted, issuer/expiry/sub are validated, `SFL_WORKSPACE_ID` cannot authorize hosted requests, membership is checked on every request and transactionally for writes, service-role material stays server-only, return URLs are same-site, and no destructive MCP tool is registered.

### Task 7: Perform authorized hosted rollout and real ChatGPT acceptance

**Files/Systems:**
- Existing linked Vercel project
- Supabase project `iyfttmztfhjlqmxjrwgw`
- ChatGPT custom SFL Brain app

- [ ] **Step 1: Preflight hosted state without exposing credentials**

Confirm the Vercel project/production domain, Supabase project health, current migration list, required environment variable names, and rollback target. Never print credential values.

- [ ] **Step 2: Apply the complete migration with explicit project targeting**

Copy the repository migrations into an isolated Supabase directory, verify byte counts and SHA-256 hashes, link only project `iyfttmztfhjlqmxjrwgw`, run migration list and dry-run, then apply. Run a final dry-run and require `upToDate: true`.

- [ ] **Step 3: Configure Supabase OAuth 2.1**

Enable OAuth 2.1, set the authorization path to `/oauth/consent`, confirm the production Site URL and allowed redirect URLs, enable dynamic client registration for the ChatGPT client, and confirm refresh-token support. Preserve disabled public signup and existing website authentication.

- [ ] **Step 4: Deploy the verified commit to Vercel**

Deploy only after confirming the intended project and production environment. Verify `/mcp` returns `401` without a token and the protected-resource/discovery endpoints return valid metadata.

- [ ] **Step 5: Replace the ChatGPT app endpoint and authorize Elaine**

Create or update the custom app to use the production `NEXT_PUBLIC_SITE_URL` value with `/mcp` appended, select OAuth, complete Elaine's login/consent, scan tools, and verify the seven reads plus three writes. Keep the tunnel-backed connector available until this succeeds.

- [ ] **Step 6: Execute hosted acceptance and clean fixtures**

With explicit confirmations, create one uniquely labeled disposable opportunity, update it, and record a test publication only against an authorized disposable destination/fixture. Query persistence to verify actor/source audit fields, prove non-member denial with a disposable account, then remove only the explicitly identified test fixtures through the supported cleanup path.

- [ ] **Step 7: Prove independence from the local computer**

Stop or disconnect the local SFL Brain server from the tunnel without deleting its configuration. Invoke a fresh hosted read through ChatGPT and require success. Restore any development processes that were running before the test.

- [ ] **Step 8: Final completion gate**

Re-run relevant hosted health checks, inspect deployment and Supabase state, confirm no fixtures remain, and report actual local and hosted evidence separately. Do not disable or remove the old tunnel connector until the user explicitly requests cleanup.
