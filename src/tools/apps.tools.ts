/**
 * Apps Tools - List and get app information
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse, App } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import { getAppInputSchema, listAppsInputSchema, validateInput } from "../utils/validation.js";

/**
 * List all apps in the App Store Connect account
 */
export async function listApps(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(listAppsInputSchema, input);

    const response = await client.get<ASCListResponse<App>>("/apps", {
      limit: params.limit,
      "fields[apps]": "name,bundleId,sku,primaryLocale",
    });

    return {
      success: true,
      data: response.data.map((app) => ({
        id: app.id,
        name: app.attributes.name,
        bundleId: app.attributes.bundleId,
        sku: app.attributes.sku,
        primaryLocale: app.attributes.primaryLocale,
      })),
      meta: {
        total: response.meta?.paging?.total,
        returned: response.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get details of a specific app
 */
export async function getApp(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(getAppInputSchema, input);

    const response = await client.get<ASCResponse<App>>(`/apps/${params.appId}`, {
      "fields[apps]":
        "name,bundleId,sku,primaryLocale,contentRightsDeclaration,isOrEverWasMadeForKids",
      include: "appInfos,appStoreVersions",
    });

    const app = response.data;

    return {
      success: true,
      data: {
        id: app.id,
        name: app.attributes.name,
        bundleId: app.attributes.bundleId,
        sku: app.attributes.sku,
        primaryLocale: app.attributes.primaryLocale,
        contentRightsDeclaration: app.attributes.contentRightsDeclaration,
        isOrEverWasMadeForKids: app.attributes.isOrEverWasMadeForKids,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for apps
 */
export const appsToolDefinitions = [
  {
    name: "list_apps",
    description:
      "List all apps in your App Store Connect account. Returns app IDs, names, bundle IDs, and SKUs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of apps to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
    },
  },
  {
    name: "get_app",
    description: "Get detailed information about a specific app by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID (numeric string)",
        },
      },
      required: ["appId"],
    },
  },
];
