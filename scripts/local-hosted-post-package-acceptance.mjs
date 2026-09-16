import assert from "node:assert/strict";
import crypto from "node:crypto";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createClient } from "@supabase/supabase-js";
import {
  assertExplicitUserMissing,
  assertLoopback,
  buildCleanupSql,
  executeCleanupSql,
  loadLocalAcceptanceConfig,
  startNextServer,
  stopProcessTree,
} from "./local-acceptance-support.mjs";

const projectDir = process.cwd();
const local = loadLocalAcceptanceConfig(projectDir);
const env = { ...process.env, ...local };
const endpoint = new URL(env.SFL_MCP_URL ?? "http://127.0.0.1:3105/mcp");
const supabaseUrl = local.supabaseUrl;
const serviceRoleKey = local.serviceRoleKey;
const publishableKey = local.publishableKey;
const workspaceId = local.workspaceId;
const jwtSecret = local.jwtSecret;
if (!supabaseUrl || !serviceRoleKey || !publishableKey || !workspaceId || !jwtSecret) {
  throw new Error("Local hosted Post Package acceptance environment is incomplete");
}
assertLoopback(endpoint, "MCP");
assertLoopback(new URL(supabaseUrl), "Supabase");

const runId = crypto.randomUUID();
const email = `sfl-package-mcp-${runId}@example.com`;
const password = crypto.randomBytes(24).toString("base64url");
const title = `[Acceptance] MCP Post Package ${runId}`;
const assetTitle = `[Acceptance] MCP asset ${runId}`;
const destinationNames = [`[Acceptance] MCP Page ${runId}`, `[Acceptance] MCP Instagram ${runId}`];
const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let userId;
let opportunityId;
let packageId;
let assetId;
const destinationIds = [];
const requestIds = [];
let client;
let server;
const cleanupErrors = [];

