/**
 * Runtime lookup over the generated App Store Connect OpenAPI operation index.
 */

import indexData from "./schema-index.json" with { type: "json" };
import type { IndexedOperation, OperationIndex } from "./types.js";

export type { IndexedOperation, OperationIndex } from "./types.js";

export type HttpMethod = IndexedOperation["method"];

const INDEX = indexData as unknown as OperationIndex;

// Operations grouped by "METHOD segmentCount" for fast template matching
const BY_SHAPE = new Map<string, Array<{ operation: IndexedOperation; segments: string[] }>>();
for (const operation of INDEX.operations) {
  const segments = splitPath(operation.path);
  const key = `${operation.method} ${segments.length}`;
  const bucket = BY_SHAPE.get(key) ?? [];
  bucket.push({ operation, segments });
  BY_SHAPE.set(key, bucket);
}

function splitPath(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

function isTemplate(segment: string): boolean {
  return segment.startsWith("{") && segment.endsWith("}");
}

export function getSpecVersion(): string {
  return INDEX.specVersion;
}

export function getOperationCount(): number {
  return INDEX.operationCount;
}

/**
 * Match a concrete path (e.g. /v1/apps/123/appStoreVersions) or a template path
 * (e.g. /v1/apps/{id}/appStoreVersions) to an indexed operation.
 * Literal segments win over template segments when both match.
 */
export function matchOperation(method: string, path: string): IndexedOperation | undefined {
  const segments = splitPath(path);
  const bucket = BY_SHAPE.get(`${method.toUpperCase()} ${segments.length}`) ?? [];

  let best: { operation: IndexedOperation; templates: number } | undefined;
  for (const candidate of bucket) {
    let templates = 0;
    let matches = true;
    for (let i = 0; i < segments.length; i++) {
      const expected = candidate.segments[i] as string;
      if (isTemplate(expected)) {
        templates++;
      } else if (expected !== segments[i]) {
        matches = false;
        break;
      }
    }
    if (matches && (!best || templates < best.templates)) {
      best = { operation: candidate.operation, templates };
    }
  }
  return best?.operation;
}

/**
 * Methods the index supports for a path, used to explain a method mismatch.
 */
export function methodsForPath(path: string): HttpMethod[] {
  const methods: HttpMethod[] = [];
  for (const method of ["GET", "POST", "PATCH", "DELETE"] as const) {
    if (matchOperation(method, path)) methods.push(method);
  }
  return methods;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function haystack(operation: IndexedOperation): string {
  return [
    operation.path,
    operation.operationId,
    operation.tag ?? "",
    operation.requestBody?.resourceType ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Keyword search over paths, operation IDs, tags, and request resource types.
 * Every query token must appear; results are ordered by how many path segments
 * the tokens hit, then by path length.
 */
export function searchOperations(
  query: string,
  options: { method?: string; limit?: number } = {}
): IndexedOperation[] {
  const tokens = tokenize(query);
  const method = options.method?.toUpperCase();
  const limit = options.limit ?? 20;

  const scored: Array<{ operation: IndexedOperation; score: number }> = [];
  for (const operation of INDEX.operations) {
    if (method && operation.method !== method) continue;
    const text = haystack(operation);
    if (!tokens.every((token) => text.includes(token))) continue;

    const pathText = operation.path.toLowerCase();
    let score = 0;
    for (const token of tokens) if (pathText.includes(token)) score += 2;
    if (operation.deprecated) score -= 3;
    scored.push({ operation, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.operation.path.length - b.operation.path.length ||
      a.operation.path.localeCompare(b.operation.path)
  );
  return scored.slice(0, limit).map((entry) => entry.operation);
}

/**
 * The operations closest to an unmatched method + path, for error hints.
 */
export function nearestOperations(method: string, path: string, count = 5): IndexedOperation[] {
  const wanted = splitPath(path);
  const wantedTokens = new Set(tokenize(path));
  const upperMethod = method.toUpperCase();

  const scored = INDEX.operations.map((operation) => {
    const segments = splitPath(operation.path);
    const pathText = operation.path.toLowerCase();
    let score = 0;
    for (let i = 0; i < Math.min(segments.length, wanted.length); i++) {
      const segment = segments[i] as string;
      const wantedSegment = (wanted[i] as string).toLowerCase();
      if (segment === wanted[i]) score += 3;
      else if (isTemplate(segment)) score += 1;
      else if (segment.toLowerCase().includes(wantedSegment)) score += 2;
    }
    for (const token of wantedTokens) if (pathText.includes(token)) score += 1;
    score -= Math.abs(segments.length - wanted.length);
    if (operation.method === upperMethod) score += 2;
    return { operation, score };
  });

  scored.sort((a, b) => b.score - a.score || a.operation.path.length - b.operation.path.length);
  return scored.slice(0, count).map((entry) => entry.operation);
}
