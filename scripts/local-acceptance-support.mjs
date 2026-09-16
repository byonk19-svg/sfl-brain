import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseEnvironment(source) {
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

export function loadMainEnvironment(cwd, processEnvironment = process.env) {
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd, encoding: "utf8" }).trim();
  const mainRoot = path.dirname(path.resolve(cwd, common));
  const envPath = processEnvironment.SFL_ACCEPTANCE_ENV_FILE ?? path.join(mainRoot, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(`Acceptance environment file is missing: ${envPath}`);
  return parseEnvironment(fs.readFileSync(envPath, "utf8"));
}

export function readLocalSupabaseStatus(cwd) {
  const localCli = path.join(cwd, "node_modules", "supabase", "dist", "supabase.js");
  const result = spawnSync(process.execPath, [localCli, "status", "-o", "env"], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error("Local Supabase status is unavailable; acceptance requires the existing running stack");
  return parseEnvironment(result.stdout);
}

export function readSupabaseProjectId(cwd) {
  const source = fs.readFileSync(path.join(cwd, "supabase", "config.toml"), "utf8");
  const match = /^project_id\s*=\s*"([a-z0-9][a-z0-9_-]*)"\s*$/im.exec(source);
  if (!match) throw new Error("Local Supabase project_id is missing or unsafe");
  return match[1];
}

export function validateLocalSupabaseConfig({ status, configured, projectId }) {
  for (const key of ["API_URL", "DB_URL", "PUBLISHABLE_KEY", "ANON_KEY", "SERVICE_ROLE_KEY", "JWT_SECRET"]) {
    if (!status[key]) throw new Error(`Local Supabase status did not return ${key}`);
  }
  const api = new URL(status.API_URL);
  const db = new URL(status.DB_URL);
  assertLoopback(api, "Supabase API");
  assertLoopback(db, "Supabase database");
  const expected = [configured.SUPABASE_URL, configured.NEXT_PUBLIC_SUPABASE_URL].filter(Boolean);
  if (expected.length !== 2 || expected.some((value) => new URL(value).href !== api.href)) {
    throw new Error("Configured Supabase URL does not match the running local Supabase status URL");
  }
  if (configured.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && configured.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== status.PUBLISHABLE_KEY) {
    throw new Error("Configured Supabase publishable key does not match the running local stack");
  }
  if (configured.SUPABASE_SERVICE_ROLE_KEY && configured.SUPABASE_SERVICE_ROLE_KEY !== status.SERVICE_ROLE_KEY) {
    throw new Error("Configured Supabase service key does not match the running local stack");
  }
  if (configured.SUPABASE_ANON_KEY && configured.SUPABASE_ANON_KEY !== status.ANON_KEY) {
    throw new Error("Configured Supabase anon key does not match the running local stack");
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(projectId)) throw new Error("Unsafe local Supabase project id");
  return {
    supabaseUrl: api.origin,
    publishableKey: status.PUBLISHABLE_KEY,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
    jwtSecret: status.JWT_SECRET,
    db: {
      hostname: db.hostname,
      port: db.port,
      username: decodeURIComponent(db.username),
      database: db.pathname.replace(/^\//, ""),
    },
    projectId,
    containerName: `supabase_db_${projectId}`,
  };
}

export function loadLocalAcceptanceConfig(cwd, processEnvironment = process.env) {
  const configured = { ...processEnvironment, ...loadMainEnvironment(cwd, processEnvironment) };
  const status = readLocalSupabaseStatus(cwd);
  const projectId = readSupabaseProjectId(cwd);
  const local = validateLocalSupabaseConfig({ status, configured, projectId });
  validateLocalSupabaseContainer(cwd, local);
  return { ...configured, ...local, workspaceId: configured.SFL_WORKSPACE_ID };
}

export function validateLocalSupabaseContainer(cwd, config) {
  const inspected = spawnSync("docker", ["inspect", config.containerName, "--format", "{{json .Config.Labels}}|{{.State.Running}}"], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (inspected.status !== 0) throw new Error(`Expected local Supabase database container ${config.containerName} is unavailable`);
  const separator = inspected.stdout.lastIndexOf("|");
  const labels = JSON.parse(inspected.stdout.slice(0, separator));
  const running = inspected.stdout.slice(separator + 1).trim() === "true";
  if (!running || labels["com.supabase.cli.project"] !== config.projectId || path.resolve(labels["com.supabase.cli.workdir"] ?? "").toLowerCase() !== path.resolve(cwd).toLowerCase()) {
    throw new Error("Running Supabase database container does not belong to this exact local project worktree");
  }
  const ports = spawnSync("docker", ["port", config.containerName, "5432"], { cwd, encoding: "utf8", windowsHide: true });
  if (ports.status !== 0 || !ports.stdout.split(/\r?\n/).some((line) => line.trim().endsWith(`:${config.db.port}`))) {
    throw new Error("Local Supabase DB_URL does not match the validated database container port");
  }
}

export function assertLoopback(url, label) {
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`Local acceptance refuses a non-loopback ${label} service`);
}

export async function assertPortAvailable(host, port) {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", (error) => reject(new Error(`Acceptance port ${host}:${port} is already in use: ${error.message}`)));
    probe.listen(port, host, resolve);
  });
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
}

