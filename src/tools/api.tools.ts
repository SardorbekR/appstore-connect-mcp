/**
 * Generic API Tools - call, search, and describe any App Store Connect API operation.
 *
 * Every request is matched against the bundled index of Apple's OpenAPI spec
 * (src/openapi/schema-index.json), so the model cannot call operations that do not exist
 * and gets the nearest valid operations when it guesses wrong.
 *
 * Path safety rules and non-JSON handling follow rorkai/App-Store-Connect-CLI `asc api` (MIT).
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import { readMaxResponseChars } from "../config.js";
import {
  type HttpMethod,
  type IndexedOperation,
  getOperationCount,
  getSpecVersion,
  matchOperation,
  methodsForPath,
  nearestOperations,
  searchOperations,
} from "../openapi/index.js";
import { ASCError, ValidationError, formatErrorResponse } from "../utils/errors.js";
import { validateInput } from "../utils/validation.js";
import type { ToolDefinition, ToolModule } from "./types.js";

const API_ORIGIN = "https://api.appstoreconnect.apple.com";
const MAX_PAGES = 50;
const DEFAULT_MAX_ITEMS = 200;
const MAX_MAX_ITEMS = 2000;
const MAX_LISTED_PARAMETERS = 60;
// Room kept free for the pagination block (cursor URL, stop reason) added after a page is sized
const PAGINATION_RESERVE_CHARS = 2_000;
// Attribute values never returned or echoed in errors (typed tools hide them too)
const SECRET_KEYS = new Set(["demoAccountPassword"]);

/** Operations whose responses are files, with the typed tool that handles them. */
const FILE_RESPONSE_TOOLS: Record<string, string> = {
  "/v1/salesReports": "get_sales_report",
  "/v1/financeReports": "get_finance_report",
  "/v1/subscriptionOfferCodeOneTimeUseCodes/{id}/values": "get_subscription_one_time_code_values",
  "/v1/inAppPurchaseOfferCodeOneTimeUseCodes/{id}/values": "get_iap_one_time_code_values",
};

const METHODS = ["GET", "POST", "PATCH", "DELETE"] as const;

const queryValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

const apiRequestInputSchema = z
  .object({
    method: z.enum(METHODS).optional(),
    path: z.string().min(1).optional(),
    query: z.record(queryValueSchema).optional(),
    body: z.record(z.unknown()).optional(),
    paginate: z.boolean().optional(),
    maxItems: z.number().int().min(1).max(MAX_MAX_ITEMS).optional(),
    cursor: z.string().min(1).optional(),
    allowUnknown: z.boolean().optional(),
  })
  .refine((input) => Boolean(input.path) !== Boolean(input.cursor), {
    message: "Provide exactly one of path or cursor",
    path: ["path"],
  });

const apiSearchInputSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  method: z.enum(METHODS).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const apiDescribeInputSchema = z.object({
  method: z.enum(METHODS),
  path: z.string().min(1, "Path is required"),
});

type QueryParams = Record<string, string>;

interface JsonApiResource {
  type?: string;
  id?: string;
  attributes?: Record<string, unknown>;
}

