#!/usr/bin/env tsx
/**
 * Print a markdown spec sheet for App Store Connect operations, resolved from the pinned
 * OpenAPI spec: query parameters, the full request body shape (nested objects, enums,
 * required markers, included resources), and the response resource's attributes.
 *
 * Usage:
 *   npx tsx scripts/spec-sheet.ts "PATCH /v1/appInfos/{id}" "GET /v1/apps/{id}/customerReviews"
 *   printf 'POST /v1/winBackOffers\n' | npx tsx scripts/spec-sheet.ts
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// biome-ignore lint/suspicious/noExplicitAny: raw OpenAPI JSON
type Json = any;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const spec: Json = JSON.parse(readFileSync(resolve(ROOT, "spec/openapi.oas.json"), "utf8"));
const MAX_DEPTH = 8;

function refName(ref: string): string {
  return ref.split("/").pop() ?? ref;
}

function resolveSchema(schema: Json): Json {
  let current = schema ?? {};
  const seen = new Set<string>();
  while (current.$ref && !seen.has(current.$ref)) {
    seen.add(current.$ref);
    const { $ref, ...siblings } = current;
    current = { ...spec.components.schemas[refName($ref)], ...siblings };
  }
  return current;
}

function scalar(schema: Json): string {
  const resolved = resolveSchema(schema);
  let text = resolved.type ?? "object";
  if (resolved.format) text += ` (${resolved.format})`;
  if (resolved.enum) text = resolved.enum.map((value: string) => JSON.stringify(value)).join(" | ");
  if (resolved.nullable) text += " | null";
  return text;
}

function renderSchema(rawSchema: Json, indent: string, depth: number, lines: string[]): void {
  const schema = resolveSchema(rawSchema);
  if (depth > MAX_DEPTH) {
    lines.push(`${indent}…`);
    return;
  }
  if (schema.oneOf) {
    lines.push(`${indent}one of:`);
    for (const branch of schema.oneOf) {
      const name = branch.$ref ? refName(branch.$ref) : "inline";
      lines.push(`${indent}  - ${name}`);
      renderSchema(branch, `${indent}      `, depth + 1, lines);
    }
    return;
  }
  const type = schema.type ?? (schema.properties ? "object" : undefined);
  if (type === "object" && schema.properties) {
    const required = new Set<string>(schema.required ?? []);
    for (const [key, child] of Object.entries<Json>(schema.properties)) {
      const resolved = resolveSchema(child);
      const marker = required.has(key) ? " (required)" : "";
      const childType = resolved.type ?? (resolved.properties ? "object" : undefined);
      if (childType === "object" && resolved.properties) {
        lines.push(`${indent}${key}${marker}${resolved.nullable ? " (nullable)" : ""}:`);
        renderSchema(child, `${indent}  `, depth + 1, lines);
      } else if (childType === "array") {
        const items = resolveSchema(resolved.items);
        const itemType = items.type ?? (items.properties || items.oneOf ? "object" : undefined);
        if (itemType === "object" || items.oneOf) {
          lines.push(`${indent}${key}${marker}: array of`);
          renderSchema(resolved.items, `${indent}  `, depth + 1, lines);
        } else {
          lines.push(`${indent}${key}${marker}: array of ${scalar(resolved.items)}`);
        }
      } else if (resolved.additionalProperties) {
        lines.push(
          `${indent}${key}${marker}: map of string to ${scalar(resolved.additionalProperties)}`
        );
      } else {
        lines.push(`${indent}${key}${marker}: ${scalar(child)}`);
      }
    }
    if (schema.anyOf) {
      lines.push(`${indent}(must also satisfy one of these requirement sets:)`);
      for (const branch of schema.anyOf) lines.push(`${indent}  - ${JSON.stringify(branch)}`);
    }
    return;
  }
  if (type === "array") {
    lines.push(`${indent}array of:`);
    renderSchema(schema.items, `${indent}  `, depth + 1, lines);
    return;
  }
  lines.push(`${indent}${scalar(schema)}`);
}

function findOperation(
  method: string,
  path: string
): { path: string; operation: Json } | undefined {
  const segments = path.split("/").filter(Boolean);
  for (const [templatePath, item] of Object.entries<Json>(spec.paths)) {
    const templateSegments = templatePath.split("/").filter(Boolean);
    if (templateSegments.length !== segments.length) continue;
    const matches = templateSegments.every(
      (segment, index) => segment.startsWith("{") || segment === segments[index]
    );
    const operation = item[method.toLowerCase()];
    if (matches && operation) return { path: templatePath, operation };
  }
  return undefined;
}

function renderParameters(operation: Json, lines: string[]): void {
  const params = (operation.parameters ?? []).filter((param: Json) => param.in === "query");
  if (!params.length) {
    lines.push("Query parameters: none", "");
    return;
  }
  const responseType = primaryResponseType(operation);
  lines.push("Query parameters:");
  for (const param of params) {
    const schema = resolveSchema(param.schema);
    const values: string[] | undefined =
      schema.type === "array" ? resolveSchema(schema.items).enum : schema.enum;
    let text = `- \`${param.name}\`${param.required ? " (required)" : ""}`;
    const isOtherFieldset =
      param.name.startsWith("fields[") && responseType && param.name !== `fields[${responseType}]`;
    if (values && !isOtherFieldset) text += `: ${values.join(", ")}`;
    if (typeof schema.maximum === "number") text += ` (max ${schema.maximum})`;
    if (param.deprecated) text += " (deprecated)";
    lines.push(text);
  }
  lines.push("");
}

function successResponse(operation: Json): { code: string; content: Json } | undefined {
  for (const [code, response] of Object.entries<Json>(operation.responses ?? {})) {
    if (code.startsWith("2")) return { code, content: response.content };
  }
  return undefined;
}

function primaryResponseType(operation: Json): string | undefined {
  const schema = successResponse(operation)?.content?.["application/json"]?.schema;
  if (!schema) return undefined;
  const data = resolveSchema(resolveSchema(schema).properties?.data);
  const resource = resolveSchema(data.type === "array" ? data.items : data);
  return resource.properties?.type?.enum?.[0];
}

function renderResponse(operation: Json, lines: string[]): void {
  const success = successResponse(operation);
  if (!success) return;
  const mediaTypes = Object.keys(success.content ?? {});
  if (!mediaTypes.length) {
    lines.push(`Response: ${success.code} with no body`, "");
    return;
  }
  const schema = success.content["application/json"]?.schema;
  if (!schema) {
    lines.push(`Response: ${success.code} ${mediaTypes.join(", ")} (not JSON)`, "");
    return;
  }
  const data = resolveSchema(resolveSchema(schema).properties?.data);
  const isList = data.type === "array";
  const resource = resolveSchema(isList ? data.items : data);
  const type = resource.properties?.type?.enum?.[0] ?? "unknown";
  lines.push(`Response: ${success.code}, data is ${isList ? "a list of" : "one"} \`${type}\``);
  const attributes = resolveSchema(resource.properties?.attributes);
  if (attributes.properties) {
    lines.push("Response attributes:");
    for (const [key, value] of Object.entries<Json>(attributes.properties)) {
      lines.push(`- ${key}: ${scalar(value)}`);
    }
  }
  lines.push("");
}

function renderOperation(line: string): string {
  const [method, path] = line.trim().split(/\s+/);
  if (!method || !path) return `Cannot parse "${line}"\n`;
  const found = findOperation(method, path);
  if (!found) return `## ${method.toUpperCase()} ${path}\n\nNOT IN SPEC\n`;

  const lines = [`## ${method.toUpperCase()} ${found.path}`, ""];
  if (found.operation.deprecated) lines.push("**Deprecated**", "");
  renderParameters(found.operation, lines);

  const body = found.operation.requestBody?.content?.["application/json"]?.schema;
  if (body) {
    lines.push(`Request body (${body.$ref ? refName(body.$ref) : "inline"}):`, "```");
    renderSchema(body, "", 0, lines);
    lines.push("```", "");
  } else {
    lines.push("Request body: none", "");
  }
  renderResponse(found.operation, lines);
  return lines.join("\n");
}

async function main(): Promise<void> {
  let inputs = process.argv.slice(2);
  if (!inputs.length && !process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    inputs = Buffer.concat(chunks).toString("utf8").split("\n");
  }
  inputs = inputs.map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  if (!inputs.length) {
    console.error('Usage: npx tsx scripts/spec-sheet.ts "METHOD /v1/path" ...');
    process.exit(1);
  }
  console.log(inputs.map(renderOperation).join("\n"));
}

main();
