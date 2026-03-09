/**
 * Subscription Tools - Manage auto-renewable subscriptions and subscription groups
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  CreateSubscriptionAvailabilityRequest,
  CreateSubscriptionGroupLocalizationRequest,
  CreateSubscriptionGroupRequest,
  CreateSubscriptionLocalizationRequest,
  CreateSubscriptionPriceRequest,
  CreateSubscriptionPromotionalOfferRequest,
  CreateSubscriptionRequest,
  GetSubscriptionAvailabilityResponse,
  Subscription,
  SubscriptionAvailability,
  SubscriptionGroup,
  SubscriptionGroupLocalization,
  SubscriptionLocalization,
  SubscriptionPrice,
  SubscriptionPricePoint,
  SubscriptionPromotionalOffer,
  SubscriptionPromotionalOfferPrice,
  Territory,
  UpdateSubscriptionGroupLocalizationRequest,
  UpdateSubscriptionGroupRequest,
  UpdateSubscriptionLocalizationRequest,
  UpdateSubscriptionPromotionalOfferRequest,
  UpdateSubscriptionRequest,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  createPromotionalOfferInputSchema,
  createSubscriptionGroupInputSchema,
  createSubscriptionGroupLocalizationInputSchema,
  createSubscriptionInputSchema,
  createSubscriptionLocalizationInputSchema,
  createSubscriptionPriceInputSchema,
  deletePromotionalOfferInputSchema,
  deleteSubscriptionInputSchema,
  deleteSubscriptionLocalizationInputSchema,
  getSubscriptionAvailabilityInputSchema,
  getSubscriptionGroupInputSchema,
  getSubscriptionGroupLocalizationInputSchema,
  getSubscriptionInputSchema,
  listPromotionalOfferPricesInputSchema,
  listPromotionalOffersInputSchema,
  listSubscriptionGroupLocalizationsInputSchema,
  listSubscriptionGroupsInputSchema,
  updatePromotionalOfferInputSchema,
  updateSubscriptionGroupInputSchema,
  updateSubscriptionGroupLocalizationInputSchema,
  listSubscriptionLocalizationsInputSchema,
  listSubscriptionPricePointsInputSchema,
  listSubscriptionPricesInputSchema,
  listSubscriptionsInputSchema,
  setSubscriptionAvailabilityInputSchema,
  updateSubscriptionInputSchema,
  updateSubscriptionLocalizationInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List subscription groups for an app
 */
