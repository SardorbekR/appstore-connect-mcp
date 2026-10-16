/**
 * Product Page Tools - Custom product pages, their versions, and per-locale promotional text.
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse } from "../api/types.js";
import { ValidationError, formatErrorResponse } from "../utils/errors.js";
import { localeSchema, resourceIdSchema, validateInput } from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Types
// ============================================================================

const CUSTOM_PRODUCT_PAGE_VERSION_STATES = [
  "PREPARE_FOR_SUBMISSION",
  "READY_FOR_REVIEW",
  "WAITING_FOR_REVIEW",
  "IN_REVIEW",
  "ACCEPTED",
  "APPROVED",
  "REPLACED_WITH_NEW_VERSION",
  "REJECTED",
] as const;

type CustomProductPageVersionState = (typeof CUSTOM_PRODUCT_PAGE_VERSION_STATES)[number];

interface CustomProductPageResource {
  type: "appCustomProductPages";
  id: string;
  attributes: {
    name?: string;
    url?: string;
    visible?: boolean;
  };
}

interface CustomProductPageVersionResource {
  type: "appCustomProductPageVersions";
  id: string;
  attributes: {
    version?: string;
    state?: CustomProductPageVersionState;
    deepLink?: string | null;
  };
}

interface CustomProductPageLocalizationResource {
  type: "appCustomProductPageLocalizations";
  id: string;
  attributes: {
    locale?: string;
    promotionalText?: string | null;
  };
}

// ============================================================================
// Input schemas
// ============================================================================

const limitSchema = z.number().int().min(1).max(200).optional();
const customProductPageVersionStateSchema = z.enum(CUSTOM_PRODUCT_PAGE_VERSION_STATES);

const listCustomProductPagesInputSchema = z.object({
  appId: resourceIdSchema,
  visible: z.boolean().optional(),
  limit: limitSchema,
});

const customProductPageIdInputSchema = z.object({ customProductPageId: resourceIdSchema });

const createCustomProductPageInputSchema = z.object({
  appId: resourceIdSchema,
  name: z.string().min(1),
  locale: localeSchema.optional(),
  promotionalText: z.string().min(1).optional(),
  deepLink: z.string().url().optional(),
});

// Temporary IDs that link the inline first version and localization within one create request
const NEW_VERSION_ID = "${new-appCustomProductPageVersion}";
const NEW_LOCALIZATION_ID = "${new-appCustomProductPageLocalization}";

const updateCustomProductPageInputSchema = z
  .object({
    customProductPageId: resourceIdSchema,
    name: z.string().min(1).optional(),
    visible: z.boolean().optional(),
  })
  .refine((input) => input.name !== undefined || input.visible !== undefined, {
    message: "Provide at least one field to update",
  });

const listCppVersionsInputSchema = z.object({
  customProductPageId: resourceIdSchema,
  states: z.array(customProductPageVersionStateSchema).min(1).optional(),
  limit: limitSchema,
});

const createCppVersionInputSchema = z.object({
  customProductPageId: resourceIdSchema,
  deepLink: z.string().url().optional(),
});

const listCppLocalizationsInputSchema = z.object({
  versionId: resourceIdSchema,
  locales: z.array(localeSchema).min(1).optional(),
  limit: limitSchema,
});

const createCppLocalizationInputSchema = z.object({
  versionId: resourceIdSchema,
  locale: localeSchema,
  promotionalText: z.string().nullable().optional(),
});

const updateCppLocalizationInputSchema = z.object({
  localizationId: resourceIdSchema,
  promotionalText: z.string().nullable(),
});

const localizationIdInputSchema = z.object({ localizationId: resourceIdSchema });

// ============================================================================
// Helpers
// ============================================================================

/** Copy only the fields the caller set, so PATCH never clears untouched attributes. */
function pickDefined<T extends Record<string, unknown>>(source: T, keys: readonly (keyof T)[]) {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) picked[key as string] = source[key];
  }
  return picked;
}

