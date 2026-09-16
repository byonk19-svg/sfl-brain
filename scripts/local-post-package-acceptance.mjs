import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const projectDir = process.cwd();
const env = { ...process.env, ...loadMainEnvironment(projectDir) };
const siteUrl = new URL(env.SFL_ACCEPTANCE_SITE_URL ?? "http://127.0.0.1:3104");
const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_PUBLISHABLE_KEY;
const workspaceId = env.SFL_WORKSPACE_ID;
if (!supabaseUrl || !serviceRoleKey || !publishableKey || !workspaceId) {
  throw new Error("Local Post Package acceptance environment is incomplete");
}
assertLoopback(siteUrl, "website");
assertLoopback(new URL(supabaseUrl), "Supabase");

const { chromium } = loadPlaywright();
const runId = crypto.randomUUID();
const email = `sfl-package-acceptance-${runId}@example.com`;
const password = crypto.randomBytes(24).toString("base64url");
const title = `[Acceptance] Post Package ${runId}`;
const destinationOneName = `[Acceptance] Page ${runId}`;
const destinationTwoName = `[Acceptance] Instagram ${runId}`;
const assetTitle = `[Acceptance] Hero ${runId}`;
const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let userId;
let opportunityId;
let packageId;
let assetId;
let assetStoragePath;
const destinationIds = [];
let browser;
let server;
const cleanupErrors = [];

