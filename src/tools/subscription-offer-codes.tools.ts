/**
 * Subscription Offer Code Tools - Create and manage subscription offer codes, one-time use
 * code batches (with CSV value download), and custom vanity codes.
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

interface SubscriptionOfferCodeResource {
  type: "subscriptionOfferCodes";
  id: string;
  attributes: {
    name?: string;
    customerEligibilities?: string[];
    offerEligibility?: string;
    duration?: string;
    offerMode?: string;
    numberOfPeriods?: number;
    totalNumberOfCodes?: number;
    productionCodeCount?: number;
    sandboxCodeCount?: number;
    active?: boolean;
    autoRenewEnabled?: boolean | null;
    targetSubscriptionPlanType?: string | null;
  };
}

interface OneTimeUseCodeBatchResource {
  type: "subscriptionOfferCodeOneTimeUseCodes";
  id: string;
  attributes: {
    numberOfCodes?: number;
    createdDate?: string;
    expirationDate?: string;
    active?: boolean;
    environment?: string;
  };
}

interface CustomCodeResource {
  type: "subscriptionOfferCodeCustomCodes";
  id: string;
  attributes: {
    customCode?: string;
    numberOfCodes?: number;
    createdDate?: string;
    expirationDate?: string | null;
    active?: boolean;
  };
}

// ============================================================================
// Input schemas
// ============================================================================

const customerEligibilitySchema = z.enum(["NEW", "EXISTING", "EXPIRED"]);
const offerEligibilitySchema = z.enum(["STACK_WITH_INTRO_OFFERS", "REPLACE_INTRO_OFFERS"]);
const targetSubscriptionPlanTypeSchema = z.enum(["MONTHLY", "UPFRONT"]);
const offerCodeEnvironmentSchema = z.enum(["PRODUCTION", "SANDBOX"]);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiration date must be YYYY-MM-DD");

const PAID_OFFER_MODES: ReadonlySet<string> = new Set(["PAY_AS_YOU_GO", "PAY_UP_FRONT"]);

const offerCodePriceSchema = z.object({
  territoryId: territoryIdSchema,
  pricePointId: resourceIdSchema,
});

const listSubscriptionOfferCodesInputSchema = z.object({
  subscriptionId: resourceIdSchema,
  territories: z.array(territoryIdSchema).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

const offerCodeIdInputSchema = z.object({ offerCodeId: resourceIdSchema });

const createSubscriptionOfferCodeInputSchema = z
  .object({
    subscriptionId: resourceIdSchema,
    name: z.string().min(1, "Name is required"),
    customerEligibilities: z
      .array(customerEligibilitySchema)
      .min(1, "At least one customer eligibility is required"),
    offerEligibility: offerEligibilitySchema,
    duration: subscriptionOfferDurationSchema,
    offerMode: subscriptionOfferModeSchema,
    numberOfPeriods: z.number().int().min(1),
    autoRenewEnabled: z.boolean().optional(),
    targetSubscriptionPlanType: targetSubscriptionPlanTypeSchema.optional(),
    prices: z.array(offerCodePriceSchema).optional(),
  })
  .superRefine((params, ctx) => {
    const prices = params.prices ?? [];
    if (PAID_OFFER_MODES.has(params.offerMode) && prices.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paid offer codes need at least one price",
        path: ["prices"],
      });
    }
    const territories = prices.map((price) => price.territoryId);
    if (new Set(territories).size !== territories.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each offer code price must use a unique territory",
        path: ["prices"],
      });
    }
  });

const updateSubscriptionOfferCodeInputSchema = z.object({
  offerCodeId: resourceIdSchema,
  active: z.boolean(),
});

const createSubscriptionOneTimeCodesInputSchema = z.object({
  offerCodeId: resourceIdSchema,
  numberOfCodes: z.number().int().min(1),
  expirationDate: isoDateSchema,
  environment: offerCodeEnvironmentSchema.optional(),
});

const oneTimeUseCodeBatchIdInputSchema = z.object({
  oneTimeUseCodeBatchId: resourceIdSchema,
});

const listSubscriptionOneTimeCodeBatchesInputSchema = z.object({
  offerCodeId: resourceIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

const createSubscriptionCustomCodeInputSchema = z.object({
  offerCodeId: resourceIdSchema,
  customCode: z.string().min(1, "Custom code is required"),
  numberOfCodes: z.number().int().min(1),
  expirationDate: isoDateSchema.optional(),
});

const listSubscriptionCustomCodesInputSchema = z.object({
  offerCodeId: resourceIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
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

/** Temporary ID for an inline subscriptionOfferCodePrices item in a create request. */
const tempPriceId = (index: number) => `\${price-${index + 1}}`;