interface JsonApiDocument {
  data?: JsonApiResource | JsonApiResource[] | null;
  included?: JsonApiResource[];
  links?: { next?: string; [key: string]: unknown };
  meta?: unknown;
  [key: string]: unknown;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Reject anything but a relative /v1-/v3 path made of plain segments.
 */
export function validateApiPath(path: string, field = "path"): void {
  if (!/^\/v[1-3]\//.test(path)) {
    throw new ValidationError(
      "Path must be relative and start with /v1/, /v2/ or /v3/ (e.g. /v1/apps)",
      field
    );
  }
  if (/[?#]/.test(path)) {
    throw new ValidationError("Put query parameters in `query`, not in the path", field);
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  if (/[%\\\u0000-\u001f\u007f]/.test(path)) {
    throw new ValidationError("Path contains a disallowed character (%, \\ or control)", field);
  }
  for (const segment of path.split("/").slice(1)) {
    if (segment === "") throw new ValidationError("Path contains an empty segment", field);
    if (segment === "." || segment === "..") {
      throw new ValidationError("Path cannot contain '.' or '..' segments", field);
    }
    if (segment.startsWith("{")) {
      throw new ValidationError(`Replace ${segment} in the path with a real ID`, field);
    }
    if (!/^[A-Za-z0-9._~=+-]+$/.test(segment)) {
      throw new ValidationError(`Path segment '${segment}' contains disallowed characters`, field);
    }
  }
}

/**
 * Parse a pagination link (or a cursor returned by this tool) into a path and query.
 */
export function parseApiUrl(url: string, field = "cursor"): { path: string; query: QueryParams } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError("Cursor must be an absolute App Store Connect API URL", field);
  }
  if (parsed.origin !== API_ORIGIN || parsed.username || parsed.password || parsed.hash) {
    throw new ValidationError(`Cursor must be an ${API_ORIGIN} URL`, field);
  }
  validateApiPath(parsed.pathname, field);
  const query: QueryParams = {};
  for (const [key, value] of parsed.searchParams) query[key] = value;
  return { path: parsed.pathname, query };
}

function formatOperation(operation: IndexedOperation): string {
  return `${operation.method} ${operation.path}`;
}

function resolveOperation(method: HttpMethod, path: string): IndexedOperation {
  const operation = matchOperation(method, path);
  if (operation) return operation;

  const methods = methodsForPath(path);
  if (methods.length > 0) {
    throw new ValidationError(
      `${method} is not supported for ${path}. Supported methods: ${methods.join(", ")}`,
      "method"
    );
  }
  const nearest = nearestOperations(method, path).map(formatOperation);
  throw new ValidationError(
    `No App Store Connect operation matches ${method} ${path}. Nearest: ${nearest.join("; ")}. Use asc_api_search to find the right path.`,
    "path"
  );
}

function normalizeQuery(query: Record<string, unknown> | undefined): QueryParams {
  const normalized: QueryParams = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    normalized[key] = Array.isArray(value) ? value.join(",") : String(value);
  }
  return normalized;
}

