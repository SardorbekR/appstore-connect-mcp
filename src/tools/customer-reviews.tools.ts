/**
 * Customer Review Tools - Read App Store customer reviews and manage developer responses.
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import { resourceIdSchema, territoryIdSchema, validateInput } from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Types
// ============================================================================

interface CustomerReviewResource {
  type: "customerReviews";
  id: string;
  attributes: {
    rating?: number;
    title?: string;
    body?: string;
    reviewerNickname?: string;
    createdDate?: string;
    territory?: string;
  };
  relationships?: {
    response?: { data?: { type: "customerReviewResponses"; id: string } | null };
  };
}

interface CustomerReviewResponseResource {
  type: "customerReviewResponses";
  id: string;
  attributes: {
    responseBody?: string;
    lastModifiedDate?: string;
    state?: "PUBLISHED" | "PENDING_PUBLISH";
  };
}

/** Developer responses arrive in `included` when a request asks for include=response. */
interface CustomerReviewsListResponse extends ASCListResponse<CustomerReviewResource> {
  included?: CustomerReviewResponseResource[];
}

interface CustomerReviewSingleResponse extends ASCResponse<CustomerReviewResource> {
  included?: CustomerReviewResponseResource[];
}

// ============================================================================
// Input schemas
// ============================================================================

const REVIEW_SORTS = ["rating", "-rating", "createdDate", "-createdDate"] as const;
const RESPONSE_BODY_MAX_LENGTH = 5970;

