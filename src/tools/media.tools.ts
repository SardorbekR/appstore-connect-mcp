/**
 * Media Tools - Screenshot and app preview sets, screenshot and preview ordering and uploads,
 * and App Review screenshots for subscriptions and in-app purchases.
 */

import { extname } from "node:path";
import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse } from "../api/types.js";
import { type UploadedAsset, uploadAsset } from "../api/upload.js";
import { ASCError, ValidationError, formatErrorResponse } from "../utils/errors.js";
import { resourceIdSchema, validateInput } from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Types
// ============================================================================

interface ScreenshotSetResource {
  type: "appScreenshotSets";
  id: string;
  attributes: {
    screenshotDisplayType?: string;
  };
}

interface PreviewSetResource {
  type: "appPreviewSets";
  id: string;
  attributes: {
    previewType?: string;
  };
}

interface PreviewResource {
  type: "appPreviews";
  id: string;
  attributes: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    previewFrameTimeCode?: string | null;
    assetDeliveryState?: { state?: string } | null;
  };
}

/** A member of a to-many relationship, as returned by /relationships/... endpoints. */
interface ResourceIdentifier {
  type: string;
  id: string;
}

// ============================================================================
// Constants
// ============================================================================

const SCREENSHOT_DISPLAY_TYPES = [
  "APP_IPHONE_67",
  "APP_IPHONE_61",
  "APP_IPHONE_65",
  "APP_IPHONE_58",
  "APP_IPHONE_55",
  "APP_IPHONE_47",
  "APP_IPHONE_40",
  "APP_IPHONE_35",
  "APP_IPAD_PRO_3GEN_129",
  "APP_IPAD_PRO_3GEN_11",
  "APP_IPAD_PRO_129",
  "APP_IPAD_105",
  "APP_IPAD_97",
  "APP_DESKTOP",
  "APP_WATCH_ULTRA",
  "APP_WATCH_SERIES_10",
  "APP_WATCH_SERIES_7",
  "APP_WATCH_SERIES_4",
  "APP_WATCH_SERIES_3",
  "APP_APPLE_TV",
  "APP_APPLE_VISION_PRO",
  "IMESSAGE_APP_IPHONE_67",
  "IMESSAGE_APP_IPHONE_61",
  "IMESSAGE_APP_IPHONE_65",
  "IMESSAGE_APP_IPHONE_58",
  "IMESSAGE_APP_IPHONE_55",
  "IMESSAGE_APP_IPHONE_47",
  "IMESSAGE_APP_IPHONE_40",
  "IMESSAGE_APP_IPAD_PRO_3GEN_129",
  "IMESSAGE_APP_IPAD_PRO_3GEN_11",
  "IMESSAGE_APP_IPAD_PRO_129",
  "IMESSAGE_APP_IPAD_105",
  "IMESSAGE_APP_IPAD_97",
] as const;

const PREVIEW_TYPES = [
  "IPHONE_67",
  "IPHONE_61",
  "IPHONE_65",
  "IPHONE_58",
  "IPHONE_55",
  "IPHONE_47",
  "IPHONE_40",
  "IPHONE_35",
  "IPAD_PRO_3GEN_129",
  "IPAD_PRO_3GEN_11",
  "IPAD_PRO_129",
  "IPAD_105",
  "IPAD_97",
  "DESKTOP",
  "APPLE_TV",
  "APPLE_VISION_PRO",
] as const;

const MAX_PREVIEWS_PER_SET = 3;

/** Allowed app preview containers, keyed by lowercase extension. A Map avoids prototype keys. */
const PREVIEW_MIME_TYPES = new Map<string, string>([
  [".mov", "video/quicktime"],
  [".m4v", "video/x-m4v"],
  [".mp4", "video/mp4"],
]);

const PREVIEW_FORMAT_MESSAGE = "Preview must be a .mov, .m4v, or .mp4 file";

function previewMimeTypeFor(filePath: string): string | undefined {
  return PREVIEW_MIME_TYPES.get(extname(filePath).toLowerCase());
}

// ============================================================================
// Input schemas
// ============================================================================