/** Drop unset query parameters so the request carries only the filters the caller asked for. */
function definedQuery(query: Record<string, string | number | undefined>) {
  const defined: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) defined[key] = value;
  }
  return defined;
}

function formatCustomProductPage(page: CustomProductPageResource) {
  return {
    id: page.id,
    name: page.attributes.name,
    url: page.attributes.url,
    visible: page.attributes.visible,
  };
}

function formatCppVersion(version: CustomProductPageVersionResource) {
  return {
    id: version.id,
    version: version.attributes.version,
    state: version.attributes.state,
    deepLink: version.attributes.deepLink,
  };
}

function formatCppLocalization(localization: CustomProductPageLocalizationResource) {
  return {
    id: localization.id,
    locale: localization.attributes.locale,
    promotionalText: localization.attributes.promotionalText,
  };
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * List the custom product pages of an app, optionally only visible or only hidden ones
 */
export async function listCustomProductPages(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listCustomProductPagesInputSchema, input);
    const response = await client.get<ASCListResponse<CustomProductPageResource>>(
      `/apps/${params.appId}/appCustomProductPages`,
      definedQuery({
        "filter[visible]": params.visible === undefined ? undefined : String(params.visible),
        limit: params.limit,
      })
    );
    return {
      success: true,
      data: response.data.map(formatCustomProductPage),
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
 * Get one custom product page by ID
 */
export async function getCustomProductPage(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(customProductPageIdInputSchema, input);
    const response = await client.get<ASCResponse<CustomProductPageResource>>(
      `/appCustomProductPages/${params.customProductPageId}`
    );
    return { success: true, data: formatCustomProductPage(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a custom product page for an app
 */
export async function createCustomProductPage(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createCustomProductPageInputSchema, input);

    // A page is created together with its first version and one localization
    // (the app's primary locale unless another is given), as App Store Connect does.
    let locale = params.locale;
    if (!locale) {
      const app = await client.get<ASCResponse<{ attributes: { primaryLocale?: string } }>>(
        `/apps/${params.appId}`,
        { "fields[apps]": "primaryLocale" }
      );
      locale = app.data.attributes.primaryLocale;
      if (!locale) {
        throw new ValidationError("Could not read the app's primary locale; pass locale", "locale");
      }
    }

    const response = await client.post<ASCResponse<CustomProductPageResource>>(
      "/appCustomProductPages",
      {
        data: {
          type: "appCustomProductPages",
          attributes: { name: params.name },
          relationships: {
            app: { data: { type: "apps", id: params.appId } },
            appCustomProductPageVersions: {
              data: [{ type: "appCustomProductPageVersions", id: NEW_VERSION_ID }],
            },
          },
        },
        included: [
          {
            type: "appCustomProductPageVersions",
            id: NEW_VERSION_ID,
            ...(params.deepLink ? { attributes: { deepLink: params.deepLink } } : {}),
            relationships: {
              appCustomProductPageLocalizations: {
                data: [{ type: "appCustomProductPageLocalizations", id: NEW_LOCALIZATION_ID }],
              },
            },
          },
          {
            type: "appCustomProductPageLocalizations",
            id: NEW_LOCALIZATION_ID,
            attributes: {
              locale,
              ...(params.promotionalText ? { promotionalText: params.promotionalText } : {}),
            },
          },
        ],
      }
    );
    return { success: true, data: formatCustomProductPage(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update a custom product page's name or visibility (only the fields provided are changed)
 */
export async function updateCustomProductPage(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateCustomProductPageInputSchema, input);
    const response = await client.patch<ASCResponse<CustomProductPageResource>>(
      `/appCustomProductPages/${params.customProductPageId}`,
      {
        data: {
          type: "appCustomProductPages",
          id: params.customProductPageId,
          attributes: pickDefined(params, ["name", "visible"]),
        },
      }
    );
    return { success: true, data: formatCustomProductPage(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a custom product page by ID
 */
export async function deleteCustomProductPage(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(customProductPageIdInputSchema, input);
    await client.delete(`/appCustomProductPages/${params.customProductPageId}`);
    return {
      success: true,
      data: { deleted: true, customProductPageId: params.customProductPageId },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List the versions of a custom product page, optionally filtered by review state
 */
export async function listCppVersions(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listCppVersionsInputSchema, input);
    const response = await client.get<ASCListResponse<CustomProductPageVersionResource>>(
      `/appCustomProductPages/${params.customProductPageId}/appCustomProductPageVersions`,
      definedQuery({
        "filter[state]": params.states?.join(","),
        limit: params.limit,
      })
    );
    return {
      success: true,
      data: response.data.map(formatCppVersion),
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
 * Create a new version of a custom product page
 */
export async function createCppVersion(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createCppVersionInputSchema, input);
    const response = await client.post<ASCResponse<CustomProductPageVersionResource>>(
      "/appCustomProductPageVersions",
      {
        data: {
          type: "appCustomProductPageVersions",
          attributes: pickDefined(params, ["deepLink"]),
          relationships: {
            appCustomProductPage: {
              data: { type: "appCustomProductPages", id: params.customProductPageId },
            },
          },
        },
      }
    );
    return { success: true, data: formatCppVersion(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List the per-locale localizations of a custom product page version
 */
export async function listCppLocalizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listCppLocalizationsInputSchema, input);
    const response = await client.get<ASCListResponse<CustomProductPageLocalizationResource>>(
      `/appCustomProductPageVersions/${params.versionId}/appCustomProductPageLocalizations`,
      definedQuery({
        "filter[locale]": params.locales?.join(","),
        limit: params.limit,
      })
    );
    return {
      success: true,
      data: response.data.map(formatCppLocalization),
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
 * Add a locale with its promotional text to a custom product page version
 */
export async function createCppLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createCppLocalizationInputSchema, input);
    const response = await client.post<ASCResponse<CustomProductPageLocalizationResource>>(
      "/appCustomProductPageLocalizations",
      {
        data: {
          type: "appCustomProductPageLocalizations",
          attributes: pickDefined(params, ["locale", "promotionalText"]),
          relationships: {
            appCustomProductPageVersion: {
              data: { type: "appCustomProductPageVersions", id: params.versionId },
            },
          },
        },
      }
    );
    return { success: true, data: formatCppLocalization(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Set the promotional text of a custom product page localization (null clears it)
 */
export async function updateCppLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateCppLocalizationInputSchema, input);
    const response = await client.patch<ASCResponse<CustomProductPageLocalizationResource>>(
      `/appCustomProductPageLocalizations/${params.localizationId}`,
      {
        data: {
          type: "appCustomProductPageLocalizations",
          id: params.localizationId,
          attributes: { promotionalText: params.promotionalText },
        },
      }
    );
    return { success: true, data: formatCppLocalization(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a custom product page localization by ID
 */
export async function deleteCppLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(localizationIdInputSchema, input);
    await client.delete(`/appCustomProductPageLocalizations/${params.localizationId}`);
    return { success: true, data: { deleted: true, localizationId: params.localizationId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

export const productPageToolDefinitions = [
  {
    name: "list_custom_product_pages",
    description: "List the custom product pages of an app, optionally filtered by visibility.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        visible: {
          type: "boolean",
          description: "Only return visible (true) or hidden (false) pages",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Maximum number of pages to return (1-200)",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_custom_product_page",
    description: "Get one custom product page by ID.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        customProductPageId: { type: "string", description: "The custom product page ID" },
      },
      required: ["customProductPageId"],
    },
  },
  {
    name: "create_custom_product_page",
    description:
      "Create a custom product page for an app, with its first version and one localization (the app's primary locale unless locale is given).",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        name: { type: "string", minLength: 1, description: "Internal name for the page" },
        locale: {
          type: "string",
          description:
            "Locale of the first localization, e.g. en-US (default: the app's primary locale)",
        },
        promotionalText: { type: "string", description: "Promotional text for that localization" },
        deepLink: {
          type: "string",
          description: "Optional deep link URL for the page's first version",
        },
      },
      required: ["appId", "name"],
    },
  },
  {
    name: "update_custom_product_page",
    description:
      "Update a custom product page's name or visibility. Only the fields provided are changed.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        customProductPageId: { type: "string", description: "The custom product page ID" },
        name: { type: "string", minLength: 1, description: "New internal name for the page" },
        visible: {
          type: "boolean",
          description: "Whether the page is visible to users",
        },
      },
      required: ["customProductPageId"],
    },
  },
  {
    name: "delete_custom_product_page",
    description: "Delete a custom product page by ID.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        customProductPageId: {
          type: "string",
          description: "The custom product page ID to delete",
        },
      },
      required: ["customProductPageId"],
    },
  },
  {
    name: "list_cpp_versions",
    description: "List the versions of a custom product page, optionally filtered by review state.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        customProductPageId: { type: "string", description: "The custom product page ID" },
        states: {
          type: "array",
          minItems: 1,
          items: { type: "string", enum: [...CUSTOM_PRODUCT_PAGE_VERSION_STATES] },
          description: "Only return versions in these states",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Maximum number of versions to return (1-200)",
        },
      },
      required: ["customProductPageId"],
    },
  },
  {
    name: "create_cpp_version",
    description:
      "Create a new version of a custom product page, optionally with a deep link. Add localizations with create_cpp_localization.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        customProductPageId: { type: "string", description: "The custom product page ID" },
        deepLink: {
          type: "string",
          format: "uri",
          description: "Deep link the page opens in the app, e.g. myapp://summer",
        },
      },
      required: ["customProductPageId"],
    },
  },
  {
    name: "list_cpp_localizations",
    description:
      "List the per-locale localizations of a custom product page version, optionally filtered by locale.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The custom product page version ID" },
        locales: {
          type: "array",
          minItems: 1,
          items: { type: "string" },
          description: "Only return localizations for these locales, e.g. en-US",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Maximum number of localizations to return (1-200)",
        },
      },
      required: ["versionId"],
    },
  },
  {
    name: "create_cpp_localization",
    description:
      "Add a locale with promotional text to a custom product page version. Fails if the locale already exists on that version.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The custom product page version ID" },
        locale: { type: "string", description: "Locale code, e.g. en-US" },
        promotionalText: {
          type: ["string", "null"],
          description: "Promotional text shown on the page",
        },
      },
      required: ["versionId", "locale"],
    },
  },
  {
    name: "update_cpp_localization",
    description:
      "Set the promotional text of a custom product page localization. Pass null to clear it.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: { type: "string", description: "The custom product page localization ID" },
        promotionalText: {
          type: ["string", "null"],
          description: "New promotional text, or null to clear it",
        },
      },
      required: ["localizationId", "promotionalText"],
    },
  },
  {
    name: "delete_cpp_localization",
    description: "Delete a custom product page localization by ID.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The custom product page localization ID to delete",
        },
      },
      required: ["localizationId"],
    },
  },
];

export const productPagesToolsModule: ToolModule = {
  toolset: "product-pages",
  definitions: productPageToolDefinitions,
  handlers: {
    list_custom_product_pages: listCustomProductPages,
    get_custom_product_page: getCustomProductPage,
    create_custom_product_page: createCustomProductPage,
    update_custom_product_page: updateCustomProductPage,
    delete_custom_product_page: deleteCustomProductPage,
    list_cpp_versions: listCppVersions,
    create_cpp_version: createCppVersion,
    list_cpp_localizations: listCppLocalizations,
    create_cpp_localization: createCppLocalization,
    update_cpp_localization: updateCppLocalization,
    delete_cpp_localization: deleteCppLocalization,
  },
};
