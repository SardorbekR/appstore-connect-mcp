/**
 * In-App Purchase Tools — manage one-time purchases (non-consumable "lifetime",
 * consumable, and non-renewing) via Apple's In-App Purchases v2 API.
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  CreateInAppPurchaseAvailabilityRequest,
  CreateInAppPurchaseLocalizationRequest,
  CreateInAppPurchasePriceScheduleRequest,
  CreateInAppPurchaseRequest,
  CreateInAppPurchaseSubmissionRequest,
  GetInAppPurchaseAvailabilityResponse,
  InAppPurchase,
  InAppPurchaseAvailability,
  InAppPurchaseLocalization,
  InAppPurchasePrice,
  InAppPurchasePricePoint,
  InAppPurchasePriceSchedule,
  InAppPurchasePriceScheduleResponse,
  InAppPurchaseSubmission,
  Territory,
  UpdateInAppPurchaseLocalizationRequest,
  UpdateInAppPurchaseRequest,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  createInAppPurchaseInputSchema,
  createInAppPurchaseLocalizationInputSchema,
  deleteInAppPurchaseInputSchema,
  deleteInAppPurchaseLocalizationInputSchema,
  getInAppPurchaseAvailabilityInputSchema,
  getInAppPurchaseInputSchema,
  getInAppPurchasePricePointEqualizationsInputSchema,
  listInAppPurchaseLocalizationsInputSchema,
  listInAppPurchasePricePointsInputSchema,
  listInAppPurchasePricesInputSchema,
  listInAppPurchasesInputSchema,
  setInAppPurchaseAvailabilityInputSchema,
  setInAppPurchasePriceInputSchema,
  submitInAppPurchaseForReviewInputSchema,
  updateInAppPurchaseInputSchema,
  updateInAppPurchaseLocalizationInputSchema,
  validateInput,
} from "../utils/validation.js";

// ============================================================================
// In-App Purchase CRUD
// ============================================================================

/**
 * List in-app purchases for an app, optionally filtered by type
 */
