/**
 * Version Admin Tools - Edit and delete App Store versions, attach builds, and manage
 * App Review details (contact, demo account, notes).
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCResponse } from "../api/types.js";
import { ASCError, formatErrorResponse } from "../utils/errors.js";
import { resourceIdSchema, validateInput } from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Types
// ============================================================================

interface AppStoreVersionResource {
  type: "appStoreVersions";
  id: string;
  attributes: {
    platform?: string;
    versionString?: string;
    appStoreState?: string;
    copyright?: string | null;
    releaseType?: string | null;
    earliestReleaseDate?: string | null;
  };
}

interface BuildResource {
  type: "builds";
  id: string;
  attributes: {
    version?: string;
    uploadedDate?: string;
    expirationDate?: string;
    expired?: boolean;
    processingState?: "PROCESSING" | "FAILED" | "INVALID" | "VALID";
    usesNonExemptEncryption?: boolean | null;
  };
}

interface ReviewDetailResource {
  type: "appStoreReviewDetails";
  id: string;
  attributes: {
    contactFirstName?: string | null;
    contactLastName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    demoAccountName?: string | null;
    demoAccountPassword?: string | null;
    demoAccountRequired?: boolean | null;
    notes?: string | null;
  };
}

// ============================================================================
// Input schemas
// ============================================================================

const releaseTypeSchema = z.enum(["MANUAL", "AFTER_APPROVAL", "SCHEDULED"]);

const updateAppVersionInputSchema = z
  .object({
    versionId: resourceIdSchema,
    versionString: z.string().min(1).optional(),
    copyright: z.string().min(1).optional(),
    releaseType: releaseTypeSchema.optional(),
    earliestReleaseDate: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (input) =>
      input.versionString !== undefined ||
      input.copyright !== undefined ||
      input.releaseType !== undefined ||
      input.earliestReleaseDate !== undefined,
    { message: "Provide at least one field to update" }
  );

const versionIdInputSchema = z.object({ versionId: resourceIdSchema });

const setAppVersionBuildInputSchema = z.object({
  versionId: resourceIdSchema,
  buildId: resourceIdSchema,
});

const reviewDetailFields = {
  contactFirstName: z.string().min(1).optional(),
  contactLastName: z.string().min(1).optional(),
  contactPhone: z
    .string()
    .regex(
      /^\+\d[\d\s().-]{5,}$/,
      "Phone must start with + and the country code, e.g. +1 408 555 0100"
    )
    .optional(),
  contactEmail: z.string().email().optional(),
  demoAccountName: z.string().min(1).optional(),
  demoAccountPassword: z
    .string()
    .min(1)
    .max(100, "Demo password can be at most 100 characters")
    .optional(),
  demoAccountRequired: z.boolean().optional(),
  notes: z.string().max(4000, "Review notes can be at most 4000 characters").optional(),
};

const createReviewDetailInputSchema = z
  .object({
    versionId: resourceIdSchema,
    ...reviewDetailFields,
    contactFirstName: reviewDetailFields.contactFirstName.unwrap(),
    contactPhone: reviewDetailFields.contactPhone.unwrap(),
  })
  .refine(
    (input) => !input.demoAccountRequired || (input.demoAccountName && input.demoAccountPassword),
    { message: "demoAccountRequired needs demoAccountName and demoAccountPassword" }
  );

const updateReviewDetailInputSchema = z
  .object({ reviewDetailId: resourceIdSchema, ...reviewDetailFields })
  .refine((input) => Object.keys(reviewDetailFields).some((key) => key in input), {
    message: "Provide at least one field to update",
  })
  .refine(
    (input) =>
      input.demoAccountRequired !== true ||
      (input.demoAccountName !== undefined && input.demoAccountPassword !== undefined),
    { message: "Setting demoAccountRequired to true needs demoAccountName and demoAccountPassword" }
  );

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

const REVIEW_DETAIL_ATTRIBUTES = Object.keys(reviewDetailFields) as Array<
  keyof typeof reviewDetailFields
>;

function formatVersion(version: AppStoreVersionResource) {
  return {
    id: version.id,
    platform: version.attributes.platform,
    versionString: version.attributes.versionString,
    state: version.attributes.appStoreState,
    copyright: version.attributes.copyright,
    releaseType: version.attributes.releaseType,
    earliestReleaseDate: version.attributes.earliestReleaseDate,
  };
}

function formatBuild(build: BuildResource) {
  return {
    id: build.id,
    version: build.attributes.version,
    processingState: build.attributes.processingState,
    uploadedDate: build.attributes.uploadedDate,
    expirationDate: build.attributes.expirationDate,
    expired: build.attributes.expired,
    usesNonExemptEncryption: build.attributes.usesNonExemptEncryption,
  };
}

/** Never echo the demo password back; report whether one is set. */
function formatReviewDetail(detail: ReviewDetailResource) {
  const { demoAccountPassword, ...attributes } = detail.attributes;
  return { id: detail.id, ...attributes, demoAccountPasswordSet: Boolean(demoAccountPassword) };
}

