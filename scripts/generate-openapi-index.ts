#!/usr/bin/env tsx
/**
 * Generate the runtime OpenAPI operation index from the pinned App Store Connect spec.
 *
 * Input:  spec/openapi.oas.json (Apple's official spec, see spec/README.md)
 * Output: src/openapi/schema-index.json
 *
 * The index is what the generic `asc_api_*` tools use to match, search, and describe
 * operations at runtime. The full spec is not shipped; tests validate request bodies
 * against it directly (tests/helpers/contract.ts).
 *
 * Index design ported from rorkai/App-Store-Connect-CLI scripts/generate-schema-index.py (MIT).
 *
 * Usage:
 *   npx tsx scripts/generate-openapi-index.ts          # write the index
 *   npx tsx scripts/generate-openapi-index.ts --check  # fail if the committed index is stale
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = resolve(ROOT, "spec/openapi.oas.json");
const INDEX_PATH = resolve(ROOT, "src/openapi/schema-index.json");

const METHODS = ["get", "post", "patch", "delete"] as const;

import type {
  IndexedAttribute,
  IndexedOperation,
  IndexedParameter,
  IndexedRelationship,
  IndexedRequestBody,
  OperationIndex,
} from "../src/openapi/types.js";

// biome-ignore lint/suspicious/noExplicitAny: raw OpenAPI JSON
type Json = any;

function refName(ref: string): string {
  return ref.split("/").pop() ?? ref;
}

function resolveRef(spec: Json, schema: Json): Json {
  let current = schema;
  const seen = new Set<string>();
  while (current?.$ref) {
    if (seen.has(current.$ref)) break;
    seen.add(current.$ref);
    const target = spec.components.schemas[refName(current.$ref)];
    // Sibling keys (e.g. `nullable`) next to a $ref override the target
    const { $ref: _ref, ...siblings } = current;
    current = { ...target, ...siblings };
  }
  return current;
}

function firstEnum(schema: Json): string | undefined {
  return Array.isArray(schema?.enum) && schema.enum.length > 0 ? schema.enum[0] : undefined;
}

function describeAttribute(spec: Json, raw: Json): IndexedAttribute {
  const resolved = resolveRef(spec, raw);
  const attr: IndexedAttribute = { type: resolved.type ?? "object" };
  if (resolved.type === "array" && resolved.items) {
    const items = resolveRef(spec, resolved.items);
    attr.type = `array<${items.type ?? "object"}>`;
    if (items.enum) attr.enum = items.enum;
  }
  if (resolved.enum) attr.enum = resolved.enum;
  if (raw.nullable || resolved.nullable) attr.nullable = true;
  if (raw.$ref) attr.ref = refName(raw.$ref);
  return attr;
}

function describeLinkageData(spec: Json, dataSchema: Json): IndexedRelationship | undefined {
  const data = resolveRef(spec, dataSchema);
  if (data?.type === "array") {
    const item = resolveRef(spec, data.items);
    const resourceType = firstEnum(item?.properties?.type);
    return resourceType ? { resourceType, many: true } : undefined;
  }
  const resourceType = firstEnum(data?.properties?.type);
  return resourceType ? { resourceType } : undefined;
}

function describeRequestBody(spec: Json, operation: Json): IndexedRequestBody | undefined {
  const schemaRef = operation.requestBody?.content?.["application/json"]?.schema;
  if (!schemaRef) return undefined;

  const root = resolveRef(spec, schemaRef);
  const body: IndexedRequestBody = {
    schema: schemaRef.$ref ? refName(schemaRef.$ref) : "inline",
  };

  const dataSchema = root.properties?.data;
  if (!dataSchema) return body;
  const data = resolveRef(spec, dataSchema);

  // Relationship linkage requests: { data: {type, id} } or { data: [{type, id}] }
  const isLinkage =
    data.type === "array" ||
    (data.properties && !data.properties.attributes && !data.properties.relationships);
  if (isLinkage) {
    const linkage = describeLinkageData(spec, dataSchema);
    if (linkage) body.linkage = linkage;
    return body;
  }

  const resourceType = firstEnum(data.properties?.type);
  if (resourceType) body.resourceType = resourceType;
  if (data.required?.includes("id")) body.requiresId = true;

  const attributes = resolveRef(spec, data.properties?.attributes);
  if (attributes?.properties) {
    body.attributes = {};
    for (const [name, raw] of Object.entries<Json>(attributes.properties)) {
      body.attributes[name] = describeAttribute(spec, raw);
    }
    if (attributes.required?.length) body.requiredAttributes = [...attributes.required].sort();
  }

  const relationships = resolveRef(spec, data.properties?.relationships);
  if (relationships?.properties) {
    body.relationships = {};
    const required = new Set<string>(relationships.required ?? []);
    for (const [name, raw] of Object.entries<Json>(relationships.properties)) {
      const rel = resolveRef(spec, raw);
      const described = describeLinkageData(spec, rel.properties?.data);
      if (!described) continue;
      if (required.has(name)) described.required = true;
      body.relationships[name] = described;
    }
  }

  const included = root.properties?.included;
  if (included) {
    const items = resolveRef(spec, included).items;
    const variants: Json[] = items?.oneOf ?? (items ? [items] : []);
    const types = variants
      .map((variant) => firstEnum(resolveRef(spec, variant)?.properties?.type))
      .filter((type): type is string => Boolean(type));
    if (types.length) body.includedTypes = [...new Set(types)].sort();
  }

  return body;
}

function describeParameters(spec: Json, operation: Json): IndexedParameter[] | undefined {
  const params: IndexedParameter[] = [];
  for (const raw of operation.parameters ?? []) {
    const param = raw.$ref ? spec.components.parameters[refName(raw.$ref)] : raw;
    if (param.in !== "query") continue;
    const entry: IndexedParameter = { name: param.name };
    if (param.required) entry.required = true;
    if (param.deprecated) entry.deprecated = true;
    const schema = resolveRef(spec, param.schema ?? {});
    const values = schema.type === "array" ? resolveRef(spec, schema.items)?.enum : schema.enum;
    if (values) entry.enum = values;
    if (typeof schema.maximum === "number") entry.maximum = schema.maximum;
    params.push(entry);
  }
  return params.length ? params : undefined;
}

function successResponse(operation: Json): { mediaTypes: string[]; schema?: Json } {
  for (const [code, response] of Object.entries<Json>(operation.responses ?? {})) {
    if (!code.startsWith("2")) continue;
    const content = response.content ?? {};
    const mediaTypes = Object.keys(content);
    return { mediaTypes, schema: content["application/json"]?.schema };
  }
  return { mediaTypes: [] };
}

function buildIndex(spec: Json): OperationIndex {
  const operations: IndexedOperation[] = [];

  for (const [path, pathItem] of Object.entries<Json>(spec.paths)) {
    for (const method of METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const entry: IndexedOperation = {
        method: method.toUpperCase() as IndexedOperation["method"],
        path,
        operationId: operation.operationId,
      };
      if (operation.tags?.[0]) entry.tag = operation.tags[0];
      if (operation.deprecated) entry.deprecated = true;

      const { mediaTypes, schema } = successResponse(operation);
      if (mediaTypes.length && !mediaTypes.includes("application/json")) {
        entry.responseMediaType = mediaTypes[0];
      }

      if (method === "get") {
        const responseData = schema ? resolveRef(spec, schema)?.properties?.data : undefined;
        if (responseData) {
          entry.getAction = resolveRef(spec, responseData).type === "array" ? "list" : "get";
        }
      }

      const parameters = describeParameters(spec, operation);
      if (parameters) entry.parameters = parameters;

      const requestBody = describeRequestBody(spec, operation);
      if (requestBody) entry.requestBody = requestBody;

      operations.push(entry);
    }
  }

  const order = { GET: 0, POST: 1, PATCH: 2, DELETE: 3 };
  operations.sort((a, b) =>
    a.path === b.path ? order[a.method] - order[b.method] : a.path < b.path ? -1 : 1
  );

  return { specVersion: spec.info.version, operationCount: operations.length, operations };
}

function main(): void {
  const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));
  const index = buildIndex(spec);
  const output = `${JSON.stringify(index)}\n`;

  const counts = { GET: 0, POST: 0, PATCH: 0, DELETE: 0 };
  for (const op of index.operations) counts[op.method]++;
  let specCount = 0;
  for (const pathItem of Object.values<Json>(spec.paths)) {
    for (const method of METHODS) if (pathItem[method]) specCount++;
  }
  console.log(
    `spec ${index.specVersion}: ${specCount} operations in spec, ${index.operationCount} indexed ` +
      `(GET ${counts.GET}, POST ${counts.POST}, PATCH ${counts.PATCH}, DELETE ${counts.DELETE}), ` +
      `${(output.length / 1024).toFixed(0)} KB`
  );
  if (specCount !== index.operationCount) {
    console.error("Indexed operation count does not match the spec");
    process.exit(1);
  }

  if (process.argv.includes("--check")) {
    let committed = "";
    try {
      committed = readFileSync(INDEX_PATH, "utf8");
    } catch {
      // missing index is stale
    }
    if (committed !== output) {
      console.error(`${INDEX_PATH} is stale. Run: npx tsx scripts/generate-openapi-index.ts`);
      process.exit(1);
    }
    console.log("index is current");
    return;
  }

  writeFileSync(INDEX_PATH, output);
  console.log(`wrote ${INDEX_PATH}`);
}

main();
