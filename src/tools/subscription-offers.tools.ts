/**
 * Subscription Offer Tools - Introductory offers and win-back offers for auto-renewable
 * subscriptions: list, create, update, delete, and win-back price reads.
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  resourceIdSchema,
  subscriptionOfferDurationSchema,
  subscriptionOfferModeSchema,
  territoryIdSchema,
  validateInput,
} from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Types
// ============================================================================

interface ToOneLinkage {
  data?: { type: string; id: string } | null;
}

interface IntroductoryOfferResource {
  type: "subscriptionIntroductoryOffers";
  id: string;
  attributes: {
    startDate?: string | null;
    endDate?: string | null;
    duration?: string;
    offerMode?: string;
    numberOfPeriods?: number;
    targetSubscriptionPlanType?: string | null;
  };
  relationships?: {
    territory?: ToOneLinkage;
    subscriptionPricePoint?: ToOneLinkage;
  };
}

interface WinBackOfferResource {
  type: "winBackOffers";
  id: string;
  attributes: {
    referenceName?: string;
    offerId?: string;
    duration?: string;
    offerMode?: string;
    periodCount?: number;
    customerEligibilityPaidSubscriptionDurationInMonths?: number;
    customerEligibilityTimeSinceLastSubscribedInMonths?: { minimum: number; maximum: number };
    customerEligibilityWaitBetweenOffersInMonths?: number | null;
    startDate?: string;
    endDate?: string | null;
    priority?: string;
    promotionIntent?: string | null;
    targetSubscriptionPlanType?: string | null;
  };
}

interface WinBackOfferPriceResource {
  type: "winBackOfferPrices";
  id: string;
  relationships?: {
    territory?: ToOneLinkage;
    subscriptionPricePoint?: ToOneLinkage;
  };
}

// ============================================================================
// Input schemas
// ============================================================================

/** Paid modes charge a price, so every price needs a price point; a free trial takes none. */
function isPaidOfferMode(offerMode: string): boolean {
  return offerMode === "PAY_AS_YOU_GO" || offerMode === "PAY_UP_FRONT";
}

function addPricePointIssues(
  offerMode: string,
  pricePointIds: ReadonlyArray<string | undefined>,
  pathFor: (index: number) => Array<string | number>,
  ctx: z.RefinementCtx
): void {
  pricePointIds.forEach((pricePointId, index) => {
    if (isPaidOfferMode(offerMode) && pricePointId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paid offers (PAY_AS_YOU_GO, PAY_UP_FRONT) need a pricePointId",
        path: pathFor(index),
      });
    }
    if (offerMode === "FREE_TRIAL" && pricePointId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Free trials have no price; remove pricePointId",
        path: pathFor(index),
      });
    }
  });
}

const limitSchema = z.number().int().min(1).max(200).optional();
const nonNegativeIntSchema = z.number().int().min(0);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must use YYYY-MM-DD");
const planTypeSchema = z.enum(["MONTHLY", "UPFRONT"]);
const winBackPrioritySchema = z.enum(["HIGH", "NORMAL"]);
const promotionIntentSchema = z.enum(["NOT_PROMOTED", "USE_AUTO_GENERATED_ASSETS"]);
const timeSinceLastSubscribedSchema = z.object({
  minimum: nonNegativeIntSchema,
  maximum: nonNegativeIntSchema,
});

/** Offers and win-back prices both expose territory and price point as relationships. */
const PRICE_INCLUDE = "territory,subscriptionPricePoint";

const listIntroductoryOffersInputSchema = z.object({
  subscriptionId: resourceIdSchema,
  territoryId: territoryIdSchema.optional(),
  limit: limitSchema,
});

const introductoryOfferIdInputSchema = z.object({
  introductoryOfferId: resourceIdSchema,
});

const createIntroductoryOfferInputSchema = z
  .object({
    subscriptionId: resourceIdSchema,
    duration: subscriptionOfferDurationSchema,
    offerMode: subscriptionOfferModeSchema,
    numberOfPeriods: z.number().int().min(1),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    targetSubscriptionPlanType: planTypeSchema.optional(),
    territoryId: territoryIdSchema.optional(),
    pricePointId: resourceIdSchema.optional(),
  })
  .superRefine((input, ctx) =>
    addPricePointIssues(input.offerMode, [input.pricePointId], () => ["pricePointId"], ctx)
  );

// Apple requires endDate on every PATCH; null removes the end date.
const updateIntroductoryOfferInputSchema = z.object({
  introductoryOfferId: resourceIdSchema,
  endDate: isoDateSchema.nullable(),
});