try {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("Connector acceptance user was not created");
  userId = created.data.user.id;
  await mustInsert("workspace member", service.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId }));

  const opportunity = await mustSingle("opportunity", service.from("content_opportunities").insert({
    workspace_id: workspaceId,
    title,
    status: "idea",
    content_type: "standalone_product",
    notes: "Disposable hosted-handler acceptance fixture",
  }).select("id").single());
  opportunityId = opportunity.id;

  const asset = await mustSingle("asset", service.from("assets").insert({
    workspace_id: workspaceId,
    title: assetTitle,
    asset_type: "photo",
    source: "other",
    notes: "Disposable hosted-handler acceptance fixture",
  }).select("id").single());
  assetId = asset.id;
  await mustInsert("opportunity asset", service.from("content_opportunity_assets").insert({
    opportunity_id: opportunityId,
    asset_id: assetId,
    role: "primary",
  }));

  for (const [name, platform] of [
    [destinationNames[0], "facebook_page"],
    [destinationNames[1], "instagram_feed"],
  ]) {
    const destination = await mustSingle("destination", service.from("destinations").insert({
      workspace_id: workspaceId,
      name,
      platform,
      posting_identity: `acceptance-${runId}`,
      notes: "Disposable hosted-handler acceptance fixture",
      is_active: true,
    }).select("id").single());
    destinationIds.push(destination.id);
  }

  server = await startNextServer({
    projectDir,
    port: Number(endpoint.port),
    env: {
      ...env,
      NODE_ENV: "development",
      VERCEL: "1",
      NEXT_PUBLIC_SITE_URL: endpoint.origin,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    },
    readyUrl: endpoint,
    readyCheck: async (response) => response.status === 401 && (response.headers.get("www-authenticate") ?? "").includes("resource_metadata="),
  });

  const accessToken = localOAuthToken({ subject: userId, issuer: `${supabaseUrl.replace(/\/$/, "")}/auth/v1`, secret: jwtSecret });
  client = await connectClient(endpoint, accessToken, "sfl-hosted-post-package-acceptance");
  const tools = (await client.listTools()).tools;
  for (const name of [
    "get_post_package_context",
    "create_post_package",
    "update_post_package",
    "upsert_post_package_caption_variant",
    "set_post_package_assets",
    "set_post_package_destinations",
    "skip_post_package_destination",
    "finish_post_package",
  ]) {
    const tool = tools.find((candidate) => candidate.name === name);
    assert.ok(tool, `Missing hosted Post Package tool ${name}`);
    assert.equal(tool.annotations?.readOnlyHint, name === "get_post_package_context");
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, false);
  }

  const initial = await call(client, "get_post_package_context", { opportunity_id: opportunityId });
  assert.equal(initial.post_package_context.active_package, null);

  const createRequest = requestId();
  const createArgs = {
    request_id: createRequest,
    opportunity_id: opportunityId,
    base_caption: "MCP base caption",
    working_angle: "MCP working angle",
    notes: "MCP package notes",
  };
  let context = contextFrom(await call(client, "create_post_package", createArgs));
  packageId = context.active_package.id;
  const repeatedCreate = contextFrom(await call(client, "create_post_package", createArgs));
  assert.equal(repeatedCreate.active_package.id, packageId, "Repeated request_id created a second package");
  let active = repeatedCreate.active_package;

  context = contextFrom(await call(client, "update_post_package", {
    request_id: requestId(),
    package_id: packageId,
    expected_updated_at: active.updated_at,
    base_caption: "MCP base caption revised",
    working_angle: "MCP working angle revised",
    notes: "MCP package notes revised",
  }));
  active = context.active_package;

  context = contextFrom(await call(client, "upsert_post_package_caption_variant", {
    request_id: requestId(),
    package_id: packageId,
    expected_updated_at: active.updated_at,
    audience: "sfl_page",
    body: "Approved MCP page caption",
    status: "approved",
  }));
  active = context.active_package;
  const pageVariant = active.caption_variants.find((variant) => variant.audience === "sfl_page");
  assert.equal(pageVariant.status, "approved");

  context = contextFrom(await call(client, "upsert_post_package_caption_variant", {
    request_id: requestId(),
    package_id: packageId,
    expected_updated_at: active.updated_at,
    audience: "instagram",
    body: "Approved MCP Instagram caption",
    status: "approved",
  }));
  active = context.active_package;
  const instagramVariant = active.caption_variants.find((variant) => variant.audience === "instagram");
  assert.equal(instagramVariant.status, "approved");

  context = contextFrom(await call(client, "set_post_package_assets", {
    request_id: requestId(),
    package_id: packageId,
    expected_updated_at: active.updated_at,
    assets: [{ asset_id: assetId, role: "hero", position: 0, note: "MCP acceptance hero" }],
  }));
  active = context.active_package;
  assert.equal(active.assets[0].asset_id, assetId);

  context = contextFrom(await call(client, "set_post_package_destinations", {
    request_id: requestId(),
    package_id: packageId,
    expected_updated_at: active.updated_at,
    destinations: [
      { destination_id: destinationIds[0], caption_variant_id: pageVariant.id },
      { destination_id: destinationIds[1], caption_variant_id: instagramVariant.id },
    ],
  }));
  active = context.active_package;
  assert.equal(active.distribution_items.length, 2);

  for (const item of [...active.distribution_items]) {
    context = contextFrom(await call(client, "skip_post_package_destination", {
      request_id: requestId(),
      package_id: packageId,
      distribution_item_id: item.id,
      expected_updated_at: context.active_package.updated_at,
      skip_reason: `MCP acceptance skip ${item.destination.name}`,
    }));
  }
  active = context.active_package;
  assert.deepEqual(active.distribution_items.map((item) => item.status).sort(), ["skipped", "skipped"]);

  context = contextFrom(await call(client, "finish_post_package", {
    request_id: requestId(),
    package_id: packageId,
    expected_updated_at: active.updated_at,
    action: "abandon",
  }));
  assert.equal(context.active_package, null);
  assert.equal(context.prior_packages.find((item) => item.id === packageId)?.status, "abandoned");

  await client.close();
  client = await connectClient(endpoint, accessToken, "sfl-hosted-post-package-fresh-read");
  const fresh = contextFrom(await call(client, "get_post_package_context", { opportunity_id: opportunityId }));
  const saved = fresh.prior_packages.find((item) => item.id === packageId);
  assert.ok(saved, "Fresh MCP client could not retrieve the saved package");
  assert.equal(saved.status, "abandoned");
  assert.equal(saved.base_caption, "MCP base caption revised");
  assert.equal(saved.assets[0].asset_id, assetId);
  assert.deepEqual(saved.distribution_items.map((item) => item.status).sort(), ["skipped", "skipped"]);
  const serialized = JSON.stringify(fresh);
  assert.doesNotMatch(serialized, /storage_path|created_by|updated_by|approved_by|service_role|jwt_secret/i);

  const audit = await service.from("mcp_mutation_requests")
    .select("action,request_id,actor_user_id,source")
    .eq("workspace_id", workspaceId)
    .in("request_id", requestIds);
  if (audit.error) throw audit.error;
  assert.equal(audit.data.length, requestIds.length, "Connector request audit did not contain one row per unique request_id");
  assert.ok(audit.data.every((row) => row.actor_user_id === userId && row.source === "chatgpt_connector"));
  assert.equal(audit.data.filter((row) => row.action === "create_post_package").length, 1, "Idempotent create wrote duplicate audit rows");

  const persistedPackage = await mustSingle("persisted package audit", service.from("post_packages")
    .select("created_by,updated_by,created_source,updated_source,status")
    .eq("id", packageId)
    .single());
  assert.deepEqual(persistedPackage, {
    created_by: userId,
    updated_by: userId,
    created_source: "chatgpt_connector",
    updated_source: "chatgpt_connector",
    status: "abandoned",
  });
  const persistedVariants = await service.from("post_package_caption_variants")
    .select("created_by,updated_by,created_source,updated_source")
    .eq("package_id", packageId);
  if (persistedVariants.error) throw persistedVariants.error;
  assert.equal(persistedVariants.data.length, 2);
  assert.ok(persistedVariants.data.every((row) => row.created_by === userId && row.updated_by === userId && row.created_source === "chatgpt_connector" && row.updated_source === "chatgpt_connector"));

  console.log("Local hosted MCP Post Package acceptance: passed");
  console.log("Verified: OAuth bearer, all seven writes, fresh read, idempotency, actor/source audit, saved state, sanitization");
} finally {
  if (client) await client.close().catch((error) => cleanupErrors.push(error));
  if (server) await stopProcessTree(server).catch((error) => cleanupErrors.push(error));
  let fixtures = fallbackHostedFixtures();
  try {
    fixtures = await recoverHostedFixtures();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    executeCleanupSql(local, buildCleanupSql({ workspaceId, ...fixtures }));
  } catch (error) {
    cleanupErrors.push(error);
  }
  for (const recoveredUserId of fixtures.actorUserIds) {
    const membership = await service.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", recoveredUserId);
    if (membership.error) cleanupErrors.push(membership.error);
    const deleted = await service.auth.admin.deleteUser(recoveredUserId);
    if (deleted.error) cleanupErrors.push(deleted.error);
  }
  await proveCleanup(fixtures);
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Local hosted Post Package acceptance cleanup failed");
  console.log("Disposable hosted MCP Post Package data: removed");
}

