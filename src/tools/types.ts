/**
 * Shared tool module contract.
 *
 * Every tool file exports one ToolModule; the registry (./index.ts) only spreads modules,
 * so adding a domain never requires touching another domain's code.
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type { Toolset } from "../config.js";

export type ToolHandler = (client: AppStoreConnectClient, input: unknown) => Promise<unknown>;

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  annotations?: ToolAnnotations;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolModule {
  toolset: Toolset;
  definitions: readonly ToolDefinition[];
  handlers: Readonly<Record<string, ToolHandler>>;
  /**
   * Definitions to expose in read-only mode. Defaults to the definitions marked
   * `readOnlyHint: true`; a module can supply narrowed variants instead.
   */
  readOnlyDefinitions?: readonly ToolDefinition[];
}
