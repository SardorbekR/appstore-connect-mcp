/**
 * Review Submission Tools - Create, submit, and cancel App Store review submissions, and
 * manage the items (versions, in-app purchases, subscriptions, ...) they contain.
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse } from "../api/types.js";
import { ASCError, formatErrorResponse } from "../utils/errors.js";
import { resourceIdSchema, validateInput } from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

const PLATFORMS = ["IOS", "MAC_OS", "TV_OS", "VISION_OS"] as const;

const SUBMISSION_STATES = [
  "READY_FOR_REVIEW",
  "WAITING_FOR_REVIEW",
  "IN_REVIEW",
  "UNRESOLVED_ISSUES",
  "CANCELING",
  "COMPLETING",
  "COMPLETE",
] as const;

/** Item relationship names accepted by add_review_submission_item, mapped to the resource type they link to. */
const ITEM_RESOURCE_TYPES = {
  appStoreVersion: "appStoreVersions",
  appCustomProductPageVersion: "appCustomProductPageVersions",
  appStoreVersionExperiment: "appStoreVersionExperiments",
  appStoreVersionExperimentV2: "appStoreVersionExperiments",
  appEvent: "appEvents",
  appAssetLibraryImage: "appAssetLibraryImages",
  appAssetLibraryVideo: "appAssetLibraryVideos",
  backgroundAssetVersion: "backgroundAssetVersions",
  inAppPurchaseVersion: "inAppPurchaseVersions",
  subscriptionVersion: "subscriptionVersions",
  subscriptionGroupVersion: "subscriptionGroupVersions",
} as const;

type ItemType = keyof typeof ITEM_RESOURCE_TYPES;
const ITEM_TYPES = Object.keys(ITEM_RESOURCE_TYPES) as [ItemType, ...ItemType[]];

/** Item relationship names. Apple returns a relationship's linked ID only when it is named in `include`. */
const ITEM_RELATIONSHIP_NAMES = [
  "appStoreVersion",
  "appCustomProductPageVersion",
  "appStoreVersionExperiment",
  "appStoreVersionExperimentV2",
  "appEvent",
  "appAssetLibraryImage",
  "appAssetLibraryVideo",
  "backgroundAssetVersion",
  "gameCenterAchievementVersion",
  "gameCenterActivityVersion",
  "gameCenterChallengeVersion",
  "gameCenterLeaderboardSetVersion",
  "gameCenterLeaderboardVersion",
  "inAppPurchaseVersion",
  "subscriptionVersion",
  "subscriptionGroupVersion",
];

/** Attribute and relationship fields requested on item reads. */
const ITEM_READ_FIELDS = ["state", ...ITEM_RELATIONSHIP_NAMES].join(",");

/** The same relationship names, sent as `include` so their linked IDs are returned. */
const ITEM_READ_FIELDS_WITHOUT_STATE = ITEM_RELATIONSHIP_NAMES.join(",");