const listLimitSchema = z.number().int().min(1).max(200).optional();
const screenshotDisplayTypeSchema = z.enum(SCREENSHOT_DISPLAY_TYPES);
const previewTypeSchema = z.enum(PREVIEW_TYPES);
const orderedIdsSchema = z.array(resourceIdSchema).min(1, "Provide the full ordered list of IDs");

const createScreenshotSetInputSchema = z.object({
  localizationId: resourceIdSchema,
  screenshotDisplayType: screenshotDisplayTypeSchema,
});

const screenshotSetIdInputSchema = z.object({ screenshotSetId: resourceIdSchema });

const screenshotIdInputSchema = z.object({ screenshotId: resourceIdSchema });

const reorderScreenshotsInputSchema = z.object({
  screenshotSetId: resourceIdSchema,
  screenshotIds: orderedIdsSchema,
});

const listPreviewSetsInputSchema = z.object({
  localizationId: resourceIdSchema,
  limit: listLimitSchema,
});

const createPreviewSetInputSchema = z.object({
  localizationId: resourceIdSchema,
  previewType: previewTypeSchema,
});

const previewSetIdInputSchema = z.object({ previewSetId: resourceIdSchema });

const listPreviewsInputSchema = z.object({
  previewSetId: resourceIdSchema,
  limit: listLimitSchema,
});

const previewIdInputSchema = z.object({ previewId: resourceIdSchema });

const reorderPreviewsInputSchema = z.object({
  previewSetId: resourceIdSchema,
  previewIds: orderedIdsSchema,
});

const uploadAppPreviewInputSchema = z.object({
  previewSetId: resourceIdSchema,
  filePath: z
    .string()
    .min(1, "File path is required")
    .refine((filePath) => previewMimeTypeFor(filePath) !== undefined, PREVIEW_FORMAT_MESSAGE),
  fileName: z.string().min(1).optional(),
  previewFrameTimeCode: z.string().min(1).optional(),
  waitForProcessing: z.boolean().optional(),
});

const uploadSubscriptionReviewScreenshotInputSchema = z.object({
  subscriptionId: resourceIdSchema,
  filePath: z.string().min(1, "File path is required"),
  fileName: z.string().min(1).optional(),
});

const uploadIapReviewScreenshotInputSchema = z.object({
  inAppPurchaseId: resourceIdSchema,
  filePath: z.string().min(1, "File path is required"),
  fileName: z.string().min(1).optional(),
});

// ============================================================================
// Helpers
// ============================================================================

function formatScreenshotSet(set: ScreenshotSetResource) {
  return { id: set.id, screenshotDisplayType: set.attributes.screenshotDisplayType };
}

function formatPreviewSet(set: PreviewSetResource) {
  return { id: set.id, previewType: set.attributes.previewType };
}

function formatPreview(preview: PreviewResource) {
  return {
    id: preview.id,
    fileName: preview.attributes.fileName,
    fileSize: preview.attributes.fileSize,
    mimeType: preview.attributes.mimeType,
    previewFrameTimeCode: preview.attributes.previewFrameTimeCode,
    deliveryState: preview.attributes.assetDeliveryState?.state,
  };
}

function formatUploadedAsset(asset: UploadedAsset) {
  return {
    id: asset.id,
    fileName: asset.attributes.fileName,
    fileSize: asset.attributes.fileSize,
    deliveryState: asset.attributes.assetDeliveryState?.state,
  };
}

/**
 * Replace the order of a to-many relationship. The IDs must be exactly the current members,
 * each once, so a stale or partial list can never drop or add a screenshot or preview.
 */
async function reorderMembers(
  client: AppStoreConnectClient,
  relationshipPath: string,
  memberType: "appScreenshots" | "appPreviews",
  orderedIds: readonly string[]
): Promise<void> {
  const current = await client.get<ASCListResponse<ResourceIdentifier>>(relationshipPath, {
    limit: 200,
  });
  const currentIds = current.data.map((member) => member.id);
  const requested = new Set(orderedIds);
  const exactMatch =
    requested.size === orderedIds.length &&
    requested.size === currentIds.length &&
    currentIds.every((id) => requested.has(id));

  if (!exactMatch) {
    throw new ASCError(
      `The order must list each current member exactly once. Current members: ${currentIds.join(", ") || "none"}`,
      "ORDER_MISMATCH",
      409
    );
  }

  await client.patch(relationshipPath, {
    data: orderedIds.map((id) => ({ type: memberType, id })),
  });
}

