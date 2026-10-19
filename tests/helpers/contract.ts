/**
 * Contract checker: validates API calls recorded by a mock client against Apple's pinned
 * OpenAPI spec (spec/openapi.oas.json).
 *
 * Stricter than JSON Schema on purpose: a key that the schema does not declare is an error
 * (the spec never sets additionalProperties: false, so stock validators would accept invented
 * field names). Schemas that declare additionalProperties (e.g. StringToStringMap) allow any key.
 *
 * Usage in a tool test:
 *   await someTool(mockClient as unknown as AppStoreConnectClient, input);
 *   expectContract(mockClient);
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { matchOperation } from "../../src/openapi/index.js";

// biome-ignore lint/suspicious/noExplicitAny: raw OpenAPI JSON
type Json = any;

const SPEC_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../spec/openapi.oas.json");
let cachedSpec: Json | undefined;

const linkage = (type: string) => ({
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: { type: { type: "string", enum: [type] }, id: { type: "string" } },
      required: ["id", "type"],
    },
  },
});

/**
 * Corrections where Apple's published spec is known to be narrower than the live API.
 * Each entry cites the evidence; add one only with a source.
 */
const SPEC_OVERRIDES: Record<string, (schema: Json) => void> = {
  // The live API clears an app info category slot with `{"data": null}` (verified 2026-10-16 on
  // a sandbox app: PATCH appInfos primaryCategory data null emptied the slot), but the spec
  // declares the linkage non-nullable.
  AppInfoUpdateRequest: (schema) => {
    for (const relationship of Object.values<Json>(
      schema.properties.data.properties.relationships.properties
    )) {
      relationship.properties.data.nullable = true;
    }
  },
  // Live API requires territory (and, for paid modes, subscriptionPricePoint) on inline win-back
  // prices: "Missing subscriptionPricePoint relationship". Source: rorkai/App-Store-Connect-CLI
  // internal/asc/win_back_offers.go (WinBackOfferPriceInlineCreate).
  WinBackOfferPriceInlineCreate: (schema) => {
    schema.properties.relationships = {
      type: "object",
      properties: {
        territory: linkage("territories"),
        subscriptionPricePoint: linkage("subscriptionPricePoints"),
      },
    };
  },
};

function getSpec(): Json {
  if (!cachedSpec) {
    cachedSpec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));
    for (const [name, patch] of Object.entries(SPEC_OVERRIDES)) {
      patch(cachedSpec.components.schemas[name]);
    }
  }
  return cachedSpec;
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface RecordedCall {
  method: HttpMethod;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
}