function validateQuery(operation: IndexedOperation, query: QueryParams): void {
  const parameters = new Map((operation.parameters ?? []).map((param) => [param.name, param]));

  for (const [key, value] of Object.entries(query)) {
    if (key === "cursor" && operation.getAction === "list") continue;
    const param = parameters.get(key);
    if (!param) {
      const names = [...parameters.keys()];
      const listed = names.slice(0, MAX_LISTED_PARAMETERS).join(", ");
      throw new ValidationError(
        `Unknown query parameter '${key}' for ${formatOperation(operation)}. ${
          names.length
            ? `Allowed: ${listed}${names.length > MAX_LISTED_PARAMETERS ? ", ..." : ""}`
            : "It takes no query parameters."
        }`,
        "query"
      );
    }
    if (param.enum) {
      const invalid = value.split(",").filter((item) => !param.enum?.includes(item));
      if (invalid.length) {
        throw new ValidationError(
          `Invalid value(s) ${invalid.join(", ")} for '${key}'. Allowed: ${param.enum.join(", ")}`,
          "query"
        );
      }
    }
    if (param.maximum !== undefined && Number(value) > param.maximum) {
      throw new ValidationError(`'${key}' cannot exceed ${param.maximum}`, "query");
    }
  }

  for (const param of parameters.values()) {
    if (param.required && !(param.name in query)) {
      throw new ValidationError(`Missing required query parameter '${param.name}'`, "query");
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkLinkage(value: unknown, resourceType: string, where: string): void {
  if (!isRecord(value) || typeof value.id !== "string" || value.type !== resourceType) {
    throw new ValidationError(`${where} must be {"type": "${resourceType}", "id": "<id>"}`, "body");
  }
}

function validateBody(
  operation: IndexedOperation,
  path: string,
  body: Record<string, unknown> | undefined
): void {
  const spec = operation.requestBody;
  if (!spec) {
    if (body !== undefined) {
      throw new ValidationError(`${formatOperation(operation)} does not take a body`, "body");
    }
    return;
  }
  if (body === undefined) {
    throw new ValidationError(
      `${formatOperation(operation)} requires a JSON:API body. Use asc_api_describe to see it.`,
      "body"
    );
  }

  const data = body.data;
  if (spec.linkage) {
    if (spec.linkage.many) {
      if (!Array.isArray(data)) {
        throw new ValidationError("Body data must be an array of {type, id} linkages", "body");
      }
      for (const item of data) checkLinkage(item, spec.linkage.resourceType, "Each data item");
    } else {
      checkLinkage(data, spec.linkage.resourceType, "Body data");
    }
    return;
  }

  if (!isRecord(data)) {
    throw new ValidationError("Body must be a JSON:API document with a `data` object", "body");
  }
  if (spec.resourceType && data.type !== spec.resourceType) {
    throw new ValidationError(`Body data.type must be "${spec.resourceType}"`, "body");
  }
  if (spec.requiresId) {
    if (typeof data.id !== "string") {
      throw new ValidationError("Body data.id is required for this operation", "body");
    }
    const pathId = operation.path.endsWith("/{id}") ? path.split("/").pop() : undefined;
    if (pathId && data.id !== pathId) {
      throw new ValidationError(
        `Body data.id (${data.id}) must match the path ID (${pathId})`,
        "body"
      );
    }
  }

  const attributes = data.attributes;
  if (attributes !== undefined) {
    if (!isRecord(attributes))
      throw new ValidationError("data.attributes must be an object", "body");
    const known = spec.attributes ?? {};
    for (const [name, value] of Object.entries(attributes)) {
      const attribute = known[name];
      if (!attribute) {
        throw new ValidationError(
          `Unknown attribute '${name}'. Allowed: ${Object.keys(known).join(", ") || "none"}`,
          "body"
        );
      }
      if (attribute.enum && typeof value === "string" && !attribute.enum.includes(value)) {
        throw new ValidationError(
          `Invalid value '${value}' for attribute '${name}'. Allowed: ${attribute.enum.join(", ")}`,
          "body"
        );
      }
    }
  }
  for (const name of spec.requiredAttributes ?? []) {
    if (!isRecord(attributes) || !(name in attributes)) {
      throw new ValidationError(`Missing required attribute '${name}'`, "body");
    }
  }

  const relationships = data.relationships;
  const knownRelationships = spec.relationships ?? {};
  if (relationships !== undefined) {
    if (!isRecord(relationships)) {
      throw new ValidationError("data.relationships must be an object", "body");
    }
    for (const [name, value] of Object.entries(relationships)) {
      const relationship = knownRelationships[name];
      if (!relationship) {
        throw new ValidationError(
          `Unknown relationship '${name}'. Allowed: ${Object.keys(knownRelationships).join(", ") || "none"}`,
          "body"
        );
      }
      const linkage = isRecord(value) ? value.data : undefined;
      if (relationship.many) {
        if (!Array.isArray(linkage)) {
          throw new ValidationError(`Relationship '${name}' data must be an array`, "body");
        }
        for (const item of linkage) {
          checkLinkage(item, relationship.resourceType, `Relationship '${name}' items`);
        }
      } else if (linkage !== null) {
        checkLinkage(linkage, relationship.resourceType, `Relationship '${name}' data`);
      }
    }
  }
  for (const [name, relationship] of Object.entries(knownRelationships)) {
    if (relationship.required && !(isRecord(relationships) && name in relationships)) {
      throw new ValidationError(`Missing required relationship '${name}'`, "body");
    }
  }

  if (body.included !== undefined) {
    if (!Array.isArray(body.included)) {
      throw new ValidationError("Body `included` must be an array", "body");
    }
    for (const item of body.included) {
      const type = isRecord(item) ? item.type : undefined;
      if (typeof type !== "string" || !spec.includedTypes?.includes(type)) {
        throw new ValidationError(
          `Included resources must have type: ${(spec.includedTypes ?? []).join(", ") || "none allowed"}`,
          "body"
        );
      }
    }
  }
}

// ============================================================================
// Execution and output shaping
// ============================================================================

/** Deep copy with secret attribute values replaced. */
function maskSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SECRET_KEYS.has(key) && typeof child === "string" ? "[REDACTED]" : maskSecrets(child),
    ])
  );
}