try {
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("Acceptance user was not created");
  userId = created.data.user.id;

  await mustInsert("workspace member", service.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId }));
  const opportunity = await mustSingle("opportunity", service.from("content_opportunities").insert({
    workspace_id: workspaceId,
    title,
    status: "idea",
    content_type: "standalone_product",
    notes: "Disposable browser acceptance fixture",
  }).select("id").single());
  opportunityId = opportunity.id;

  for (const [name, platform, identity] of [
    [destinationOneName, "facebook_page", "SFL acceptance page"],
    [destinationTwoName, "instagram_feed", "SFL acceptance Instagram"],
  ]) {
    const destination = await mustSingle("destination", service.from("destinations").insert({
      workspace_id: workspaceId,
      name,
      platform,
      posting_identity: identity,
      notes: "Disposable browser acceptance fixture",
      is_active: true,
    }).select("id").single());
    destinationIds.push(destination.id);
  }

  server = await startNextServer({
    projectDir,
    port: Number(siteUrl.port),
    env: {
      ...env,
      NODE_ENV: "development",
      VERCEL: "",
      NEXT_PUBLIC_SITE_URL: siteUrl.origin,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    },
    readyUrl: new URL("/login", siteUrl),
  });

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(new URL(`/login?next=/opportunities/${opportunityId}`, siteUrl).href);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForURL(new RegExp(`/opportunities/${opportunityId}`)),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);

  const startForm = formForButton(page, "Start package");
  await startForm.getByLabel("Base caption").fill("Acceptance base caption");
  await startForm.getByLabel("Working angle").fill("Initial acceptance angle");
  await startForm.getByLabel("Working notes").fill("Initial acceptance notes");
  await submitAndWait(page, "Start package", "Post Package started.");

  const packageRow = await mustSingle("Post Package", service.from("post_packages")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("opportunity_id", opportunityId)
    .single());
  packageId = packageRow.id;

  const contextForm = formForButton(page, "Save package context");
  await contextForm.getByLabel("Base caption").fill("Acceptance base caption revised");
  await contextForm.getByLabel("Working angle").fill("Desktop edited angle");
  await contextForm.getByLabel("Working notes").fill("Desktop edited notes");
  await submitAndWait(page, "Save package context", "Package context saved.");

  await page.getByText("Upload and attach a new asset", { exact: true }).click();
  const uploadForm = formForButton(page, "Upload asset");
  await uploadForm.getByLabel("File").setInputFiles({
    name: `acceptance-${runId}.png`,
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrxsAAAAASUVORK5CYII=", "base64"),
  });
  await uploadForm.getByLabel("Title").fill(assetTitle);
  await submitAndWait(page, "Upload asset", "Private asset uploaded and attached to the package.");

  const assetRow = await mustSingle("uploaded asset", service.from("assets")
    .select("id,storage_path")
    .eq("workspace_id", workspaceId)
    .eq("title", assetTitle)
    .single());
  assetId = assetRow.id;
  assetStoragePath = assetRow.storage_path;
  assert.ok(assetStoragePath, "Acceptance upload did not create a private Storage object");

  const assetForm = formForButton(page, "Save asset selection");
  const assetArticle = assetForm.locator(".package-asset-row").filter({ hasText: assetTitle });
  await assetArticle.getByLabel("Role").selectOption("hero");
  await assetArticle.getByLabel("Order").fill("0");
  await assetArticle.getByLabel("Package note").fill("Acceptance hero");
  await submitAndWait(page, "Save asset selection", "Package asset selection saved.");

  const createVariant = page.locator("details").filter({ hasText: "Create caption variant" });
  if (!(await createVariant.locator("form").isVisible())) await createVariant.getByText("Create caption variant", { exact: true }).click();
  let variantForm = createVariant.locator("form");
  await variantForm.locator('select[name="audience"]').selectOption("sfl_page");
  await variantForm.getByLabel("Caption copy").fill("Draft page caption");
  await submitAndWait(page, "Save draft variant", "Caption variant saved as draft.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "Post Package workspace overflows the narrow viewport");
  const draftCard = page.locator(".package-card").filter({ hasText: "Draft page caption" });
  await draftCard.getByText("Edit variant", { exact: true }).click();
  const editVariant = draftCard.locator("form");
  await editVariant.getByLabel("Caption copy").fill("Approved page caption");
  await editVariant.getByLabel("Status").selectOption("draft");
  await editVariant.getByRole("button", { name: "Save variant" }).click();
  await page.getByText("Caption variant saved as draft.", { exact: true }).waitFor();
  const revisedCard = page.locator(".package-card").filter({ hasText: "Approved page caption" });
  await revisedCard.getByText("Edit variant", { exact: true }).click();
  await revisedCard.getByLabel("Status").selectOption("approved");
  await revisedCard.getByRole("button", { name: "Save variant" }).click();
  await page.getByText("Caption variant approved.", { exact: true }).waitFor();

  const nextVariant = page.locator("details").filter({ hasText: "Create caption variant" });
  if (!(await nextVariant.locator("form").isVisible())) await nextVariant.getByText("Create caption variant", { exact: true }).click();
  variantForm = nextVariant.locator("form");
  await variantForm.locator('select[name="audience"]').selectOption("instagram");
  await variantForm.getByLabel("Caption copy").fill("Approved Instagram caption");
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes(`/opportunities/${opportunityId}`)),
    variantForm.getByRole("button", { name: "Approve variant" }).click(),
  ]);
  await page.getByText("Caption variant approved.", { exact: true }).waitFor();
  await page.getByText("Approved Instagram caption", { exact: true }).waitFor();
  await page.reload();

  const planForm = formForButton(page, "Save distribution plan");
  const savedVariants = await service.from("post_package_caption_variants").select("id,audience,status").eq("package_id", packageId);
  if (savedVariants.error) throw savedVariants.error;
  const pageVariant = savedVariants.data.find((item) => item.audience === "sfl_page" && item.status === "approved");
  const instagramVariant = savedVariants.data.find((item) => item.audience === "instagram" && item.status === "approved");
  assert.ok(pageVariant && instagramVariant, `Approved website variants were not persisted: ${JSON.stringify(savedVariants.data)}`);
  const submittedPlan = await planForm.evaluate((form, selection) => {
    for (const item of selection) {
      form.querySelector(`input[name="destination_ids"][value="${item.destinationId}"]`).checked = true;
      form.querySelector(`select[name="caption_variant_${item.destinationId}"]`).value = item.variantId;
    }
    return [...new FormData(form).entries()].map(([key, value]) => [key, String(value)]);
  }, [
    { destinationId: destinationIds[0], variantId: pageVariant.id },
    { destinationId: destinationIds[1], variantId: instagramVariant.id },
  ]);
  assert.equal(submittedPlan.filter(([key]) => key === "destination_ids").length, 2, "Distribution form did not include two checked destinations");
  assert.ok(submittedPlan.some(([key, value]) => key === `caption_variant_${destinationIds[0]}` && value === pageVariant.id), "Distribution form did not include the first approved caption");
  assert.ok(submittedPlan.some(([key, value]) => key === `caption_variant_${destinationIds[1]}` && value === instagramVariant.id), "Distribution form did not include the second approved caption");
  await submitAndWait(page, "Save distribution plan", "Distribution plan saved.");
  const savedPlan = await service.from("post_package_destinations").select("id,destination_id,status").eq("package_id", packageId);
  if (savedPlan.error) throw savedPlan.error;
  assert.equal(savedPlan.data.length, 2, `Distribution plan saved ${savedPlan.data.length} rows instead of two`);
  await page.reload();
  await page.getByText(destinationOneName, { exact: true }).first().waitFor();

  const firstDistribution = page.locator(".distribution-row").filter({ hasText: destinationOneName });
  await firstDistribution.getByRole("link", { name: "Record publication" }).click();
  await page.getByRole("heading", { name: "Package publication" }).waitFor();
  await page.getByText("Approved page caption", { exact: true }).waitFor();
  await page.getByText(`${assetTitle} · Hero`, { exact: true }).waitFor();
  await page.getByLabel("Publication notes").fill("Acceptance publication snapshot");
  await page.getByRole("button", { name: "Record package publication" }).click();
  await page.getByText("Publication recorded from the approved Post Package snapshot.", { exact: true }).waitFor();

  const secondDistribution = page.locator(".distribution-row").filter({ hasText: destinationTwoName });
  await secondDistribution.getByLabel("Skip reason").fill("Acceptance skip after publication");
  await secondDistribution.getByRole("button", { name: "Skip destination" }).click();
  await page.getByText("Destination marked skipped.", { exact: true }).waitFor();
  await page.getByText("Acceptance skip after publication", { exact: true }).waitFor();

  const closeButton = page.getByRole("button", { name: "Close package" });
  assert.equal(await closeButton.isEnabled(), true, "Package close stayed disabled after every destination was resolved");
  await closeButton.click();
  await page.getByText("Post Package closed.", { exact: true }).waitFor();

  const archived = page.locator('details[data-read-only="true"]').filter({ hasText: "Package 1 · Closed" });
  await archived.getByText("Package 1 · Closed", { exact: true }).click();
  await archived.getByText("Approved page caption", { exact: true }).waitFor();
  await archived.getByText(assetTitle, { exact: true }).waitFor();
  await archived.getByText("Acceptance skip after publication", { exact: true }).waitFor();
  assert.equal(await archived.locator('input, textarea, select, button[type="submit"]').count(), 0, "Archived package exposed an editable control");

  const persistedPackage = await mustSingle("closed package", service.from("post_packages")
    .select("status,base_caption,working_angle,notes,created_by,updated_by,created_source,updated_source,updated_at")
    .eq("id", packageId)
    .single());
  assert.equal(persistedPackage.status, "closed");
  assert.equal(persistedPackage.created_by, userId);
  assert.equal(persistedPackage.updated_by, userId);
  assert.equal(persistedPackage.created_source, "website");
  assert.equal(persistedPackage.updated_source, "website");

  const publication = await mustSingle("publication snapshot", service.from("posts")
    .select("id,destination_id,caption,post_package_id,caption_variant_id,notes,post_assets(asset_id,position)")
    .eq("post_package_id", packageId)
    .single());
  assert.equal(publication.destination_id, destinationIds[0]);
  assert.equal(publication.caption, "Approved page caption");
  assert.equal(publication.notes, "Acceptance publication snapshot");
  assert.deepEqual(publication.post_assets, [{ asset_id: assetId, position: 0 }]);

  const immutable = await service.rpc("update_post_package", {
    p_workspace_id: workspaceId,
    p_package_id: packageId,
    p_actor_user_id: userId,
    p_source: "website",
    p_request_id: null,
    p_expected_updated_at: persistedPackage.updated_at,
    p_base_caption: "Forbidden closed edit",
    p_working_angle: "Forbidden",
    p_notes: "Forbidden",
  });
  assert.ok(immutable.error, "Closed package mutation unexpectedly succeeded");

  await page.reload();
  const reloadedArchive = page.locator('details[data-read-only="true"]').filter({ hasText: "Package 1 · Closed" });
  await reloadedArchive.getByText("Package 1 · Closed", { exact: true }).click();
  await reloadedArchive.getByText("Acceptance base caption revised", { exact: true }).waitFor();

  console.log("Local website Post Package acceptance: passed");
  console.log("Verified: desktop and narrow editing, approval, private asset selection, atomic publication, skip, close, archive retrieval, immutability");
} finally {
  if (browser) await browser.close().catch((error) => cleanupErrors.push(error));
  if (server) await stopServer(server).catch((error) => cleanupErrors.push(error));
  if (assetStoragePath) {
    const removed = await service.storage.from("sfl-assets").remove([assetStoragePath]);
    if (removed.error) cleanupErrors.push(removed.error);
  }
  try {
    cleanupDatabase({ opportunityId, packageId, assetId, destinationIds });
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
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Local Post Package acceptance cleanup failed");
  console.log("Disposable website Post Package data and private Storage object: removed");
}

function loadMainEnvironment(cwd) {
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd, encoding: "utf8" }).trim();
  const mainRoot = path.dirname(path.resolve(cwd, common));
  const envPath = process.env.SFL_ACCEPTANCE_ENV_FILE ?? path.join(mainRoot, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(`Acceptance environment file is missing: ${envPath}`);
  const values = {};
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

function loadPlaywright() {
  if (process.env.CODEX_PLAYWRIGHT_PACKAGE) return require(process.env.CODEX_PLAYWRIGHT_PACKAGE);
  try {
    return require("playwright");
  } catch {
    throw new Error("CODEX_PLAYWRIGHT_PACKAGE must point to an installed Playwright package for browser acceptance");
  }
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

function formForButton(page, name) {
  return page.getByRole("button", { name, exact: true }).locator("xpath=ancestor::form");
}

async function submitAndWait(page, button, notice) {
  await page.getByRole("button", { name: button, exact: true }).click();
  await page.getByText(notice, { exact: true }).waitFor();
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
  if (!opportunity && !postPackage && !asset && destinations.length === 0) return;
  const quotedDestinations = destinations.map((id) => `'${id}'::uuid`).join(",") || "null";
  const packageLiteral = postPackage ? `'${postPackage}'::uuid` : "null";
  const opportunityLiteral = opportunity ? `'${opportunity}'::uuid` : "null";
  const assetLiteral = asset ? `'${asset}'::uuid` : "null";
  const sql = `
begin;
set local session_replication_role = replica;
delete from public.post_package_destinations where package_id = ${packageLiteral};
delete from public.post_assets where post_id in (select id from public.posts where post_package_id = ${packageLiteral});
delete from public.posts where post_package_id = ${packageLiteral};
delete from public.post_package_assets where package_id = ${packageLiteral};
delete from public.post_package_caption_variants where package_id = ${packageLiteral};
delete from public.post_packages where id = ${packageLiteral};
delete from public.content_opportunity_assets where opportunity_id = ${opportunityLiteral};
delete from public.content_opportunities where id = ${opportunityLiteral};
delete from public.assets where id = ${assetLiteral};
delete from public.destinations where id in (${quotedDestinations});
commit;`;
  const result = spawnSync("docker", ["exec", "-i", "supabase_db_sfl-brain", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sql,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`Exact fixture cleanup failed: ${result.stderr || result.stdout}`);
}

async function proveCleanup() {
  const checks = [
    ["opportunity", "content_opportunities", "id", opportunityId],
    ["package", "post_packages", "id", packageId],
    ["package variant", "post_package_caption_variants", "package_id", packageId],
    ["package asset selection", "post_package_assets", "package_id", packageId],
    ["package distribution item", "post_package_destinations", "package_id", packageId],
    ["package publication", "posts", "post_package_id", packageId],
    ["asset", "assets", "id", assetId],
    ...destinationIds.map((id) => ["destination", "destinations", "id", id]),
  ];
  for (const [label, table, column, value] of checks) {
    if (!value) continue;
    const result = await service.from(table).select(column, { count: "exact", head: true }).eq(column, value);
    if (result.error || result.count !== 0) cleanupErrors.push(result.error ?? new Error(`Disposable ${label} remained after cleanup`));
  }
  if (userId) {
    const membership = await service.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
    if (membership.error || membership.count !== 0) cleanupErrors.push(membership.error ?? new Error("Disposable membership remained after cleanup"));
    const deletedUser = await service.auth.admin.getUserById(userId);
    if (!deletedUser.error && deletedUser.data.user) cleanupErrors.push(new Error("Disposable Auth user remained after cleanup"));
  }
  if (assetStoragePath) {
    const downloaded = await service.storage.from("sfl-assets").download(assetStoragePath);
    if (!downloaded.error) cleanupErrors.push(new Error("Disposable private Storage object remained after cleanup"));
  }
}