function resolveSchema(schema: Json): Json {
  let current = schema;
  const seen = new Set<string>();
  while (current?.$ref) {
    if (seen.has(current.$ref)) break;
    seen.add(current.$ref);
    const name = String(current.$ref).split("/").pop() as string;
    const { $ref: _ref, ...siblings } = current;
    current = { ...getSpec().components.schemas[name], ...siblings };
  }
  return current ?? {};
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Validate a value against an OpenAPI 3.0 schema subset.
 * `partial` is used for anyOf branches, which only add `required` constraints.
 */
export function validateAgainstSchema(
  rawSchema: Json,
  value: unknown,
  at: string,
  partial = false
): string[] {
  const schema = resolveSchema(rawSchema);

  if (value === null) {
    return schema.nullable || partial ? [] : [`${at}: null is not allowed`];
  }

  const errors: string[] = [];

  if (schema.oneOf) {
    const matched = (schema.oneOf as Json[]).some(
      (branch) => validateAgainstSchema(branch, value, at).length === 0
    );
    if (!matched) errors.push(`${at}: matches none of the allowed shapes (oneOf)`);
    return errors;
  }

  const type = schema.type ?? (schema.properties ? "object" : undefined);
  switch (type) {
    case "object": {
      if (typeName(value) !== "object") return [`${at}: expected object, got ${typeName(value)}`];
      const record = value as Record<string, unknown>;
      const properties: Record<string, Json> = schema.properties ?? {};
      for (const key of schema.required ?? []) {
        if (!(key in record) || record[key] === undefined)
          errors.push(`${at}: missing required '${key}'`);
      }
      for (const [key, child] of Object.entries(record)) {
        if (child === undefined) continue;
        if (properties[key]) {
          errors.push(...validateAgainstSchema(properties[key], child, `${at}.${key}`, partial));
        } else if (schema.additionalProperties) {
          if (typeof schema.additionalProperties === "object") {
            errors.push(
              ...validateAgainstSchema(schema.additionalProperties, child, `${at}.${key}`, partial)
            );
          }
        } else if (!partial) {
          errors.push(
            `${at}: unknown key '${key}' (allowed: ${Object.keys(properties).join(", ")})`
          );
        }
      }
      break;
    }
    case "array": {
      if (!Array.isArray(value)) return [`${at}: expected array, got ${typeName(value)}`];
      value.forEach((item, index) => {
        errors.push(...validateAgainstSchema(schema.items ?? {}, item, `${at}[${index}]`, partial));
      });
      break;
    }
    case "string":
      if (typeof value !== "string") errors.push(`${at}: expected string, got ${typeName(value)}`);
      else if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${at}: '${value}' is not one of ${schema.enum.join(", ")}`);
      }
      break;
    case "integer":
      if (!Number.isInteger(value)) errors.push(`${at}: expected integer, got ${typeName(value)}`);
      break;
    case "number":
      if (typeof value !== "number") errors.push(`${at}: expected number, got ${typeName(value)}`);
      break;
    case "boolean":
      if (typeof value !== "boolean")
        errors.push(`${at}: expected boolean, got ${typeName(value)}`);
      break;
    default:
      break;
  }

  if (schema.anyOf && errors.length === 0) {
    const matched = (schema.anyOf as Json[]).some(
      (branch) => validateAgainstSchema(branch, value, at, true).length === 0
    );
    if (!matched) errors.push(`${at}: satisfies none of the anyOf requirement sets`);
  }

  return errors;
}

/**
 * Normalize a client path: add /v1 when unversioned and split off any query string.
 */
function normalizeCall(call: RecordedCall): RecordedCall {
  let path = call.path;
  const query: Record<string, unknown> = { ...(call.query ?? {}) };
  const questionMark = path.indexOf("?");
  if (questionMark >= 0) {
    for (const [key, value] of new URLSearchParams(path.slice(questionMark + 1))) {
      query[key] = value;
    }
    path = path.slice(0, questionMark);
  }
  if (!/^\/v\d+\//.test(path)) path = `/v1${path.startsWith("/") ? "" : "/"}${path}`;
  return { ...call, path, query };
}

export function contractErrors(rawCall: RecordedCall): string[] {
  const call = normalizeCall(rawCall);
  const label = `${call.method} ${call.path}`;
  const indexed = matchOperation(call.method, call.path);
  if (!indexed) return [`${label}: no such operation in the App Store Connect spec`];

  const operation = getSpec().paths[indexed.path][call.method.toLowerCase()];
  const errors: string[] = [];

  const parameters = new Map<string, Json>();
  for (const raw of operation.parameters ?? []) {
    if (raw.in === "query") parameters.set(raw.name, raw);
  }
  for (const [key, value] of Object.entries(call.query ?? {})) {
    if (value === undefined) continue;
    if (key === "cursor" && indexed.getAction === "list") continue;
    const param = parameters.get(key);
    if (!param) {
      errors.push(`${label}: unknown query parameter '${key}'`);
      continue;
    }
    const schema = resolveSchema(param.schema ?? {});
    const allowed: string[] | undefined =
      schema.type === "array" ? resolveSchema(schema.items ?? {}).enum : schema.enum;
    if (allowed) {
      for (const item of String(value).split(",")) {
        if (!allowed.includes(item)) {
          errors.push(
            `${label}: query '${key}' value '${item}' is not one of ${allowed.join(", ")}`
          );
        }
      }
    }
  }
  for (const [name, param] of parameters) {
    if (param.required && call.query?.[name] === undefined) {
      errors.push(`${label}: missing required query parameter '${name}'`);
    }
  }

  const bodySchema = operation.requestBody?.content?.["application/json"]?.schema;
  if (bodySchema) {
    if (call.body === undefined) errors.push(`${label}: request body is required`);
    else errors.push(...validateAgainstSchema(bodySchema, call.body, `${label} body`));
  } else if (call.body !== undefined) {
    errors.push(`${label}: operation takes no request body`);
  }

  return errors;
}

interface MockClientLike {
  get?: { mock: { calls: unknown[][] } };
  post?: { mock: { calls: unknown[][] } };
  patch?: { mock: { calls: unknown[][] } };
  delete?: { mock: { calls: unknown[][] } };
  requestRaw?: { mock: { calls: unknown[][] } };
}

/**
 * Every API call recorded on a vitest mock client, in method order (GET, POST, PATCH, DELETE).
 */
export function recordedCalls(client: MockClientLike): RecordedCall[] {
  const calls: RecordedCall[] = [];
  for (const args of client.get?.mock.calls ?? []) {
    calls.push({
      method: "GET",
      path: args[0] as string,
      query: args[1] as Record<string, unknown>,
    });
  }
  for (const args of client.requestRaw?.mock.calls ?? []) {
    const options = args[1] as { params?: Record<string, unknown> } | undefined;
    calls.push({ method: "GET", path: args[0] as string, query: options?.params });
  }
  for (const args of client.post?.mock.calls ?? []) {
    calls.push({ method: "POST", path: args[0] as string, body: args[1] });
  }
  for (const args of client.patch?.mock.calls ?? []) {
    calls.push({ method: "PATCH", path: args[0] as string, body: args[1] });
  }
  for (const args of client.delete?.mock.calls ?? []) {
    calls.push({ method: "DELETE", path: args[0] as string, body: args[1] });
  }
  return calls;
}

/**
 * Assert that every call recorded on the mock client matches the App Store Connect spec,
 * and that at least one call was made.
 */
export function expectContract(client: MockClientLike): void {
  const calls = recordedCalls(client);
  expect(calls.length, "no API calls were recorded").toBeGreaterThan(0);
  const errors = calls.flatMap((call) => contractErrors(call));
  expect(errors).toEqual([]);
}