/** Secret values supplied in the tool input, so errors that echo them can be redacted. */
function secretsIn(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) secretsIn(item, found);
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEYS.has(key) && typeof child === "string") found.push(child);
      else secretsIn(child, found);
    }
  }
  return found;
}

function serializedSize(value: unknown): number {
  // Must match how src/index.ts serializes tool results
  return JSON.stringify(value, null, 2).length;
}

function withQuery(path: string, query: QueryParams): string {
  const search = new URLSearchParams(query).toString();
  return search ? `${path}?${search}` : path;
}

function tooLargeSummary(
  operation: string,
  document: unknown,
  sizeChars: number,
  maxChars: number
): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    success: true,
    operation,
    tooLarge: true,
    sizeChars,
    maxChars,
    topLevelKeys: isRecord(document) ? Object.keys(document) : [],
    hint:
      "The response exceeds ASC_MAX_RESPONSE_CHARS. Retry with a smaller `limit`, " +
      "`fields[<type>]` to select attributes, or fewer `include` values.",
  };
  const data = isRecord(document) ? (document as JsonApiDocument).data : undefined;
  if (Array.isArray(data)) {
    summary.count = data.length;
    summary.ids = data.slice(0, 50).map((resource) => `${resource.type}:${resource.id}`);
  } else if (isRecord(data)) {
    summary.ids = [`${data.type}:${data.id}`];
    summary.attributeKeys = Object.keys((data.attributes as Record<string, unknown>) ?? {});
  }
  return summary;
}

function shapeSingle(
  operation: string,
  document: unknown,
  maxChars: number
): Record<string, unknown> {
  const masked = maskSecrets(document ?? null);
  const result = { success: true, operation, response: masked };
  const size = serializedSize(result);
  return size > maxChars ? tooLargeSummary(operation, masked, size, maxChars) : result;
}

