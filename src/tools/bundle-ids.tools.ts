/**
 * Bundle ID Tools - Manage bundle identifiers
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  BundleId,
  CreateBundleIdRequest,
  UpdateBundleIdRequest,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  createBundleIdInputSchema,
  deleteBundleIdInputSchema,
  getBundleIdInputSchema,
  listBundleIdsInputSchema,
  updateBundleIdInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List all bundle IDs
 */
export async function listBundleIds(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listBundleIdsInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      "fields[bundleIds]": "name,identifier,platform,seedId",
    };

    if (params.platform) {
      queryParams["filter[platform]"] = params.platform;
    }

    const response = await client.get<ASCListResponse<BundleId>>("/bundleIds", queryParams);

    return {
      success: true,
      data: response.data.map((bundleId) => ({
        id: bundleId.id,
        name: bundleId.attributes.name,
        identifier: bundleId.attributes.identifier,
        platform: bundleId.attributes.platform,
        seedId: bundleId.attributes.seedId,
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
 * Get a specific bundle ID
 */
export async function getBundleId(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(getBundleIdInputSchema, input);

    const response = await client.get<ASCResponse<BundleId>>(`/bundleIds/${params.bundleIdId}`, {
      "fields[bundleIds]": "name,identifier,platform,seedId",
    });

    const bundleId = response.data;

    return {
      success: true,
      data: {
        id: bundleId.id,
        name: bundleId.attributes.name,
        identifier: bundleId.attributes.identifier,
        platform: bundleId.attributes.platform,
        seedId: bundleId.attributes.seedId,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a new bundle ID
 */
export async function createBundleId(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createBundleIdInputSchema, input);

    const requestBody: CreateBundleIdRequest = {
      data: {
        type: "bundleIds",
        attributes: {
          identifier: params.identifier,
          name: params.name,
          platform: params.platform,
        },
      },
    };

    const response = await client.post<ASCResponse<BundleId>>("/bundleIds", requestBody);

    const bundleId = response.data;

    return {
      success: true,
      data: {
        id: bundleId.id,
        name: bundleId.attributes.name,
        identifier: bundleId.attributes.identifier,
        platform: bundleId.attributes.platform,
        seedId: bundleId.attributes.seedId,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update a bundle ID (only name can be changed)
 */
export async function updateBundleId(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateBundleIdInputSchema, input);

    const requestBody: UpdateBundleIdRequest = {
      data: {
        type: "bundleIds",
        id: params.bundleIdId,
        attributes: {
          name: params.name,
        },
      },
    };

    const response = await client.patch<ASCResponse<BundleId>>(
      `/bundleIds/${params.bundleIdId}`,
      requestBody
    );

    const bundleId = response.data;

    return {
      success: true,
      data: {
        id: bundleId.id,
        name: bundleId.attributes.name,
        identifier: bundleId.attributes.identifier,
        platform: bundleId.attributes.platform,
        seedId: bundleId.attributes.seedId,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a bundle ID
 */
export async function deleteBundleId(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deleteBundleIdInputSchema, input);

    await client.delete(`/bundleIds/${params.bundleIdId}`);

    return {
      success: true,
      data: {
        deleted: true,
        bundleIdId: params.bundleIdId,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for bundle IDs
 */
export const bundleIdsToolDefinitions = [
  {
    name: "list_bundle_ids",
    description: "List all bundle IDs registered in App Store Connect. Can filter by platform.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of bundle IDs to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
        platform: {
          type: "string",
          enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"],
          description: "Filter by platform",
        },
      },
      required: [],
    },
  },
  {
    name: "get_bundle_id",
    description: "Get details of a specific bundle ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundleIdId: {
          type: "string",
          description: "The bundle ID resource ID",
        },
      },
      required: ["bundleIdId"],
    },
  },
  {
    name: "create_bundle_id",
    description:
      "Register a new bundle ID in App Store Connect. The identifier must be unique and follow reverse-domain notation (e.g., com.example.app).",
    inputSchema: {
      type: "object" as const,
      properties: {
        identifier: {
          type: "string",
          description: "The bundle identifier (e.g., com.example.app)",
        },
        name: {
          type: "string",
          description: "A name for the bundle ID",
        },
        platform: {
          type: "string",
          enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"],
          description: "The platform for this bundle ID",
        },
      },
      required: ["identifier", "name", "platform"],
    },
  },
  {
    name: "update_bundle_id",
    description: "Update a bundle ID's name. Note: The identifier cannot be changed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundleIdId: {
          type: "string",
          description: "The bundle ID resource ID",
        },
        name: {
          type: "string",
          description: "The new name for the bundle ID",
        },
      },
      required: ["bundleIdId", "name"],
    },
  },
  {
    name: "delete_bundle_id",
    description:
      "Delete a bundle ID. Note: This cannot be undone and may affect apps using this bundle ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bundleIdId: {
          type: "string",
          description: "The bundle ID resource ID to delete",
        },
      },
      required: ["bundleIdId"],
    },
  },
];
