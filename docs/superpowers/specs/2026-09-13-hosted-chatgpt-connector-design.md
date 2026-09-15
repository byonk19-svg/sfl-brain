# Hosted ChatGPT Connector Design

## Goal

Elaine can use SFL Brain from ChatGPT when no developer computer or local port is running. The production connector is an authenticated Streamable HTTP MCP endpoint on the existing Vercel deployment. The Secure MCP Tunnel remains an optional development path and is not a production dependency.

## Chosen approach

Deploy the existing MCP server as a Vercel Function and protect it with Supabase Auth acting as an OAuth 2.1 authorization server. ChatGPT connects directly to the deployed `/mcp` URL, discovers the protected-resource metadata, sends Elaine through the SFL Brain authorization screen, and receives access and refresh tokens for her existing account.

Two alternatives were rejected:

- Running the tunnel client on an always-on VM preserves an unnecessary proxy and creates another host to operate.
- Publishing the current service-role MCP route without OAuth would expose workspace data and write capabilities to unauthenticated callers.

Supabase OAuth 2.1 is currently beta. The integration must stay isolated behind small authentication and workspace-resolution modules so another standards-compliant authorization server can replace it without changing the MCP tools or domain services.

## Identity and authorization

Elaine signs in with her existing owner-provisioned SFL Brain email/password account. Public signup remains disabled. ChatGPT uses the Supabase OAuth 2.1 authorization-code flow with PKCE and refresh tokens; the hosted application provides a consent page that clearly identifies SFL Brain and the requested access.

Every MCP request must:

1. Require a bearer token and advertise the OAuth protected-resource metadata required for discovery.
2. Validate the token against the configured Supabase project and reject expired, malformed, wrongly issued, or otherwise invalid tokens.
3. Derive the authenticated user ID only from verified token claims.
4. Resolve exactly one `workspace_members` row readable by that authenticated user.
5. Construct `BrainService` only after that workspace has been authorized.

The request must fail closed when authentication is missing, the user has no membership, or the membership result is ambiguous. The hosted MCP route never accepts `SFL_WORKSPACE_ID` as an authorization fallback. Service-role credentials remain server-only and may be used by the already-authorized domain service only after the user and workspace boundary has been established.

The OAuth consent flow must support the refresh/offline access expected by ChatGPT so Elaine does not need to sign in for each conversation. Dynamic client registration may be enabled for ChatGPT compatibility, but user consent and workspace membership remain mandatory for every registered client.

## MCP behavior

The hosted MCP server retains all current read tools. The initial production write scope is deliberately limited to the three existing conversational operations:

- `create_content_opportunity`
- `update_content_opportunity`
- `record_post`

Production no longer gates these tools on `NODE_ENV === "development"`. Instead, their availability depends on successful connector authentication and server configuration. Development-only test writers remain unavailable in production.

Each write tool is marked truthfully as mutating and described as requiring an explicit user request. ChatGPT's app permission layer is responsible for presenting the proposed action and receiving Elaine's confirmation before execution; the hosted acceptance run must verify that behavior rather than assuming annotations are sufficient. The connector does not expose deletes, archive changes, product administration, listings, affiliate links, Radar events, assets, or relationship changes in this release.

Writes remain idempotent by workspace, action, and caller request ID. Opportunity updates retain optimistic concurrency through `expected_updated_at`, so a stale conversational edit cannot silently overwrite a newer website change. Successful tool responses re-read and return the saved state so ChatGPT can report what actually changed.

## Audit record

`mcp_mutation_requests` becomes the connector mutation record. In addition to its existing request identity, payload hash, result, and timestamp, every new mutation records:

- the verified connector member's user ID;
- the source `chatgpt_connector`;
- the authorized workspace and action.

The mutation record does not store prompts, assistant messages, or the broader conversation. Reusing a request ID with another user, action, workspace, or payload is rejected. Existing historical rows remain valid and identifiable as legacy records with no actor.

The write RPCs accept the verified actor identity from the server and confirm that the actor has the specified workspace membership inside the same database transaction before mutating data. This prevents a successful HTTP-layer check from becoming a time-of-check/time-of-use authorization gap.

