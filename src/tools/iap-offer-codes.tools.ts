/**
 * IAP Offer Code Tools - Create and manage offer codes for in-app purchases, generate
 * one-time-use and custom redemption codes, and read the generated one-time code values.
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import { deliverText } from "../utils/text-output.js";
import { resourceIdSchema, validateInput } from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Types
// ============================================================================

interface OfferCodeResource {
  type: "inAppPurchaseOfferCodes";
  id: string;
  attributes: {
    name?: string;
    customerEligibilities?: string[];
    productionCodeCount?: number;
    sandboxCodeCount?: number;
    active?: boolean;
  };
}

interface OneTimeUseCodeBatchResource {
  type: "inAppPurchaseOfferCodeOneTimeUseCodes";
  id: string;
  attributes: {
    numberOfCodes?: number;
    createdDate?: string;
    expirationDate?: string;
    active?: boolean;
    environment?: "PRODUCTION" | "SANDBOX";
  };
}

interface CustomCodeResource {
  type: "inAppPurchaseOfferCodeCustomCodes";
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

const limitSchema = z.number().int().min(1).max(200).optional();
const expirationDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiration date must be YYYY-MM-DD, e.g. 2026-12-31");
const customerEligibilitySchema = z.enum(["NON_SPENDER", "ACTIVE_SPENDER", "CHURNED_SPENDER"]);
const environmentSchema = z.enum(["PRODUCTION", "SANDBOX"]);

const inAppPurchaseOfferCodesInputSchema = z.object({
  inAppPurchaseId: resourceIdSchema,
  limit: limitSchema,
});

const offerCodeIdInputSchema = z.object({ offerCodeId: resourceIdSchema });

const createOfferCodeInputSchema = z.object({
  inAppPurchaseId: resourceIdSchema,
  name: z.string().min(1),
  customerEligibilities: z.array(customerEligibilitySchema).min(1),
  prices: z
    .array(
      z.object({
        territoryId: resourceIdSchema,
        pricePointId: resourceIdSchema,
      })
    )
    .min(1, "Provide at least one price"),
});

const updateOfferCodeInputSchema = z.object({
  offerCodeId: resourceIdSchema,
  active: z.boolean(),
});

const createOneTimeCodesInputSchema = z.object({
  offerCodeId: resourceIdSchema,
  numberOfCodes: z.number().int().min(1),
  expirationDate: expirationDateSchema,
  environment: environmentSchema.optional(),
});

const offerCodeListInputSchema = z.object({
  offerCodeId: resourceIdSchema,
  limit: limitSchema,
});

const oneTimeCodeValuesInputSchema = z.object({
  oneTimeUseCodeBatchId: resourceIdSchema,
  savePath: z.string().min(1).optional(),
});

const createCustomCodeInputSchema = z.object({
  offerCodeId: resourceIdSchema,
  customCode: z.string().min(1),
  numberOfCodes: z.number().int().min(1),
  expirationDate: expirationDateSchema.optional(),
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

function formatOfferCode(code: OfferCodeResource) {
  return {
    id: code.id,
    name: code.attributes.name,
    active: code.attributes.active,
    customerEligibilities: code.attributes.customerEligibilities,
    productionCodeCount: code.attributes.productionCodeCount,
    sandboxCodeCount: code.attributes.sandboxCodeCount,
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
 * List the offer codes configured for an in-app purchase
 */
