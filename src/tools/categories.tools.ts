/**
 * Category Tools - Manage app categories and pricing
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  AppAvailability,
  AppCategory,
  AppPriceSchedule,
  Territory,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  getAppAvailabilityInputSchema,
  getAppPriceScheduleInputSchema,
  listAppCategoriesInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List all app categories
 */
export async function listAppCategories(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAppCategoriesInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      "fields[appCategories]": "platforms",
      include: "subcategories",
    };

    if (params.platform) {
      queryParams["filter[platforms]"] = params.platform;
    }

    const response = await client.get<ASCListResponse<AppCategory>>("/appCategories", queryParams);

    // Get included subcategories
    const included = (response.included ?? []) as AppCategory[];
    const subcategoriesMap = new Map<string, AppCategory>();
    for (const sub of included) {
      if (sub.type === "appCategories") {
        subcategoriesMap.set(sub.id, sub);
      }
    }

    return {
      success: true,
      data: response.data.map((category) => {
        // Get subcategory IDs from relationships
        const subcategoryData = category.relationships?.subcategories?.data;
        const subcategoryIds = Array.isArray(subcategoryData)
          ? subcategoryData.map((s) => s.id)
          : [];

        return {
          id: category.id,
          platforms: category.attributes.platforms,
          subcategories: subcategoryIds.map((id) => {
            const sub = subcategoriesMap.get(id);
            return sub
              ? {
                  id: sub.id,
                  platforms: sub.attributes.platforms,
                }
              : { id };
          }),
        };
      }),
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
 * Get app price schedule (pricing tiers)
 */
export async function getAppPriceSchedule(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getAppPriceScheduleInputSchema, input);

    const response = await client.get<ASCResponse<AppPriceSchedule>>(
      `/apps/${params.appId}/appPriceSchedule`,
      {
        include: "baseTerritory,manualPrices,automaticPrices",
      }
    );

    const schedule = response.data;
    const included = (response.included ?? []) as Array<Territory | unknown>;

    // Find the base territory from included
    let baseTerritory: { id: string; currency?: string } | undefined;
    const baseTerritoryData = schedule.relationships?.baseTerritory?.data;
    if (baseTerritoryData && !Array.isArray(baseTerritoryData)) {
      const territory = included.find(
        (item): item is Territory =>
          (item as Territory).type === "territories" &&
          (item as Territory).id === baseTerritoryData.id
      );
      if (territory) {
        baseTerritory = {
          id: territory.id,
          currency: territory.attributes.currency,
        };
      }
    }

    return {
      success: true,
      data: {
        id: schedule.id,
        baseTerritory,
        hasManualPrices:
          schedule.relationships?.manualPrices?.data !== undefined &&
          (Array.isArray(schedule.relationships.manualPrices.data)
            ? schedule.relationships.manualPrices.data.length > 0
            : true),
        hasAutomaticPrices:
          schedule.relationships?.automaticPrices?.data !== undefined &&
          (Array.isArray(schedule.relationships.automaticPrices.data)
            ? schedule.relationships.automaticPrices.data.length > 0
            : true),
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get app availability in territories
 */
export async function getAppAvailability(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getAppAvailabilityInputSchema, input);

    const response = await client.get<ASCResponse<AppAvailability>>(
      `/apps/${params.appId}/appAvailability`,
      {
        include: "availableTerritories",
        "fields[territories]": "currency",
      }
    );

    const availability = response.data;
    const included = (response.included ?? []) as Territory[];

    // Get territory details from included
    const territories = included
      .filter((item): item is Territory => item.type === "territories")
      .map((territory) => ({
        id: territory.id,
        currency: territory.attributes.currency,
      }));

    return {
      success: true,
      data: {
        id: availability.id,
        availableInNewTerritories: availability.attributes.availableInNewTerritories,
        territories,
        territoryCount: territories.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for categories
 */
export const categoriesToolDefinitions = [
  {
    name: "list_app_categories",
    description: "List all app categories available in the App Store. Can filter by platform.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of categories to return (1-200)",
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
    name: "get_app_price_schedule",
    description: "Get the price schedule for an app, including pricing information.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_app_availability",
    description:
      "Get app availability information, including which territories the app is available in.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
      },
      required: ["appId"],
    },
  },
];