## Routes and modules

The implementation adds or separates these responsibilities:

- `/mcp`: authenticated Streamable HTTP transport. Vercel is allowed only when OAuth protection is configured; local development may continue without hosted OAuth through an explicit local mode.
- `/.well-known/oauth-protected-resource/mcp`: metadata identifying the Supabase authorization server and the hosted MCP resource.
- `/oauth/consent`: authenticated approval/denial screen for the Supabase OAuth authorization request, using the existing SFL Brain visual language.
- Connector authentication module: verifies bearer tokens and returns a verified user identity.
- Connector workspace module: resolves the authenticated member's workspace and returns the actor/workspace context used to create `BrainService`.
- Connector audit migration: adds actor/source fields and transaction-level membership enforcement to the three existing write RPCs.

The website cookie/session authorization path remains separate. Shared pure helpers are appropriate for membership result validation, but MCP bearer-token handling must not be routed through browser cookies or redirects.

## Failure behavior

- Missing or invalid bearer token: return the MCP-compatible unauthorized response and discovery challenge without executing a tool.
- Valid account without membership: return forbidden; do not fall back to a configured workspace.
- Ambiguous memberships: fail closed with an actionable error instead of choosing a workspace silently.
- Revoked membership: the next tool request fails because membership is checked on every request and again for writes inside the transaction.
- Expired access token: ChatGPT uses the OAuth refresh flow; if refresh is unavailable or revoked, Elaine signs in again.
- Duplicate request: return the original result only when actor, workspace, action, and payload match.
- Stale opportunity update: preserve the existing concurrency error and require a fresh read before retrying.
- Database or storage outage: return a bounded tool error without leaking credentials, SQL details, or internal paths.

## Deployment and transition

The hosted release requires three coordinated changes:

1. Deploy the OAuth-protected routes and migration to the existing Vercel/Supabase environment.
2. Enable the Supabase OAuth 2.1 server, configure the SFL Brain consent URL, ensure refresh-token support, and enable or register the ChatGPT OAuth client.
3. Create or update the ChatGPT custom app to use the Vercel `/mcp` endpoint, complete Elaine's authorization, scan tools, and verify reads and confirmed writes.

The current tunnel-backed connector remains in place until hosted acceptance succeeds. Afterward it is labeled development-only; stopping the local Next.js server or tunnel must not affect the production connector.

No credential value is printed, committed, placed in browser-visible configuration, or passed on a command line. Production deployment, hosted migration, OAuth enablement, and connector replacement require explicit authorization at the point of mutation.

## Acceptance criteria

Automated checks must prove:

1. Vercel serves `/mcp` only behind bearer-token authentication.
2. Protected-resource metadata points to the configured Supabase authorization server.
3. Missing, invalid, expired, and wrong-issuer tokens fail closed.
4. A verified member resolves only their own workspace; non-members and ambiguous memberships are denied.
5. Production exposes all read tools plus the three approved write tools, but no development test or destructive tools.
6. Every write persists the verified actor and connector source, validates membership transactionally, remains idempotent, and rejects stale updates.
7. Website authentication and behavior continue to pass their existing tests.
8. Lint, typecheck, unit/integration tests, and production build pass.

Hosted acceptance must additionally prove, using a disposable authorized fixture and cleanup where needed:

1. The deployed metadata and OAuth discovery endpoints return valid configuration.
2. Elaine can authorize the SFL Brain app through ChatGPT and remain connected through token refresh.
3. ChatGPT can read an existing opportunity while this computer and its local server are not involved.
4. A confirmed create, update, and record-post call changes the expected hosted database rows and records the actor/source audit fields.
5. A non-member cannot read or write workspace data.
6. The local server and tunnel can be stopped without affecting a subsequent hosted connector read.

## Cost and scope

The connector uses on-demand Vercel Functions and the existing hosted Supabase project. At the expected single-member usage, current included limits should avoid incremental compute charges; Supabase OAuth 2.1 is free during its beta period. Usage must still be monitored because provider pricing and beta terms can change.

Full website write parity, destructive operations, publishing integrations, retailer monitoring, and conversation storage are outside this release.