export async function listIapOfferCodes(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(inAppPurchaseOfferCodesInputSchema, input);
    const response = await client.get<ASCListResponse<OfferCodeResource>>(
      `/v2/inAppPurchases/${params.inAppPurchaseId}/offerCodes`,
      { limit: params.limit }
    );
    return {
      success: true,
      data: response.data.map(formatOfferCode),
      meta: { total: response.meta?.paging?.total, returned: response.data.length },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get one in-app purchase offer code
 */
export async function getIapOfferCode(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(offerCodeIdInputSchema, input);
    const response = await client.get<ASCResponse<OfferCodeResource>>(
      `/inAppPurchaseOfferCodes/${params.offerCodeId}`
    );
    return { success: true, data: formatOfferCode(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create an in-app purchase offer code with per-territory prices (sent inline in the same request)
 */
export async function createIapOfferCode(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createOfferCodeInputSchema, input);

    // Temporary IDs link each inline price to the offer code's prices relationship.
    const prices = params.prices.map((price, index) => ({
      ...price,
      tempId: `\${price-${index + 1}}`,
    }));

    const response = await client.post<ASCResponse<OfferCodeResource>>("/inAppPurchaseOfferCodes", {
      data: {
        type: "inAppPurchaseOfferCodes",
        attributes: {
          name: params.name,
          customerEligibilities: params.customerEligibilities,
        },
        relationships: {
          inAppPurchase: { data: { type: "inAppPurchases", id: params.inAppPurchaseId } },
          prices: {
            data: prices.map((price) => ({ type: "inAppPurchaseOfferPrices", id: price.tempId })),
          },
        },
      },
      included: prices.map((price) => ({
        type: "inAppPurchaseOfferPrices",
        id: price.tempId,
        relationships: {
          territory: { data: { type: "territories", id: price.territoryId } },
          pricePoint: { data: { type: "inAppPurchasePricePoints", id: price.pricePointId } },
        },
      })),
    });

    return { success: true, data: formatOfferCode(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Activate or deactivate an in-app purchase offer code
 */
export async function updateIapOfferCode(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateOfferCodeInputSchema, input);
    const response = await client.patch<ASCResponse<OfferCodeResource>>(
      `/inAppPurchaseOfferCodes/${params.offerCodeId}`,
      {
        data: {
          type: "inAppPurchaseOfferCodes",
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
 * Generate a batch of one-time-use redemption codes for an offer code
 */
export async function createIapOneTimeCodes(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createOneTimeCodesInputSchema, input);
    const response = await client.post<ASCResponse<OneTimeUseCodeBatchResource>>(
      "/inAppPurchaseOfferCodeOneTimeUseCodes",
      {
        data: {
          type: "inAppPurchaseOfferCodeOneTimeUseCodes",
          attributes: pickDefined(params, ["numberOfCodes", "expirationDate", "environment"]),
          relationships: {
            offerCode: { data: { type: "inAppPurchaseOfferCodes", id: params.offerCodeId } },
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
 * List the one-time-use code batches generated for an offer code
 */
export async function listIapOneTimeCodeBatches(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(offerCodeListInputSchema, input);
    const response = await client.get<ASCListResponse<OneTimeUseCodeBatchResource>>(
      `/inAppPurchaseOfferCodes/${params.offerCodeId}/oneTimeUseCodes`,
      { limit: params.limit }
    );
    return {
      success: true,
      data: response.data.map(formatOneTimeCodeBatch),
      meta: { total: response.meta?.paging?.total, returned: response.data.length },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Download the redemption code values of a one-time-use batch as CSV
 */
export async function getIapOneTimeCodeValues(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(oneTimeCodeValuesInputSchema, input);
    // The values endpoint returns text/csv, not JSON, so it is the only call that uses requestRaw.
    const response = await client.requestRaw(
      `/inAppPurchaseOfferCodeOneTimeUseCodes/${params.oneTimeUseCodeBatchId}/values`,
      { headers: { Accept: "text/csv" } }
    );
    const delivered = await deliverText(await response.text(), params.savePath);
    return {
      success: true,
      data: {
        oneTimeUseCodeBatchId: params.oneTimeUseCodeBatchId,
        lineCount: delivered.lineCount,
        ...(delivered.savedTo ? { savedTo: delivered.savedTo } : { csv: delivered.text }),
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a custom redemption code for an offer code
 */
export async function createIapCustomCode(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createCustomCodeInputSchema, input);
    const response = await client.post<ASCResponse<CustomCodeResource>>(
      "/inAppPurchaseOfferCodeCustomCodes",
      {
        data: {
          type: "inAppPurchaseOfferCodeCustomCodes",
          attributes: pickDefined(params, ["customCode", "numberOfCodes", "expirationDate"]),
          relationships: {
            offerCode: { data: { type: "inAppPurchaseOfferCodes", id: params.offerCodeId } },
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
 * List the custom redemption codes for an offer code
 */
export async function listIapCustomCodes(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(offerCodeListInputSchema, input);
    const response = await client.get<ASCListResponse<CustomCodeResource>>(
      `/inAppPurchaseOfferCodes/${params.offerCodeId}/customCodes`,
      { limit: params.limit }
    );
    return {
      success: true,
      data: response.data.map(formatCustomCode),
      meta: { total: response.meta?.paging?.total, returned: response.data.length },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

export const iapOfferCodeToolDefinitions = [
  {
    name: "list_iap_offer_codes",
    description:
      "List the offer codes configured for an in-app purchase. Returns names, eligibility, active state, and code counts.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: { type: "string", description: "The in-app purchase ID" },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Maximum number of offer codes to return (1-200)",
        },
      },
      required: ["inAppPurchaseId"],
    },
  },
  {
    name: "get_iap_offer_code",
    description: "Get one in-app purchase offer code by ID.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The offer code ID" },
      },
      required: ["offerCodeId"],
    },
  },
  {
    name: "create_iap_offer_code",
    description:
      "Create an in-app purchase offer code with a price per territory. Each price needs a territory ID and a price point ID from list_in_app_purchase_price_points.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: { type: "string", description: "The in-app purchase ID" },
        name: { type: "string", description: "Internal name for the offer code" },
        customerEligibilities: {
          type: "array",
          minItems: 1,
          items: {
            type: "string",
            enum: ["NON_SPENDER", "ACTIVE_SPENDER", "CHURNED_SPENDER"],
          },
          description: "Customer groups that can redeem the offer code",
        },
        prices: {
          type: "array",
          minItems: 1,
          description: "One price per territory",
          items: {
            type: "object",
            properties: {
              territoryId: { type: "string", description: "Territory ID, e.g. USA" },
              pricePointId: { type: "string", description: "In-app purchase price point ID" },
            },
            required: ["territoryId", "pricePointId"],
          },
        },
      },
      required: ["inAppPurchaseId", "name", "customerEligibilities", "prices"],
    },
  },
  {
    name: "update_iap_offer_code",
    description:
      "Activate or deactivate an in-app purchase offer code. Deactivating stops new redemptions of its codes.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The offer code ID" },
        active: { type: "boolean", description: "true to activate, false to deactivate" },
      },
      required: ["offerCodeId", "active"],
    },
  },
  {
    name: "create_iap_one_time_codes",
    description:
      "Generate a batch of one-time-use redemption codes for an offer code. The generated codes are redeemable immediately.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The offer code ID" },
        numberOfCodes: { type: "integer", minimum: 1, description: "How many codes to generate" },
        expirationDate: {
          type: "string",
          description: "Date the codes expire, YYYY-MM-DD",
        },
        environment: {
          type: "string",
          enum: ["PRODUCTION", "SANDBOX"],
          description: "Environment the codes work in",
        },
      },
      required: ["offerCodeId", "numberOfCodes", "expirationDate"],
    },
  },
  {
    name: "list_iap_one_time_code_batches",
    description:
      "List the one-time-use code batches generated for an offer code, with counts and expiry dates.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The offer code ID" },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Maximum number of batches to return (1-200)",
        },
      },
      required: ["offerCodeId"],
    },
  },
  {
    name: "get_iap_one_time_code_values",
    description:
      "Get the redemption code values of a one-time-use batch as CSV, inline or (for large batches) to a new file via savePath, with the number of non-empty lines. The codes are sensitive.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        oneTimeUseCodeBatchId: {
          type: "string",
          description: "The one-time-use code batch ID from list_iap_one_time_code_batches",
        },
        savePath: {
          type: "string",
          description:
            "Absolute path of a new file to write the CSV to (owner-only permissions; an existing file is never overwritten). Required when the CSV is too large to return inline.",
        },
      },
      required: ["oneTimeUseCodeBatchId"],
    },
  },
  {
    name: "create_iap_custom_code",
    description:
      "Create a custom redemption code for an offer code. The code string is redeemable immediately by anyone who knows it.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The offer code ID" },
        customCode: { type: "string", description: "The custom code string customers enter" },
        numberOfCodes: {
          type: "integer",
          minimum: 1,
          description: "How many times the custom code can be redeemed",
        },
        expirationDate: {
          type: "string",
          description: "Date the code expires, YYYY-MM-DD (omit for no expiry date)",
        },
      },
      required: ["offerCodeId", "customCode", "numberOfCodes"],
    },
  },
  {
    name: "list_iap_custom_codes",
    description:
      "List the custom redemption codes for an offer code, with redemption counts and expiry dates.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        offerCodeId: { type: "string", description: "The offer code ID" },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Maximum number of custom codes to return (1-200)",
        },
      },
      required: ["offerCodeId"],
    },
  },
];

export const iapOfferCodesToolsModule: ToolModule = {
  toolset: "iap",
  definitions: iapOfferCodeToolDefinitions,
  handlers: {
    list_iap_offer_codes: listIapOfferCodes,
    get_iap_offer_code: getIapOfferCode,
    create_iap_offer_code: createIapOfferCode,
    update_iap_offer_code: updateIapOfferCode,
    create_iap_one_time_codes: createIapOneTimeCodes,
    list_iap_one_time_code_batches: listIapOneTimeCodeBatches,
    get_iap_one_time_code_values: getIapOneTimeCodeValues,
    create_iap_custom_code: createIapCustomCode,
    list_iap_custom_codes: listIapCustomCodes,
  },
};