function passwordOf(input: unknown): string[] {
  const password = (input as { demoAccountPassword?: unknown } | null)?.demoAccountPassword;
  return typeof password === "string" ? [password] : [];
}

const BUILD_FIELDS =
  "version,uploadedDate,expirationDate,expired,processingState,usesNonExemptEncryption";

// ============================================================================
// Handlers
// ============================================================================

/**
 * Update an App Store version's version string, copyright, or release settings
 */
export async function updateAppVersion(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateAppVersionInputSchema, input);

    const response = await client.patch<ASCResponse<AppStoreVersionResource>>(
      `/appStoreVersions/${params.versionId}`,
      {
        data: {
          type: "appStoreVersions",
          id: params.versionId,
          attributes: pickDefined(params, [
            "versionString",
            "copyright",
            "releaseType",
            "earliestReleaseDate",
          ]),
        },
      }
    );

    return { success: true, data: formatVersion(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete an App Store version that has not been submitted
 */
export async function deleteAppVersion(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(versionIdInputSchema, input);
    await client.delete(`/appStoreVersions/${params.versionId}`);
    return { success: true, data: { deleted: true, versionId: params.versionId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get the build attached to an App Store version
 */
export async function getAppVersionBuild(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(versionIdInputSchema, input);
    const response = await client.get<ASCResponse<BuildResource | null>>(
      `/appStoreVersions/${params.versionId}/build`,
      { "fields[builds]": BUILD_FIELDS }
    );
    return { success: true, data: response.data ? formatBuild(response.data) : null };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Attach a processed (VALID) build to an App Store version
 */
export async function setAppVersionBuild(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(setAppVersionBuildInputSchema, input);

    const build = await client.get<ASCResponse<BuildResource>>(`/builds/${params.buildId}`, {
      "fields[builds]": BUILD_FIELDS,
    });
    const state = build.data.attributes.processingState;
    if (state !== "VALID") {
      throw new ASCError(
        `Build ${params.buildId} is ${state ?? "in an unknown state"}; only VALID builds can be attached`,
        "BUILD_NOT_VALID",
        409
      );
    }

    await client.patch(`/appStoreVersions/${params.versionId}/relationships/build`, {
      data: { type: "builds", id: params.buildId },
    });

    return {
      success: true,
      data: { versionId: params.versionId, build: formatBuild(build.data) },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get the App Review details (contact, demo account, notes) for a version
 */
export async function getReviewDetail(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(versionIdInputSchema, input);
    const response = await client.get<ASCResponse<ReviewDetailResource | null>>(
      `/appStoreVersions/${params.versionId}/appStoreReviewDetail`
    );
    if (!response.data) {
      return {
        success: true,
        data: null,
        meta: { hint: "No review details yet. Create them with create_review_detail." },
      };
    }
    return { success: true, data: formatReviewDetail(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create App Review details for a version
 */
export async function createReviewDetail(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createReviewDetailInputSchema, input);

    const response = await client.post<ASCResponse<ReviewDetailResource>>(
      "/appStoreReviewDetails",
      {
        data: {
          type: "appStoreReviewDetails",
          attributes: pickDefined(params, REVIEW_DETAIL_ATTRIBUTES),
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: params.versionId } },
          },
        },
      }
    );

    return { success: true, data: formatReviewDetail(response.data) };
  } catch (error) {
    return formatErrorResponse(error, passwordOf(input));
  }
}

/**
 * Update App Review details (only the fields provided are changed)
 */
export async function updateReviewDetail(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateReviewDetailInputSchema, input);

    const response = await client.patch<ASCResponse<ReviewDetailResource>>(
      `/appStoreReviewDetails/${params.reviewDetailId}`,
      {
        data: {
          type: "appStoreReviewDetails",
          id: params.reviewDetailId,
          attributes: pickDefined(params, REVIEW_DETAIL_ATTRIBUTES),
        },
      }
    );

    return { success: true, data: formatReviewDetail(response.data) };
  } catch (error) {
    return formatErrorResponse(error, passwordOf(input));
  }
}

// ============================================================================
// Definitions
// ============================================================================

const reviewDetailProperties = {
  contactFirstName: { type: "string", description: "App Review contact first name" },
  contactLastName: { type: "string", description: "App Review contact last name" },
  contactPhone: {
    type: "string",
    description: "Contact phone with + and country code, e.g. +1 408 555 0100",
  },
  contactEmail: { type: "string", description: "Contact email" },
  demoAccountName: { type: "string", description: "Demo account user name for App Review" },
  demoAccountPassword: {
    type: "string",
    description: "Demo account password (max 100 characters). Never returned by the tools.",
  },
  demoAccountRequired: {
    type: "boolean",
    description: "Whether App Review needs the demo account to use the app",
  },
  notes: { type: "string", description: "Notes for App Review (max 4000 characters)" },
};

export const versionAdminToolDefinitions = [
  {
    name: "update_app_version",
    description:
      "Update an App Store version's version string, copyright, release type, or scheduled release date. Only the fields provided are changed.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The App Store version ID" },
        versionString: { type: "string", description: "New version number, e.g. '2.1.0'" },
        copyright: { type: "string", description: "Copyright line, e.g. '2026 Example Inc.'" },
        releaseType: {
          type: "string",
          enum: ["MANUAL", "AFTER_APPROVAL", "SCHEDULED"],
          description: "How the version is released after approval",
        },
        earliestReleaseDate: {
          type: "string",
          description: "ISO 8601 date-time for SCHEDULED releases, e.g. 2026-11-01T09:00:00Z",
        },
      },
      required: ["versionId"],
    },
  },
  {
    name: "delete_app_version",
    description:
      "Delete an App Store version. Only versions that were never submitted can be deleted.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The App Store version ID to delete" },
      },
      required: ["versionId"],
    },
  },
  {
    name: "get_app_version_build",
    description: "Get the build attached to an App Store version (null when none is attached).",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The App Store version ID" },
      },
      required: ["versionId"],
    },
  },
  {
    name: "set_app_version_build",
    description:
      "Attach a build to an App Store version. The build must have finished processing (VALID); use list_builds to find build IDs.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The App Store version ID" },
        buildId: { type: "string", description: "The build ID to attach" },
      },
      required: ["versionId", "buildId"],
    },
  },
  {
    name: "get_review_detail",
    description:
      "Get the App Review details for a version: contact, demo account, and review notes. The demo password is never returned; demoAccountPasswordSet shows whether one exists.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The App Store version ID" },
      },
      required: ["versionId"],
    },
  },
  {
    name: "create_review_detail",
    description:
      "Create App Review details for a version that has none. contactFirstName and contactPhone are required.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The App Store version ID" },
        ...reviewDetailProperties,
      },
      required: ["versionId", "contactFirstName", "contactPhone"],
    },
  },
  {
    name: "update_review_detail",
    description:
      "Update App Review details (contact, demo account, notes). Only the fields provided are changed. Get the ID from get_review_detail.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        reviewDetailId: { type: "string", description: "The App Store review detail ID" },
        ...reviewDetailProperties,
      },
      required: ["reviewDetailId"],
    },
  },
];

export const versionAdminToolsModule: ToolModule = {
  toolset: "versions",
  definitions: versionAdminToolDefinitions,
  handlers: {
    update_app_version: updateAppVersion,
    delete_app_version: deleteAppVersion,
    get_app_version_build: getAppVersionBuild,
    set_app_version_build: setAppVersionBuild,
    get_review_detail: getReviewDetail,
    create_review_detail: createReviewDetail,
    update_review_detail: updateReviewDetail,
  },
};
