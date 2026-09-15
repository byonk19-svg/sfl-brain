import assert from "node:assert/strict";
import crypto from "node:crypto";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createClient } from "@supabase/supabase-js";

const endpoint = new URL(process.env.SFL_MCP_URL ?? "http://127.0.0.1:3103/mcp");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.SUPABASE_JWT_SECRET;
const workspaceId = process.env.SFL_WORKSPACE_ID;
if (!supabaseUrl || !serviceRoleKey || !jwtSecret || !workspaceId) {
  throw new Error("Local hosted-connector acceptance environment is incomplete");
}
if (!["127.0.0.1", "localhost"].includes(endpoint.hostname) || !["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname)) {
  throw new Error("Local hosted-connector acceptance refuses non-loopback services");
}

const runId = crypto.randomUUID();
const email = `sfl-connector-acceptance-${runId}@example.com`;
const password = crypto.randomBytes(24).toString("base64url");
const title = `[Acceptance] Connector hold ${runId}`;
const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let userId;
let opportunityId;
let client;
const cleanupErrors = [];

async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    const message = result.content?.find((item) => item.type === "text")?.text ?? `${name} failed`;
    throw new Error(message);
  }
  return result.structuredContent;
}

function localOAuthToken(subject) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    aud: "authenticated",
    exp: now + 600,
    iat: now,
    iss: `${supabaseUrl.replace(/\/$/, "")}/auth/v1`,
    sub: subject,
    role: "authenticated",
    client_id: "local-acceptance",
    scope: "openid email",
  });
  const signature = crypto.createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function cleanup() {
  if (client) await client.close().catch((error) => cleanupErrors.push(error));
  if (opportunityId) {
    const deleted = await service.from("content_opportunities").delete().eq("id", opportunityId);
    if (deleted.error) cleanupErrors.push(deleted.error);
  }
  if (userId) {
    const membership = await service.from("workspace_members").delete().eq("user_id", userId);
    if (membership.error) cleanupErrors.push(membership.error);
    const deleted = await service.auth.admin.deleteUser(userId);
    if (deleted.error) cleanupErrors.push(deleted.error);
  }
}

try {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("Connector acceptance user was not created");
  userId = created.data.user.id;

  const membership = await service.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId });
  if (membership.error) throw membership.error;

  const accessToken = localOAuthToken(userId);

  client = new Client({ name: "sfl-hosted-hold-acceptance", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(endpoint, {
    authProvider: { token: async () => accessToken },
  }));

  const tools = (await client.listTools()).tools;
  for (const name of [
    "get_on_hold_opportunities",
    "place_content_opportunity_on_hold",
    "update_content_opportunity_hold",
    "release_content_opportunity_hold",
  ]) {
    const tool = tools.find((candidate) => candidate.name === name);
    assert.ok(tool, `Missing hosted tool ${name}`);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.readOnlyHint, name === "get_on_hold_opportunities");
  }

  const createdOpportunity = await call("create_content_opportunity", {
    request_id: crypto.randomUUID(),
    title,
    status: "idea",
    content_type: "unspecified",
  });
  opportunityId = createdOpportunity.opportunity.id;

  const placed = await call("place_content_opportunity_on_hold", {
    request_id: crypto.randomUUID(),
    opportunity_id: opportunityId,
    hold_reason: "Connector acceptance blocker",
    release_condition: "Connector acceptance condition",
    review_on: null,
  });
  assert.equal(placed.hold.held_source, "chatgpt_connector");
  assert.equal(placed.hold.held_by, userId);

  const held = await call("get_on_hold_opportunities", { query: runId, limit: 10 });
  assert.equal(held.opportunities.length, 1);
  assert.equal(held.opportunities[0].id, opportunityId);

  const updated = await call("update_content_opportunity_hold", {
    request_id: crypto.randomUUID(),
    hold_id: placed.hold.id,
    expected_updated_at: placed.hold.updated_at,
    hold_reason: "Updated connector blocker",
    release_condition: "Updated connector condition",
    review_on: null,
  });
  assert.equal(updated.hold.hold_reason, "Updated connector blocker");

  const released = await call("release_content_opportunity_hold", {
    request_id: crypto.randomUUID(),
    hold_id: updated.hold.id,
    expected_updated_at: updated.hold.updated_at,
    release_note: "Acceptance complete",
  });
  assert.equal(released.hold.released_source, "chatgpt_connector");
  assert.equal(released.hold.released_by, userId);
  assert.ok(released.hold.released_at);

  const persisted = await service
    .from("content_opportunity_holds")
    .select("held_by,held_source,released_by,released_source,released_at,release_note")
    .eq("id", released.hold.id)
    .single();
  if (persisted.error) throw persisted.error;
  assert.deepEqual(persisted.data, {
    held_by: userId,
    held_source: "chatgpt_connector",
    released_by: userId,
    released_source: "chatgpt_connector",
    released_at: released.hold.released_at,
    release_note: "Acceptance complete",
  });

  console.log("Local hosted MCP hold acceptance: passed");
  console.log("Verified: bearer auth, tool annotations, create, place, list, update, release, actor/source audit");
} finally {
  await cleanup();
  const remaining = await service.from("content_opportunities").select("id", { count: "exact", head: true }).eq("title", title);
  if (remaining.error) cleanupErrors.push(remaining.error);
  if (remaining.count !== 0) cleanupErrors.push(new Error("Disposable connector opportunity remained after cleanup"));
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Local hosted connector cleanup failed");
  console.log("Disposable local connector data: removed");
}