async function paginate(
  client: AppStoreConnectClient,
  operation: IndexedOperation,
  start: { path: string; query: QueryParams },
  maxItems: number,
  maxChars: number
): Promise<Record<string, unknown>> {
  const label = formatOperation(operation);
  const data: JsonApiResource[] = [];
  const included = new Map<string, JsonApiResource>();
  const seen = new Set<string>();
  let meta: unknown;
  let pages = 0;
  let cursor: string | undefined;
  let stopReason: string | undefined;
  let current = start;

  const build = (extraData: JsonApiResource[], extraIncluded: JsonApiResource[]) => {
    const mergedIncluded = new Map(included);
    for (const resource of extraIncluded) {
      mergedIncluded.set(`${resource.type}:${resource.id}`, resource);
    }
    const response: Record<string, unknown> = { data: [...data, ...extraData] };
    if (mergedIncluded.size) response.included = [...mergedIncluded.values()];
    if (meta !== undefined) response.meta = meta;
    return response;
  };

  const result = (response: Record<string, unknown>) => ({
    success: true,
    operation: label,
    response,
    pagination: {
      pages,
      returned: (response.data as unknown[]).length,
      truncated: Boolean(stopReason),
      ...(cursor ? { cursor } : {}),
      ...(stopReason ? { stopReason } : {}),
    },
  });

  while (true) {
    const url = `${API_ORIGIN}${withQuery(current.path, current.query)}`;
    if (seen.has(url)) {
      // Apple returned a next link already fetched; the result may be incomplete
      stopReason = "repeatedNextLink";
      break;
    }
    seen.add(url);

    const page = maskSecrets(
      await client.get<JsonApiDocument>(current.path, current.query)
    ) as JsonApiDocument;
    const pageData = Array.isArray(page.data) ? page.data : page.data ? [page.data] : [];
    const pageIncluded = page.included ?? [];

    if (pages === 0) meta = page.meta;
    const candidateSize = serializedSize(result(build(pageData, pageIncluded)));
    if (pages === 0) {
      if (candidateSize > maxChars - PAGINATION_RESERVE_CHARS) {
        return tooLargeSummary(label, page, candidateSize, maxChars);
      }
    } else if (data.length + pageData.length > maxItems) {
      cursor = url;
      stopReason = "maxItems";
      break;
    } else if (candidateSize > maxChars - PAGINATION_RESERVE_CHARS) {
      cursor = url;
      stopReason = "maxChars";
      break;
    }

    data.push(...pageData);
    for (const resource of pageIncluded) included.set(`${resource.type}:${resource.id}`, resource);
    pages++;

    const next = page.links?.next;
    if (!next) break;
    if (data.length >= maxItems) {
      cursor = next;
      stopReason = "maxItems";
      break;
    }
    if (pages >= MAX_PAGES) {
      cursor = next;
      stopReason = "maxPages";
      break;
    }
    current = parseApiUrl(next, "links.next");
  }

  return result(build([], []));
}

type ApiRequestInput = z.infer<typeof apiRequestInputSchema>;

interface ResolvedRequest {
  method: HttpMethod;
  path: string;
  query: QueryParams;
  operation?: IndexedOperation;
  label: string;
}

/**
 * Turn tool input into a validated request: safe path, known operation, valid query and body.
 */
function resolveRequest(params: ApiRequestInput, readOnly: boolean): ResolvedRequest {
  let method: HttpMethod = params.method ?? "GET";
  let path: string;
  let query: QueryParams;
  if (params.cursor) {
    ({ path, query } = parseApiUrl(params.cursor));
    method = "GET";
  } else {
    path = params.path as string;
    validateApiPath(path);
    query = normalizeQuery(params.query);
  }

  if (readOnly && method !== "GET") {
    throw new ASCError(
      `Read-only mode (ASC_READ_ONLY) blocks ${method} requests`,
      "READ_ONLY",
      403
    );
  }
  if (method === "GET" && params.body !== undefined) {
    throw new ValidationError("GET requests cannot have a body", "body");
  }

  if (params.allowUnknown) {
    const operation = matchOperation(method, path);
    return {
      method,
      path,
      query,
      operation,
      label: operation ? formatOperation(operation) : `${method} ${path}`,
    };
  }

  const operation = resolveOperation(method, path);
  validateQuery(operation, query);
  validateBody(operation, path, params.body);

  const mediaType = operation.responseMediaType;
  if (mediaType && !mediaType.endsWith("+json")) {
    const tool = FILE_RESPONSE_TOOLS[operation.path];
    throw new ValidationError(
      `${formatOperation(operation)} returns ${mediaType}, not JSON.${tool ? ` Use the ${tool} tool instead.` : ""}`,
      "path"
    );
  }
  return { method, path, query, operation, label: formatOperation(operation) };
}

