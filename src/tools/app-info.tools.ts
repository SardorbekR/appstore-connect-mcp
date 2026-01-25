/**
 * App Info Localizations Tools - Manage app-level localizations (name, subtitle, privacy)
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  AppInfo,
  AppInfoLocalization,
  UpdateAppInfoLocalizationRequest,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  getAppInfosInputSchema,
  listAppInfoLocalizationsInputSchema,
  updateAppInfoLocalizationInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List app infos for an app (needed to get appInfoId for localizations)
 */
export async function listAppInfos(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getAppInfosInputSchema, input);

    const response = await client.get<ASCListResponse<AppInfo>>(`/apps/${params.appId}/appInfos`, {
      limit: params.limit,
      "fields[appInfos]": "appStoreState,appStoreAgeRating",
    });

    return {
      success: true,
      data: response.data.map((info) => ({
        id: info.id,
        appStoreState: info.attributes.appStoreState,
        appStoreAgeRating: info.attributes.appStoreAgeRating,
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
 * List all localizations for an app info
 */
export async function listAppInfoLocalizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAppInfoLocalizationsInputSchema, input);

    const response = await client.get<ASCListResponse<AppInfoLocalization>>(
      `/appInfos/${params.appInfoId}/appInfoLocalizations`,
      {
        limit: params.limit,
        "fields[appInfoLocalizations]":
          "locale,name,subtitle,privacyPolicyUrl,privacyChoicesUrl,privacyPolicyText",
      }
    );

    return {
      success: true,
      data: response.data.map((loc) => ({
        id: loc.id,
        locale: loc.attributes.locale,
        name: loc.attributes.name,
        subtitle: loc.attributes.subtitle,
        privacyPolicyUrl: loc.attributes.privacyPolicyUrl,
        privacyChoicesUrl: loc.attributes.privacyChoicesUrl,
        privacyPolicyText: loc.attributes.privacyPolicyText,
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
 * Update an app info localization
 */
export async function updateAppInfoLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateAppInfoLocalizationInputSchema, input);

    const requestBody: UpdateAppInfoLocalizationRequest = {
      data: {
        type: "appInfoLocalizations",
        id: params.localizationId,
        attributes: {
          name: params.name,
          subtitle: params.subtitle,
          privacyPolicyUrl: params.privacyPolicyUrl,
          privacyChoicesUrl: params.privacyChoicesUrl,
          privacyPolicyText: params.privacyPolicyText,
        },
      },
    };

    const response = await client.patch<ASCResponse<AppInfoLocalization>>(
      `/appInfoLocalizations/${params.localizationId}`,
      requestBody
    );

    const loc = response.data;

    return {
      success: true,
      data: {
        id: loc.id,
        locale: loc.attributes.locale,
        name: loc.attributes.name,
        subtitle: loc.attributes.subtitle,
        privacyPolicyUrl: loc.attributes.privacyPolicyUrl,
        privacyChoicesUrl: loc.attributes.privacyChoicesUrl,
        privacyPolicyText: loc.attributes.privacyPolicyText,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for app info localizations
 */
export const appInfoToolDefinitions = [
  {
    name: "list_app_infos",
    description:
      "List app info records for an app. Use this to get the appInfoId needed for localization operations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "list_app_info_localizations",
    description:
      "List all localizations for an app info. Returns app name, subtitle, and privacy policy info for each locale.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appInfoId: {
          type: "string",
          description: "The App Info ID (get this from list_app_infos)",
        },
        limit: {
          type: "number",
          description: "Maximum number of localizations to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["appInfoId"],
    },
  },
  {
    name: "update_app_info_localization",
    description:
      "Update an app info localization. Use this to change app name, subtitle, or privacy policy URL for a locale.",
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The app info localization ID to update",
        },
        name: {
          type: "string",
          description: "App name (max 30 characters)",
        },
        subtitle: {
          type: "string",
          description: "App subtitle (max 30 characters)",
        },
        privacyPolicyUrl: {
          type: "string",
          description: "Privacy policy URL (HTTPS only)",
        },
        privacyChoicesUrl: {
          type: "string",
          description: "Privacy choices URL (HTTPS only)",
        },
        privacyPolicyText: {
          type: "string",
          description: "Privacy policy text (for apps without a URL)",
        },
      },
      required: ["localizationId"],
    },
  },
];