export async function listInAppPurchases(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listInAppPurchasesInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };
    if (params.inAppPurchaseType) {
      queryParams["filter[inAppPurchaseType]"] = params.inAppPurchaseType;
    }

    const response = await client.get<ASCListResponse<InAppPurchase>>(
      `/apps/${params.appId}/inAppPurchasesV2`,
      queryParams
    );

    return {
      success: true,
      data: response.data.map((iap) => ({
        id: iap.id,
        name: iap.attributes.name,
        productId: iap.attributes.productId,
        inAppPurchaseType: iap.attributes.inAppPurchaseType,
        state: iap.attributes.state,
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
 * Get details of a specific in-app purchase
 */
export async function getInAppPurchase(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getInAppPurchaseInputSchema, input);

    const response = await client.get<ASCResponse<InAppPurchase>>(
      `/v2/inAppPurchases/${params.inAppPurchaseId}`
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        productId: response.data.attributes.productId,
        inAppPurchaseType: response.data.attributes.inAppPurchaseType,
        state: response.data.attributes.state,
        familySharable: response.data.attributes.familySharable,
        reviewNote: response.data.attributes.reviewNote,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a new in-app purchase (defaults to NON_CONSUMABLE — a "lifetime" unlock)
 */
export async function createInAppPurchase(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createInAppPurchaseInputSchema, input);

    const requestBody: CreateInAppPurchaseRequest = {
      data: {
        type: "inAppPurchases",
        attributes: {
          name: params.name,
          productId: params.productId,
          inAppPurchaseType: params.inAppPurchaseType ?? "NON_CONSUMABLE",
          familySharable: params.familySharable,
          reviewNote: params.reviewNote,
        },
        relationships: {
          app: {
            data: { type: "apps", id: params.appId },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<InAppPurchase>>(
      "/v2/inAppPurchases",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        productId: response.data.attributes.productId,
        inAppPurchaseType: response.data.attributes.inAppPurchaseType,
        state: response.data.attributes.state,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update an existing in-app purchase (productId and type are immutable)
 */
export async function updateInAppPurchase(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateInAppPurchaseInputSchema, input);

    const requestBody: UpdateInAppPurchaseRequest = {
      data: {
        type: "inAppPurchases",
        id: params.inAppPurchaseId,
        attributes: {
          name: params.name,
          familySharable: params.familySharable,
          reviewNote: params.reviewNote,
        },
      },
    };

    const response = await client.patch<ASCResponse<InAppPurchase>>(
      `/v2/inAppPurchases/${params.inAppPurchaseId}`,
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        familySharable: response.data.attributes.familySharable,
        state: response.data.attributes.state,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete an in-app purchase
 */
export async function deleteInAppPurchase(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deleteInAppPurchaseInputSchema, input);

    await client.delete(`/v2/inAppPurchases/${params.inAppPurchaseId}`);

    return { success: true };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// In-App Purchase Localizations
// ============================================================================

/**
 * List localizations for an in-app purchase
 */
export async function listInAppPurchaseLocalizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listInAppPurchaseLocalizationsInputSchema, input);

    const response = await client.get<ASCListResponse<InAppPurchaseLocalization>>(
      `/v2/inAppPurchases/${params.inAppPurchaseId}/inAppPurchaseLocalizations`,
      { limit: params.limit }
    );

    return {
      success: true,
      data: response.data.map((localization) => ({
        id: localization.id,
        name: localization.attributes.name,
        locale: localization.attributes.locale,
        description: localization.attributes.description,
        state: localization.attributes.state,
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
 * Create a localization (display name + description) for an in-app purchase
 */
export async function createInAppPurchaseLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createInAppPurchaseLocalizationInputSchema, input);

    const requestBody: CreateInAppPurchaseLocalizationRequest = {
      data: {
        type: "inAppPurchaseLocalizations",
        attributes: {
          name: params.name,
          locale: params.locale,
          description: params.description,
        },
        relationships: {
          inAppPurchaseV2: {
            data: { type: "inAppPurchases", id: params.inAppPurchaseId },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<InAppPurchaseLocalization>>(
      "/inAppPurchaseLocalizations",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        locale: response.data.attributes.locale,
        description: response.data.attributes.description,
        state: response.data.attributes.state,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update an existing in-app purchase localization
 */
export async function updateInAppPurchaseLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateInAppPurchaseLocalizationInputSchema, input);

    const requestBody: UpdateInAppPurchaseLocalizationRequest = {
      data: {
        type: "inAppPurchaseLocalizations",
        id: params.localizationId,
        attributes: {
          name: params.name,
          description: params.description,
        },
      },
    };

    const response = await client.patch<ASCResponse<InAppPurchaseLocalization>>(
      `/inAppPurchaseLocalizations/${params.localizationId}`,
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        locale: response.data.attributes.locale,
        description: response.data.attributes.description,
        state: response.data.attributes.state,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete an in-app purchase localization
 */
export async function deleteInAppPurchaseLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deleteInAppPurchaseLocalizationInputSchema, input);

    await client.delete(`/inAppPurchaseLocalizations/${params.localizationId}`);

    return { success: true };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// In-App Purchase Pricing
// ============================================================================

/**
 * List price points for an in-app purchase, optionally filtered by territory
 */
export async function listInAppPurchasePricePoints(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listInAppPurchasePricePointsInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit || 200,
    };
    if (params.territory) {
      queryParams["filter[territory]"] = params.territory;
    }

    // Use pagination to skip past the first N results
    const offset = params.offset || 0;
    const maxItems = (params.limit || 200) + offset;

    const results: Array<{ id: string; customerPrice?: string; proceeds?: string }> = [];

    let itemIndex = 0;
    for await (const pricePoint of client.paginate<InAppPurchasePricePoint>(
      `/v2/inAppPurchases/${params.inAppPurchaseId}/pricePoints`,
      queryParams,
      maxItems
    )) {
      if (itemIndex >= offset) {
        results.push({
          id: pricePoint.id,
          customerPrice: pricePoint.attributes.customerPrice,
          proceeds: pricePoint.attributes.proceeds,
        });
      }
      itemIndex++;
      if (results.length >= (params.limit || 200)) {
        break;
      }
    }

    return {
      success: true,
      data: results,
      meta: {
        total: undefined,
        returned: results.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Set per-territory pricing for an in-app purchase (replaces the entire price schedule).
 * Provide just the base territory to let Apple auto-equalize, or a full per-territory
 * list for manual Purchase Power Parity pricing.
 */
export async function setInAppPurchasePrice(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(setInAppPurchasePriceInputSchema, input);

    const manualPricesData: Array<{ type: "inAppPurchasePrices"; id: string }> = [];
    const includedPrices: CreateInAppPurchasePriceScheduleRequest["included"] = [];

    for (const entry of params.manualPrices) {
      const tempId = `\${${entry.territory}-price}`;

      manualPricesData.push({ type: "inAppPurchasePrices", id: tempId });

      includedPrices.push({
        type: "inAppPurchasePrices",
        id: tempId,
        attributes: { startDate: null },
        relationships: {
          inAppPurchasePricePoint: {
            data: { type: "inAppPurchasePricePoints", id: entry.pricePointId },
          },
        },
      });
    }

    const requestBody: CreateInAppPurchasePriceScheduleRequest = {
      data: {
        type: "inAppPurchasePriceSchedules",
        relationships: {
          inAppPurchase: {
            data: { type: "inAppPurchases", id: params.inAppPurchaseId },
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

    const response = await client.post<ASCResponse<InAppPurchasePriceSchedule>>(
      "/inAppPurchasePriceSchedules",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        inAppPurchaseId: params.inAppPurchaseId,
        baseTerritory: params.baseTerritory,
        manualPricesCount: params.manualPrices.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// In-App Purchase Availability
// ============================================================================

/**
 * Get the territory availability of an in-app purchase
 */
export async function getInAppPurchaseAvailability(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getInAppPurchaseAvailabilityInputSchema, input);

    const response = await client.get<GetInAppPurchaseAvailabilityResponse>(
      `/v2/inAppPurchases/${params.inAppPurchaseId}/inAppPurchaseAvailability`,
      {
        include: "availableTerritories",
        "fields[territories]": "currency",
      }
    );

    const included = (response.included ?? []) as Territory[];
    const territories = included
      .filter((item) => (item as { type: string }).type === "territories")
      .map((t) => ({ id: t.id, currency: t.attributes.currency }));

    return {
      success: true,
      data: {
        id: response.data.id,
        inAppPurchaseId: params.inAppPurchaseId,
        availableInNewTerritories: response.data.attributes.availableInNewTerritories,
        availableTerritories: territories,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Set the territory availability of an in-app purchase
 */
export async function setInAppPurchaseAvailability(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(setInAppPurchaseAvailabilityInputSchema, input);

    const requestBody: CreateInAppPurchaseAvailabilityRequest = {
      data: {
        type: "inAppPurchaseAvailabilities",
        attributes: {
          availableInNewTerritories: params.availableInNewTerritories,
        },
        relationships: {
          inAppPurchase: {
            data: { type: "inAppPurchases", id: params.inAppPurchaseId },
          },
          ...(params.territories && params.territories.length > 0
            ? {
                availableTerritories: {
                  data: params.territories.map((id) => ({ type: "territories" as const, id })),
                },
              }
            : {}),
        },
      },
    };

    const response = await client.post<ASCResponse<InAppPurchaseAvailability>>(
      "/inAppPurchaseAvailabilities",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        inAppPurchaseId: params.inAppPurchaseId,
        availableInNewTerritories: response.data.attributes.availableInNewTerritories,
        territoriesCount: params.territories?.length ?? 0,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// In-App Purchase Submission
// ============================================================================

/**
 * Submit an in-app purchase for App Review (independent of an app version)
 */
export async function submitInAppPurchaseForReview(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(submitInAppPurchaseForReviewInputSchema, input);

    const requestBody: CreateInAppPurchaseSubmissionRequest = {
      data: {
        type: "inAppPurchaseSubmissions",
        relationships: {
          inAppPurchaseV2: {
            data: { type: "inAppPurchases", id: params.inAppPurchaseId },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<InAppPurchaseSubmission>>(
      "/inAppPurchaseSubmissions",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        inAppPurchaseId: params.inAppPurchaseId,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// In-App Purchase Price Reads (PPP equalizations + current prices)
// ============================================================================

/** Extract a to-one (or first to-many) relationship id. */
function relationshipId(
  relationship: { data?: { id: string } | Array<{ id: string }> } | undefined
): string | undefined {
  const data = relationship?.data;
  if (!data) {
    return undefined;
  }
  return Array.isArray(data) ? data[0]?.id : data.id;
}

/**
 * Get Apple's equivalent price points in other territories for an in-app purchase
 * price point — the core Purchase Power Parity (PPP) data for one-time purchases.
 */
export async function getInAppPurchasePricePointEqualizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getInAppPurchasePricePointEqualizationsInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      "fields[inAppPurchasePricePoints]": "customerPrice,proceeds",
      include: "territory",
    };
    if (params.territories && params.territories.length > 0) {
      queryParams["filter[territory]"] = params.territories.join(",");
    }

    const response = await client.get<ASCListResponse<InAppPurchasePricePoint>>(
      `/v1/inAppPurchasePricePoints/${params.pricePointId}/equalizations`,
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
        const territoryId = relationshipId(pricePoint.relationships?.territory);
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

/** Index price-schedule include resources (price points + territories) by id. */
function indexIapPricingIncludes(included: Array<InAppPurchasePricePoint | Territory>): {
  pricePointMap: Map<string, InAppPurchasePricePoint>;
  territoryMap: Map<string, Territory>;
} {
  const pricePointMap = new Map<string, InAppPurchasePricePoint>();
  const territoryMap = new Map<string, Territory>();
  for (const item of included) {
    const type = (item as { type: string }).type;
    if (type === "inAppPurchasePricePoints") {
      pricePointMap.set(item.id, item as InAppPurchasePricePoint);
    } else if (type === "territories") {
      territoryMap.set(item.id, item as Territory);
    }
  }
  return { pricePointMap, territoryMap };
}

/** Resolve one scheduled price into a flat record with territory + customer price. */
function mapIapPrice(
  price: InAppPurchasePrice,
  pricePointMap: Map<string, InAppPurchasePricePoint>,
  territoryMap: Map<string, Territory>,
  isManualRelationship: boolean
) {
  const pricePointId = relationshipId(price.relationships?.inAppPurchasePricePoint);
  const territoryId = relationshipId(price.relationships?.territory);
  const pricePoint = pricePointId ? pricePointMap.get(pricePointId) : undefined;
  const territory = territoryId ? territoryMap.get(territoryId) : undefined;
  return {
    id: price.id,
    territory: territory
      ? { id: territory.id, currency: territory.attributes.currency }
      : territoryId
        ? { id: territoryId }
        : undefined,
    customerPrice: pricePoint?.attributes.customerPrice,
    proceeds: pricePoint?.attributes.proceeds,
    manual: price.attributes?.manual ?? isManualRelationship,
    startDate: price.attributes?.startDate ?? null,
    pricePointId,
  };
}

/**
 * List the current per-territory prices set for an in-app purchase. Returns the
 * developer-set (manual) prices by default; pass includeAutomatic to also return
 * Apple's auto-equalized prices. Reads via the in-app purchase's price schedule.
 */
export async function listInAppPurchasePrices(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listInAppPurchasePricesInputSchema, input);

    // Current prices live behind the in-app purchase's price schedule.
    const schedule = await client.get<InAppPurchasePriceScheduleResponse>(
      `/v2/inAppPurchases/${params.inAppPurchaseId}/iapPriceSchedule`
    );
    const scheduleId = schedule.data.id;

    const queryParams: Record<string, string | number | boolean | undefined> = {
      // A schedule holds at most one price per territory (<= 200) and the endpoint's
      // page limit max is also 200, so a single full page always returns the complete
      // set — no second page is possible. `total` is surfaced below to make any
      // (theoretical) truncation visible.
      limit: params.limit ?? 200,
      include: "inAppPurchasePricePoint,territory",
      "fields[inAppPurchasePricePoints]": "customerPrice,proceeds",
      "fields[territories]": "currency",
    };
    if (params.territory) {
      queryParams["filter[territory]"] = params.territory;
    }

    const relationshipsToRead = params.includeAutomatic
      ? (["manualPrices", "automaticPrices"] as const)
      : (["manualPrices"] as const);

    const data: Array<ReturnType<typeof mapIapPrice>> = [];
    let total = 0;
    let totalKnown = true;

    for (const relationship of relationshipsToRead) {
      const response = await client.get<ASCListResponse<InAppPurchasePrice>>(
        `/inAppPurchasePriceSchedules/${scheduleId}/${relationship}`,
        queryParams
      );
      const pageTotal = response.meta?.paging?.total;
      if (typeof pageTotal === "number") {
        total += pageTotal;
      } else {
        totalKnown = false;
      }
      const { pricePointMap, territoryMap } = indexIapPricingIncludes(
        (response.included ?? []) as Array<InAppPurchasePricePoint | Territory>
      );
      for (const price of response.data) {
        data.push(mapIapPrice(price, pricePointMap, territoryMap, relationship === "manualPrices"));
      }
    }

    return {
      success: true,
      data,
      meta: {
        total: totalKnown ? total : undefined,
        returned: data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const inAppPurchaseToolDefinitions = [
  {
    name: "list_in_app_purchases",
    description:
      "List in-app purchases for an app. Covers one-time purchases — non-consumable (a 'lifetime' unlock), consumable, and non-renewing. Optionally filter by type.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        inAppPurchaseType: {
          type: "string",
          enum: ["CONSUMABLE", "NON_CONSUMABLE", "NON_RENEWING_SUBSCRIPTION"],
          description: "Filter by purchase type (NON_CONSUMABLE = lifetime)",
        },
        limit: {
          type: "number",
          description: "Maximum number of in-app purchases to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_in_app_purchase",
    description: "Get details of a specific in-app purchase, including its state and product ID.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
        },
      },
      required: ["inAppPurchaseId"],
    },
  },
  {
    name: "create_in_app_purchase",
    description:
      "Create a new in-app purchase. Defaults to NON_CONSUMABLE — a one-time 'lifetime' purchase that permanently unlocks the app. After creating, add a localization, set a price, and set availability before submitting for review. productId and type cannot be changed later.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        name: {
          type: "string",
          description: "Reference name (internal, max 64 chars)",
        },
        productId: {
          type: "string",
          description: "Unique product ID / SKU (e.g., com.app.lifetime). Immutable.",
        },
        inAppPurchaseType: {
          type: "string",
          enum: ["CONSUMABLE", "NON_CONSUMABLE", "NON_RENEWING_SUBSCRIPTION"],
          description: "Purchase type. Defaults to NON_CONSUMABLE (lifetime). Immutable.",
        },
        familySharable: {
          type: "boolean",
          description: "Whether the purchase supports Family Sharing",
        },
        reviewNote: {
          type: "string",
          description: "Note for App Review (max 4000 chars)",
        },
      },
      required: ["appId", "name", "productId"],
    },
  },
  {
    name: "update_in_app_purchase",
    description:
      "Update an in-app purchase's reference name, Family Sharing setting, or review note. productId and type are immutable.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
        },
        name: {
          type: "string",
          description: "Reference name (internal, max 64 chars)",
        },
        familySharable: {
          type: "boolean",
          description: "Whether the purchase supports Family Sharing",
        },
        reviewNote: {
          type: "string",
          description: "Note for App Review (max 4000 chars)",
        },
      },
      required: ["inAppPurchaseId"],
    },
  },
  {
    name: "delete_in_app_purchase",
    description: "Delete an in-app purchase. Only possible before it has been approved/sold.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
        },
      },
      required: ["inAppPurchaseId"],
    },
  },
  {
    name: "list_in_app_purchase_localizations",
    description: "List the localized display names and descriptions for an in-app purchase.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of localizations to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["inAppPurchaseId"],
    },
  },
  {
    name: "create_in_app_purchase_localization",
    description:
      "Add a localized display name (and optional description) for an in-app purchase. At least one localization is required before submission.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
        },
        locale: {
          type: "string",
          description: "Locale code (e.g., en-US, fr-FR)",
        },
        name: {
          type: "string",
          description: "Localized display name (max 30 chars)",
        },
        description: {
          type: "string",
          description: "Localized description (max 45 chars)",
        },
      },
      required: ["inAppPurchaseId", "locale", "name"],
    },
  },
  {
    name: "update_in_app_purchase_localization",
    description: "Update the display name or description of an in-app purchase localization.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The in-app purchase localization ID",
        },
        name: {
          type: "string",
          description: "Localized display name (max 30 chars)",
        },
        description: {
          type: "string",
          description: "Localized description (max 45 chars)",
        },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "delete_in_app_purchase_localization",
    description: "Delete an in-app purchase localization.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The in-app purchase localization ID",
        },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "list_in_app_purchase_price_points",
    description:
      "List available price points for an in-app purchase, showing customer price and developer proceeds. Filter by territory to find a price point ID for set_in_app_purchase_price. Supports offset-based pagination.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
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
        offset: {
          type: "number",
          description: "Number of price points to skip (for pagination)",
          minimum: 0,
        },
      },
      required: ["inAppPurchaseId"],
    },
  },
  {
    name: "set_in_app_purchase_price",
    description:
      "Set pricing for an in-app purchase. WARNING: This replaces the entire price schedule. Provide only the base territory to let Apple auto-equalize all other territories, or provide a full per-territory list for manual Purchase Power Parity (PPP) pricing. Use list_in_app_purchase_price_points to find price point IDs. The base territory's price point must be included in manualPrices.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
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
                  "Price point ID for this territory (from list_in_app_purchase_price_points)",
              },
            },
            required: ["territory", "pricePointId"],
          },
          description:
            "Per-territory price assignments. Must include the base territory. Provide one entry to auto-equalize, or many for manual PPP.",
        },
      },
      required: ["inAppPurchaseId", "baseTerritory", "manualPrices"],
    },
  },
  {
    name: "get_in_app_purchase_availability",
    description:
      "Get the territory availability of an in-app purchase, including which territories it is available in.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
        },
      },
      required: ["inAppPurchaseId"],
    },
  },
  {
    name: "set_in_app_purchase_availability",
    description:
      "Set the territory availability of an in-app purchase. Set availableInNewTerritories to auto-enable future App Store territories, and optionally restrict to a specific list of territories.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
        },
        availableInNewTerritories: {
          type: "boolean",
          description:
            "Whether to make the purchase available in territories Apple adds in the future",
        },
        territories: {
          type: "array",
          items: { type: "string" },
          description:
            "Territory codes to make the purchase available in (e.g., ['USA', 'GBR']). Omit to keep all territories.",
        },
      },
      required: ["inAppPurchaseId", "availableInNewTerritories"],
    },
  },
  {
    name: "submit_in_app_purchase_for_review",
    description:
      "Submit an in-app purchase to App Review. This is an outward-facing action: the purchase must already have metadata, a localization, a price, and availability set. App Store Connect also typically requires a review screenshot on the in-app purchase before it can pass review — uploading review screenshots is NOT covered by these tools, so add one in App Store Connect if submission fails for a missing screenshot. Can be submitted independently of an app version.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
        },
      },
      required: ["inAppPurchaseId"],
    },
  },
  {
    name: "get_in_app_purchase_price_point_equalizations",
    description:
      "Get Apple's equivalent price points in other territories for an in-app purchase price point — the core Purchase Power Parity (PPP) data for one-time purchases. Use list_in_app_purchase_price_points to get a base price point ID, then feed the per-territory results into set_in_app_purchase_price.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        pricePointId: {
          type: "string",
          description:
            "The in-app purchase price point ID (from list_in_app_purchase_price_points)",
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
    name: "list_in_app_purchase_prices",
    description:
      "List the current per-territory prices set for an in-app purchase, with resolved customer price and territory. Returns developer-set (manual) prices by default; set includeAutomatic to also include Apple's auto-equalized prices. Use this to read existing pricing or verify a set_in_app_purchase_price change.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: {
          type: "string",
          description: "The in-app purchase ID",
        },
        territory: {
          type: "string",
          description: "Filter by territory (3-letter code, e.g., USA, GBR, JPN)",
        },
        includeAutomatic: {
          type: "boolean",
          description: "Also include Apple's automatically-equalized prices (default false)",
        },
        limit: {
          type: "number",
          description: "Maximum number of prices to return per price set (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["inAppPurchaseId"],
    },
  },
];
