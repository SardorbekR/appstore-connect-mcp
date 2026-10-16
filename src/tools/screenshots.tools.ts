/**
 * Screenshots Tools - Manage app screenshot sets and screenshots
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, AppScreenshot, AppScreenshotSet } from "../api/types.js";
import { uploadAsset } from "../api/upload.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  listScreenshotSetsInputSchema,
  listScreenshotsInputSchema,
  uploadScreenshotInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List screenshot sets for a version localization
 */
export async function listScreenshotSets(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listScreenshotSetsInputSchema, input);

    const response = await client.get<ASCListResponse<AppScreenshotSet>>(
      `/appStoreVersionLocalizations/${params.localizationId}/appScreenshotSets`,
      {
        limit: params.limit,
        "fields[appScreenshotSets]": "screenshotDisplayType",
      }
    );

    return {
      success: true,
      data: response.data.map((set) => ({
        id: set.id,
        screenshotDisplayType: set.attributes.screenshotDisplayType,
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
 * List screenshots in a screenshot set
 */
export async function listScreenshots(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listScreenshotsInputSchema, input);

    const response = await client.get<ASCListResponse<AppScreenshot>>(
      `/appScreenshotSets/${params.screenshotSetId}/appScreenshots`,
      {
        limit: params.limit,
        "fields[appScreenshots]":
          "fileSize,fileName,sourceFileChecksum,imageAsset,assetDeliveryState",
      }
    );

    return {
      success: true,
      data: response.data.map((screenshot) => ({
        id: screenshot.id,
        fileName: screenshot.attributes.fileName,
        fileSize: screenshot.attributes.fileSize,
        sourceFileChecksum: screenshot.attributes.sourceFileChecksum,
        imageAsset: screenshot.attributes.imageAsset,
        assetDeliveryState: screenshot.attributes.assetDeliveryState,
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
 * Upload a screenshot to a screenshot set
 *
 * This is a multi-step process:
 * 1. Reserve the screenshot (POST)
 * 2. Upload file chunks to the provided URLs (PUT)
 * 3. Commit the upload (PATCH)
 */
export async function uploadScreenshot(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(uploadScreenshotInputSchema, input);

    const finalScreenshot = await uploadAsset(client, {
      resourceType: "appScreenshots",
      collectionPath: "/appScreenshots",
      parent: { name: "appScreenshotSet", type: "appScreenshotSets", id: params.screenshotSetId },
      filePath: params.filePath,
      fileName: params.fileName,
      expectedFileSize: params.fileSize,
    });

    return {
      success: true,
      data: {
        id: finalScreenshot.id,
        fileName: finalScreenshot.attributes.fileName,
        fileSize: finalScreenshot.attributes.fileSize,
        sourceFileChecksum: finalScreenshot.attributes.sourceFileChecksum,
        assetDeliveryState: finalScreenshot.attributes.assetDeliveryState,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for screenshots
 */
export const screenshotsToolDefinitions = [
  {
    name: "list_screenshot_sets",
    description:
      "List all screenshot sets for a version localization. Each set represents a different display type (device size).",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: {
          type: "string",
          description: "The version localization ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of sets to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "list_screenshots",
    description: "List all screenshots in a screenshot set.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        screenshotSetId: {
          type: "string",
          description: "The screenshot set ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of screenshots to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["screenshotSetId"],
    },
  },
  {
    name: "upload_screenshot",
    description:
      "Upload a new screenshot to a screenshot set. Provide the local file path, and this tool will handle the multi-step upload process.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        screenshotSetId: {
          type: "string",
          description: "The screenshot set ID to upload to",
        },
        fileName: {
          type: "string",
          description: "Name for the screenshot file",
        },
        fileSize: {
          type: "number",
          description: "Size of the file in bytes",
        },
        filePath: {
          type: "string",
          description: "Local path to the screenshot file",
        },
      },
      required: ["screenshotSetId", "fileName", "fileSize", "filePath"],
    },
  },
];