export async function listSubscriptionGroups(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listSubscriptionGroupsInputSchema, input);

    const response = await client.get<ASCListResponse<SubscriptionGroup>>(
      `/apps/${params.appId}/subscriptionGroups`,
      { limit: params.limit }
    );

    return {
      success: true,
      data: response.data.map((group) => ({
        id: group.id,
        referenceName: group.attributes.referenceName,
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
 * Get a specific subscription group by ID
 */
export async function getSubscriptionGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getSubscriptionGroupInputSchema, input);

    const response = await client.get<ASCResponse<SubscriptionGroup>>(
      `/subscriptionGroups/${params.subscriptionGroupId}`
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        referenceName: response.data.attributes.referenceName,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a new subscription group for an app
 */
export async function createSubscriptionGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createSubscriptionGroupInputSchema, input);

    const requestBody: CreateSubscriptionGroupRequest = {
      data: {
        type: "subscriptionGroups",
        attributes: {
          referenceName: params.referenceName,
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

    const response = await client.post<ASCResponse<SubscriptionGroup>>(
      "/subscriptionGroups",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        referenceName: response.data.attributes.referenceName,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update the reference name of a subscription group
 */
export async function updateSubscriptionGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateSubscriptionGroupInputSchema, input);

    const requestBody: UpdateSubscriptionGroupRequest = {
      data: {
        type: "subscriptionGroups",
        id: params.subscriptionGroupId,
        attributes: {
          referenceName: params.referenceName,
        },
      },
    };

    const response = await client.patch<ASCResponse<SubscriptionGroup>>(
      `/subscriptionGroups/${params.subscriptionGroupId}`,
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        referenceName: response.data.attributes.referenceName,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List localizations for a subscription group
 */
export async function listSubscriptionGroupLocalizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listSubscriptionGroupLocalizationsInputSchema, input);

    const response = await client.get<ASCListResponse<SubscriptionGroupLocalization>>(
      `/subscriptionGroups/${params.subscriptionGroupId}/subscriptionGroupLocalizations`,
      { limit: params.limit }
    );

    return {
      success: true,
      data: response.data.map((loc) => ({
        id: loc.id,
        name: loc.attributes.name,
        locale: loc.attributes.locale,
        customAppName: loc.attributes.customAppName,
        customAppDescription: loc.attributes.customAppDescription,
        state: loc.attributes.state,
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
 * Get a single subscription group localization by ID
 */
export async function getSubscriptionGroupLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getSubscriptionGroupLocalizationInputSchema, input);

    const response = await client.get<ASCResponse<SubscriptionGroupLocalization>>(
      `/subscriptionGroupLocalizations/${params.localizationId}`
    );

    const loc = response.data;
    return {
      success: true,
      data: {
        id: loc.id,
        name: loc.attributes.name,
        locale: loc.attributes.locale,
        customAppName: loc.attributes.customAppName,
        customAppDescription: loc.attributes.customAppDescription,
        state: loc.attributes.state,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a subscription group localization
 * POST /v1/subscriptionGroupLocalizations
 */
export async function createSubscriptionGroupLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createSubscriptionGroupLocalizationInputSchema, input);

    const requestBody: CreateSubscriptionGroupLocalizationRequest = {
      data: {
        type: "subscriptionGroupLocalizations",
        attributes: {
          name: params.name,
          locale: params.locale,
          ...(params.customAppName !== undefined && { customAppName: params.customAppName }),
          ...(params.customAppDescription !== undefined && {
            customAppDescription: params.customAppDescription,
          }),
        },
        relationships: {
          subscriptionGroup: {
            data: { type: "subscriptionGroups", id: params.subscriptionGroupId },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<SubscriptionGroupLocalization>>(
      "/subscriptionGroupLocalizations",
      requestBody
    );

    const loc = response.data;
    return {
      success: true,
      data: {
        id: loc.id,
        name: loc.attributes.name,
        locale: loc.attributes.locale,
        customAppName: loc.attributes.customAppName,
        customAppDescription: loc.attributes.customAppDescription,
        state: loc.attributes.state,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update a subscription group localization
 * PATCH /v1/subscriptionGroupLocalizations/{id}
 */
export async function updateSubscriptionGroupLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateSubscriptionGroupLocalizationInputSchema, input);

    const requestBody: UpdateSubscriptionGroupLocalizationRequest = {
      data: {
        type: "subscriptionGroupLocalizations",
        id: params.localizationId,
        attributes: {
          ...(params.name !== undefined && { name: params.name }),
          ...(params.customAppName !== undefined && { customAppName: params.customAppName }),
          ...(params.customAppDescription !== undefined && {
            customAppDescription: params.customAppDescription,
          }),
        },
      },
    };

    const response = await client.patch<ASCResponse<SubscriptionGroupLocalization>>(
      `/subscriptionGroupLocalizations/${params.localizationId}`,
      requestBody
    );

    const loc = response.data;
    return {
      success: true,
      data: {
        id: loc.id,
        name: loc.attributes.name,
        locale: loc.attributes.locale,
        customAppName: loc.attributes.customAppName,
        customAppDescription: loc.attributes.customAppDescription,
        state: loc.attributes.state,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List subscriptions within a subscription group
 */
export async function listSubscriptions(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listSubscriptionsInputSchema, input);

    const response = await client.get<ASCListResponse<Subscription>>(
      `/subscriptionGroups/${params.subscriptionGroupId}/subscriptions`,
      { limit: params.limit }
    );

    return {
      success: true,
      data: response.data.map((subscription) => ({
        id: subscription.id,
        name: subscription.attributes.name,
        productId: subscription.attributes.productId,
        familySharable: subscription.attributes.familySharable,
        state: subscription.attributes.state,
        subscriptionPeriod: subscription.attributes.subscriptionPeriod,
        groupLevel: subscription.attributes.groupLevel,
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
 * Get a specific subscription by ID
 */
export async function getSubscription(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getSubscriptionInputSchema, input);

    const response = await client.get<ASCResponse<Subscription>>(
      `/subscriptions/${params.subscriptionId}`
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        productId: response.data.attributes.productId,
        familySharable: response.data.attributes.familySharable,
        state: response.data.attributes.state,
        subscriptionPeriod: response.data.attributes.subscriptionPeriod,
        reviewNote: response.data.attributes.reviewNote,
        groupLevel: response.data.attributes.groupLevel,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a new subscription within a subscription group
 */
export async function createSubscription(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createSubscriptionInputSchema, input);

    const requestBody: CreateSubscriptionRequest = {
      data: {
        type: "subscriptions",
        attributes: {
          name: params.name,
          productId: params.productId,
          subscriptionPeriod: params.subscriptionPeriod,
          familySharable: params.familySharable,
          reviewNote: params.reviewNote,
          groupLevel: params.groupLevel,
        },
        relationships: {
          group: {
            data: {
              type: "subscriptionGroups",
              id: params.subscriptionGroupId,
            },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<Subscription>>(
      "/subscriptions",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        productId: response.data.attributes.productId,
        subscriptionPeriod: response.data.attributes.subscriptionPeriod,
        state: response.data.attributes.state,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update an existing subscription
 */
export async function updateSubscription(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateSubscriptionInputSchema, input);

    const requestBody: UpdateSubscriptionRequest = {
      data: {
        type: "subscriptions",
        id: params.subscriptionId,
        attributes: {
          name: params.name,
          familySharable: params.familySharable,
          subscriptionPeriod: params.subscriptionPeriod,
          reviewNote: params.reviewNote,
          groupLevel: params.groupLevel,
        },
      },
    };

    const response = await client.patch<ASCResponse<Subscription>>(
      `/subscriptions/${params.subscriptionId}`,
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        productId: response.data.attributes.productId,
        subscriptionPeriod: response.data.attributes.subscriptionPeriod,
        state: response.data.attributes.state,
        familySharable: response.data.attributes.familySharable,
        groupLevel: response.data.attributes.groupLevel,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a subscription
 */
export async function deleteSubscription(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deleteSubscriptionInputSchema, input);

    await client.delete(`/subscriptions/${params.subscriptionId}`);

    return { success: true };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List localizations for a subscription
 */
export async function listSubscriptionLocalizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listSubscriptionLocalizationsInputSchema, input);

    const response = await client.get<ASCListResponse<SubscriptionLocalization>>(
      `/subscriptions/${params.subscriptionId}/subscriptionLocalizations`,
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
 * Create a localization for a subscription
 */
export async function createSubscriptionLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createSubscriptionLocalizationInputSchema, input);

    const requestBody: CreateSubscriptionLocalizationRequest = {
      data: {
        type: "subscriptionLocalizations",
        attributes: {
          name: params.name,
          locale: params.locale,
          description: params.description,
        },
        relationships: {
          subscription: {
            data: {
              type: "subscriptions",
              id: params.subscriptionId,
            },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<SubscriptionLocalization>>(
      "/subscriptionLocalizations",
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
 * Update an existing subscription localization
 */
export async function updateSubscriptionLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateSubscriptionLocalizationInputSchema, input);

    const requestBody: UpdateSubscriptionLocalizationRequest = {
      data: {
        type: "subscriptionLocalizations",
        id: params.localizationId,
        attributes: {
          name: params.name,
          description: params.description,
        },
      },
    };

    const response = await client.patch<ASCResponse<SubscriptionLocalization>>(
      `/subscriptionLocalizations/${params.localizationId}`,
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
 * Delete a subscription localization
 */
export async function deleteSubscriptionLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deleteSubscriptionLocalizationInputSchema, input);

    await client.delete(`/subscriptionLocalizations/${params.localizationId}`);

    return { success: true };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List price points for a subscription, optionally filtered by territory
 */
export async function listSubscriptionPricePoints(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listSubscriptionPricePointsInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };

    if (params.territory) {
      queryParams["filter[territory]"] = params.territory;
    }

    const response = await client.get<ASCListResponse<SubscriptionPricePoint>>(
      `/subscriptions/${params.subscriptionId}/pricePoints`,
      queryParams
    );

    return {
      success: true,
      data: response.data.map((pricePoint) => ({
        id: pricePoint.id,
        customerPrice: pricePoint.attributes.customerPrice,
        proceeds: pricePoint.attributes.proceeds,
        proceedsYear2: pricePoint.attributes.proceedsYear2,
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
 * List current prices for a subscription, optionally filtered by territory
 */
export async function listSubscriptionPrices(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listSubscriptionPricesInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      include: "subscriptionPricePoint,territory",
      "fields[subscriptionPricePoints]": "customerPrice,proceeds",
      "fields[territories]": "currency",
    };

    if (params.territory) {
      queryParams["filter[territory]"] = params.territory;
    }

    const response = await client.get<ASCListResponse<SubscriptionPrice>>(
      `/subscriptions/${params.subscriptionId}/prices`,
      queryParams
    );

    const included = (response.included ?? []) as Array<SubscriptionPricePoint | Territory>;
    const pricePointMap = new Map<string, SubscriptionPricePoint>();
    const territoryMap = new Map<string, Territory>();
    for (const item of included) {
      if ((item as { type: string }).type === "subscriptionPricePoints") {
        pricePointMap.set(item.id, item as SubscriptionPricePoint);
      } else if ((item as { type: string }).type === "territories") {
        territoryMap.set(item.id, item as Territory);
      }
    }

    return {
      success: true,
      data: response.data.map((price) => {
        const ppData = price.relationships?.subscriptionPricePoint?.data;
        const ppId = ppData && !Array.isArray(ppData) ? ppData.id : undefined;
        const pp = ppId ? pricePointMap.get(ppId) : undefined;

        const terrData = price.relationships?.territory?.data;
        const terrId = terrData && !Array.isArray(terrData) ? terrData.id : undefined;
        const territory = terrId ? territoryMap.get(terrId) : undefined;

        return {
          id: price.id,
          startDate: price.attributes?.startDate ?? null,
          pricePoint: pp
            ? { id: pp.id, customerPrice: pp.attributes.customerPrice, proceeds: pp.attributes.proceeds }
            : ppId ? { id: ppId } : undefined,
          territory: territory
            ? { id: territory.id, currency: territory.attributes.currency }
            : terrId ? { id: terrId } : undefined,
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
 * Get the territory availability for a subscription
 */
export async function getSubscriptionAvailability(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getSubscriptionAvailabilityInputSchema, input);

    const response = await client.get<GetSubscriptionAvailabilityResponse>(
      `/subscriptions/${params.subscriptionId}/subscriptionAvailability`,
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
        subscriptionId: params.subscriptionId,
        availableInNewTerritories: response.data.attributes.availableInNewTerritories,
        availableTerritories: territories,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Set territory availability for a subscription
 */
export async function setSubscriptionAvailability(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(setSubscriptionAvailabilityInputSchema, input);

    const requestBody: CreateSubscriptionAvailabilityRequest = {
      data: {
        type: "subscriptionAvailabilities",
        attributes: {
          availableInNewTerritories: params.availableInNewTerritories,
        },
        relationships: {
          subscription: {
            data: { type: "subscriptions", id: params.subscriptionId },
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

    const response = await client.post<ASCResponse<SubscriptionAvailability>>(
      "/subscriptionAvailabilities",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        subscriptionId: params.subscriptionId,
        availableInNewTerritories: response.data.attributes.availableInNewTerritories,
        territoriesCount: params.territories?.length ?? 0,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a price for a subscription in a specific territory
 */
export async function createSubscriptionPrice(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createSubscriptionPriceInputSchema, input);

    const requestBody: CreateSubscriptionPriceRequest = {
      data: {
        type: "subscriptionPrices",
        attributes: {
          startDate: params.startDate ?? null,
          preserveCurrentPrice: params.preserveCurrentPrice ?? false,
        },
        relationships: {
          subscription: {
            data: { type: "subscriptions", id: params.subscriptionId },
          },
          subscriptionPricePoint: {
            data: { type: "subscriptionPricePoints", id: params.subscriptionPricePointId },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<SubscriptionPrice>>(
      "/subscriptionPrices",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        subscriptionId: params.subscriptionId,
        subscriptionPricePointId: params.subscriptionPricePointId,
        startDate: response.data.attributes?.startDate ?? null,
        preserveCurrentPrice: response.data.attributes?.preserveCurrentPrice,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// Promotional offer helpers
// ---------------------------------------------------------------------------

function buildPriceIncludes(
  prices: Array<{ territory: string; pricePointId: string }>
): {
  pricesData: Array<{ type: "subscriptionPromotionalOfferPrices"; id: string }>;
  included: CreateSubscriptionPromotionalOfferRequest["included"];
} {
  const pricesData: Array<{ type: "subscriptionPromotionalOfferPrices"; id: string }> = [];
  const included: CreateSubscriptionPromotionalOfferRequest["included"] = [];
  for (const entry of prices) {
    const tempId = `\${${entry.territory}-promo}`;
    pricesData.push({ type: "subscriptionPromotionalOfferPrices", id: tempId });
    included!.push({
      type: "subscriptionPromotionalOfferPrices",
      id: tempId,
      attributes: {},
      relationships: {
        subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: entry.pricePointId } },
        territory: { data: { type: "territories", id: entry.territory } },
      },
    });
  }
  return { pricesData, included };
}

/**
 * List promotional offers for a subscription
 */
export async function listPromotionalOffers(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listPromotionalOffersInputSchema, input);

    const response = await client.get<ASCListResponse<SubscriptionPromotionalOffer>>(
      `/subscriptions/${params.subscriptionId}/promotionalOffers`,
      { limit: params.limit }
    );

    return {
      success: true,
      data: response.data.map((offer) => ({
        id: offer.id,
        name: offer.attributes.name,
        offerCode: offer.attributes.offerCode,
        duration: offer.attributes.duration,
        offerMode: offer.attributes.offerMode,
        periodCount: offer.attributes.periodCount,
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
 * Create a promotional offer (or free trial) for a subscription
 */
export async function createPromotionalOffer(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createPromotionalOfferInputSchema, input);

    const { pricesData, included } = buildPriceIncludes(params.prices ?? []);

    const requestBody: CreateSubscriptionPromotionalOfferRequest = {
      data: {
        type: "subscriptionPromotionalOffers",
        attributes: {
          name: params.name,
          offerCode: params.offerCode,
          duration: params.duration,
          offerMode: params.offerMode,
          numberOfPeriods: params.periodCount,
        },
        relationships: {
          subscription: { data: { type: "subscriptions", id: params.subscriptionId } },
          prices: { data: pricesData },
        },
      },
      ...(included && included.length > 0 ? { included } : {}),
    };

    const response = await client.post<ASCResponse<SubscriptionPromotionalOffer>>(
      "/subscriptionPromotionalOffers",
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        offerCode: response.data.attributes.offerCode,
        duration: response.data.attributes.duration,
        offerMode: response.data.attributes.offerMode,
        periodCount: response.data.attributes.periodCount,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update a promotional offer
 */
export async function updatePromotionalOffer(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updatePromotionalOfferInputSchema, input);

    const requestBody: UpdateSubscriptionPromotionalOfferRequest = {
      data: {
        type: "subscriptionPromotionalOffers",
        id: params.promotionalOfferId,
        attributes: {
          name: params.name,
          offerCode: params.offerCode,
          duration: params.duration,
          offerMode: params.offerMode,
          numberOfPeriods: params.periodCount,
        },
      },
    };

    if (params.prices && params.prices.length > 0) {
      const { pricesData, included } = buildPriceIncludes(params.prices);
      requestBody.data.relationships = { prices: { data: pricesData } };
      requestBody.included = included;
    }

    const response = await client.patch<ASCResponse<SubscriptionPromotionalOffer>>(
      `/subscriptionPromotionalOffers/${params.promotionalOfferId}`,
      requestBody
    );

    return {
      success: true,
      data: {
        id: response.data.id,
        name: response.data.attributes.name,
        offerCode: response.data.attributes.offerCode,
        duration: response.data.attributes.duration,
        offerMode: response.data.attributes.offerMode,
        periodCount: response.data.attributes.periodCount,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a promotional offer
 */
export async function deletePromotionalOffer(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deletePromotionalOfferInputSchema, input);
    await client.delete(`/subscriptionPromotionalOffers/${params.promotionalOfferId}`);
    return { success: true };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List prices for a promotional offer
 */
export async function listPromotionalOfferPrices(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listPromotionalOfferPricesInputSchema, input);

    const response = await client.get<ASCListResponse<SubscriptionPromotionalOfferPrice>>(
      `/subscriptionPromotionalOffers/${params.promotionalOfferId}/prices`,
      {
        limit: params.limit,
        include: "subscriptionPricePoint,territory",
        "fields[subscriptionPricePoints]": "customerPrice,proceeds",
        "fields[territories]": "currency",
      }
    );

    const included = (response.included ?? []) as Array<SubscriptionPricePoint | Territory>;
    const pricePointMap = new Map<string, SubscriptionPricePoint>();
    const territoryMap = new Map<string, Territory>();
    for (const item of included) {
      const type = (item as { type: string }).type;
      if (type === "subscriptionPricePoints") pricePointMap.set(item.id, item as SubscriptionPricePoint);
      else if (type === "territories") territoryMap.set(item.id, item as Territory);
    }

    return {
      success: true,
      data: response.data.map((price) => {
        const ppData = price.relationships?.subscriptionPricePoint?.data;
        const ppId = ppData && !Array.isArray(ppData) ? ppData.id : undefined;
        const pp = ppId ? pricePointMap.get(ppId) : undefined;

        const terrData = price.relationships?.territory?.data;
        const terrId = terrData && !Array.isArray(terrData) ? terrData.id : undefined;
        const territory = terrId ? territoryMap.get(terrId) : undefined;

        return {
          id: price.id,
          pricePoint: pp
            ? { id: pp.id, customerPrice: pp.attributes.customerPrice, proceeds: pp.attributes.proceeds }
            : ppId ? { id: ppId } : undefined,
          territory: territory
            ? { id: territory.id, currency: territory.attributes.currency }
            : terrId ? { id: terrId } : undefined,
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
 * Tool definitions for subscriptions
 */
export const subscriptionToolDefinitions = [
  {
    name: "list_subscription_groups",
    description:
      "List all subscription groups for an app. Subscription groups contain auto-renewable subscriptions and define upgrade/downgrade relationships.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of subscription groups to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_subscription_group",
    description: "Get details of a specific subscription group by its ID.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionGroupId: {
          type: "string",
          description: "The subscription group ID",
        },
      },
      required: ["subscriptionGroupId"],
    },
  },
  {
    name: "create_subscription_group",
    description:
      "Create a new subscription group for an app. A subscription group must be created before adding individual subscriptions to it.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        referenceName: {
          type: "string",
          description: "Internal reference name for the subscription group (not visible to users)",
        },
      },
      required: ["appId", "referenceName"],
    },
  },
  {
    name: "update_subscription_group",
    description: "Update the reference name of a subscription group.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionGroupId: {
          type: "string",
          description: "The subscription group ID to update",
        },
        referenceName: {
          type: "string",
          description: "New internal reference name for the subscription group",
        },
      },
      required: ["subscriptionGroupId", "referenceName"],
    },
  },
  {
    name: "list_subscription_group_localizations",
    description:
      "List the localizations for a subscription group. These provide the localized name shown to users on the subscription management page.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionGroupId: {
          type: "string",
          description: "The subscription group ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of localizations to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["subscriptionGroupId"],
    },
  },
  {
    name: "get_subscription_group_localization",
    description:
      "Get a single subscription group localization by its ID. Returns the localized name, locale, custom app name, and description.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The subscription group localization ID",
        },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "create_subscription_group_localization",
    description:
      "Create a localization for a subscription group. Provides the localized group name shown to users on the App Store subscription management page.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionGroupId: {
          type: "string",
          description: "The subscription group ID to add a localization for",
        },
        name: {
          type: "string",
          description: "The localized name of the subscription group",
        },
        locale: {
          type: "string",
          description: "The locale for this localization (e.g. en-US, pt-BR)",
        },
        customAppName: {
          type: "string",
          description: "A custom app name to display for this locale",
        },
        customAppDescription: {
          type: "string",
          description: "A custom app description to display for this locale",
        },
      },
      required: ["subscriptionGroupId", "name", "locale"],
    },
  },
  {
    name: "update_subscription_group_localization",
    description:
      "Update an existing subscription group localization. Can update the group name, custom app name, or custom app description.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The subscription group localization ID to update",
        },
        name: {
          type: "string",
          description: "The updated localized name of the subscription group",
        },
        customAppName: {
          type: "string",
          description: "Updated custom app name for this locale",
        },
        customAppDescription: {
          type: "string",
          description: "Updated custom app description for this locale",
        },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "list_subscriptions",
    description:
      "List all auto-renewable subscriptions within a subscription group.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionGroupId: {
          type: "string",
          description: "The subscription group ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of subscriptions to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["subscriptionGroupId"],
    },
  },
  {
    name: "get_subscription",
    description: "Get details of a specific auto-renewable subscription by its ID.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID",
        },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "create_subscription",
    description:
      "Create a new auto-renewable subscription within a subscription group.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionGroupId: {
          type: "string",
          description: "The subscription group ID to add this subscription to",
        },
        name: {
          type: "string",
          description: "The reference name for the subscription (internal, not user-facing)",
        },
        productId: {
          type: "string",
          description: "The unique product identifier for this subscription",
        },
        subscriptionPeriod: {
          type: "string",
          enum: ["ONE_WEEK", "ONE_MONTH", "TWO_MONTHS", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR"],
          description: "The duration of the subscription period",
        },
        familySharable: {
          type: "boolean",
          description: "Whether the subscription can be shared with family members",
        },
        reviewNote: {
          type: "string",
          description: "Notes for the App Store reviewer (max 4000 characters)",
        },
        groupLevel: {
          type: "number",
          description: "The level of the subscription within the group (for upgrade/downgrade)",
          minimum: 1,
        },
      },
      required: ["subscriptionGroupId", "name", "productId", "subscriptionPeriod"],
    },
  },
  {
    name: "update_subscription",
    description: "Update the metadata of an existing auto-renewable subscription.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID to update",
        },
        name: {
          type: "string",
          description: "Updated reference name for the subscription",
        },
        familySharable: {
          type: "boolean",
          description: "Whether the subscription can be shared with family members",
        },
        subscriptionPeriod: {
          type: "string",
          enum: ["ONE_WEEK", "ONE_MONTH", "TWO_MONTHS", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR"],
          description: "Updated subscription period",
        },
        reviewNote: {
          type: "string",
          description: "Updated notes for the App Store reviewer (max 4000 characters)",
        },
        groupLevel: {
          type: "number",
          description: "Updated level of the subscription within the group",
          minimum: 1,
        },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "delete_subscription",
    description:
      "Delete an auto-renewable subscription. Only subscriptions in MISSING_METADATA or DEVELOPER_REMOVED_FROM_SALE state can be deleted.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID to delete",
        },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "list_subscription_localizations",
    description:
      "List all localizations (translated names and descriptions) for a subscription.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of localizations to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "create_subscription_localization",
    description:
      "Create a localized name and description for a subscription in a specific locale.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID to localize",
        },
        name: {
          type: "string",
          description: "The localized display name of the subscription",
        },
        locale: {
          type: "string",
          description: "The locale code (e.g., en-US, ja, zh-Hans)",
        },
        description: {
          type: "string",
          description: "The localized description of the subscription",
        },
      },
      required: ["subscriptionId", "name", "locale"],
    },
  },
  {
    name: "update_subscription_localization",
    description: "Update the localized name or description for a subscription localization.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The subscription localization ID to update",
        },
        name: {
          type: "string",
          description: "Updated localized display name of the subscription",
        },
        description: {
          type: "string",
          description: "Updated localized description of the subscription",
        },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "delete_subscription_localization",
    description: "Delete a localization for a subscription.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The subscription localization ID to delete",
        },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "list_subscription_price_points",
    description:
      "List available price points for a subscription, showing customer price and developer proceeds. Optionally filter by territory.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID",
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
      required: ["subscriptionId"],
    },
  },
  {
    name: "list_subscription_prices",
    description:
      "List the current prices set for a subscription, including price tier and territory details. Use this to read existing pricing before making changes.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID",
        },
        territory: {
          type: "string",
          description: "Filter by territory (3-letter code, e.g., USA, GBR, JPN)",
        },
        limit: {
          type: "number",
          description: "Maximum number of prices to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "get_subscription_availability",
    description:
      "Get the territory availability configuration for a subscription — shows which territories it is available in and whether it is automatically available in new territories.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID",
        },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "set_subscription_availability",
    description:
      "Set the territory availability for a subscription. Controls which countries/regions the subscription is available in, and whether it is automatically available in new territories Apple adds.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID",
        },
        availableInNewTerritories: {
          type: "boolean",
          description: "Whether the subscription is automatically available in new App Store territories",
        },
        territories: {
          type: "array",
          items: { type: "string" },
          description: "Explicit list of territory IDs to make available (3-letter codes, e.g., ['USA', 'GBR', 'BRA']). If omitted, only the availableInNewTerritories flag is set.",
        },
      },
      required: ["subscriptionId", "availableInNewTerritories"],
    },
  },
  {
    name: "create_subscription_price",
    description:
      "Set the price for a subscription in a specific territory. Use list_subscription_price_points to find the price point ID for the desired price tier. The price takes effect on startDate (or immediately if null).",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: {
          type: "string",
          description: "The subscription ID",
        },
        subscriptionPricePointId: {
          type: "string",
          description: "The price point ID (from list_subscription_price_points)",
        },
        startDate: {
          type: "string",
          description: "Date the price change takes effect (YYYY-MM-DD). Pass null or omit for immediate effect.",
          nullable: true,
        },
        preserveCurrentPrice: {
          type: "boolean",
          description: "If true, existing subscribers keep their current price. Defaults to false.",
        },
      },
      required: ["subscriptionId", "subscriptionPricePointId"],
    },
  },
  {
    name: "list_promotional_offers",
    description:
      "List all promotional offers configured for a subscription. Promotional offers target existing or previously subscribed customers via offer codes.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: { type: "string", description: "The subscription ID" },
        limit: { type: "number", description: "Maximum number of offers to return (1-200)", minimum: 1, maximum: 200 },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "create_promotional_offer",
    description:
      "Create a promotional offer for a subscription. Use offerMode FREE_TRIAL for a trial offer (no prices needed). Use PAY_AS_YOU_GO or PAY_UP_FRONT for discounted paid offers and supply prices per territory. The offerCode is the string customers redeem.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: { type: "string", description: "The subscription ID" },
        name: { type: "string", description: "Internal reference name for the offer" },
        offerCode: { type: "string", description: "Redemption code customers use to claim the offer" },
        duration: {
          type: "string",
          enum: ["THREE_DAYS", "ONE_WEEK", "TWO_WEEKS", "ONE_MONTH", "TWO_MONTHS", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR"],
          description: "Duration of the offer period",
        },
        offerMode: {
          type: "string",
          enum: ["FREE_TRIAL", "PAY_AS_YOU_GO", "PAY_UP_FRONT"],
          description: "FREE_TRIAL: free for the duration. PAY_AS_YOU_GO: discounted recurring price. PAY_UP_FRONT: discounted upfront price.",
        },
        periodCount: {
          type: "number",
          description: "Number of periods for PAY_AS_YOU_GO or PAY_UP_FRONT offers",
          minimum: 1,
        },
        prices: {
          type: "array",
          description: "Price per territory (required for PAY_AS_YOU_GO / PAY_UP_FRONT; omit for FREE_TRIAL)",
          items: {
            type: "object",
            properties: {
              territory: { type: "string", description: "3-letter territory code (e.g., USA, GBR)" },
              pricePointId: { type: "string", description: "Subscription price point ID for this territory" },
            },
            required: ["territory", "pricePointId"],
          },
        },
      },
      required: ["subscriptionId", "name", "offerCode", "duration", "offerMode"],
    },
  },
  {
    name: "update_promotional_offer",
    description:
      "Update an existing promotional offer's attributes or prices. Supply only the fields you want to change. To update prices, provide the full new prices array.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        promotionalOfferId: { type: "string", description: "The promotional offer ID to update" },
        name: { type: "string", description: "Updated internal reference name" },
        offerCode: { type: "string", description: "Updated redemption code" },
        duration: {
          type: "string",
          enum: ["THREE_DAYS", "ONE_WEEK", "TWO_WEEKS", "ONE_MONTH", "TWO_MONTHS", "THREE_MONTHS", "SIX_MONTHS", "ONE_YEAR"],
          description: "Updated offer duration",
        },
        offerMode: {
          type: "string",
          enum: ["FREE_TRIAL", "PAY_AS_YOU_GO", "PAY_UP_FRONT"],
          description: "Updated offer mode",
        },
        periodCount: { type: "number", description: "Updated period count", minimum: 1 },
        prices: {
          type: "array",
          description: "Replacement prices (full list, per territory)",
          items: {
            type: "object",
            properties: {
              territory: { type: "string" },
              pricePointId: { type: "string" },
            },
            required: ["territory", "pricePointId"],
          },
        },
      },
      required: ["promotionalOfferId"],
    },
  },
  {
    name: "delete_promotional_offer",
    description: "Delete a promotional offer from a subscription.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        promotionalOfferId: { type: "string", description: "The promotional offer ID to delete" },
      },
      required: ["promotionalOfferId"],
    },
  },
  {
    name: "list_promotional_offer_prices",
    description:
      "List the prices set for a promotional offer, with resolved price tier and territory details.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        promotionalOfferId: { type: "string", description: "The promotional offer ID" },
        limit: { type: "number", description: "Maximum number of prices to return (1-200)", minimum: 1, maximum: 200 },
      },
      required: ["promotionalOfferId"],
    },
  },
];
