/**
 * Tool registry: module consistency, toolset filtering, and read-only exposure.
 */

import { describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import { TOOLSETS, parseToolsets } from "../src/config.js";
import { allToolModules, assertModulesConsistent, createToolRegistry } from "../src/tools/index.js";
import type { ToolModule } from "../src/tools/types.js";

describe("tool registry", () => {
  it("has unique names and exactly one handler per definition", () => {
    expect(() => assertModulesConsistent(allToolModules)).not.toThrow();
  });

  it("rejects a module whose definition has no handler", () => {
    const broken: ToolModule = {
      toolset: "apps",
      definitions: [{ name: "orphan", description: "x", inputSchema: { type: "object" } }],
      handlers: {},
    };
    expect(() => assertModulesConsistent([broken])).toThrow("orphan");
  });

  it("uses only known toolsets", () => {
    for (const module of allToolModules) {
      expect(TOOLSETS).toContain(module.toolset);
    }
  });

  it("exposes only the selected toolsets", () => {
    const registry = createToolRegistry({ toolsets: parseToolsets("api"), readOnly: false });
    expect(registry.definitions.map((definition) => definition.name).sort()).toEqual([
      "asc_api_describe",
      "asc_api_request",
      "asc_api_search",
    ]);
    expect(registry.has("list_apps")).toBe(false);
  });

  it("rejects unknown toolset names with the list of valid ones", () => {
    expect(() => parseToolsets("apps,gamecenter")).toThrow(/gamecenter.*Valid toolsets/);
    expect(parseToolsets("")).toBeUndefined();
    expect(parseToolsets("all")).toBeUndefined();
  });

  describe("read-only mode", () => {
    const registry = createToolRegistry({ readOnly: true });

    it("lists only read tools", () => {
      expect(registry.definitions.length).toBeGreaterThan(0);
      for (const definition of registry.definitions) {
        expect(definition.annotations?.readOnlyHint, definition.name).toBe(true);
      }
    });

    it("exposes asc_api_request as a GET-only variant", () => {
      const request = registry.definitions.find(
        (definition) => definition.name === "asc_api_request"
      );
      expect(
        (request?.inputSchema.properties?.method as { enum: string[] } | undefined)?.enum
      ).toEqual(["GET"]);
    });

    it("rejects calls to write tools at dispatch", async () => {
      const client = { post: vi.fn() } as unknown as AppStoreConnectClient;
      expect(registry.has("create_app_version")).toBe(false);
      const result = await registry.execute(client, "create_app_version", {});
      expect(result).toMatchObject({ success: false, error: { code: "UNKNOWN_TOOL" } });
    });
  });
});