const listCustomerReviewsInputSchema = z.object({
  appId: resourceIdSchema,
  rating: z.number().int().min(1).max(5).optional(),
  territory: territoryIdSchema.optional(),
  sort: z.enum(REVIEW_SORTS).optional(),
  hasResponse: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

const reviewIdInputSchema = z.object({ reviewId: resourceIdSchema });

const createReviewResponseInputSchema = z.object({
  reviewId: resourceIdSchema,
  responseBody: z
    .string()
    .max(RESPONSE_BODY_MAX_LENGTH, "Response body can be at most 5970 characters")
    .refine((body) => body.trim().length > 0, { message: "Response body cannot be empty" }),
});

const deleteReviewResponseInputSchema = z.object({ responseId: resourceIdSchema });

// ============================================================================
// Helpers
// ============================================================================

type QueryParams = Record<string, string | number | boolean | undefined>;

/** Drop unset filters; `false` is a real value (e.g. hasResponse=false) and is kept. */
function definedParams(params: QueryParams): QueryParams {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}

function indexResponses(
  included: CustomerReviewResponseResource[] | undefined
): Map<string, CustomerReviewResponseResource> {
  return new Map((included ?? []).map((item) => [item.id, item] as const));
}

function formatReviewResponse(response: CustomerReviewResponseResource) {
  return {
    id: response.id,
    responseBody: response.attributes.responseBody,
    state: response.attributes.state,
    lastModifiedDate: response.attributes.lastModifiedDate,
  };
}

function formatReview(
  review: CustomerReviewResource,
  responses: ReadonlyMap<string, CustomerReviewResponseResource>
) {
  const responseId = review.relationships?.response?.data?.id;
  const response = responseId ? responses.get(responseId) : undefined;
  return {
    id: review.id,
    rating: review.attributes.rating,
    title: review.attributes.title,
    body: review.attributes.body,
    reviewerNickname: review.attributes.reviewerNickname,
    createdDate: review.attributes.createdDate,
    territory: review.attributes.territory,
    response: response ? formatReviewResponse(response) : null,
  };
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * List customer reviews for an app, with each review's developer response
 */
export async function listCustomerReviews(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listCustomerReviewsInputSchema, input);

    const response = await client.get<CustomerReviewsListResponse>(
      `/apps/${params.appId}/customerReviews`,
      definedParams({
        "filter[rating]": params.rating?.toString(),
        "filter[territory]": params.territory,
        "exists[publishedResponse]": params.hasResponse,
        sort: params.sort ?? "-createdDate",
        include: "response",
        limit: params.limit,
      })
    );

    const responses = indexResponses(response.included);
    const reviews = response.data.map((review) => formatReview(review, responses));

    return {
      success: true,
      data: reviews,
      meta: {
        total: response.meta?.paging?.total,
        returned: reviews.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get one customer review, including its developer response when one exists
 */
export async function getCustomerReview(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(reviewIdInputSchema, input);

    const response = await client.get<CustomerReviewSingleResponse>(
      `/customerReviews/${params.reviewId}`,
      { include: "response" }
    );

    return {
      success: true,
      data: formatReview(response.data, indexResponses(response.included)),
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get the developer response to a customer review (null when there is none)
 */
export async function getReviewResponse(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(reviewIdInputSchema, input);

    const response = await client.get<ASCResponse<CustomerReviewResponseResource | null>>(
      `/customerReviews/${params.reviewId}/response`
    );

    return {
      success: true,
      data: response.data ? formatReviewResponse(response.data) : null,
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Publish a developer response to a customer review (Apple replaces any existing response)
 */
export async function createReviewResponse(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createReviewResponseInputSchema, input);

    const response = await client.post<ASCResponse<CustomerReviewResponseResource>>(
      "/customerReviewResponses",
      {
        data: {
          type: "customerReviewResponses",
          attributes: { responseBody: params.responseBody },
          relationships: {
            review: { data: { type: "customerReviews", id: params.reviewId } },
          },
        },
      }
    );

    return { success: true, data: formatReviewResponse(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a developer response to a customer review
 */
export async function deleteReviewResponse(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deleteReviewResponseInputSchema, input);
    await client.delete(`/customerReviewResponses/${params.responseId}`);
    return { success: true, data: { deleted: true, responseId: params.responseId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

export const customerReviewsToolDefinitions = [
  {
    name: "list_customer_reviews",
    description:
      "List customer reviews for an app, each with its developer response when one exists. Newest first by default.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        rating: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "Only reviews with this star rating (1-5)",
        },
        territory: {
          type: "string",
          description: "Only reviews from this App Store territory, e.g. USA",
        },
        sort: {
          type: "string",
          enum: [...REVIEW_SORTS],
          description: "Sort order; defaults to -createdDate (newest first)",
        },
        hasResponse: {
          type: "boolean",
          description: "true for reviews that have a developer response, false for those without",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Maximum reviews to return (1-200)",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_customer_review",
    description: "Get one customer review by ID, including its developer response when one exists.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        reviewId: { type: "string", description: "The customer review ID" },
      },
      required: ["reviewId"],
    },
  },
  {
    name: "get_review_response",
    description: "Get the developer response to a customer review (null when there is none).",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        reviewId: { type: "string", description: "The customer review ID" },
      },
      required: ["reviewId"],
    },
  },
  {
    name: "create_review_response",
    description:
      "Publish a developer response to a customer review. Apple replaces any existing response, and the text is public on the App Store.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        reviewId: { type: "string", description: "The customer review ID to respond to" },
        responseBody: {
          type: "string",
          minLength: 1,
          maxLength: RESPONSE_BODY_MAX_LENGTH,
          description: "Response text, up to 5970 characters; it is shown publicly",
        },
      },
      required: ["reviewId", "responseBody"],
    },
  },
  {
    name: "delete_review_response",
    description:
      "Delete a developer response to a customer review. This removes the public reply from the App Store.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        responseId: {
          type: "string",
          description: "The developer response ID (from get_review_response)",
        },
      },
      required: ["responseId"],
    },
  },
];

export const customerReviewsToolsModule: ToolModule = {
  toolset: "reviews",
  definitions: customerReviewsToolDefinitions,
  handlers: {
    list_customer_reviews: listCustomerReviews,
    get_customer_review: getCustomerReview,
    get_review_response: getReviewResponse,
    create_review_response: createReviewResponse,
    delete_review_response: deleteReviewResponse,
  },
};