function requestId() {
  const id = crypto.randomUUID();
  requestIds.push(id);
  return id;
}

async function call(mcpClient, name, args) {
  const result = await mcpClient.callTool({ name, arguments: args });
  if (result.isError) {
    const message = result.content?.find((item) => item.type === "text")?.text ?? `${name} failed`;
    throw new Error(message);
  }
  return result.structuredContent;
}

function contextFrom(structured) {
  const context = structured?.post_package_context;
  if (!context) throw new Error("Post Package tool did not return a fresh structured context");
  return context;
}

async function connectClient(url, token, name) {
  const mcpClient = new Client({ name, version: "1.0.0" });
  await mcpClient.connect(new StreamableHTTPClientTransport(url, {
    authProvider: { token: async () => token },
  }));
  return mcpClient;
}

function localOAuthToken({ subject, issuer, secret }) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    aud: "authenticated",
    exp: now + 600,
    iat: now,
    iss: issuer,
    sub: subject,
    role: "authenticated",
    client_id: "local-post-package-acceptance",
    scope: "openid email",
  });
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function mustInsert(label, query) {
  const { error } = await query;
  if (error) throw new Error(`Create ${label}: ${error.message}`);
}

async function mustSingle(label, query) {
  const { data, error } = await query;
  if (error || !data) throw new Error(`Load ${label}: ${error?.message ?? "no row returned"}`);
  return data;
}

