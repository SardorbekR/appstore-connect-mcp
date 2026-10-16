/**
 * TestFlight Builds Tools - "What to Test" notes, TestFlight app details, beta App Review,
 * build beta settings, and pre-release versions.
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  localeSchema,
  optionalUrlSchema,
  resourceIdSchema,
  validateInput,
} from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Types
// ============================================================================

interface BetaBuildLocalizationResource {
  type: "betaBuildLocalizations";
  id: string;
  attributes: {
    whatsNew?: string | null;
    locale?: string;
  };
}

interface BetaAppLocalizationResource {
  type: "betaAppLocalizations";
  id: string;
  attributes: {
    description?: string | null;
    feedbackEmail?: string | null;
    marketingUrl?: string | null;
    privacyPolicyUrl?: string | null;
    tvOsPrivacyPolicy?: string | null;
    locale?: string;
  };
}

interface BetaAppReviewDetailResource {
  type: "betaAppReviewDetails";
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

interface BetaAppReviewSubmissionResource {
  type: "betaAppReviewSubmissions";
  id: string;
  attributes: {
    betaReviewState?: string;
    submittedDate?: string;
  };
}

interface BuildBetaDetailResource {
  type: "buildBetaDetails";
  id: string;
  attributes: {
    autoNotifyEnabled?: boolean;
    internalBuildState?: string;
    externalBuildState?: string;
  };
}

interface PreReleaseVersionResource {
  type: "preReleaseVersions";
  id: string;
  attributes: {
    version?: string;
    platform?: string;
  };
}

// ============================================================================
// Input schemas
// ============================================================================

const BETA_REVIEW_STATES = ["WAITING_FOR_REVIEW", "IN_REVIEW", "REJECTED", "APPROVED"] as const;

const limitSchema = z.number().int().min(1).max(200);

const buildIdInputSchema = z.object({ buildId: resourceIdSchema });
const appIdInputSchema = z.object({ appId: resourceIdSchema });
const localizationIdInputSchema = z.object({ localizationId: resourceIdSchema });

const listBuildLocalizationsInputSchema = buildIdInputSchema.extend({
  limit: limitSchema.optional(),
});

const createBuildLocalizationInputSchema = z.object({
  buildId: resourceIdSchema,
  locale: localeSchema,
  whatsNew: z.string().optional(),
});

const updateBuildLocalizationInputSchema = z.object({
  localizationId: resourceIdSchema,
  whatsNew: z.string(),
});

const appLocalizationFields = {
  description: z.string().min(1).optional(),
  feedbackEmail: z.string().email().optional(),
  marketingUrl: optionalUrlSchema,
  privacyPolicyUrl: optionalUrlSchema,
  tvOsPrivacyPolicy: z.string().min(1).optional(),
};

const APP_LOCALIZATION_FIELDS = Object.keys(appLocalizationFields) as Array<
  keyof typeof appLocalizationFields
>;

const listAppLocalizationsInputSchema = appIdInputSchema.extend({
  limit: limitSchema.optional(),
});

const createAppLocalizationInputSchema = z.object({
  appId: resourceIdSchema,
  locale: localeSchema,
  ...appLocalizationFields,
});

const updateAppLocalizationInputSchema = z
  .object({
    localizationId: resourceIdSchema,
    description: appLocalizationFields.description.nullable(),
    feedbackEmail: appLocalizationFields.feedbackEmail.nullable(),
    marketingUrl: appLocalizationFields.marketingUrl.nullable(),
    privacyPolicyUrl: appLocalizationFields.privacyPolicyUrl.nullable(),
    tvOsPrivacyPolicy: appLocalizationFields.tvOsPrivacyPolicy.nullable(),
  })
  .refine((input) => APP_LOCALIZATION_FIELDS.some((key) => input[key] !== undefined), {
    message: "Provide at least one field to update",
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

const BETA_REVIEW_DETAIL_FIELDS = Object.keys(reviewDetailFields) as Array<
  keyof typeof reviewDetailFields
>;

// Updates may set optional fields to null to clear them. Apple validates the stored demo
// account when demoAccountRequired changes, so credentials are not required alongside it.
const updateBetaReviewDetailInputSchema = z
  .object({
    reviewDetailId: resourceIdSchema,
    ...reviewDetailFields,
    contactLastName: reviewDetailFields.contactLastName.nullable(),
    contactEmail: reviewDetailFields.contactEmail.nullable(),
    demoAccountName: reviewDetailFields.demoAccountName.nullable(),
    demoAccountPassword: reviewDetailFields.demoAccountPassword.nullable(),
    notes: reviewDetailFields.notes.nullable(),
  })
  .refine((input) => BETA_REVIEW_DETAIL_FIELDS.some((key) => input[key] !== undefined), {
    message: "Provide at least one field to update",
  });

const listBetaReviewSubmissionsInputSchema = z.object({
  buildId: resourceIdSchema,
  betaReviewState: z.array(z.enum(BETA_REVIEW_STATES)).min(1).optional(),
  limit: limitSchema.optional(),
});

const updateBuildBetaDetailInputSchema = z.object({
  buildBetaDetailId: resourceIdSchema,
  autoNotifyEnabled: z.boolean(),
});

const listPreReleaseVersionsInputSchema = appIdInputSchema.extend({
  limit: limitSchema.optional(),
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

function formatBuildLocalization(localization: BetaBuildLocalizationResource) {
  return {
    id: localization.id,
    locale: localization.attributes.locale,
    whatsNew: localization.attributes.whatsNew,
  };
}

function formatAppLocalization(localization: BetaAppLocalizationResource) {
  return {
    id: localization.id,
    locale: localization.attributes.locale,
    description: localization.attributes.description,
    feedbackEmail: localization.attributes.feedbackEmail,
    marketingUrl: localization.attributes.marketingUrl,
    privacyPolicyUrl: localization.attributes.privacyPolicyUrl,
    tvOsPrivacyPolicy: localization.attributes.tvOsPrivacyPolicy,
  };
}

/** Never echo the demo password back; report whether one is set. */
function formatReviewDetail(detail: BetaAppReviewDetailResource) {
  const { demoAccountPassword, ...attributes } = detail.attributes;
  return { id: detail.id, ...attributes, demoAccountPasswordSet: Boolean(demoAccountPassword) };
}