const winBackOfferIdInputSchema = z.object({
  winBackOfferId: resourceIdSchema,
});

const winBackPriceEntrySchema = z.object({
  territoryId: territoryIdSchema,
  pricePointId: resourceIdSchema.optional(),
});

const createWinBackOfferInputSchema = z
  .object({
    subscriptionId: resourceIdSchema,
    referenceName: z.string().min(1, "Reference name is required"),
    offerId: z.string().min(1, "Offer ID is required"),
    duration: subscriptionOfferDurationSchema,
    offerMode: subscriptionOfferModeSchema,
    periodCount: z.number().int().min(1),
    customerEligibilityPaidSubscriptionDurationInMonths: nonNegativeIntSchema,
    customerEligibilityTimeSinceLastSubscribedInMonths: timeSinceLastSubscribedSchema,
    customerEligibilityWaitBetweenOffersInMonths: nonNegativeIntSchema.optional(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.optional(),
    priority: winBackPrioritySchema,
    promotionIntent: promotionIntentSchema.optional(),
    targetSubscriptionPlanType: planTypeSchema.optional(),
    prices: z.array(winBackPriceEntrySchema).min(1, "At least one price is required"),
  })
  .superRefine((input, ctx) =>
    addPricePointIssues(
      input.offerMode,
      input.prices.map((price) => price.pricePointId),
      (index) => ["prices", index, "pricePointId"],
      ctx
    )
  );

const WIN_BACK_UPDATE_ATTRIBUTES = [
  "customerEligibilityPaidSubscriptionDurationInMonths",
  "customerEligibilityTimeSinceLastSubscribedInMonths",
  "customerEligibilityWaitBetweenOffersInMonths",
  "startDate",
  "endDate",
  "priority",
  "promotionIntent",
] as const;

const updateWinBackOfferInputSchema = z
  .object({
    winBackOfferId: resourceIdSchema,
    customerEligibilityPaidSubscriptionDurationInMonths: nonNegativeIntSchema.optional(),
    customerEligibilityTimeSinceLastSubscribedInMonths: timeSinceLastSubscribedSchema.optional(),
    customerEligibilityWaitBetweenOffersInMonths: nonNegativeIntSchema.nullable().optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.nullable().optional(),
    priority: winBackPrioritySchema.optional(),
    promotionIntent: promotionIntentSchema.nullable().optional(),
  })
  .refine((input) => WIN_BACK_UPDATE_ATTRIBUTES.some((key) => input[key] !== undefined), {
    message: "Provide at least one field to update",
  });

const listWinBackOffersInputSchema = z.object({
  subscriptionId: resourceIdSchema,
  limit: limitSchema,
});

const listWinBackOfferPricesInputSchema = z.object({
  winBackOfferId: resourceIdSchema,
  territoryId: territoryIdSchema.optional(),
  limit: limitSchema,
});

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

const INTRO_CREATE_ATTRIBUTES = [
  "duration",
  "offerMode",
  "numberOfPeriods",
  "startDate",
  "endDate",
  "targetSubscriptionPlanType",
] as const;

const WIN_BACK_CREATE_ATTRIBUTES = [
  "referenceName",
  "offerId",
  "duration",
  "offerMode",
  "periodCount",
  "customerEligibilityPaidSubscriptionDurationInMonths",
  "customerEligibilityTimeSinceLastSubscribedInMonths",
  "customerEligibilityWaitBetweenOffersInMonths",
  "startDate",
  "endDate",
  "priority",
  "promotionIntent",
  "targetSubscriptionPlanType",
] as const;

function formatIntroductoryOffer(offer: IntroductoryOfferResource) {
  return {
    id: offer.id,
    ...offer.attributes,
    territoryId: offer.relationships?.territory?.data?.id,
    pricePointId: offer.relationships?.subscriptionPricePoint?.data?.id,
  };
}

function formatWinBackOffer(offer: WinBackOfferResource) {
  return { id: offer.id, ...offer.attributes };
}

function formatWinBackPrice(price: WinBackOfferPriceResource) {
  return {
    id: price.id,
    territoryId: price.relationships?.territory?.data?.id,
    pricePointId: price.relationships?.subscriptionPricePoint?.data?.id,
  };
}

// ============================================================================
// Handlers: introductory offers
// ============================================================================

/**
 * List introductory offers for a subscription, with territory and price point IDs
 */
export async function listIntroductoryOffers(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listIntroductoryOffersInputSchema, input);

    const query: Record<string, string | number> = { include: PRICE_INCLUDE };
    if (params.territoryId !== undefined) query["filter[territory]"] = params.territoryId;
    if (params.limit !== undefined) query.limit = params.limit;

    const response = await client.get<ASCListResponse<IntroductoryOfferResource>>(
      `/subscriptions/${params.subscriptionId}/introductoryOffers`,
      query
    );

    return {
      success: true,
      data: response.data.map(formatIntroductoryOffer),
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
 * Create an introductory offer for a subscription (paid modes need a price point)
 */
export async function createIntroductoryOffer(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createIntroductoryOfferInputSchema, input);

    const response = await client.post<ASCResponse<IntroductoryOfferResource>>(
      "/subscriptionIntroductoryOffers",
      {
        data: {
          type: "subscriptionIntroductoryOffers",
          attributes: pickDefined(params, INTRO_CREATE_ATTRIBUTES),
          relationships: {
            subscription: { data: { type: "subscriptions", id: params.subscriptionId } },
            ...(params.territoryId !== undefined
              ? { territory: { data: { type: "territories", id: params.territoryId } } }
              : {}),
            ...(params.pricePointId !== undefined
              ? {
                  subscriptionPricePoint: {
                    data: { type: "subscriptionPricePoints", id: params.pricePointId },
                  },
                }
              : {}),
          },
        },
      }
    );

    return { success: true, data: formatIntroductoryOffer(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Change the end date of an introductory offer (null removes it)
 */
export async function updateIntroductoryOffer(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateIntroductoryOfferInputSchema, input);

    const response = await client.patch<ASCResponse<IntroductoryOfferResource>>(
      `/subscriptionIntroductoryOffers/${params.introductoryOfferId}`,
      {
        data: {
          type: "subscriptionIntroductoryOffers",
          id: params.introductoryOfferId,
          attributes: pickDefined(params, ["endDate"]),
        },
      }
    );

    return { success: true, data: formatIntroductoryOffer(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete an introductory offer
 */
export async function deleteIntroductoryOffer(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(introductoryOfferIdInputSchema, input);
    await client.delete(`/subscriptionIntroductoryOffers/${params.introductoryOfferId}`);
    return {
      success: true,
      data: { deleted: true, introductoryOfferId: params.introductoryOfferId },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Handlers: win-back offers
// ============================================================================

/**
 * List win-back offers for a subscription
 */
export async function listWinBackOffers(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listWinBackOffersInputSchema, input);

    const query: Record<string, string | number> = {};
    if (params.limit !== undefined) query.limit = params.limit;

    const response = await client.get<ASCListResponse<WinBackOfferResource>>(
      `/subscriptions/${params.subscriptionId}/winBackOffers`,
      query
    );

    return {
      success: true,
      data: response.data.map(formatWinBackOffer),
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
 * Create a win-back offer with one price per territory. Paid modes need a price point on every price.
 */
export async function createWinBackOffer(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createWinBackOfferInputSchema, input);

    // Inline prices are linked by temporary IDs, which the API resolves within this request.
    const priceEntries = params.prices.map((price, index) => ({
      id: `\${price-${index + 1}}`,
      price,
    }));

    const response = await client.post<ASCResponse<WinBackOfferResource>>("/winBackOffers", {
      data: {
        type: "winBackOffers",
        attributes: pickDefined(params, WIN_BACK_CREATE_ATTRIBUTES),
        relationships: {
          subscription: { data: { type: "subscriptions", id: params.subscriptionId } },
          prices: {
            data: priceEntries.map(({ id }) => ({ type: "winBackOfferPrices", id })),
          },
        },
      },
      included: priceEntries.map(({ id, price }) => ({
        type: "winBackOfferPrices",
        id,
        relationships: {
          territory: { data: { type: "territories", id: price.territoryId } },
          ...(price.pricePointId !== undefined
            ? {
                subscriptionPricePoint: {
                  data: { type: "subscriptionPricePoints", id: price.pricePointId },
                },
              }
            : {}),
        },
      })),
    });

    return { success: true, data: formatWinBackOffer(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update the eligibility, dates, priority, or promotion intent of a win-back offer
 */
export async function updateWinBackOffer(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateWinBackOfferInputSchema, input);

    const response = await client.patch<ASCResponse<WinBackOfferResource>>(
      `/winBackOffers/${params.winBackOfferId}`,
      {
        data: {
          type: "winBackOffers",
          id: params.winBackOfferId,
          attributes: pickDefined(params, WIN_BACK_UPDATE_ATTRIBUTES),
        },
      }
    );

    return { success: true, data: formatWinBackOffer(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a win-back offer
 */
export async function deleteWinBackOffer(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(winBackOfferIdInputSchema, input);
    await client.delete(`/winBackOffers/${params.winBackOfferId}`);
    return { success: true, data: { deleted: true, winBackOfferId: params.winBackOfferId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List the per-territory prices of a win-back offer
 */
export async function listWinBackOfferPrices(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listWinBackOfferPricesInputSchema, input);

    const query: Record<string, string | number> = { include: PRICE_INCLUDE };
    if (params.territoryId !== undefined) query["filter[territory]"] = params.territoryId;
    if (params.limit !== undefined) query.limit = params.limit;

    const response = await client.get<ASCListResponse<WinBackOfferPriceResource>>(
      `/winBackOffers/${params.winBackOfferId}/prices`,
      query
    );

    return {
      success: true,
      data: response.data.map(formatWinBackPrice),
      meta: {
        total: response.meta?.paging?.total,
        returned: response.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

const subscriptionIdProperty = { type: "string", description: "The subscription ID" };
const territoryIdProperty = { type: "string", description: "Territory code, e.g. USA or GBR" };
const limitProperty = { type: "integer", minimum: 1, maximum: 200, description: "Maximum results" };
const pricePointIdProperty = {
  type: "string",
  description:
    "Subscription price point ID. Required for paid offers; not allowed for free trials.",
};
const offerDurationProperty = {
  type: "string",
  enum: subscriptionOfferDurationSchema.options,
  description: "Length of each offer period",
};
const offerModeProperty = {
  type: "string",
  enum: subscriptionOfferModeSchema.options,
  description: "FREE_TRIAL, PAY_AS_YOU_GO, or PAY_UP_FRONT",
};
const planTypeProperty = {
  type: "string",
  enum: ["MONTHLY", "UPFRONT"],
  description: "Subscription plan type the offer targets",
};
const winBackPriorityProperty = {
  type: "string",
  enum: ["HIGH", "NORMAL"],
  description: "Priority when several win-back offers qualify",
};
const promotionIntentProperty = {
  type: "string",
  enum: ["NOT_PROMOTED", "USE_AUTO_GENERATED_ASSETS"],
  description: "Whether App Store promotes the offer",
};

export const subscriptionOffersToolDefinitions = [
  {
    name: "list_introductory_offers",
    description:
      "List introductory offers for a subscription, with territory and price point IDs. Optionally filter by territory.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: subscriptionIdProperty,
        territoryId: territoryIdProperty,
        limit: limitProperty,
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "create_introductory_offer",
    description:
      "Create an introductory offer for a subscription in one territory. Paid offers need pricePointId; free trials must omit it.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: subscriptionIdProperty,
        duration: offerDurationProperty,
        offerMode: offerModeProperty,
        numberOfPeriods: { type: "integer", minimum: 1, description: "Number of periods" },
        startDate: { type: "string", description: "First redemption day, YYYY-MM-DD" },
        endDate: { type: "string", description: "Last redemption day, YYYY-MM-DD" },
        targetSubscriptionPlanType: planTypeProperty,
        territoryId: territoryIdProperty,
        pricePointId: pricePointIdProperty,
      },
      required: ["subscriptionId", "duration", "offerMode", "numberOfPeriods"],
    },
  },
  {
    name: "update_introductory_offer",
    description:
      "Change the end date of an introductory offer. Pass null as endDate to remove the end date.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        introductoryOfferId: { type: "string", description: "The introductory offer ID" },
        endDate: {
          type: ["string", "null"],
          description: "Last redemption day, YYYY-MM-DD, or null to remove it",
        },
      },
      required: ["introductoryOfferId", "endDate"],
    },
  },
  {
    name: "delete_introductory_offer",
    description: "Delete an introductory offer by ID.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        introductoryOfferId: { type: "string", description: "The introductory offer ID to delete" },
      },
      required: ["introductoryOfferId"],
    },
  },
  {
    name: "list_win_back_offers",
    description: "List win-back offers for a subscription.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: subscriptionIdProperty,
        limit: limitProperty,
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "create_win_back_offer",
    description:
      "Create a win-back offer for lapsed subscribers, with one price entry per territory. Paid offers need a pricePointId on every price; free trials must omit it.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: subscriptionIdProperty,
        referenceName: { type: "string", description: "Internal name for the offer" },
        offerId: { type: "string", description: "Offer identifier used to redeem the offer" },
        duration: offerDurationProperty,
        offerMode: offerModeProperty,
        periodCount: { type: "integer", minimum: 1, description: "Number of periods" },
        customerEligibilityPaidSubscriptionDurationInMonths: {
          type: "integer",
          minimum: 0,
          description: "Months the customer must have paid for the subscription",
        },
        customerEligibilityTimeSinceLastSubscribedInMonths: {
          type: "object",
          description: "Customer last subscribed between minimum and maximum months ago",
          properties: {
            minimum: { type: "integer", minimum: 0 },
            maximum: { type: "integer", minimum: 0 },
          },
          required: ["minimum", "maximum"],
        },
        customerEligibilityWaitBetweenOffersInMonths: {
          type: "integer",
          minimum: 0,
          description: "Months to wait between win-back offers",
        },
        startDate: { type: "string", description: "First day the offer is available, YYYY-MM-DD" },
        endDate: { type: "string", description: "Last day the offer is available, YYYY-MM-DD" },
        priority: winBackPriorityProperty,
        promotionIntent: promotionIntentProperty,
        targetSubscriptionPlanType: planTypeProperty,
        prices: {
          type: "array",
          minItems: 1,
          description: "Per-territory prices. Paid offers need a pricePointId on every entry.",
          items: {
            type: "object",
            properties: {
              territoryId: territoryIdProperty,
              pricePointId: pricePointIdProperty,
            },
            required: ["territoryId"],
          },
        },
      },
      required: [
        "subscriptionId",
        "referenceName",
        "offerId",
        "duration",
        "offerMode",
        "periodCount",
        "customerEligibilityPaidSubscriptionDurationInMonths",
        "customerEligibilityTimeSinceLastSubscribedInMonths",
        "startDate",
        "priority",
        "prices",
      ],
    },
  },
  {
    name: "update_win_back_offer",
    description:
      "Update a win-back offer's eligibility, dates, priority, or promotion intent. Only the fields provided are changed.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        winBackOfferId: { type: "string", description: "The win-back offer ID" },
        customerEligibilityPaidSubscriptionDurationInMonths: {
          type: "integer",
          minimum: 0,
          description: "Months the customer must have paid for the subscription",
        },
        customerEligibilityTimeSinceLastSubscribedInMonths: {
          type: "object",
          description: "Customer last subscribed between minimum and maximum months ago",
          properties: {
            minimum: { type: "integer", minimum: 0 },
            maximum: { type: "integer", minimum: 0 },
          },
          required: ["minimum", "maximum"],
        },
        customerEligibilityWaitBetweenOffersInMonths: {
          type: ["integer", "null"],
          minimum: 0,
          description: "Months to wait between win-back offers, or null to remove the wait",
        },
        startDate: { type: "string", description: "First day the offer is available, YYYY-MM-DD" },
        endDate: {
          type: ["string", "null"],
          description: "Last day the offer is available, YYYY-MM-DD, or null to remove it",
        },
        priority: winBackPriorityProperty,
        promotionIntent: {
          ...promotionIntentProperty,
          type: ["string", "null"],
          enum: [...promotionIntentProperty.enum, null],
          description: "Whether App Store promotes the offer, or null to remove the setting",
        },
      },
      required: ["winBackOfferId"],
    },
  },
  {
    name: "delete_win_back_offer",
    description: "Delete a win-back offer by ID.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        winBackOfferId: { type: "string", description: "The win-back offer ID to delete" },
      },
      required: ["winBackOfferId"],
    },
  },
  {
    name: "list_win_back_offer_prices",
    description:
      "List the per-territory prices of a win-back offer, with territory and price point IDs. Optionally filter by territory.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        winBackOfferId: { type: "string", description: "The win-back offer ID" },
        territoryId: territoryIdProperty,
        limit: limitProperty,
      },
      required: ["winBackOfferId"],
    },
  },
];

export const subscriptionOffersToolsModule: ToolModule = {
  toolset: "subscriptions",
  definitions: subscriptionOffersToolDefinitions,
  handlers: {
    list_introductory_offers: listIntroductoryOffers,
    create_introductory_offer: createIntroductoryOffer,
    update_introductory_offer: updateIntroductoryOffer,
    delete_introductory_offer: deleteIntroductoryOffer,
    list_win_back_offers: listWinBackOffers,
    create_win_back_offer: createWinBackOffer,
    update_win_back_offer: updateWinBackOffer,
    delete_win_back_offer: deleteWinBackOffer,
    list_win_back_offer_prices: listWinBackOfferPrices,
  },
};