async function executeGet(
  client: AppStoreConnectClient,
  request: ResolvedRequest,
  params: ApiRequestInput,
  maxChars: number
): Promise<Record<string, unknown>> {
  const { operation, path, query, label } = request;
  const mediaType = operation?.responseMediaType;

  if (mediaType?.endsWith("+json")) {
    const response = await client.requestRaw(path, {
      params: query,
      headers: { Accept: mediaType },
    });
    const text = await response.text();
    return shapeSingle(label, text ? JSON.parse(text) : null, maxChars);
  }

  if (params.paginate && operation?.getAction === "list") {
    const maxItems = params.maxItems ?? DEFAULT_MAX_ITEMS;
    const limitParam = operation.parameters?.find((param) => param.name === "limit");
    if (limitParam && query.limit === undefined) {
      query.limit = String(Math.min(maxItems, limitParam.maximum ?? 200));
    } else if (query.limit !== undefined && Number(query.limit) > maxItems) {
      // A page larger than maxItems would overshoot it on the first page
      query.limit = String(maxItems);
    }
    return paginate(client, operation, { path, query }, maxItems, maxChars);
  }

  return shapeSingle(label, await client.get(path, query), maxChars);
}

/**
 * Call any App Store Connect API operation
 */
export async function apiRequest(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(apiRequestInputSchema, input);
    const maxChars = readMaxResponseChars();
    const request = resolveRequest(params, client.readOnly);

    if (request.method === "GET") return await executeGet(client, request, params, maxChars);

    const target = withQuery(request.path, request.query);
    if (request.method === "POST") {
      return shapeSingle(request.label, await client.post(target, params.body), maxChars);
    }
    if (request.method === "PATCH") {
      return shapeSingle(request.label, await client.patch(target, params.body), maxChars);
    }
    await client.delete(target, params.body);
    return { success: true, operation: request.label, response: null };
  } catch (error) {
    return formatErrorResponse(error, secretsIn(input));
  }
}

/**
 * Find App Store Connect API operations by keyword
 */
