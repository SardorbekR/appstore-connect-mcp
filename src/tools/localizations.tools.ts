/**
 * App Store Version Localizations Tools - CRUD operations for version localizations
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  AppStoreVersionLocalization,
  CreateAppStoreVersionLocalizationRequest,
  UpdateAppStoreVersionLocalizationRequest,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  createVersionLocalizationInputSchema,
  deleteVersionLocalizationInputSchema,
  getVersionLocalizationInputSchema,
  listVersionLocalizationsInputSchema,
  updateVersionLocalizationInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List all localizations for an app version
 */
export async function listVersionLocalizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listVersionLocalizationsInputSchema, input);

    const response = await client.get<ASCListResponse<AppStoreVersionLocalization>>(
      `/appStoreVersions/${params.versionId}/appStoreVersionLocalizations`,
      {
        limit: params.limit,
        "fields[appStoreVersionLocalizations]":
          "locale,description,keywords,marketingUrl,promotionalText,supportUrl,whatsNew",
      }
    );

    return {
      success: true,
      data: response.data.map((loc) => ({
        id: loc.id,
        locale: loc.attributes.locale,
        description: loc.attributes.description,
        keywords: loc.attributes.keywords,
        marketingUrl: loc.attributes.marketingUrl,
        promotionalText: loc.attributes.promotionalText,
        supportUrl: loc.attributes.supportUrl,
        whatsNew: loc.attributes.whatsNew,
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
 * Get details of a specific version localization
 */
export async function getVersionLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getVersionLocalizationInputSchema, input);

    const response = await client.get<ASCResponse<AppStoreVersionLocalization>>(
      `/appStoreVersionLocalizations/${params.localizationId}`,
      {
        "fields[appStoreVersionLocalizations]":
          "locale,description,keywords,marketingUrl,promotionalText,supportUrl,whatsNew",
      }
    );

    const loc = response.data;

    return {
      success: true,
      data: {
        id: loc.id,
        locale: loc.attributes.locale,
        description: loc.attributes.description,
        keywords: loc.attributes.keywords,
        marketingUrl: loc.attributes.marketingUrl,
        promotionalText: loc.attributes.promotionalText,
        supportUrl: loc.attributes.supportUrl,
        whatsNew: loc.attributes.whatsNew,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a new version localization
 */
export async function createVersionLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createVersionLocalizationInputSchema, input);

    const requestBody: CreateAppStoreVersionLocalizationRequest = {
      data: {
        type: "appStoreVersionLocalizations",
        attributes: {
          locale: params.locale,
          description: params.description,
          keywords: params.keywords,
          marketingUrl: params.marketingUrl,
          promotionalText: params.promotionalText,
          supportUrl: params.supportUrl,
          whatsNew: params.whatsNew,
        },
        relationships: {
          appStoreVersion: {
            data: {
              type: "appStoreVersions",
              id: params.versionId,
            },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<AppStoreVersionLocalization>>(
      "/appStoreVersionLocalizations",
      requestBody
    );

    const loc = response.data;

    return {
      success: true,
      data: {
        id: loc.id,
        locale: loc.attributes.locale,
        description: loc.attributes.description,
        keywords: loc.attributes.keywords,
        marketingUrl: loc.attributes.marketingUrl,
        promotionalText: loc.attributes.promotionalText,
        supportUrl: loc.attributes.supportUrl,
        whatsNew: loc.attributes.whatsNew,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update an existing version localization
 */
export async function updateVersionLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateVersionLocalizationInputSchema, input);

    const requestBody: UpdateAppStoreVersionLocalizationRequest = {
      data: {
        type: "appStoreVersionLocalizations",
        id: params.localizationId,
        attributes: {
          description: params.description,
          keywords: params.keywords,
          marketingUrl: params.marketingUrl,
          promotionalText: params.promotionalText,
          supportUrl: params.supportUrl,
          whatsNew: params.whatsNew,
        },
      },
    };

    const response = await client.patch<ASCResponse<AppStoreVersionLocalization>>(
      `/appStoreVersionLocalizations/${params.localizationId}`,
      requestBody
    );

    const loc = response.data;

    return {
      success: true,
      data: {
        id: loc.id,
        locale: loc.attributes.locale,
        description: loc.attributes.description,
        keywords: loc.attributes.keywords,
        marketingUrl: loc.attributes.marketingUrl,
        promotionalText: loc.attributes.promotionalText,
        supportUrl: loc.attributes.supportUrl,
        whatsNew: loc.attributes.whatsNew,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a version localization
 */
export async function deleteVersionLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deleteVersionLocalizationInputSchema, input);

    await client.delete(`/appStoreVersionLocalizations/${params.localizationId}`);

    return {
      success: true,
      data: {
        deleted: true,
        localizationId: params.localizationId,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for localizations
 */
export const localizationsToolDefinitions = [
  {
    name: "list_version_localizations",
    description:
      "List all localizations for an App Store version. Returns description, keywords, what's new, and URLs for each locale.",
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: {
          type: "string",
          description: "The App Store version ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of localizations to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["versionId"],
    },
  },
  {
    name: "get_version_localization",
    description: "Get detailed information about a specific version localization.",
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The localization ID",
        },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "create_version_localization",
    description:
      "Create a new localization for an App Store version. Add descriptions, keywords, and other metadata in a specific locale.",
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: {
          type: "string",
          description: "The App Store version ID",
        },
        locale: {
          type: "string",
          description: "Locale code (e.g., 'en-US', 'ja', 'zh-Hans')",
        },
        description: {
          type: "string",
          description: "App description (max 4000 characters)",
        },
        keywords: {
          type: "string",
          description: "Keywords for search (max 100 characters, comma-separated)",
        },
        whatsNew: {
          type: "string",
          description: "What's new in this version (max 4000 characters)",
        },
        promotionalText: {
          type: "string",
          description: "Promotional text (max 170 characters)",
        },
        marketingUrl: {
          type: "string",
          description: "Marketing URL (HTTPS only)",
        },
        supportUrl: {
          type: "string",
          description: "Support URL (HTTPS only)",
        },
      },
      required: ["versionId", "locale"],
    },
  },
  {
    name: "update_version_localization",
    description: "Update an existing version localization. Only provided fields will be updated.",
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The localization ID to update",
        },
        description: {
          type: "string",
          description: "App description (max 4000 characters)",
        },
        keywords: {
          type: "string",
          description: "Keywords for search (max 100 characters, comma-separated)",
        },
        whatsNew: {
          type: "string",
          description: "What's new in this version (max 4000 characters)",
        },
        promotionalText: {
          type: "string",
          description: "Promotional text (max 170 characters)",
        },
        marketingUrl: {
          type: "string",
          description: "Marketing URL (HTTPS only)",
        },
        supportUrl: {
          type: "string",
          description: "Support URL (HTTPS only)",
        },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "delete_version_localization",
    description: "Delete a version localization. Cannot delete the primary locale.",
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The localization ID to delete",
        },
      },
      required: ["localizationId"],
    },
  },
];