function fallbackHostedFixtures() {
  return {
    opportunityIds: [opportunityId].filter(Boolean),
    packageIds: [packageId].filter(Boolean),
    assetIds: [assetId].filter(Boolean),
    destinationIds: [...destinationIds],
    requestIds: [...requestIds],
    actorUserIds: [userId].filter(Boolean),
  };
}

async function recoverHostedFixtures() {
  const fallback = fallbackHostedFixtures();
  const opportunities = await rowsOrThrow("recover opportunity", service.from("content_opportunities").select("id").eq("workspace_id", workspaceId).eq("title", title));
  const opportunityIds = union(fallback.opportunityIds, opportunities.map((row) => row.id));
  const packages = opportunityIds.length
    ? await rowsOrThrow("recover packages", service.from("post_packages").select("id").eq("workspace_id", workspaceId).in("opportunity_id", opportunityIds))
    : [];
  const assets = await rowsOrThrow("recover assets", service.from("assets").select("id").eq("workspace_id", workspaceId).eq("title", assetTitle));
  const destinations = await rowsOrThrow("recover destinations", service.from("destinations").select("id").eq("workspace_id", workspaceId).in("name", destinationNames));
  const recoveredUser = await findUserByEmail(email);
  const actorUserIds = union(fallback.actorUserIds, recoveredUser ? [recoveredUser.id] : []);
  const auditRows = actorUserIds.length
    ? await rowsOrThrow("recover request audit", service.from("mcp_mutation_requests").select("request_id").eq("workspace_id", workspaceId).in("actor_user_id", actorUserIds))
    : [];
  return {
    opportunityIds,
    packageIds: union(fallback.packageIds, packages.map((row) => row.id)),
    assetIds: union(fallback.assetIds, assets.map((row) => row.id)),
    destinationIds: union(fallback.destinationIds, destinations.map((row) => row.id)),
    requestIds: union(fallback.requestIds, auditRows.map((row) => row.request_id)),
    actorUserIds,
  };
}

async function proveCleanup(fixtures) {
  const checks = [
    ["opportunity ID", "content_opportunities", "id", fixtures.opportunityIds],
    ["opportunity marker", "content_opportunities", "title", [title]],
    ["package", "post_packages", "id", fixtures.packageIds],
    ["package variant", "post_package_caption_variants", "package_id", fixtures.packageIds],
    ["package asset selection", "post_package_assets", "package_id", fixtures.packageIds],
    ["package distribution item", "post_package_destinations", "package_id", fixtures.packageIds],
    ["asset ID", "assets", "id", fixtures.assetIds],
    ["asset marker", "assets", "title", [assetTitle]],
    ["destination ID", "destinations", "id", fixtures.destinationIds],
    ["destination marker", "destinations", "name", destinationNames],
    ["request audit", "mcp_mutation_requests", "request_id", fixtures.requestIds],
  ];
  for (const [label, table, column, values] of checks) {
    if (!values.length) continue;
    const result = await service.from(table).select(column, { count: "exact", head: true }).in(column, values);
    if (result.error || result.count !== 0) cleanupErrors.push(result.error ?? new Error(`Disposable ${label} remained after cleanup`));
  }
  for (const recoveredUserId of fixtures.actorUserIds) {
    const membership = await service.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("user_id", recoveredUserId);
    if (membership.error || membership.count !== 0) cleanupErrors.push(membership.error ?? new Error("Disposable connector membership remained after cleanup"));
    try { assertExplicitUserMissing(await service.auth.admin.getUserById(recoveredUserId)); } catch (error) { cleanupErrors.push(error); }
  }
  try {
    if (await findUserByEmail(email)) cleanupErrors.push(new Error("Disposable connector Auth user marker remained after cleanup"));
  } catch (error) { cleanupErrors.push(error); }
}

async function rowsOrThrow(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data ?? [];
}

async function findUserByEmail(targetEmail) {
  for (let page = 1; page <= 20; page += 1) {
    const result = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw new Error(`Recover Auth user: ${result.error.message}`);
    const found = result.data.users.find((user) => user.email === targetEmail);
    if (found) return found;
    if (result.data.users.length < 100) return null;
  }
  throw new Error("Recover Auth user exceeded the bounded local user scan");
}

function union(...collections) {
  return [...new Set(collections.flat().filter(Boolean))];
}