export async function startNextServer({ projectDir: cwd, port, env, readyUrl, readyCheck }) {
  await assertPortAvailable("127.0.0.1", port);
  const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "-H", "127.0.0.1", "-p", String(port)], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let logs = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { logs = `${logs}${chunk}`.slice(-12_000); });
  try {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Next server exited before acceptance:\n${logs}`);
      if (/Ready in|started server/i.test(logs)) {
        try {
          const response = await fetch(readyUrl, { redirect: "manual", cache: "no-store" });
          if (child.exitCode === null && await readyCheck(response)) return child;
        } catch {}
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Next server did not become ready with the expected current-app response:\n${logs}`);
  } catch (error) {
    await stopProcessTree(child);
    throw error;
  }
}

export async function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    const stopped = spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { encoding: "utf8", windowsHide: true });
    if (stopped.status !== 0 && child.exitCode === null) throw new Error(`Could not terminate acceptance server process tree: ${stopped.stderr || stopped.stdout}`);
  } else if (child.exitCode === null) {
    child.kill("SIGTERM");
  }
  if (child.exitCode === null) {
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  }
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  }
  if (child.exitCode === null) throw new Error("Acceptance server process tree did not terminate");
}

function uuidList(values) {
  const unique = [...new Set(values.filter(Boolean))];
  for (const value of unique) if (!UUID.test(value)) throw new Error("Refusing cleanup for a non-UUID identifier");
  return unique.length ? `array[${unique.map((value) => `'${value}'::uuid`).join(",")}]` : "array[]::uuid[]";
}

export function buildCleanupSql({ workspaceId, packageIds, opportunityIds, assetIds, destinationIds, requestIds = [], actorUserIds = [] }) {
  if (!UUID.test(workspaceId)) throw new Error("Refusing cleanup for a non-UUID workspace");
  const packages = uuidList(packageIds);
  const opportunities = uuidList(opportunityIds);
  const assets = uuidList(assetIds);
  const destinations = uuidList(destinationIds);
  const requests = uuidList(requestIds);
  const actors = uuidList(actorUserIds);
  return `begin;
alter table public.post_assets disable trigger post_assets_reject_terminal_package_mutation;
alter table public.posts disable trigger posts_reject_terminal_package_mutation;
alter table public.post_package_destinations disable trigger post_package_destinations_reject_terminal_mutation;
alter table public.post_package_assets disable trigger post_package_assets_reject_terminal_mutation;
alter table public.post_package_caption_variants disable trigger post_package_variants_reject_terminal_mutation;
alter table public.post_packages disable trigger post_packages_reject_terminal_update;
delete from public.mcp_mutation_requests where workspace_id = '${workspaceId}'::uuid and (request_id = any(${requests}) or actor_user_id = any(${actors}));
delete from public.post_package_destinations where package_id = any(${packages});
delete from public.post_assets where post_id in (select id from public.posts where post_package_id = any(${packages}));
delete from public.posts where post_package_id = any(${packages});
delete from public.post_package_assets where package_id = any(${packages});
delete from public.post_package_caption_variants where package_id = any(${packages});
delete from public.post_packages where id = any(${packages});
delete from public.content_opportunity_assets where opportunity_id = any(${opportunities}) or asset_id = any(${assets});
delete from public.content_opportunities where id = any(${opportunities});
delete from public.assets where id = any(${assets});
delete from public.destinations where id = any(${destinations});
alter table public.post_packages enable trigger post_packages_reject_terminal_update;
alter table public.post_package_caption_variants enable trigger post_package_variants_reject_terminal_mutation;
alter table public.post_package_assets enable trigger post_package_assets_reject_terminal_mutation;
alter table public.post_package_destinations enable trigger post_package_destinations_reject_terminal_mutation;
alter table public.posts enable trigger posts_reject_terminal_package_mutation;
alter table public.post_assets enable trigger post_assets_reject_terminal_package_mutation;
commit;`;
}

