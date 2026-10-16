/**
 * Once-a-day check for a newer asc-mcp release on npm.
 *
 * Startup reads only the cached result, so it never waits on the network; a background request
 * refreshes the cache for the next start. A newer version becomes a notice (stderr and the MCP
 * server instructions, so the assistant can tell the user). Nothing is downloaded or installed.
 * Set ASC_DISABLE_UPDATE_CHECK=1 to turn it off.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const LATEST_URL = "https://registry.npmjs.org/asc-mcp/latest";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 5_000;

interface CachedCheck {
  checkedAt: number;
  latest: string;
}

export interface UpdateCheckOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: number;
  cacheFile?: string;
  timeoutMs?: number;
}

function defaultCacheFile(env: NodeJS.ProcessEnv): string {
  const base = env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(base, "asc-mcp", "update-check.json");
}

function parseVersion(version: string): number[] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return match ? match.slice(1).map(Number) : undefined;
}

/**
 * True when `latest` is a higher release than `current`. Pre-release or malformed versions
 * never count as newer.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if ((a[i] as number) !== (b[i] as number)) return (a[i] as number) > (b[i] as number);
  }
  return false;
}

async function readCache(file: string): Promise<CachedCheck | undefined> {
  try {
    const cached = JSON.parse(await readFile(file, "utf8")) as CachedCheck;
    return typeof cached.checkedAt === "number" && typeof cached.latest === "string"
      ? cached
      : undefined;
  } catch {
    return undefined;
  }
}

async function writeCache(file: string, check: CachedCheck): Promise<void> {
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(check));
  } catch {
    // A read-only home directory only means the next start checks again
  }
}

async function fetchLatest(
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(LATEST_URL, { signal: controller.signal });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function isDisabled(env: NodeJS.ProcessEnv): boolean {
  return ["1", "true", "yes"].includes((env.ASC_DISABLE_UPDATE_CHECK ?? "").trim().toLowerCase());
}

/**
 * The newer version recorded by the last background check, or undefined. Reads only the local
 * cache, so server startup never waits on the network. Never throws.
 */
export async function cachedNewerVersion(
  currentVersion: string,
  options: UpdateCheckOptions = {}
): Promise<string | undefined> {
  const env = options.env ?? process.env;
  if (isDisabled(env)) return undefined;
  const cached = await readCache(options.cacheFile ?? defaultCacheFile(env));
  return cached && isNewerVersion(cached.latest, currentVersion) ? cached.latest : undefined;
}

/**
 * Ask npm for the latest version at most once a day and record it for the next start.
 * Meant to run in the background; never throws.
 */
export async function refreshLatestVersion(options: UpdateCheckOptions = {}): Promise<void> {
  const env = options.env ?? process.env;
  if (isDisabled(env)) return;

  const now = options.now ?? Date.now();
  const cacheFile = options.cacheFile ?? defaultCacheFile(env);
  const cached = await readCache(cacheFile);
  if (cached && now - cached.checkedAt >= 0 && now - cached.checkedAt < CHECK_INTERVAL_MS) return;

  const latest = await fetchLatest(options.fetchImpl ?? fetch, options.timeoutMs ?? TIMEOUT_MS);
  if (latest) await writeCache(cacheFile, { checkedAt: now, latest });
}

/**
 * Instructions for the assistant when a newer version exists.
 */
export function updateNotice(currentVersion: string, latestVersion: string): string {
  return [
    `asc-mcp ${latestVersion} is available; this server is running ${currentVersion}.`,
    "Mention this to the user once, then continue with their request.",
    "To update: if their MCP config runs `npx -y asc-mcp` (or `asc-mcp@latest`), restarting the MCP client is enough;",
    "for a global install, run `npm install -g asc-mcp@latest` and restart the client.",
    "Changes: https://github.com/SardorbekR/appstore-connect-mcp",
  ].join(" ");
}