// ============================================================================
// Screenshot set handlers
// ============================================================================

/**
 * Create a screenshot set for one display size in a version localization
 */
export async function createScreenshotSet(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createScreenshotSetInputSchema, input);

    const response = await client.post<ASCResponse<ScreenshotSetResource>>("/appScreenshotSets", {
      data: {
        type: "appScreenshotSets",
        attributes: { screenshotDisplayType: params.screenshotDisplayType },
        relationships: {
          appStoreVersionLocalization: {
            data: { type: "appStoreVersionLocalizations", id: params.localizationId },
          },
        },
      },
    });

    return { success: true, data: formatScreenshotSet(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a screenshot set and every screenshot in it
 */
export async function deleteScreenshotSet(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(screenshotSetIdInputSchema, input);
    await client.delete(`/appScreenshotSets/${params.screenshotSetId}`);
    return { success: true, data: { deleted: true, screenshotSetId: params.screenshotSetId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete one screenshot
 */
export async function deleteScreenshot(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(screenshotIdInputSchema, input);
    await client.delete(`/appScreenshots/${params.screenshotId}`);
    return { success: true, data: { deleted: true, screenshotId: params.screenshotId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Set the display order of the screenshots in a set (full ordered list)
 */
export async function reorderScreenshots(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(reorderScreenshotsInputSchema, input);
    await reorderMembers(
      client,
      `/appScreenshotSets/${params.screenshotSetId}/relationships/appScreenshots`,
      "appScreenshots",
      params.screenshotIds
    );
    return {
      success: true,
      data: { screenshotSetId: params.screenshotSetId, screenshotIds: params.screenshotIds },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// App preview set handlers
// ============================================================================

/**
 * List the app preview sets (one per device type) in a version localization
 */
export async function listPreviewSets(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listPreviewSetsInputSchema, input);

    const response = await client.get<ASCListResponse<PreviewSetResource>>(
      `/appStoreVersionLocalizations/${params.localizationId}/appPreviewSets`,
      { limit: params.limit }
    );

    return {
      success: true,
      data: response.data.map(formatPreviewSet),
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
 * Create an app preview set for one device type in a version localization
 */
export async function createPreviewSet(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createPreviewSetInputSchema, input);

    const response = await client.post<ASCResponse<PreviewSetResource>>("/appPreviewSets", {
      data: {
        type: "appPreviewSets",
        attributes: { previewType: params.previewType },
        relationships: {
          appStoreVersionLocalization: {
            data: { type: "appStoreVersionLocalizations", id: params.localizationId },
          },
        },
      },
    });

    return { success: true, data: formatPreviewSet(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete an app preview set and every app preview in it
 */
export async function deletePreviewSet(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(previewSetIdInputSchema, input);
    await client.delete(`/appPreviewSets/${params.previewSetId}`);
    return { success: true, data: { deleted: true, previewSetId: params.previewSetId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List the app previews in a preview set
 */
export async function listPreviews(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listPreviewsInputSchema, input);

    const response = await client.get<ASCListResponse<PreviewResource>>(
      `/appPreviewSets/${params.previewSetId}/appPreviews`,
      { limit: params.limit }
    );

    return {
      success: true,
      data: response.data.map(formatPreview),
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
 * Upload a video as an app preview. The MIME type comes from the file extension, and a set
 * holds at most MAX_PREVIEWS_PER_SET previews.
 */
export async function uploadAppPreview(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(uploadAppPreviewInputSchema, input);
    const mimeType = previewMimeTypeFor(params.filePath);
    if (mimeType === undefined) throw new ValidationError(PREVIEW_FORMAT_MESSAGE, "filePath");

    const existing = await client.get<ASCListResponse<PreviewResource>>(
      `/appPreviewSets/${params.previewSetId}/appPreviews`,
      { limit: 200 }
    );
    if (existing.data.length >= MAX_PREVIEWS_PER_SET) {
      throw new ASCError(
        `Preview set ${params.previewSetId} already has ${existing.data.length} previews; a set holds at most ${MAX_PREVIEWS_PER_SET}. Delete one with delete_app_preview first.`,
        "PREVIEW_SET_FULL",
        409
      );
    }

    const extraAttributes: Record<string, unknown> = { mimeType };
    if (params.previewFrameTimeCode !== undefined) {
      extraAttributes.previewFrameTimeCode = params.previewFrameTimeCode;
    }

    const asset = await uploadAsset(client, {
      resourceType: "appPreviews",
      collectionPath: "/appPreviews",
      parent: { name: "appPreviewSet", type: "appPreviewSets", id: params.previewSetId },
      filePath: params.filePath,
      fileName: params.fileName,
      extraAttributes,
      waitForProcessing: params.waitForProcessing ?? false,
    });

    return {
      success: true,
      data: { previewSetId: params.previewSetId, ...formatUploadedAsset(asset) },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete one app preview
 */
export async function deleteAppPreview(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(previewIdInputSchema, input);
    await client.delete(`/appPreviews/${params.previewId}`);
    return { success: true, data: { deleted: true, previewId: params.previewId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Set the display order of the app previews in a preview set (full ordered list)
 */
export async function reorderPreviews(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(reorderPreviewsInputSchema, input);
    await reorderMembers(
      client,
      `/appPreviewSets/${params.previewSetId}/relationships/appPreviews`,
      "appPreviews",
      params.previewIds
    );
    return {
      success: true,
      data: { previewSetId: params.previewSetId, previewIds: params.previewIds },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// App Review screenshot handlers
// ============================================================================

/**
 * Upload the App Review screenshot for a subscription
 */
export async function uploadSubscriptionReviewScreenshot(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(uploadSubscriptionReviewScreenshotInputSchema, input);

    const asset = await uploadAsset(client, {
      resourceType: "subscriptionAppStoreReviewScreenshots",
      collectionPath: "/subscriptionAppStoreReviewScreenshots",
      parent: { name: "subscription", type: "subscriptions", id: params.subscriptionId },
      filePath: params.filePath,
      fileName: params.fileName,
    });

    return {
      success: true,
      data: { subscriptionId: params.subscriptionId, ...formatUploadedAsset(asset) },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Upload the App Review screenshot for an in-app purchase
 */
export async function uploadIapReviewScreenshot(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(uploadIapReviewScreenshotInputSchema, input);

    const asset = await uploadAsset(client, {
      resourceType: "inAppPurchaseAppStoreReviewScreenshots",
      collectionPath: "/inAppPurchaseAppStoreReviewScreenshots",
      parent: { name: "inAppPurchaseV2", type: "inAppPurchases", id: params.inAppPurchaseId },
      filePath: params.filePath,
      fileName: params.fileName,
    });

    return {
      success: true,
      data: { inAppPurchaseId: params.inAppPurchaseId, ...formatUploadedAsset(asset) },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

export const mediaToolDefinitions = [
  {
    name: "create_screenshot_set",
    description:
      "Create a screenshot set for one device display size in an App Store version localization. Add screenshots to it with upload_screenshot.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The App Store version localization ID",
        },
        screenshotDisplayType: {
          type: "string",
          enum: [...SCREENSHOT_DISPLAY_TYPES],
          description: "Device display size, e.g. APP_IPHONE_67 or APP_DESKTOP",
        },
      },
      required: ["localizationId", "screenshotDisplayType"],
    },
  },
  {
    name: "delete_screenshot_set",
    description: "Delete a screenshot set and every screenshot in it.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        screenshotSetId: { type: "string", description: "The screenshot set ID to delete" },
      },
      required: ["screenshotSetId"],
    },
  },
  {
    name: "delete_screenshot",
    description: "Delete one screenshot from its screenshot set.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        screenshotId: { type: "string", description: "The screenshot ID to delete" },
      },
      required: ["screenshotId"],
    },
  },
  {
    name: "reorder_screenshots",
    description:
      "Set the display order of the screenshots in a set. screenshotIds must list every current screenshot in the set exactly once, in the new order; get the IDs with list_screenshots.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        screenshotSetId: { type: "string", description: "The screenshot set ID" },
        screenshotIds: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Every screenshot ID in the set, in the desired display order",
        },
      },
      required: ["screenshotSetId", "screenshotIds"],
    },
  },
  {
    name: "list_preview_sets",
    description:
      "List the app preview sets (one per device type) in an App Store version localization.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The App Store version localization ID",
        },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Maximum results" },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "create_preview_set",
    description:
      "Create an app preview set for one device type in an App Store version localization. Add videos to it with upload_app_preview.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The App Store version localization ID",
        },
        previewType: {
          type: "string",
          enum: [...PREVIEW_TYPES],
          description: "Device type, e.g. IPHONE_67 or DESKTOP",
        },
      },
      required: ["localizationId", "previewType"],
    },
  },
  {
    name: "delete_preview_set",
    description: "Delete an app preview set and every app preview in it.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        previewSetId: { type: "string", description: "The app preview set ID to delete" },
      },
      required: ["previewSetId"],
    },
  },
  {
    name: "list_previews",
    description: "List the app previews (videos) in an app preview set.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        previewSetId: { type: "string", description: "The app preview set ID" },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Maximum results" },
      },
      required: ["previewSetId"],
    },
  },
  {
    name: "upload_app_preview",
    description:
      "Upload a .mov, .m4v, or .mp4 video as an app preview. A preview set holds at most 3 previews.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        previewSetId: { type: "string", description: "The app preview set ID" },
        filePath: { type: "string", description: "Local path to the video file" },
        fileName: {
          type: "string",
          description: "File name to store in App Store Connect (defaults to the file's name)",
        },
        previewFrameTimeCode: {
          type: "string",
          description: "Frame time code for the poster frame, e.g. 00:00:05:00",
        },
        waitForProcessing: {
          type: "boolean",
          description: "Wait until App Store Connect finishes processing the video (default false)",
        },
      },
      required: ["previewSetId", "filePath"],
    },
  },
  {
    name: "delete_app_preview",
    description: "Delete one app preview from its preview set.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        previewId: { type: "string", description: "The app preview ID to delete" },
      },
      required: ["previewId"],
    },
  },
  {
    name: "reorder_previews",
    description:
      "Set the display order of the app previews in a preview set. previewIds must list every current preview in the set exactly once, in the new order; get the IDs with list_previews.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        previewSetId: { type: "string", description: "The app preview set ID" },
        previewIds: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Every app preview ID in the set, in the desired display order",
        },
      },
      required: ["previewSetId", "previewIds"],
    },
  },
  {
    name: "upload_subscription_review_screenshot",
    description: "Upload the App Review screenshot for a subscription from a local file.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriptionId: { type: "string", description: "The subscription ID" },
        filePath: { type: "string", description: "Local path to the screenshot file" },
        fileName: {
          type: "string",
          description: "File name to store in App Store Connect (defaults to the file's name)",
        },
      },
      required: ["subscriptionId", "filePath"],
    },
  },
  {
    name: "upload_iap_review_screenshot",
    description: "Upload the App Review screenshot for an in-app purchase from a local file.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        inAppPurchaseId: { type: "string", description: "The in-app purchase ID" },
        filePath: { type: "string", description: "Local path to the screenshot file" },
        fileName: {
          type: "string",
          description: "File name to store in App Store Connect (defaults to the file's name)",
        },
      },
      required: ["inAppPurchaseId", "filePath"],
    },
  },
];

export const mediaToolsModule: ToolModule = {
  toolset: "media",
  definitions: mediaToolDefinitions,
  handlers: {
    create_screenshot_set: createScreenshotSet,
    delete_screenshot_set: deleteScreenshotSet,
    delete_screenshot: deleteScreenshot,
    reorder_screenshots: reorderScreenshots,
    list_preview_sets: listPreviewSets,
    create_preview_set: createPreviewSet,
    delete_preview_set: deletePreviewSet,
    list_previews: listPreviews,
    upload_app_preview: uploadAppPreview,
    delete_app_preview: deleteAppPreview,
    reorder_previews: reorderPreviews,
    upload_subscription_review_screenshot: uploadSubscriptionReviewScreenshot,
    upload_iap_review_screenshot: uploadIapReviewScreenshot,
  },
};