export async function apiSearch(_client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(apiSearchInputSchema, input);
    const results = searchOperations(params.query, { method: params.method, limit: params.limit });
    return {
      success: true,
      specVersion: getSpecVersion(),
      data: results.map((operation) => ({
        method: operation.method,
        path: operation.path,
        operationId: operation.operationId,
        ...(operation.getAction ? { getAction: operation.getAction } : {}),
        ...(operation.responseMediaType ? { responseMediaType: operation.responseMediaType } : {}),
        ...(operation.deprecated ? { deprecated: true } : {}),
      })),
      meta: { returned: results.length },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

function bodyTemplate(operation: IndexedOperation): unknown {
  const spec = operation.requestBody;
  if (!spec) return undefined;
  const linkage = (type: string) => ({ type, id: "<id>" });
  if (spec.linkage) {
    return {
      data: spec.linkage.many
        ? [linkage(spec.linkage.resourceType)]
        : linkage(spec.linkage.resourceType),
    };
  }

  const data: Record<string, unknown> = { type: spec.resourceType };
  if (spec.requiresId) data.id = "<id>";
  const required = spec.requiredAttributes ?? [];
  if (required.length) {
    data.attributes = Object.fromEntries(
      required.map((name) => {
        const attribute = spec.attributes?.[name];
        return [
          name,
          attribute?.enum ? attribute.enum.join(" | ") : `<${attribute?.type ?? "value"}>`,
        ];
      })
    );
  }
  const requiredRelationships = Object.entries(spec.relationships ?? {}).filter(
    ([, relationship]) => relationship.required
  );
  if (requiredRelationships.length) {
    data.relationships = Object.fromEntries(
      requiredRelationships.map(([name, relationship]) => [
        name,
        {
          data: relationship.many
            ? [linkage(relationship.resourceType)]
            : linkage(relationship.resourceType),
        },
      ])
    );
  }
  return { data };
}

/**
 * Describe one App Store Connect API operation: query parameters, body attributes and relationships
 */
export async function apiDescribe(
  _client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(apiDescribeInputSchema, input);
    const operation = resolveOperation(params.method, params.path.split("?")[0] as string);
    const fileTool = FILE_RESPONSE_TOOLS[operation.path];
    return {
      success: true,
      data: {
        ...operation,
        ...(operation.requestBody ? { minimalBody: bodyTemplate(operation) } : {}),
        ...(fileTool ? { useTool: fileTool } : {}),
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

const REQUEST_DESCRIPTION = `Call any App Store Connect API operation (${getOperationCount()} operations from Apple's OpenAPI ${getSpecVersion()}). Prefer a typed tool when one exists. Find operations with asc_api_search and see parameters and body shape with asc_api_describe. \`path\` is relative, e.g. /v1/apps/123/appStoreVersions; put query parameters in \`query\`, e.g. {"filter[platform]": "IOS", "limit": 50, "fields[apps]": "name,bundleId"}. Bodies are JSON:API: {"data": {"type", "id", "attributes", "relationships"}}. Set paginate to follow pages; when a result has a cursor (or links.next), pass it as \`cursor\` to continue.`;

function requestDefinition(readOnly: boolean): ToolDefinition {
  return {
    name: "asc_api_request",
    description: readOnly
      ? `${REQUEST_DESCRIPTION} Read-only mode: only GET is allowed.`
      : `${REQUEST_DESCRIPTION} Writes (POST/PATCH/DELETE) change live App Store Connect data.`,
    annotations: readOnly
      ? { readOnlyHint: true, openWorldHint: true }
      : { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: readOnly ? ["GET"] : [...METHODS],
          description: "HTTP method (default GET)",
        },
        path: {
          type: "string",
          description: "Relative API path with real IDs, e.g. /v1/apps/123/appStoreVersions",
        },
        query: {
          type: "object",
          description:
            "Query parameters, e.g. filter[...], fields[...], include, limit, sort. Arrays are joined with commas.",
        },
        ...(readOnly
          ? {}
          : {
              body: {
                type: "object",
                description: "JSON:API request body for POST/PATCH (and relationship DELETE)",
              },
            }),
        paginate: {
          type: "boolean",
          description: "Follow links.next for list operations (GET only)",
        },
        maxItems: {
          type: "number",
          minimum: 1,
          maximum: MAX_MAX_ITEMS,
          description: `Maximum resources to collect when paginating (default ${DEFAULT_MAX_ITEMS})`,
        },
        cursor: {
          type: "string",
          description:
            "Continue a previous result: pass its pagination.cursor or links.next instead of path",
        },
        allowUnknown: {
          type: "boolean",
          description:
            "Skip spec matching and query/body key checks, for operations missing from Apple's published spec. Path safety rules still apply.",
        },
      },
    },
  };
}

const searchDefinition: ToolDefinition = {
  name: "asc_api_search",
  description:
    "Search the App Store Connect API operation index by keywords (matches paths, operation IDs, resource types), e.g. 'phased release', 'customer reviews', 'offer codes'.",
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keywords to search for" },
      method: { type: "string", enum: [...METHODS], description: "Only return this HTTP method" },
      limit: {
        type: "number",
        minimum: 1,
        maximum: 50,
        description: "Maximum results (default 20)",
      },
    },
    required: ["query"],
  },
};

const describeDefinition: ToolDefinition = {
  name: "asc_api_describe",
  description:
    "Describe one App Store Connect API operation: query parameters with allowed values, body attributes (types, enums, required), relationships, and a minimal body template.",
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: "object",
    properties: {
      method: { type: "string", enum: [...METHODS], description: "HTTP method" },
      path: {
        type: "string",
        description: "Template or concrete path, e.g. /v1/appInfos/{id} or /v1/appInfos/abc",
      },
    },
    required: ["method", "path"],
  },
};

export const apiToolDefinitions: ToolDefinition[] = [
  requestDefinition(false),
  searchDefinition,
  describeDefinition,
];

export const apiToolsModule: ToolModule = {
  toolset: "api",
  definitions: apiToolDefinitions,
  readOnlyDefinitions: [requestDefinition(true), searchDefinition, describeDefinition],
  handlers: {
    asc_api_request: apiRequest,
    asc_api_search: apiSearch,
    asc_api_describe: apiDescribe,
  },
};
