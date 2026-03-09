/**
 * Pricing Tools - Manage app pricing and Purchase Power Parity (PPP)
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  AppPricePoint,
  AppPriceSchedule,
  CreateAppPriceScheduleRequest,
  Territory,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  getPricePointEqualizationsInputSchema,
  listAppPricePointsInputSchema,
  listTerritoriesInputSchema,
  setAppPricesInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List all App Store territories with their currencies
 */
export async function listTerritories(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listTerritoriesInputSchema, input);

    const response = await client.get<ASCListResponse<Territory>>("/territories", {
      limit: params.limit,
      "fields[territories]": "currency",
    });

    return {
      success: true,
      data: response.data.map((territory) => ({
        id: territory.id,
        currency: territory.attributes.currency,
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
 * List available price points for an app, optionally filtered by territory
 */
export async function listAppPricePoints(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAppPricePointsInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      "fields[appPricePoints]": "customerPrice,proceeds",
      include: "territory",
    };

    if (params.territory) {
      queryParams["filter[territory]"] = params.territory;
    }

    const response = await client.get<ASCListResponse<AppPricePoint>>(
      `/apps/${params.appId}/appPricePoints`,
      queryParams
    );

    const included = (response.included ?? []) as Territory[];
    const territoryMap = new Map<string, Territory>();
    for (const item of included) {
      if ((item as { type: string }).type === "territories") {
        territoryMap.set(item.id, item);
      }
    }

    return {
      success: true,
      data: response.data.map((pricePoint) => {
        const territoryData = pricePoint.relationships?.territory?.data;
        const territoryId =
          territoryData && !Array.isArray(territoryData) ? territoryData.id : undefined;
        const territory = territoryId ? territoryMap.get(territoryId) : undefined;

        return {
          id: pricePoint.id,
          customerPrice: pricePoint.attributes.customerPrice,
          proceeds: pricePoint.attributes.proceeds,
          territory: territory
            ? { id: territory.id, currency: territory.attributes.currency }
            : territoryId
              ? { id: territoryId }
              : undefined,
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
 * Get Apple's equivalent price points in other territories for a given price point (PPP)
 */
export async function getPricePointEqualizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getPricePointEqualizationsInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      "fields[appPricePoints]": "customerPrice,proceeds",
      include: "territory",
    };

    if (params.territories && params.territories.length > 0) {
      queryParams["filter[territory]"] = params.territories.join(",");
    }

    // Equalizations endpoint is v3
    const response = await client.get<ASCListResponse<AppPricePoint>>(
      `/v3/appPricePoints/${params.pricePointId}/equalizations`,
      queryParams
    );

    const included = (response.included ?? []) as Territory[];
    const territoryMap = new Map<string, Territory>();
    for (const item of included) {
      if ((item as { type: string }).type === "territories") {
        territoryMap.set(item.id, item);
      }
    }

    return {
      success: true,
      data: response.data.map((pricePoint) => {
        const territoryData = pricePoint.relationships?.territory?.data;
        const territoryId =
          territoryData && !Array.isArray(territoryData) ? territoryData.id : undefined;
        const territory = territoryId ? territoryMap.get(territoryId) : undefined;

        return {
          id: pricePoint.id,
          customerPrice: pricePoint.attributes.customerPrice,
          proceeds: pricePoint.attributes.proceeds,
          territory: territory
            ? { id: territory.id, currency: territory.attributes.currency }
            : territoryId
              ? { id: territoryId }
              : undefined,
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
 * Set per-territory manual pricing for an app (replaces entire price schedule)
 */
export async function setAppPrices(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(setAppPricesInputSchema, input);

    const manualPricesData: Array<{ type: "appPrices"; id: string }> = [];
    const includedPrices: CreateAppPriceScheduleRequest["included"] = [];

    for (const entry of params.manualPrices) {
      const tempId = `\${${entry.territory}-price}`;

      manualPricesData.push({ type: "appPrices", id: tempId });

      includedPrices.push({
        type: "appPrices",
        id: tempId,
        attributes: { startDate: null },
        relationships: {
          appPricePoint: {
            data: { type: "appPricePoints", id: entry.pricePointId },
          },
        },
      });
    }

    const requestBody: CreateAppPriceScheduleRequest = {
      data: {
        type: "appPriceSchedules",
        relationships: {
          app: {
            data: { type: "apps", id: params.appId },
          },
          baseTerritory: {
            data: { type: "territories", id: params.baseTerritory },
          },
          manualPrices: {
            data: manualPricesData,
          },
        },
      },
      included: includedPrices,
    };

    const response = await client.post<ASCResponse<AppPriceSchedule>>(
      "/appPriceSchedules",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        appId: params.appId,
        baseTerritory: params.baseTerritory,
        manualPricesCount: params.manualPrices.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for pricing
 */
export const pricingToolDefinitions = [
  {
    name: "list_territories",
    description:
      "List all App Store territories (countries/regions) with their currencies. Useful for understanding which markets are available for pricing.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of territories to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: [],
    },
  },
  {
    name: "list_app_price_points",
    description:
      "List available price points for an app. Each price point represents a possible price tier showing customer price and developer proceeds in local currency. Filter by territory to see prices for a specific country.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        territory: {
          type: "string",
          description: "Filter by territory (3-letter code, e.g., USA, GBR, JPN)",
        },
        limit: {
          type: "number",
          description: "Maximum number of price points to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_price_point_equalizations",
    description:
      "Get Apple's equivalent price points in other territories for a given price point. This is the core Purchase Power Parity (PPP) data — shows what Apple considers equivalent pricing across countries. Use list_app_price_points first to get a price point ID.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        pricePointId: {
          type: "string",
          description: "The price point ID (from list_app_price_points)",
        },
        territories: {
          type: "array",
          items: { type: "string" },
          description:
            "Filter to specific territories (3-letter codes, e.g., ['IND', 'BRA', 'TUR'])",
        },
        limit: {
          type: "number",
          description: "Maximum number of equalizations to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["pricePointId"],
    },
  },
  {
    name: "set_app_prices",
    description:
      "Set per-territory manual pricing for an app (Purchase Power Parity). WARNING: This replaces the entire price schedule — include ALL territory prices, not just changes. The base territory price must be included in manualPrices. Use list_app_price_points and get_price_point_equalizations to find price point IDs first.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        baseTerritory: {
          type: "string",
          description: "Base territory for pricing (3-letter code, e.g., USA)",
        },
        manualPrices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              territory: {
                type: "string",
                description: "Territory code (e.g., USA, GBR, IND)",
              },
              pricePointId: {
                type: "string",
                description:
                  "Price point ID for this territory (from list_app_price_points or get_price_point_equalizations)",
              },
            },
            required: ["territory", "pricePointId"],
          },
          description: "Array of per-territory price assignments. Must include the base territory.",
        },
      },
      required: ["appId", "baseTerritory", "manualPrices"],
    },
  },
];