function formatOfferCode(offerCode: SubscriptionOfferCodeResource) {
  return {
    id: offerCode.id,
    name: offerCode.attributes.name,
    active: offerCode.attributes.active,
    offerMode: offerCode.attributes.offerMode,
    duration: offerCode.attributes.duration,
    numberOfPeriods: offerCode.attributes.numberOfPeriods,
    offerEligibility: offerCode.attributes.offerEligibility,
    customerEligibilities: offerCode.attributes.customerEligibilities,
    autoRenewEnabled: offerCode.attributes.autoRenewEnabled,
    targetSubscriptionPlanType: offerCode.attributes.targetSubscriptionPlanType,
    totalNumberOfCodes: offerCode.attributes.totalNumberOfCodes,
    productionCodeCount: offerCode.attributes.productionCodeCount,
    sandboxCodeCount: offerCode.attributes.sandboxCodeCount,
  };
}

function formatOneTimeCodeBatch(batch: OneTimeUseCodeBatchResource) {
  return {
    id: batch.id,
    numberOfCodes: batch.attributes.numberOfCodes,
    createdDate: batch.attributes.createdDate,
    expirationDate: batch.attributes.expirationDate,
    active: batch.attributes.active,
    environment: batch.attributes.environment,
  };
}

function formatCustomCode(code: CustomCodeResource) {
  return {
    id: code.id,
    customCode: code.attributes.customCode,
    numberOfCodes: code.attributes.numberOfCodes,
    createdDate: code.attributes.createdDate,
    expirationDate: code.attributes.expirationDate,
    active: code.attributes.active,
  };
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * List the offer codes for a subscription, optionally filtered by territory
 */
export async function listSubscriptionOfferCodes(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listSubscriptionOfferCodesInputSchema, input);

    const response = await client.get<ASCListResponse<SubscriptionOfferCodeResource>>(
      `/subscriptions/${params.subscriptionId}/offerCodes`,
      {
        "filter[territory]": params.territories?.join(","),
        limit: params.limit,
      }
    );

    const results = response.data.map(formatOfferCode);
    return {
      success: true,
      data: results,
      meta: { total: response.meta?.paging?.total, returned: results.length },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get a single subscription offer code
 */
export async function getSubscriptionOfferCode(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(offerCodeIdInputSchema, input);
    const response = await client.get<ASCResponse<SubscriptionOfferCodeResource>>(
      `/subscriptionOfferCodes/${params.offerCodeId}`
    );
    return { success: true, data: formatOfferCode(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a subscription offer code, with optional per-territory prices for paid offers
 */
export async function createSubscriptionOfferCode(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createSubscriptionOfferCodeInputSchema, input);
    const prices = params.prices ?? [];

    const response = await client.post<ASCResponse<SubscriptionOfferCodeResource>>(
      "/subscriptionOfferCodes",
      {
        data: {
          type: "subscriptionOfferCodes",
          attributes: pickDefined(params, [
            "name",
            "customerEligibilities",
            "offerEligibility",
            "duration",
            "offerMode",
            "numberOfPeriods",
            "autoRenewEnabled",
            "targetSubscriptionPlanType",
          ]),
          relationships: {
            subscription: { data: { type: "subscriptions", id: params.subscriptionId } },
            prices: {
              data: prices.map((_, index) => ({
                type: "subscriptionOfferCodePrices",
                id: tempPriceId(index),
              })),
            },
          },
        },
        included: prices.map((price, index) => ({
          type: "subscriptionOfferCodePrices",
          id: tempPriceId(index),
          relationships: {
            territory: { data: { type: "territories", id: price.territoryId } },
            subscriptionPricePoint: {
              data: { type: "subscriptionPricePoints", id: price.pricePointId },
            },
          },
        })),
      }
    );

    return { success: true, data: formatOfferCode(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Activate or deactivate a subscription offer code
 */
export async function updateSubscriptionOfferCode(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateSubscriptionOfferCodeInputSchema, input);

    const response = await client.patch<ASCResponse<SubscriptionOfferCodeResource>>(
      `/subscriptionOfferCodes/${params.offerCodeId}`,
      {
        data: {
          type: "subscriptionOfferCodes",
          id: params.offerCodeId,
          attributes: pickDefined(params, ["active"]),
        },
      }
    );

    return { success: true, data: formatOfferCode(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Generate a batch of one-time use codes for a subscription offer code
 */
export async function createSubscriptionOneTimeCodes(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createSubscriptionOneTimeCodesInputSchema, input);

    const response = await client.post<ASCResponse<OneTimeUseCodeBatchResource>>(
      "/subscriptionOfferCodeOneTimeUseCodes",
      {
        data: {
          type: "subscriptionOfferCodeOneTimeUseCodes",
          attributes: pickDefined(params, ["numberOfCodes", "expirationDate", "environment"]),
          relationships: {
            offerCode: { data: { type: "subscriptionOfferCodes", id: params.offerCodeId } },
          },
        },
      }
    );

    return { success: true, data: formatOneTimeCodeBatch(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List the one-time use code batches generated for a subscription offer code
 */
export async function listSubscriptionOneTimeCodeBatches(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listSubscriptionOneTimeCodeBatchesInputSchema, input);

    const response = await client.get<ASCListResponse<OneTimeUseCodeBatchResource>>(
      `/subscriptionOfferCodes/${params.offerCodeId}/oneTimeUseCodes`,
      { limit: params.limit }
    );

    const results = response.data.map(formatOneTimeCodeBatch);
    return {
      success: true,
      data: results,
      meta: { total: response.meta?.paging?.total, returned: results.length },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Download the redemption codes of a one-time use code batch as CSV text
 */
export async function getSubscriptionOneTimeCodeValues(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(oneTimeUseCodeBatchIdInputSchema, input);

    const response = await client.requestRaw(
      `/subscriptionOfferCodeOneTimeUseCodes/${params.oneTimeUseCodeBatchId}/values`,
      { headers: { Accept: "text/csv" } }
    );
    const csv = await response.text();
    const lineCount = csv.split(/\r?\n/).filter((line) => line.trim() !== "").length;

    return {
      success: true,
      data: { oneTimeUseCodeBatchId: params.oneTimeUseCodeBatchId, csv, lineCount },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a custom (vanity) code for a subscription offer code
 */
export async function createSubscriptionCustomCode(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createSubscriptionCustomCodeInputSchema, input);

    const response = await client.post<ASCResponse<CustomCodeResource>>(
      "/subscriptionOfferCodeCustomCodes",
      {
        data: {
          type: "subscriptionOfferCodeCustomCodes",
          attributes: pickDefined(params, ["customCode", "numberOfCodes", "expirationDate"]),
          relationships: {
            offerCode: { data: { type: "subscriptionOfferCodes", id: params.offerCodeId } },
          },
        },
      }
    );

    return { success: true, data: formatCustomCode(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List the custom codes created for a subscription offer code
 */
export async function listSubscriptionCustomCodes(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listSubscriptionCustomCodesInputSchema, input);

    const response = await client.get<ASCListResponse<CustomCodeResource>>(
      `/subscriptionOfferCodes/${params.offerCodeId}/customCodes`,
      { limit: params.limit }
    );

    const results = response.data.map(formatCustomCode);
    return {
      success: true,
      data: results,
      meta: { total: response.meta?.paging?.total, returned: results.length },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

const offerCodeProperties = {
  subscriptionId: { type: "string", description: "The subscription ID" },
  name: {
    type: "string",
    description: "Reference name for the offer code (not shown to customers)",
  },
  customerEligibilities: {
    type: "array",
    items: { type: "string", enum: customerEligibilitySchema.options },
    minItems: 1,
    description: "Customer types the offer code applies to: NEW, EXISTING, or EXPIRED",
  },
  offerEligibility: {
    type: "string",
    enum: offerEligibilitySchema.options,
    description: "Whether the offer stacks with or replaces introductory offers",
  },
  duration: {
    type: "string",
    enum: subscriptionOfferDurationSchema.options,
    description: "Length of each billing period the offer covers",
  },
  offerMode: {
    type: "string",
    enum: subscriptionOfferModeSchema.options,
    description: "FREE_TRIAL, PAY_AS_YOU_GO, or PAY_UP_FRONT",
  },
  numberOfPeriods: { type: "integer", minimum: 1, description: "How many periods the offer lasts" },
  autoRenewEnabled: {
    type: "boolean",
    description: "Whether the subscription auto-renews after the offer ends",
  },
  targetSubscriptionPlanType: {
    type: "string",
    enum: targetSubscriptionPlanTypeSchema.options,
    description: "Plan type the offer targets: MONTHLY or UPFRONT",
  },
  prices: {
    type: "array",
    description: "Per-territory prices, required for paid offers. Each territory may appear once.",
    items: {
      type: "object",
      properties: {
        territoryId: { type: "string", description: "3-letter territory code, e.g. USA" },
        pricePointId: {
          type: "string",
          description: "Subscription price point ID for that territory",
        },
      },
      required: ["territoryId", "pricePointId"],
    },
  },
};

export const subscriptionOfferCodesToolDefinitions = [
  {
    name: "list_subscription_offer_codes",
    description:
      "List the offer codes for a subscription, optionally filtered by territory codes such as USA.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: offerCodeProperties.subscriptionId,
        territories: {
          type: "array",
          items: { type: "string", description: "3-letter territory code, e.g. USA" },
          description: "Only return offer codes available in these territories",
        },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Page size (max 200)" },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "get_subscription_offer_code",
    description: "Get one subscription offer code by ID, including its code counts and state.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The subscription offer code ID" },
      },
      required: ["offerCodeId"],
    },
  },
  {
    name: "create_subscription_offer_code",
    description:
      "Create a subscription offer code. Paid offers (PAY_AS_YOU_GO, PAY_UP_FRONT) need at least one price; use list_subscription_price_points to find price point IDs.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: offerCodeProperties,
      required: [
        "subscriptionId",
        "name",
        "customerEligibilities",
        "offerEligibility",
        "duration",
        "offerMode",
        "numberOfPeriods",
      ],
    },
  },
  {
    name: "update_subscription_offer_code",
    description:
      "Activate or deactivate a subscription offer code. Deactivating stops new redemptions and cannot be undone for customers who already hold the code.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The subscription offer code ID" },
        active: { type: "boolean", description: "true to activate, false to deactivate" },
      },
      required: ["offerCodeId", "active"],
    },
  },
  {
    name: "create_subscription_one_time_codes",
    description:
      "Generate a batch of one-time use redemption codes for a subscription offer code. Use get_subscription_one_time_code_values to download them.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The subscription offer code ID" },
        numberOfCodes: { type: "integer", minimum: 1, description: "How many codes to generate" },
        expirationDate: {
          type: "string",
          description: "Date the codes expire, YYYY-MM-DD",
        },
        environment: {
          type: "string",
          enum: offerCodeEnvironmentSchema.options,
          description: "PRODUCTION or SANDBOX codes",
        },
      },
      required: ["offerCodeId", "numberOfCodes", "expirationDate"],
    },
  },
  {
    name: "list_subscription_one_time_code_batches",
    description: "List the one-time use code batches generated for a subscription offer code.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The subscription offer code ID" },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Page size (max 200)" },
      },
      required: ["offerCodeId"],
    },
  },
  {
    name: "get_subscription_one_time_code_values",
    description:
      "Download the redemption codes of a one-time use code batch as CSV text. The codes are sensitive: treat the output as secret.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        oneTimeUseCodeBatchId: {
          type: "string",
          description:
            "The one-time use code batch ID (from list_subscription_one_time_code_batches)",
        },
      },
      required: ["oneTimeUseCodeBatchId"],
    },
  },
  {
    name: "create_subscription_custom_code",
    description:
      "Create a custom (vanity) redemption code for a subscription offer code, optionally with an expiration date.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The subscription offer code ID" },
        customCode: { type: "string", description: "The custom code customers will type" },
        numberOfCodes: {
          type: "integer",
          minimum: 1,
          description: "How many redemptions the custom code allows",
        },
        expirationDate: {
          type: "string",
          description: "Optional date the code expires, YYYY-MM-DD",
        },
      },
      required: ["offerCodeId", "customCode", "numberOfCodes"],
    },
  },
  {
    name: "list_subscription_custom_codes",
    description: "List the custom codes created for a subscription offer code.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The subscription offer code ID" },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Page size (max 200)" },
      },
      required: ["offerCodeId"],
    },
  },
];

export const subscriptionOfferCodesToolsModule: ToolModule = {
  toolset: "subscriptions",
  definitions: subscriptionOfferCodesToolDefinitions,
  handlers: {
    list_subscription_offer_codes: listSubscriptionOfferCodes,
    get_subscription_offer_code: getSubscriptionOfferCode,
    create_subscription_offer_code: createSubscriptionOfferCode,
    update_subscription_offer_code: updateSubscriptionOfferCode,
    create_subscription_one_time_codes: createSubscriptionOneTimeCodes,
    list_subscription_one_time_code_batches: listSubscriptionOneTimeCodeBatches,
    get_subscription_one_time_code_values: getSubscriptionOneTimeCodeValues,
    create_subscription_custom_code: createSubscriptionCustomCode,
    list_subscription_custom_codes: listSubscriptionCustomCodes,
  },
};
