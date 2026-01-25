/**
 * App Store Connect MCP Server
 *
 * MCP server providing tools to interact with Apple's App Store Connect API.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { type AppStoreConnectClient, createClient } from "./api/client.js";
import { type TokenManager, createTokenManagerFromEnv } from "./auth/jwt.js";
import { allToolDefinitions, executeTool, hasToolHandler } from "./tools/index.js";
import { ConfigError, formatErrorResponse } from "./utils/errors.js";

// Server metadata
const SERVER_NAME = "asc-mcp";
const SERVER_VERSION = "1.0.0";

/**
 * Initialize and run the MCP server
 */
async function main(): Promise<void> {
  // Initialize token manager and client
  let tokenManager: TokenManager;
  let client: AppStoreConnectClient;

  try {
    tokenManager = createTokenManagerFromEnv();
    client = createClient(tokenManager);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Configuration error: ${error.message}`);
      console.error("\nRequired environment variables:");
      console.error("  APP_STORE_CONNECT_KEY_ID - Your API key ID");
      console.error("  APP_STORE_CONNECT_ISSUER_ID - Your issuer ID");
      console.error("  APP_STORE_CONNECT_P8_PATH - Path to your .p8 private key file");
      console.error("  or APP_STORE_CONNECT_P8_CONTENT - Content of your .p8 private key");
      process.exit(1);
    }
    throw error;
  }

  // Create MCP server
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allToolDefinitions,
    };
  });

  // Handle call tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!hasToolHandler(name)) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: {
                  code: "UNKNOWN_TOOL",
                  message: `Unknown tool: ${name}`,
                },
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await executeTool(client, name, args ?? {});

      // Check if result indicates an error
      const isError =
        typeof result === "object" &&
        result !== null &&
        "success" in result &&
        (result as { success: boolean }).success === false;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError,
      };
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorResponse, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // Handle graceful shutdown
  const shutdown = (): void => {
    console.error("Shutting down...");
    tokenManager.destroy();
    // Allow a brief moment for cleanup before exiting
    setTimeout(() => {
      process.exit(0);
    }, 100);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (not stdout, which is used for MCP communication)
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