/** Apple's 409 text names the conflicting submission, e.g. "... reviewSubmission with id <X>". */
const CONFLICT_SUBMISSION_PATTERN = /reviewSubmission (?:with id )?['"[]?(?!with\b)([\w-]+)/;

/** Cancel states Apple returns once a cancel request has been accepted. */
const CANCEL_ACCEPTED_STATES = new Set<string>(["CANCELING", "COMPLETE"]);

const MAX_PAGE_LIMIT = 200;

// ============================================================================
// Types
// ============================================================================

interface ReviewSubmissionResource {
  type: "reviewSubmissions";
  id: string;
  attributes: {
    platform?: (typeof PLATFORMS)[number];
    submittedDate?: string | null;
    state?: (typeof SUBMISSION_STATES)[number];
  };
}

interface ReviewSubmissionItemResource {
  type: "reviewSubmissionItems";
  id: string;
  attributes: {
    state?: "READY_FOR_REVIEW" | "ACCEPTED" | "APPROVED" | "REJECTED" | "REMOVED";
  };
  relationships?: Record<string, { data?: { type: string; id: string } | null }>;
}

// ============================================================================
// Input schemas
// ============================================================================

const platformSchema = z.enum(PLATFORMS);
const submissionStateSchema = z.enum(SUBMISSION_STATES);
const itemTypeSchema = z.enum(ITEM_TYPES);

const submissionIdInputSchema = z.object({ submissionId: resourceIdSchema });
const itemIdInputSchema = z.object({ itemId: resourceIdSchema });

const listReviewSubmissionsInputSchema = z.object({
  appId: resourceIdSchema,
  state: z.array(submissionStateSchema).min(1).optional(),
  platform: z.array(platformSchema).min(1).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
});

const createReviewSubmissionInputSchema = z.object({
  appId: resourceIdSchema,
  platform: platformSchema,
});

const addReviewSubmissionItemInputSchema = z.object({
  submissionId: resourceIdSchema,
  itemType: itemTypeSchema,
  itemId: resourceIdSchema,
});

const submitReviewSubmissionInputSchema = z.object({
  submissionId: resourceIdSchema,
  expectedItemIds: z
    .array(resourceIdSchema)
    .min(1, "expectedItemIds must list at least one item ID"),
});

// ============================================================================
// Helpers
// ============================================================================

/** A refused operation: success false with a stable code and any extra context. */
function refusal(code: string, message: string, extra: Record<string, unknown> = {}) {
  return { success: false, error: { code, message, ...extra } };
}

function formatSubmission(submission: ReviewSubmissionResource) {
  return {
    id: submission.id,
    platform: submission.attributes.platform,
    state: submission.attributes.state,
    submittedDate: submission.attributes.submittedDate,
  };
}

function formatItem(item: ReviewSubmissionItemResource) {
  const relationshipIds: Record<string, string> = {};
  for (const [name, relationship] of Object.entries(item.relationships ?? {})) {
    if (relationship.data) relationshipIds[name] = relationship.data.id;
  }
  return { id: item.id, state: item.attributes.state, relationshipIds };
}

/** Item IDs present in the submission but not expected, and expected but not present. */
function diffItemIds(listedIds: string[], expectedIds: string[]) {
  const listed = new Set(listedIds);
  const expected = new Set(expectedIds);
  return {
    extraItemIds: listedIds.filter((id) => !expected.has(id)),
    missingItemIds: [...expected].filter((id) => !listed.has(id)),
  };
}

/** Find the conflicting submission ID in the 409 message first, then in the error details. */
function conflictingSubmissionIdOf(error: ASCError): string | undefined {
  const texts = [error.message, ...(error.details ?? []).map((detail) => JSON.stringify(detail))];
  for (const text of texts) {
    const match = CONFLICT_SUBMISSION_PATTERN.exec(text);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * List review submissions for an app, optionally filtered by state or platform
 */
export async function listReviewSubmissions(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listReviewSubmissionsInputSchema, input);

    const query: Record<string, string | number> = { "filter[app]": params.appId };
    if (params.state) query["filter[state]"] = params.state.join(",");
    if (params.platform) query["filter[platform]"] = params.platform.join(",");
    if (params.limit) query.limit = params.limit;

    const response = await client.get<ASCListResponse<ReviewSubmissionResource>>(
      "/reviewSubmissions",
      query
    );

    return {
      success: true,
      data: response.data.map(formatSubmission),
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
 * Get a review submission with the items it contains
 */
export async function getReviewSubmission(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(submissionIdInputSchema, input);

    const submission = await client.get<ASCResponse<ReviewSubmissionResource>>(
      `/reviewSubmissions/${params.submissionId}`
    );
    const items = await client.get<ASCListResponse<ReviewSubmissionItemResource>>(
      `/reviewSubmissions/${params.submissionId}/items`,
      {
        "fields[reviewSubmissionItems]": ITEM_READ_FIELDS,
        include: ITEM_READ_FIELDS_WITHOUT_STATE,
        limit: MAX_PAGE_LIMIT,
      }
    );

    return {
      success: true,
      data: {
        ...formatSubmission(submission.data),
        items: items.data.map(formatItem),
      },
      meta: {
        itemsTotal: items.meta?.paging?.total,
        itemsReturned: items.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a review submission for one platform of an app
 */
export async function createReviewSubmission(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createReviewSubmissionInputSchema, input);

    const response = await client.post<ASCResponse<ReviewSubmissionResource>>(
      "/reviewSubmissions",
      {
        data: {
          type: "reviewSubmissions",
          attributes: { platform: params.platform },
          relationships: {
            app: { data: { type: "apps", id: params.appId } },
          },
        },
      }
    );

    return { success: true, data: formatSubmission(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Add one item (a version, in-app purchase, subscription, ...) to a review submission
 */
export async function addReviewSubmissionItem(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(addReviewSubmissionItemInputSchema, input);

    const response = await client.post<ASCResponse<ReviewSubmissionItemResource>>(
      "/reviewSubmissionItems",
      {
        data: {
          type: "reviewSubmissionItems",
          relationships: {
            reviewSubmission: { data: { type: "reviewSubmissions", id: params.submissionId } },
            [params.itemType]: {
              data: { type: ITEM_RESOURCE_TYPES[params.itemType], id: params.itemId },
            },
          },
        },
      }
    );

    return { success: true, data: formatItem(response.data) };
  } catch (error) {
    if (error instanceof ASCError && error.status === 409) {
      const conflictingSubmissionId = conflictingSubmissionIdOf(error);
      if (conflictingSubmissionId) {
        return refusal("CONFLICT", error.message, {
          conflictingSubmissionId,
          details: error.details,
        });
      }
    }
    return formatErrorResponse(error);
  }
}

/**
 * Remove an item from a review submission
 */
export async function removeReviewSubmissionItem(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(itemIdInputSchema, input);
    await client.delete(`/reviewSubmissionItems/${params.itemId}`);
    return { success: true, data: { deleted: true, itemId: params.itemId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Submit a review submission for review, only when its items are exactly the expected set
 */
export async function submitReviewSubmission(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(submitReviewSubmissionInputSchema, input);

    const listed = await client.get<ASCListResponse<ReviewSubmissionItemResource>>(
      `/reviewSubmissions/${params.submissionId}/items`,
      { limit: MAX_PAGE_LIMIT }
    );

    // A partial page cannot prove the item set is exact, so it is refused like a mismatch.
    if (listed.links?.next) {
      return refusal(
        "ITEMS_MISMATCH",
        `The submission has more than ${MAX_PAGE_LIMIT} items, so its item set cannot be verified. Nothing was submitted.`
      );
    }

    const diff = diffItemIds(
      listed.data.map((item) => item.id),
      params.expectedItemIds
    );
    if (diff.extraItemIds.length > 0 || diff.missingItemIds.length > 0) {
      return refusal(
        "ITEMS_MISMATCH",
        "The submission's items do not match expectedItemIds. Nothing was submitted or removed.",
        diff
      );
    }

    const response = await client.patch<ASCResponse<ReviewSubmissionResource>>(
      `/reviewSubmissions/${params.submissionId}`,
      {
        data: {
          type: "reviewSubmissions",
          id: params.submissionId,
          attributes: { submitted: true },
        },
      }
    );

    return { success: true, data: formatSubmission(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Cancel a review submission that is still in progress
 */
export async function cancelReviewSubmission(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(submissionIdInputSchema, input);

    const response = await client.patch<ASCResponse<ReviewSubmissionResource>>(
      `/reviewSubmissions/${params.submissionId}`,
      {
        data: {
          type: "reviewSubmissions",
          id: params.submissionId,
          attributes: { canceled: true },
        },
      }
    );

    const state = response.data.attributes.state;
    if (!state || !CANCEL_ACCEPTED_STATES.has(state)) {
      return refusal(
        "CANCEL_NOT_CONFIRMED",
        `Apple returned state ${state ?? "none"} after the cancel request; expected CANCELING or COMPLETE.`,
        { state }
      );
    }

    return { success: true, data: formatSubmission(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

export const reviewSubmissionToolDefinitions = [
  {
    name: "list_review_submissions",
    description:
      "List review submissions for an app, optionally filtered by state or platform. Use the returned IDs with get_review_submission.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        state: {
          type: "array",
          items: { type: "string", enum: [...SUBMISSION_STATES] },
          minItems: 1,
          description: "Only submissions in these states",
        },
        platform: {
          type: "array",
          items: { type: "string", enum: [...PLATFORMS] },
          minItems: 1,
          description: "Only submissions for these platforms",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_PAGE_LIMIT,
          description: "Maximum number of submissions to return (1 to 200)",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_review_submission",
    description:
      "Get a review submission with the items it contains. Each item lists the IDs of the resources it links to.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        submissionId: { type: "string", description: "The review submission ID" },
      },
      required: ["submissionId"],
    },
  },
  {
    name: "create_review_submission",
    description:
      "Create a review submission for one platform of an app. Items are added afterwards with add_review_submission_item.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        platform: {
          type: "string",
          enum: [...PLATFORMS],
          description: "Platform the submission is for",
        },
      },
      required: ["appId", "platform"],
    },
  },
  {
    name: "add_review_submission_item",
    description:
      "Add one item to a review submission. If the item already belongs to another open submission, the error names that submission in conflictingSubmissionId.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        submissionId: { type: "string", description: "The review submission ID" },
        itemType: {
          type: "string",
          enum: [...ITEM_TYPES],
          description: "Kind of resource being added, e.g. appStoreVersion",
        },
        itemId: {
          type: "string",
          description: "ID of the resource to add, e.g. an App Store version ID",
        },
      },
      required: ["submissionId", "itemType", "itemId"],
    },
  },
  {
    name: "remove_review_submission_item",
    description:
      "Remove an item from a review submission. Get item IDs from get_review_submission.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        itemId: { type: "string", description: "The review submission item ID to remove" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "submit_review_submission",
    description:
      "Submit a review submission to App Review. It is refused unless its items exactly match expectedItemIds; nothing is removed or added.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        submissionId: { type: "string", description: "The review submission ID to submit" },
        expectedItemIds: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Exact item IDs the submission must contain, from get_review_submission",
        },
      },
      required: ["submissionId", "expectedItemIds"],
    },
  },
  {
    name: "cancel_review_submission",
    description:
      "Cancel a review submission that is in progress. Apple then moves it to CANCELING.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        submissionId: { type: "string", description: "The review submission ID to cancel" },
      },
      required: ["submissionId"],
    },
  },
];

export const reviewSubmissionsToolsModule: ToolModule = {
  toolset: "versions",
  definitions: reviewSubmissionToolDefinitions,
  handlers: {
    list_review_submissions: listReviewSubmissions,
    get_review_submission: getReviewSubmission,
    create_review_submission: createReviewSubmission,
    add_review_submission_item: addReviewSubmissionItem,
    remove_review_submission_item: removeReviewSubmissionItem,
    submit_review_submission: submitReviewSubmission,
    cancel_review_submission: cancelReviewSubmission,
  },
};
