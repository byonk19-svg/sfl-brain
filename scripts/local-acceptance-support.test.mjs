import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";

import {
  assertExplicitStorageMissing,
  assertExplicitUserMissing,
  assertPortAvailable,
  assertStoragePathsWithinPrefixes,
  assertStoragePrefixEmpty,
  buildCleanupSql,
  listStoragePrefixObjects,
  storageFixturePrefix,
  validateLocalSupabaseConfig,
} from "./local-acceptance-support.mjs";

const status = {
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:secret@127.0.0.1:54322/postgres",
  PUBLISHABLE_KEY: "publishable-key",
  ANON_KEY: "anon-key",
  SERVICE_ROLE_KEY: "service-role-key",
  JWT_SECRET: "jwt-secret",
};

test("local Supabase config comes from one matching status result", () => {
  const result = validateLocalSupabaseConfig({
    status,
    configured: {
      SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    },
    projectId: "sfl-brain",
  });
  assert.equal(result.supabaseUrl, status.API_URL);
  assert.equal(result.publishableKey, status.PUBLISHABLE_KEY);
  assert.equal(result.serviceRoleKey, status.SERVICE_ROLE_KEY);
  assert.equal(result.jwtSecret, status.JWT_SECRET);
  assert.equal(result.db.port, "54322");
  assert.equal(result.containerName, "supabase_db_sfl-brain");
});

test("local Supabase config rejects mismatched URLs and keys", () => {
  assert.throws(() => validateLocalSupabaseConfig({
    status,
    configured: {
      SUPABASE_URL: "http://127.0.0.1:64321",
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    },
    projectId: "sfl-brain",
  }), /does not match/i);
});

test("cleanup SQL is exact, FK ordered, and never uses replication-role bypass", () => {
  const sql = buildCleanupSql({
    workspaceId: "11111111-1111-4111-8111-111111111111",
    packageIds: ["22222222-2222-4222-8222-222222222222"],
    opportunityIds: ["33333333-3333-4333-8333-333333333333"],
    assetIds: ["44444444-4444-4444-8444-444444444444"],
    destinationIds: ["55555555-5555-4555-8555-555555555555"],
    requestIds: ["66666666-6666-4666-8666-666666666666"],
    actorUserIds: ["77777777-7777-4777-8777-777777777777"],
  });
  assert.doesNotMatch(sql, /session_replication_role/i);
  assert.match(sql, /disable trigger post_packages_reject_terminal_update/i);
  assert.ok(sql.indexOf("delete from public.post_package_destinations") < sql.indexOf("delete from public.posts"));
  assert.ok(sql.indexOf("delete from public.posts") < sql.indexOf("delete from public.post_packages"));
  assert.match(sql, /commit;/i);
});

test("absence proof accepts only explicit not-found responses", () => {
  assert.doesNotThrow(() => assertExplicitUserMissing({ data: { user: null }, error: { status: 404, code: "user_not_found", message: "User not found" } }));
  assert.doesNotThrow(() => assertExplicitStorageMissing({ data: null, error: { status: 400, code: "NoSuchKey", message: "Object not found" } }));
  assert.throws(() => assertExplicitUserMissing({ data: { user: null }, error: { status: 503, code: "unavailable", message: "Connection failed" } }), /not prove/i);
  assert.throws(() => assertExplicitStorageMissing({ data: null, error: { status: 500, code: "storage_error", message: "Storage unavailable" } }), /not prove/i);
});

test("port preflight rejects a listener already occupying the acceptance port", async () => {
  const occupied = net.createServer();
  await new Promise((resolve, reject) => occupied.listen(0, "127.0.0.1", resolve).once("error", reject));
  const { port } = occupied.address();
  await assert.rejects(assertPortAvailable("127.0.0.1", port), /already in use/i);
  await new Promise((resolve) => occupied.close(resolve));
  await assert.doesNotReject(assertPortAvailable("127.0.0.1", port));
});

test("Storage prefix recovery paginates and descends into nested folders", async () => {
  const calls = [];
  const storage = {
    list: async (prefix, options) => {
      calls.push([prefix, options.offset]);
      if (prefix.endsWith("nested")) return { data: [{ id: "file-2", name: "two.png" }], error: null };
      if (options.offset === 0) return { data: [{ id: "file-1", name: "one.png" }, { id: null, name: "nested" }], error: null };
      return { data: [], error: null };
    },
  };
  const prefix = storageFixturePrefix("11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333");
  assert.deepEqual(await listStoragePrefixObjects(storage, prefix, 2), [
    `${prefix}one.png`,
    `${prefix}nested/two.png`,
  ]);
  assert.deepEqual(calls, [[prefix.slice(0, -1), 0], [prefix.slice(0, -1), 2], [`${prefix}nested`, 0]]);
});

test("Storage prefix proof rejects listing errors and surviving objects", async () => {
  const prefix = storageFixturePrefix("11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333");
  await assert.rejects(listStoragePrefixObjects({ list: async () => ({ data: null, error: new Error("network") }) }, prefix), /list.*network/i);
  await assert.rejects(assertStoragePrefixEmpty({ list: async () => ({ data: [{ id: "file", name: "left.png" }], error: null }) }, prefix), /remained/i);
  assert.throws(() => storageFixturePrefix("../unsafe", "33333333-3333-4333-8333-333333333333"), /UUID/i);
});

test("Storage deletion scope accepts nested fixture objects and rejects foreign metadata paths", () => {
  const prefix = storageFixturePrefix("11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333");
  assert.deepEqual(assertStoragePathsWithinPrefixes([
    `${prefix}hero.png`,
    `${prefix}nested/supporting.png`,
    `${prefix}hero.png`,
  ], [prefix]), [`${prefix}hero.png`, `${prefix}nested/supporting.png`]);
  assert.throws(() => assertStoragePathsWithinPrefixes([
    `${prefix}hero.png`,
    "11111111-1111-4111-8111-111111111111/opportunities/99999999-9999-4999-8999-999999999999/foreign.png",
  ], [prefix]), /outside.*disposable/i);
});
