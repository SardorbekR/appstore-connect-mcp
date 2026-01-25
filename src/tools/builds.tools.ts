/**
 * Build Tools - Manage app builds
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse, Build } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import { getBuildInputSchema, listBuildsInputSchema, validateInput } from "../utils/validation.js";

/**
 * List all builds for an app
 */
export async function listBuilds(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(listBuildsInputSchema, input);

    const response = await client.get<ASCListResponse<Build>>(`/apps/${params.appId}/builds`, {
      limit: params.limit,
      "fields[builds]":
        "version,uploadedDate,expirationDate,expired,minOsVersion,processingState,buildAudienceType,usesNonExemptEncryption",
    });

    return {
      success: true,
      data: response.data.map((build) => ({
        id: build.id,
        version: build.attributes.version,
        uploadedDate: build.attributes.uploadedDate,
        expirationDate: build.attributes.expirationDate,
        expired: build.attributes.expired,
        minOsVersion: build.attributes.minOsVersion,
        processingState: build.attributes.processingState,
        buildAudienceType: build.attributes.buildAudienceType,
        usesNonExemptEncryption: build.attributes.usesNonExemptEncryption,
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
 * Get a specific build
 */
export async function getBuild(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(getBuildInputSchema, input);

    const response = await client.get<ASCResponse<Build>>(`/builds/${params.buildId}`, {
      "fields[builds]":
        "version,uploadedDate,expirationDate,expired,minOsVersion,processingState,buildAudienceType,usesNonExemptEncryption",
    });

    const build = response.data;

    return {
      success: true,
      data: {
        id: build.id,
        version: build.attributes.version,
        uploadedDate: build.attributes.uploadedDate,
        expirationDate: build.attributes.expirationDate,
        expired: build.attributes.expired,
        minOsVersion: build.attributes.minOsVersion,
        processingState: build.attributes.processingState,
        buildAudienceType: build.attributes.buildAudienceType,
        usesNonExemptEncryption: build.attributes.usesNonExemptEncryption,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for builds
 */
export const buildsToolDefinitions = [
  {
    name: "list_builds",
    description: "List all builds for an app.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of builds to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_build",
    description: "Get details of a specific build.",
    inputSchema: {
      type: "object" as const,
      properties: {
        buildId: {
          type: "string",
          description: "The build resource ID",
        },
      },
      required: ["buildId"],
    },
  },
];
