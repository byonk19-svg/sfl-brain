import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";

import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const playwrightPackage = process.env.CODEX_PLAYWRIGHT_PACKAGE;
if (!playwrightPackage) throw new Error("CODEX_PLAYWRIGHT_PACKAGE is required");
const { chromium } = require(playwrightPackage);

const siteUrl = process.env.SFL_ACCEPTANCE_SITE_URL ?? "http://127.0.0.1:3103";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const workspaceId = process.env.SFL_WORKSPACE_ID;
if (!supabaseUrl || !serviceRoleKey || !publishableKey || !workspaceId) {
  throw new Error("Local Supabase acceptance environment is incomplete");
}
if (!["127.0.0.1", "localhost"].includes(new URL(siteUrl).hostname) || !["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname)) {
  throw new Error("Local hold acceptance refuses non-loopback services");
}

const runId = crypto.randomUUID();
const email = `sfl-acceptance-${runId}@example.com`;
const password = crypto.randomBytes(24).toString("base64url");
const title = `[Acceptance] Hold lifecycle ${runId}`;
const reviewDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const service = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let userId;
let opportunityId;
let browser;
const cleanupErrors = [];

async function cleanup() {
  if (browser) await browser.close().catch((error) => cleanupErrors.push(error));
  if (opportunityId) {
    const { error } = await service.from("content_opportunities").delete().eq("id", opportunityId);
    if (error) cleanupErrors.push(error);
  }
  if (userId) {
    const membership = await service.from("workspace_members").delete().eq("user_id", userId);
    if (membership.error) cleanupErrors.push(membership.error);
    const deleted = await service.auth.admin.deleteUser(userId);
    if (deleted.error) cleanupErrors.push(deleted.error);
  }
}

try {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) throw created.error ?? new Error("Acceptance user was not created");
  userId = created.data.user.id;

  const membership = await service.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: userId,
  });
  if (membership.error) throw membership.error;

  const authProbe = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await authProbe.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`Disposable account could not authenticate: ${signedIn.error.message}`);
  await authProbe.auth.signOut();

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${siteUrl}/login?next=/add`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForURL(`${siteUrl}/add`),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);

  await page.getByLabel("What are you working on?").fill(title);
  await Promise.all([
    page.waitForURL(/\/opportunities\/[0-9a-f-]+/),
    page.getByRole("button", { name: "Save to backlog" }).click(),
  ]);
  opportunityId = new URL(page.url()).pathname.split("/").at(-1);
  assert.match(opportunityId, /^[0-9a-f-]{36}$/);

  await page.getByText("Put on hold", { exact: true }).click();
  await page.getByLabel("Hold reason").fill("Acceptance blocker");
  await page.getByLabel("Release condition").fill("Acceptance condition is met");
  await page.getByLabel("Review date (optional)").fill(reviewDate);
  await page.getByRole("button", { name: "Move to On hold" }).click();
  await page.getByText("Moved to On hold.").waitFor();
  await page.getByText(/via website/).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${siteUrl}/library?view=on-hold`);
  await page.getByRole("heading", { name: title }).waitFor();
  const heldRow = page.locator(".backlog-row");
  await heldRow.getByText("Acceptance blocker", { exact: true }).waitFor();
  await heldRow.getByText("Acceptance condition is met", { exact: true }).waitFor();
  await heldRow.getByText("Due for review", { exact: true }).waitFor();

  await page.getByRole("heading", { name: title }).click();
  await page.getByText("Edit hold", { exact: true }).click();
  await page.getByLabel("Hold reason").fill("Updated acceptance blocker");
  await page.getByLabel("Release condition").fill("Updated acceptance condition");
  await page.getByLabel("Review date (optional)").fill("");
  await page.getByRole("button", { name: "Save hold" }).click();
  await page.getByText("Hold details updated.").waitFor();
  const holdSummary = page.locator(".hold-panel p");
  await holdSummary.filter({ hasText: "Updated acceptance blocker" }).waitFor();
  await holdSummary.filter({ hasText: "No review date" }).waitFor();

  await page.getByRole("button", { name: "Return to backlog" }).click();
  await page.getByText("Returned to the active backlog.").waitFor();
  await page.getByText("This opportunity is active and can appear in the backlog and Today recommendations.").waitFor();

  const opportunity = await service
    .from("content_opportunities")
    .select("status,content_opportunity_holds(held_source,released_source,released_at)")
    .eq("id", opportunityId)
    .single();
  if (opportunity.error) throw opportunity.error;
  assert.equal(opportunity.data.status, "idea");
  assert.equal(opportunity.data.content_opportunity_holds.length, 1);
  assert.equal(opportunity.data.content_opportunity_holds[0].held_source, "website");
  assert.equal(opportunity.data.content_opportunity_holds[0].released_source, "website");
  assert.ok(opportunity.data.content_opportunity_holds[0].released_at);

  console.log("Local website hold acceptance: passed");
  console.log("Verified: login, placement, due state, narrow facts, edit, release, provenance, stage preservation");
} finally {
  await cleanup();
  const remaining = await service.from("content_opportunities").select("id", { count: "exact", head: true }).eq("title", title);
  if (remaining.error) cleanupErrors.push(remaining.error);
  if (remaining.count !== 0) cleanupErrors.push(new Error("Disposable opportunity remained after cleanup"));
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, "Local hold acceptance cleanup failed");
  }
  console.log("Disposable local acceptance data: removed");
}
