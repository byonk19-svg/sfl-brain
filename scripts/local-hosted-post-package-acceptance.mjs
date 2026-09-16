import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createClient } from "@supabase/supabase-js";

const projectDir = process.cwd();
const env = { ...process.env, ...loadMainEnvironment(projectDir) };
const endpoint = new URL(env.SFL_MCP_URL ?? "http://127.0.0.1:3105/mcp");
const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const workspaceId = env.SFL_WORKSPACE_ID;
const jwtSecret = localSupabaseEnvironment(projectDir).JWT_SECRET;
if (!supabaseUrl || !serviceRoleKey || !publishableKey || !workspaceId || !jwtSecret) {
  throw new Error("Local hosted Post Package acceptance environment is incomplete");
}
assertLoopback(endpoint, "MCP");
assertLoopback(new URL(supabaseUrl), "Supabase");

const runId = crypto.randomUUID();
const email = `sfl-package-mcp-${runId}@example.com`;
const password = crypto.randomBytes(24).toString("base64url");
const title = `[Acceptance] MCP Post Package ${runId}`;
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
    title: `[Acceptance] MCP asset ${runId}`,
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
    [`[Acceptance] MCP Page ${runId}`, "facebook_page"],
    [`[Acceptance] MCP Instagram ${runId}`, "instagram_feed"],
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
  if (server) await stopServer(server).catch((error) => cleanupErrors.push(error));
  try {
    cleanupDatabase({ opportunityId, packageId, assetId, destinationIds, requestIds });
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (userId) {
    const membership = await service.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    if (membership.error) cleanupErrors.push(membership.error);
    const deleted = await service.auth.admin.deleteUser(userId);
    if (deleted.error) cleanupErrors.push(deleted.error);
  }
  await proveCleanup();
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

function loadMainEnvironment(cwd) {
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd, encoding: "utf8" }).trim();
  const mainRoot = path.dirname(path.resolve(cwd, common));
  const envPath = process.env.SFL_ACCEPTANCE_ENV_FILE ?? path.join(mainRoot, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(`Acceptance environment file is missing: ${envPath}`);
  return parseEnvironment(fs.readFileSync(envPath, "utf8"));
}

function localSupabaseEnvironment(cwd) {
  const localCli = path.join(cwd, "node_modules", "supabase", "dist", "supabase.js");
  const result = spawnSync(process.execPath, [localCli, "status", "-o", "env"], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error("Local Supabase status is unavailable; the acceptance requires the existing running stack");
  return parseEnvironment(result.stdout);
}

function parseEnvironment(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value.replaceAll("\\n", "\n");
  }
  return values;
}

function assertLoopback(url, label) {
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`Local acceptance refuses a non-loopback ${label} service`);
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

async function startNextServer({ projectDir: cwd, port, env: serverEnv, readyUrl }) {
  const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", String(port)], {
    cwd,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let logs = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { logs = `${logs}${chunk}`.slice(-12_000); });
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Next server exited before acceptance:\n${logs}`);
    try {
      const response = await fetch(readyUrl, { redirect: "manual" });
      if (response.status < 500) return child;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error(`Next server did not become ready:\n${logs}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function uuidOrNull(value) {
  if (!value) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("Refusing cleanup for a non-UUID identifier");
  return value;
}

function cleanupDatabase(ids) {
  const opportunity = uuidOrNull(ids.opportunityId);
  const postPackage = uuidOrNull(ids.packageId);
  const asset = uuidOrNull(ids.assetId);
  const destinations = ids.destinationIds.map(uuidOrNull).filter(Boolean);
  const requests = ids.requestIds.map(uuidOrNull).filter(Boolean);
  if (!opportunity && !postPackage && !asset && destinations.length === 0 && requests.length === 0) return;
  const packageLiteral = postPackage ? `'${postPackage}'::uuid` : "null";
  const opportunityLiteral = opportunity ? `'${opportunity}'::uuid` : "null";
  const assetLiteral = asset ? `'${asset}'::uuid` : "null";
  const destinationList = destinations.map((id) => `'${id}'::uuid`).join(",") || "null";
  const requestList = requests.map((id) => `'${id}'::uuid`).join(",") || "null";
  const sql = `
begin;
set local session_replication_role = replica;
delete from public.mcp_mutation_requests where workspace_id = '${workspaceId}'::uuid and request_id in (${requestList});
delete from public.post_package_destinations where package_id = ${packageLiteral};
delete from public.post_package_assets where package_id = ${packageLiteral};
delete from public.post_package_caption_variants where package_id = ${packageLiteral};
delete from public.post_packages where id = ${packageLiteral};
delete from public.content_opportunity_assets where opportunity_id = ${opportunityLiteral};
delete from public.content_opportunities where id = ${opportunityLiteral};
delete from public.assets where id = ${assetLiteral};
delete from public.destinations where id in (${destinationList});
commit;`;
  const result = spawnSync("docker", ["exec", "-i", "supabase_db_sfl-brain", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sql,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`Exact hosted fixture cleanup failed: ${result.stderr || result.stdout}`);
}

async function proveCleanup() {
  const checks = [
    ["opportunity", "content_opportunities", "id", opportunityId],
    ["package", "post_packages", "id", packageId],
    ["package variant", "post_package_caption_variants", "package_id", packageId],
    ["package asset selection", "post_package_assets", "package_id", packageId],
    ["package distribution item", "post_package_destinations", "package_id", packageId],
    ["asset", "assets", "id", assetId],
    ...destinationIds.map((id) => ["destination", "destinations", "id", id]),
  ];
  for (const [label, table, column, value] of checks) {
    if (!value) continue;
    const result = await service.from(table).select(column, { count: "exact", head: true }).eq(column, value);
    if (result.error || result.count !== 0) cleanupErrors.push(result.error ?? new Error(`Disposable ${label} remained after cleanup`));
  }
  if (requestIds.length) {
    const audit = await service.from("mcp_mutation_requests").select("request_id", { count: "exact", head: true }).in("request_id", requestIds);
    if (audit.error || audit.count !== 0) cleanupErrors.push(audit.error ?? new Error("Disposable connector audit rows remained after cleanup"));
  }
  if (userId) {
    const membership = await service.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
    if (membership.error || membership.count !== 0) cleanupErrors.push(membership.error ?? new Error("Disposable connector membership remained after cleanup"));
    const deletedUser = await service.auth.admin.getUserById(userId);
    if (!deletedUser.error && deletedUser.data.user) cleanupErrors.push(new Error("Disposable connector Auth user remained after cleanup"));
  }
}