export function executeCleanupSql(config, sql) {
  const result = spawnSync("docker", ["exec", "-i", config.containerName, "psql", "-U", config.db.username, "-d", config.db.database, "-v", "ON_ERROR_STOP=1", "-q"], {
    input: sql,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`Exact local fixture cleanup failed: ${result.stderr || result.stdout}`);
}

export function assertExplicitUserMissing(result) {
  if (result.data?.user) throw new Error("Disposable Auth user remained after cleanup");
  if (result.error?.status !== 404 || result.error?.code !== "user_not_found") {
    throw new Error(`Auth response did not prove user absence: ${result.error?.code ?? result.error?.message ?? "missing explicit not-found error"}`);
  }
}

export function assertExplicitStorageMissing(result) {
  if (result.data) throw new Error("Disposable private Storage object remained after cleanup");
  if (result.error?.code !== "NoSuchKey") {
    throw new Error(`Storage response did not prove object absence: ${result.error?.code ?? result.error?.message ?? "missing explicit not-found error"}`);
  }
}

export function storageFixturePrefix(workspaceId, opportunityId) {
  if (!UUID.test(workspaceId) || !UUID.test(opportunityId)) {
    throw new Error("Storage fixture prefix requires exact workspace and opportunity UUIDs");
  }
  return `${workspaceId}/opportunities/${opportunityId}/`;
}

export async function listStoragePrefixObjects(storage, prefix, pageSize = 100) {
  if (!prefix.endsWith("/") || prefix.includes("..")) throw new Error("Unsafe Storage fixture prefix");
  const objects = [];
  const pending = [prefix.slice(0, -1)];
  while (pending.length) {
    const current = pending.shift();
    for (let offset = 0; ; offset += pageSize) {
      const result = await storage.list(current, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (result.error) throw new Error(`Storage prefix list failed: ${result.error.message}`);
      if (!Array.isArray(result.data)) throw new Error("Storage prefix list returned no explicit result set");
      for (const item of result.data) {
        if (!item?.name || item.name.includes("/") || item.name === "." || item.name === "..") {
          throw new Error("Storage prefix list returned an unsafe object name");
        }
        const objectPath = `${current}/${item.name}`;
        if (item.id === null || item.id === undefined) pending.push(objectPath);
        else objects.push(objectPath);
      }
      if (result.data.length < pageSize) break;
    }
  }
  return [...new Set(objects)];
}

export async function removeStorageObjects(storage, objectPaths, batchSize = 100) {
  const unique = [...new Set(objectPaths)];
  for (let index = 0; index < unique.length; index += batchSize) {
    const batch = unique.slice(index, index + batchSize);
    const result = await storage.remove(batch);
    if (result.error) throw new Error(`Storage object cleanup failed: ${result.error.message}`);
  }
}

export async function assertStoragePrefixEmpty(storage, prefix) {
  const remaining = await listStoragePrefixObjects(storage, prefix);
  if (remaining.length) throw new Error(`Storage objects remained under the disposable prefix: ${remaining.join(", ")}`);
}
