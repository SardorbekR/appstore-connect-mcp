/**
 * Server configuration from environment variables (beyond credentials).
 *
 *   ASC_TOOLSETS            comma-separated toolsets to expose (default: all)
 *   ASC_READ_ONLY           "1"/"true"/"yes" exposes only read tools and blocks every write request
 *   ASC_MAX_RESPONSE_CHARS  size cap for asc_api_request responses (default 80000)
 */

import { ConfigError } from "./utils/errors.js";

export const TOOLSETS = [
  "apps",
  "versions",
  "media",
  "testflight",
  "pricing",
  "subscriptions",
  "iap",
  "reviews",
  "product-pages",
  "provisioning",
  "users",
  "analytics",
  "api",
] as const;

export type Toolset = (typeof TOOLSETS)[number];

export interface ServerConfig {
  /** Undefined means every toolset is enabled. */
  toolsets?: ReadonlySet<Toolset>;
  readOnly: boolean;
}

export const DEFAULT_MAX_RESPONSE_CHARS = 80_000;
const MIN_MAX_RESPONSE_CHARS = 5_000;

function isTruthy(value: string | undefined): boolean {
  return ["1", "true", "yes"].includes((value ?? "").trim().toLowerCase());
}

export function parseToolsets(value: string | undefined): ReadonlySet<Toolset> | undefined {
  const names = (value ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);
  if (names.length === 0 || names.includes("all")) return undefined;

  const unknown = names.filter((name) => !(TOOLSETS as readonly string[]).includes(name));
  if (unknown.length > 0) {
    throw new ConfigError(
      `Unknown ASC_TOOLSETS value(s): ${unknown.join(", ")}. Valid toolsets: ${TOOLSETS.join(", ")}`
    );
  }
  return new Set(names as Toolset[]);
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    toolsets: parseToolsets(env.ASC_TOOLSETS),
    readOnly: isTruthy(env.ASC_READ_ONLY),
  };
}

export function readMaxResponseChars(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(env.ASC_MAX_RESPONSE_CHARS ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_RESPONSE_CHARS;
  return Math.max(parsed, MIN_MAX_RESPONSE_CHARS);
}