function formatSubmission(submission: BetaAppReviewSubmissionResource) {
  return {
    id: submission.id,
    betaReviewState: submission.attributes.betaReviewState,
    submittedDate: submission.attributes.submittedDate,
  };
}

function formatBuildBetaDetail(detail: BuildBetaDetailResource) {
  return {
    id: detail.id,
    autoNotifyEnabled: detail.attributes.autoNotifyEnabled,
    internalBuildState: detail.attributes.internalBuildState,
    externalBuildState: detail.attributes.externalBuildState,
  };
}

function formatPreReleaseVersion(version: PreReleaseVersionResource) {
  return {
    id: version.id,
    version: version.attributes.version,
    platform: version.attributes.platform,
  };
}

function passwordOf(input: unknown): string[] {
  const password = (input as { demoAccountPassword?: unknown } | null)?.demoAccountPassword;
  return typeof password === "string" ? [password] : [];
}

const APP_LOCALIZATION_FIELD_LIST =
  "feedbackEmail,marketingUrl,privacyPolicyUrl,tvOsPrivacyPolicy,description,locale";

// ============================================================================
// Handlers: TestFlight "What to Test" notes (per build)
// ============================================================================

/**
 * List the TestFlight "What to Test" notes for a build, one per locale
 */
export async function listBetaBuildLocalizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listBuildLocalizationsInputSchema, input);

    const response = await client.get<ASCListResponse<BetaBuildLocalizationResource>>(
      `/builds/${params.buildId}/betaBuildLocalizations`,
      {
        "fields[betaBuildLocalizations]": "whatsNew,locale",
        limit: params.limit,
      }
    );

    return {
      success: true,
      data: response.data.map(formatBuildLocalization),
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
 * Add "What to Test" notes for a build in one locale
 */
export async function createBetaBuildLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createBuildLocalizationInputSchema, input);

    const response = await client.post<ASCResponse<BetaBuildLocalizationResource>>(
      "/betaBuildLocalizations",
      {
        data: {
          type: "betaBuildLocalizations",
          attributes: pickDefined(params, ["locale", "whatsNew"]),
          relationships: {
            build: { data: { type: "builds", id: params.buildId } },
          },
        },
      }
    );

    return { success: true, data: formatBuildLocalization(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Replace the "What to Test" notes of a build localization
 */
export async function updateBetaBuildLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateBuildLocalizationInputSchema, input);

    const response = await client.patch<ASCResponse<BetaBuildLocalizationResource>>(
      `/betaBuildLocalizations/${params.localizationId}`,
      {
        data: {
          type: "betaBuildLocalizations",
          id: params.localizationId,
          attributes: { whatsNew: params.whatsNew },
        },
      }
    );

    return { success: true, data: formatBuildLocalization(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete the "What to Test" notes of a build for one locale
 */
export async function deleteBetaBuildLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(localizationIdInputSchema, input);
    await client.delete(`/betaBuildLocalizations/${params.localizationId}`);
    return { success: true, data: { deleted: true, localizationId: params.localizationId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Handlers: TestFlight app details (per app and locale)
// ============================================================================

/**
 * List the TestFlight app details (description, feedback email, URLs) per locale for an app
 */
export async function listBetaAppLocalizations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAppLocalizationsInputSchema, input);

    const response = await client.get<ASCListResponse<BetaAppLocalizationResource>>(
      `/apps/${params.appId}/betaAppLocalizations`,
      {
        "fields[betaAppLocalizations]": APP_LOCALIZATION_FIELD_LIST,
        limit: params.limit,
      }
    );

    return {
      success: true,
      data: response.data.map(formatAppLocalization),
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
 * Add TestFlight app details for an app in one locale
 */
export async function createBetaAppLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createAppLocalizationInputSchema, input);

    const response = await client.post<ASCResponse<BetaAppLocalizationResource>>(
      "/betaAppLocalizations",
      {
        data: {
          type: "betaAppLocalizations",
          attributes: pickDefined(params, ["locale", ...APP_LOCALIZATION_FIELDS]),
          relationships: {
            app: { data: { type: "apps", id: params.appId } },
          },
        },
      }
    );

    return { success: true, data: formatAppLocalization(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update TestFlight app details for one locale (only the fields provided are changed)
 */
export async function updateBetaAppLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateAppLocalizationInputSchema, input);

    const response = await client.patch<ASCResponse<BetaAppLocalizationResource>>(
      `/betaAppLocalizations/${params.localizationId}`,
      {
        data: {
          type: "betaAppLocalizations",
          id: params.localizationId,
          attributes: pickDefined(params, APP_LOCALIZATION_FIELDS),
        },
      }
    );

    return { success: true, data: formatAppLocalization(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete the TestFlight app details for one locale
 */
export async function deleteBetaAppLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(localizationIdInputSchema, input);
    await client.delete(`/betaAppLocalizations/${params.localizationId}`);
    return { success: true, data: { deleted: true, localizationId: params.localizationId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Handlers: beta App Review (per app)
// ============================================================================

/**
 * Get the TestFlight beta App Review details (contact, demo account, notes) for an app
 */
export async function getBetaAppReviewDetail(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(appIdInputSchema, input);
    const response = await client.get<ASCResponse<BetaAppReviewDetailResource | null>>(
      `/apps/${params.appId}/betaAppReviewDetail`
    );
    return {
      success: true,
      data: response.data ? formatReviewDetail(response.data) : null,
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update TestFlight beta App Review details (only the fields provided are changed)
 */
export async function updateBetaAppReviewDetail(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateBetaReviewDetailInputSchema, input);

    const response = await client.patch<ASCResponse<BetaAppReviewDetailResource>>(
      `/betaAppReviewDetails/${params.reviewDetailId}`,
      {
        data: {
          type: "betaAppReviewDetails",
          id: params.reviewDetailId,
          attributes: pickDefined(params, BETA_REVIEW_DETAIL_FIELDS),
        },
      }
    );

    return { success: true, data: formatReviewDetail(response.data) };
  } catch (error) {
    return formatErrorResponse(error, passwordOf(input));
  }
}

/**
 * Submit a build to TestFlight beta App Review
 */
export async function submitBuildForBetaReview(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(buildIdInputSchema, input);

    const response = await client.post<ASCResponse<BetaAppReviewSubmissionResource>>(
      "/betaAppReviewSubmissions",
      {
        data: {
          type: "betaAppReviewSubmissions",
          relationships: {
            build: { data: { type: "builds", id: params.buildId } },
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
 * List TestFlight beta App Review submissions for a build, optionally filtered by review state
 */
export async function listBetaReviewSubmissions(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listBetaReviewSubmissionsInputSchema, input);

    const response = await client.get<ASCListResponse<BetaAppReviewSubmissionResource>>(
      "/betaAppReviewSubmissions",
      {
        "filter[build]": params.buildId,
        "filter[betaReviewState]": params.betaReviewState?.join(","),
        "fields[betaAppReviewSubmissions]": "betaReviewState,submittedDate",
        limit: params.limit,
      }
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

// ============================================================================
// Handlers: build beta settings and pre-release versions
// ============================================================================

/**
 * Get the TestFlight settings and build processing states for a build
 */
export async function getBuildBetaDetail(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(buildIdInputSchema, input);

    const response = await client.get<ASCResponse<BuildBetaDetailResource>>(
      `/builds/${params.buildId}/buildBetaDetail`,
      {
        "fields[buildBetaDetails]": "autoNotifyEnabled,internalBuildState,externalBuildState",
      }
    );

    return { success: true, data: formatBuildBetaDetail(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Turn automatic tester notifications on or off for a build
 */
export async function updateBuildBetaDetail(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateBuildBetaDetailInputSchema, input);

    const response = await client.patch<ASCResponse<BuildBetaDetailResource>>(
      `/buildBetaDetails/${params.buildBetaDetailId}`,
      {
        data: {
          type: "buildBetaDetails",
          id: params.buildBetaDetailId,
          attributes: { autoNotifyEnabled: params.autoNotifyEnabled },
        },
      }
    );

    return { success: true, data: formatBuildBetaDetail(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List the TestFlight pre-release versions (version string and platform) of an app
 */
export async function listPreReleaseVersions(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listPreReleaseVersionsInputSchema, input);

    const response = await client.get<ASCListResponse<PreReleaseVersionResource>>(
      `/apps/${params.appId}/preReleaseVersions`,
      {
        "fields[preReleaseVersions]": "version,platform",
        limit: params.limit,
      }
    );

    return {
      success: true,
      data: response.data.map(formatPreReleaseVersion),
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

const limitProperty = {
  type: "number",
  description: "Maximum number of results to return (1-200)",
  minimum: 1,
  maximum: 200,
};

/** JSON-schema variant of a property that also accepts null, which clears the field. */
function clearable<T extends { type: string; description: string }>(property: T) {
  return {
    ...property,
    type: [property.type, "null"],
    description: `${property.description}. Pass null to clear.`,
  };
}

const appLocalizationProperties = {
  description: { type: "string", description: "TestFlight description for testers" },
  feedbackEmail: { type: "string", description: "Email address for tester feedback" },
  marketingUrl: { type: "string", description: "HTTPS marketing URL" },
  privacyPolicyUrl: { type: "string", description: "HTTPS privacy policy URL" },
  tvOsPrivacyPolicy: { type: "string", description: "Privacy policy text for tvOS apps" },
};

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

export const testflightBuildsToolDefinitions = [
  {
    name: "list_beta_build_localizations",
    description:
      "List the TestFlight 'What to Test' notes for a build, one per locale. Use list_builds to find build IDs.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        buildId: { type: "string", description: "The build ID" },
        limit: limitProperty,
      },
      required: ["buildId"],
    },
  },
  {
    name: "create_beta_build_localization",
    description: "Add 'What to Test' notes for a build in one locale.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        buildId: { type: "string", description: "The build ID" },
        locale: { type: "string", description: "Locale code, e.g. en-US" },
        whatsNew: { type: "string", description: "What to Test text for this locale" },
      },
      required: ["buildId", "locale"],
    },
  },
  {
    name: "update_beta_build_localization",
    description:
      "Replace the 'What to Test' notes of a build localization. Get the ID from list_beta_build_localizations.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: { type: "string", description: "The beta build localization ID" },
        whatsNew: { type: "string", description: "New What to Test text" },
      },
      required: ["localizationId", "whatsNew"],
    },
  },
  {
    name: "delete_beta_build_localization",
    description: "Delete the 'What to Test' notes of a build for one locale.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: { type: "string", description: "The beta build localization ID" },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "list_beta_app_localizations",
    description:
      "List the TestFlight app details (description, feedback email, URLs) for an app, one per locale.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        limit: limitProperty,
      },
      required: ["appId"],
    },
  },
  {
    name: "create_beta_app_localization",
    description: "Add TestFlight app details for an app in one locale.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        locale: { type: "string", description: "Locale code, e.g. en-US" },
        ...appLocalizationProperties,
      },
      required: ["appId", "locale"],
    },
  },
  {
    name: "update_beta_app_localization",
    description:
      "Update the TestFlight app details for one locale. Only the fields provided are changed.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: { type: "string", description: "The beta app localization ID" },
        description: clearable(appLocalizationProperties.description),
        feedbackEmail: clearable(appLocalizationProperties.feedbackEmail),
        marketingUrl: clearable(appLocalizationProperties.marketingUrl),
        privacyPolicyUrl: clearable(appLocalizationProperties.privacyPolicyUrl),
        tvOsPrivacyPolicy: clearable(appLocalizationProperties.tvOsPrivacyPolicy),
      },
      required: ["localizationId"],
    },
  },
  {
    name: "delete_beta_app_localization",
    description: "Delete the TestFlight app details for one locale.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: { type: "string", description: "The beta app localization ID" },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "get_beta_app_review_detail",
    description:
      "Get the TestFlight beta App Review details for an app: contact, demo account, and notes. The demo password is never returned; demoAccountPasswordSet shows whether one exists.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
      },
      required: ["appId"],
    },
  },
  {
    name: "update_beta_app_review_detail",
    description:
      "Update the TestFlight beta App Review details (contact, demo account, notes). Only the fields provided are changed. Get the ID from get_beta_app_review_detail.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        reviewDetailId: { type: "string", description: "The beta App Review detail ID" },
        ...reviewDetailProperties,
        contactLastName: clearable(reviewDetailProperties.contactLastName),
        contactEmail: clearable(reviewDetailProperties.contactEmail),
        demoAccountName: clearable(reviewDetailProperties.demoAccountName),
        demoAccountPassword: clearable(reviewDetailProperties.demoAccountPassword),
        notes: clearable(reviewDetailProperties.notes),
      },
      required: ["reviewDetailId"],
    },
  },
  {
    name: "submit_build_for_beta_review",
    description:
      "Submit a build to TestFlight beta App Review so it can be shared with external testers.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        buildId: { type: "string", description: "The build ID to submit" },
      },
      required: ["buildId"],
    },
  },
  {
    name: "list_beta_review_submissions",
    description:
      "List the TestFlight beta App Review submissions for a build, optionally filtered by review state.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        buildId: { type: "string", description: "The build ID" },
        betaReviewState: {
          type: "array",
          items: { type: "string", enum: [...BETA_REVIEW_STATES] },
          description: "Only return submissions in these review states",
        },
        limit: limitProperty,
      },
      required: ["buildId"],
    },
  },
  {
    name: "get_build_beta_detail",
    description:
      "Get the TestFlight settings and processing states for a build (auto-notify, internal and external state).",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        buildId: { type: "string", description: "The build ID" },
      },
      required: ["buildId"],
    },
  },
  {
    name: "update_build_beta_detail",
    description:
      "Turn automatic tester notifications on or off for a build. Get the ID from get_build_beta_detail.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        buildBetaDetailId: { type: "string", description: "The build beta detail ID" },
        autoNotifyEnabled: {
          type: "boolean",
          description: "Whether testers are notified automatically when the build is available",
        },
      },
      required: ["buildBetaDetailId", "autoNotifyEnabled"],
    },
  },
  {
    name: "list_pre_release_versions",
    description:
      "List the TestFlight pre-release versions (version string and platform) of an app.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        limit: limitProperty,
      },
      required: ["appId"],
    },
  },
];

export const testflightBuildsToolsModule: ToolModule = {
  toolset: "testflight",
  definitions: testflightBuildsToolDefinitions,
  handlers: {
    list_beta_build_localizations: listBetaBuildLocalizations,
    create_beta_build_localization: createBetaBuildLocalization,
    update_beta_build_localization: updateBetaBuildLocalization,
    delete_beta_build_localization: deleteBetaBuildLocalization,
    list_beta_app_localizations: listBetaAppLocalizations,
    create_beta_app_localization: createBetaAppLocalization,
    update_beta_app_localization: updateBetaAppLocalization,
    delete_beta_app_localization: deleteBetaAppLocalization,
    get_beta_app_review_detail: getBetaAppReviewDetail,
    update_beta_app_review_detail: updateBetaAppReviewDetail,
    submit_build_for_beta_review: submitBuildForBetaReview,
    list_beta_review_submissions: listBetaReviewSubmissions,
    get_build_beta_detail: getBuildBetaDetail,
    update_build_beta_detail: updateBuildBetaDetail,
    list_pre_release_versions: listPreReleaseVersions,
  },
};
