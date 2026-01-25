/**
 * App Store Versions Tools - List, get, and create app versions
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  AppStoreVersion,
  CreateAppStoreVersionRequest,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  createAppVersionInputSchema,
  getAppVersionInputSchema,
  listAppVersionsInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List all versions for an app
 */
export async function listAppVersions(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAppVersionsInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      "fields[appStoreVersions]":
        "platform,versionString,appStoreState,copyright,releaseType,createdDate",
    };

    if (params.platform) {
      queryParams["filter[platform]"] = params.platform;
    }

    if (params.versionState) {
      queryParams["filter[appStoreState]"] = params.versionState;
    }

    const response = await client.get<ASCListResponse<AppStoreVersion>>(
      `/apps/${params.appId}/appStoreVersions`,
      queryParams
    );

    return {
      success: true,
      data: response.data.map((version) => ({
        id: version.id,
        platform: version.attributes.platform,
        versionString: version.attributes.versionString,
        state: version.attributes.appStoreState,
        copyright: version.attributes.copyright,
        releaseType: version.attributes.releaseType,
        createdDate: version.attributes.createdDate,
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
 * Get details of a specific app version
 */
export async function getAppVersion(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getAppVersionInputSchema, input);

    const response = await client.get<ASCResponse<AppStoreVersion>>(
      `/appStoreVersions/${params.versionId}`,
      {
        "fields[appStoreVersions]":
          "platform,versionString,appStoreState,copyright,releaseType,earliestReleaseDate,usesIdfa,downloadable,createdDate",
      }
    );

    const version = response.data;

    return {
      success: true,
      data: {
        id: version.id,
        platform: version.attributes.platform,
        versionString: version.attributes.versionString,
        state: version.attributes.appStoreState,
        copyright: version.attributes.copyright,
        releaseType: version.attributes.releaseType,
        earliestReleaseDate: version.attributes.earliestReleaseDate,
        usesIdfa: version.attributes.usesIdfa,
        downloadable: version.attributes.downloadable,
        createdDate: version.attributes.createdDate,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a new app version
 */
export async function createAppVersion(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createAppVersionInputSchema, input);

    const requestBody: CreateAppStoreVersionRequest = {
      data: {
        type: "appStoreVersions",
        attributes: {
          platform: params.platform,
          versionString: params.versionString,
          copyright: params.copyright,
          releaseType: params.releaseType,
          earliestReleaseDate: params.earliestReleaseDate,
        },
        relationships: {
          app: {
            data: {
              type: "apps",
              id: params.appId,
            },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<AppStoreVersion>>(
      "/appStoreVersions",
      requestBody
    );

    const version = response.data;

    return {
      success: true,
      data: {
        id: version.id,
        platform: version.attributes.platform,
        versionString: version.attributes.versionString,
        state: version.attributes.appStoreState,
        copyright: version.attributes.copyright,
        releaseType: version.attributes.releaseType,
        createdDate: version.attributes.createdDate,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for versions
 */
export const versionsToolDefinitions = [
  {
    name: "list_app_versions",
    description:
      "List all App Store versions for an app. Can filter by platform and version state.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        platform: {
          type: "string",
          description: "Filter by platform (IOS, MAC_OS, TV_OS, VISION_OS)",
          enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"],
        },
        versionState: {
          type: "string",
          description: "Filter by version state (e.g., PREPARE_FOR_SUBMISSION, READY_FOR_SALE)",
        },
        limit: {
          type: "number",
          description: "Maximum number of versions to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_app_version",
    description: "Get detailed information about a specific app version.",
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: {
          type: "string",
          description: "The App Store version ID",
        },
      },
      required: ["versionId"],
    },
  },
  {
    name: "create_app_version",
    description: "Create a new App Store version for an app.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        platform: {
          type: "string",
          description: "Platform for the version",
          enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"],
        },
        versionString: {
          type: "string",
          description: "Version number (e.g., '1.0.0', '2.1')",
        },
        releaseType: {
          type: "string",
          description: "Release type",
          enum: ["MANUAL", "AFTER_APPROVAL", "SCHEDULED"],
        },
        copyright: {
          type: "string",
          description: "Copyright text for the version",
        },
        earliestReleaseDate: {
          type: "string",
          description: "Earliest release date (ISO 8601 format) for SCHEDULED release type",
        },
      },
      required: ["appId", "platform", "versionString"],
    },
  },
];
