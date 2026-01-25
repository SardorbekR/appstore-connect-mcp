/**
 * Input validation schemas and utilities using Zod
 */

import { z } from "zod";
import { ValidationError } from "./errors.js";

// App ID - numeric string
export const appIdSchema = z
  .string()
  .regex(/^\d+$/, "App ID must be a numeric string")
  .min(1, "App ID is required");

// Version ID - numeric string
export const versionIdSchema = z
  .string()
  .regex(/^\d+$/, "Version ID must be a numeric string")
  .min(1, "Version ID is required");

// Localization ID - numeric string
export const localizationIdSchema = z
  .string()
  .regex(/^\d+$/, "Localization ID must be a numeric string")
  .min(1, "Localization ID is required");

// Build ID - numeric string (can be UUID format in some cases)
export const buildIdSchema = z.string().min(1, "Build ID is required");

// Beta Group ID
export const betaGroupIdSchema = z.string().min(1, "Beta Group ID is required");

// Locale code (e.g., "en-US", "ja", "zh-Hans", "en_US")
export const localeSchema = z
  .string()
  .regex(
    /^[a-z]{2}([-_][A-Z][a-z]{3})?([-_][A-Z]{2})?$/,
    "Invalid locale format (e.g., en-US, en_US, ja, zh-Hans)"
  )
  .min(2, "Locale is required");

// HTTPS URL
export const urlSchema = z
  .string()
  .url("Must be a valid URL")
  .refine((url) => url.startsWith("https://"), "URL must use HTTPS");

// Optional HTTPS URL
export const optionalUrlSchema = urlSchema.optional();

// Version string (e.g., "1.0.0", "2.1") - no leading zeros except for single "0"
export const versionStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)(\.(0|[1-9]\d*))*$/, "Invalid version format (e.g., 1.0.0)")
  .min(1, "Version string is required");

// Platform enum
export const platformSchema = z.enum(["IOS", "MAC_OS", "TV_OS", "VISION_OS"]);

// App Store version state
export const versionStateSchema = z.enum([
  "DEVELOPER_REMOVED_FROM_SALE",
  "DEVELOPER_REJECTED",
  "IN_REVIEW",
  "INVALID_BINARY",
  "METADATA_REJECTED",
  "PENDING_APPLE_RELEASE",
  "PENDING_CONTRACT",
  "PENDING_DEVELOPER_RELEASE",
  "PREPARE_FOR_SUBMISSION",
  "PREORDER_READY_FOR_SALE",
  "PROCESSING_FOR_APP_STORE",
  "READY_FOR_REVIEW",
  "READY_FOR_SALE",
  "REJECTED",
  "REMOVED_FROM_SALE",
  "WAITING_FOR_EXPORT_COMPLIANCE",
  "WAITING_FOR_REVIEW",
  "REPLACED_WITH_NEW_VERSION",
  "NOT_APPLICABLE",
]);

// Release type
export const releaseTypeSchema = z.enum(["MANUAL", "AFTER_APPROVAL", "SCHEDULED"]);

// Pagination options
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});

// List apps input
export const listAppsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

// Get app input
export const getAppInputSchema = z.object({
  appId: appIdSchema,
});

// List app versions input
export const listAppVersionsInputSchema = z.object({
  appId: appIdSchema,
  platform: platformSchema.optional(),
  versionState: versionStateSchema.optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

// Get app version input
export const getAppVersionInputSchema = z.object({
  versionId: versionIdSchema,
});

// Create app version input
export const createAppVersionInputSchema = z.object({
  appId: appIdSchema,
  platform: platformSchema,
  versionString: versionStringSchema,
  releaseType: releaseTypeSchema.optional(),
  copyright: z.string().optional(),
  earliestReleaseDate: z.string().datetime().optional(),
});

// List version localizations input
export const listVersionLocalizationsInputSchema = z.object({
  versionId: versionIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

// Get version localization input
export const getVersionLocalizationInputSchema = z.object({
  localizationId: localizationIdSchema,
});

// Create version localization input
export const createVersionLocalizationInputSchema = z.object({
  versionId: versionIdSchema,
  locale: localeSchema,
  description: z.string().max(4000).optional(),
  keywords: z.string().max(100).optional(),
  whatsNew: z.string().max(4000).optional(),
  promotionalText: z.string().max(170).optional(),
  marketingUrl: optionalUrlSchema,
  supportUrl: optionalUrlSchema,
});

// Update version localization input
export const updateVersionLocalizationInputSchema = z.object({
  localizationId: localizationIdSchema,
  description: z.string().max(4000).optional(),
  keywords: z.string().max(100).optional(),
  whatsNew: z.string().max(4000).optional(),
  promotionalText: z.string().max(170).optional(),
  marketingUrl: optionalUrlSchema,
  supportUrl: optionalUrlSchema,
});

// Delete version localization input
export const deleteVersionLocalizationInputSchema = z.object({
  localizationId: localizationIdSchema,
});

// Get app infos input
export const getAppInfosInputSchema = z.object({
  appId: appIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

// List app info localizations input
export const listAppInfoLocalizationsInputSchema = z.object({
  appInfoId: z.string().min(1, "App Info ID is required"),
  limit: z.number().int().min(1).max(200).optional(),
});

// Update app info localization input
export const updateAppInfoLocalizationInputSchema = z.object({
  localizationId: localizationIdSchema,
  name: z.string().max(30).optional(),
  subtitle: z.string().max(30).optional(),
  privacyPolicyUrl: optionalUrlSchema,
  privacyChoicesUrl: optionalUrlSchema,
  privacyPolicyText: z.string().optional(),
});

// List beta groups input
export const listBetaGroupsInputSchema = z.object({
  appId: appIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

// List beta testers input
export const listBetaTestersInputSchema = z.object({
  betaGroupId: betaGroupIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

// Add beta tester input
export const addBetaTesterInputSchema = z.object({
  betaGroupId: betaGroupIdSchema,
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

// Screenshot set input
export const listScreenshotSetsInputSchema = z.object({
  localizationId: localizationIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

// List screenshots input
export const listScreenshotsInputSchema = z.object({
  screenshotSetId: z.string().min(1, "Screenshot Set ID is required"),
  limit: z.number().int().min(1).max(200).optional(),
});

// Upload screenshot input
export const uploadScreenshotInputSchema = z.object({
  screenshotSetId: z.string().min(1, "Screenshot Set ID is required"),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().int().positive("File size must be positive"),
  filePath: z.string().min(1, "File path is required"),
});

/**
 * Validate input and throw ValidationError if invalid
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    const field = firstError?.path.join(".");
    const message = firstError?.message ?? "Invalid input";
    throw new ValidationError(message, field || undefined);
  }

  return result.data;
}

/**
 * Safe parse that returns result without throwing
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: ValidationError } {
  const result = schema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    const field = firstError?.path.join(".");
    const message = firstError?.message ?? "Invalid input";
    return { success: false, error: new ValidationError(message, field || undefined) };
  }

  return { success: true, data: result.data };
}

// ============================================================================
// Bundle ID Schemas
// ============================================================================

// Bundle ID identifier (e.g., com.example.app)
export const bundleIdIdentifierSchema = z
  .string()
  .regex(
    /^[a-zA-Z][a-zA-Z0-9.-]*$/,
    "Bundle ID must start with a letter and contain only letters, numbers, dots, and hyphens"
  )
  .min(1, "Bundle ID identifier is required");

// List bundle IDs input
export const listBundleIdsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  platform: platformSchema.optional(),
});

// Get bundle ID input
export const getBundleIdInputSchema = z.object({
  bundleIdId: z.string().min(1, "Bundle ID ID is required"),
});

// Create bundle ID input
export const createBundleIdInputSchema = z.object({
  identifier: bundleIdIdentifierSchema,
  name: z.string().min(1, "Name is required").max(255, "Name must be 255 characters or less"),
  platform: platformSchema,
});

// Update bundle ID input
export const updateBundleIdInputSchema = z.object({
  bundleIdId: z.string().min(1, "Bundle ID ID is required"),
  name: z.string().min(1, "Name is required").max(255, "Name must be 255 characters or less"),
});

// Delete bundle ID input
export const deleteBundleIdInputSchema = z.object({
  bundleIdId: z.string().min(1, "Bundle ID ID is required"),
});

// ============================================================================
// Device Schemas
// ============================================================================

// Device status enum
export const deviceStatusSchema = z.enum(["ENABLED", "DISABLED"]);

// List devices input
export const listDevicesInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  platform: platformSchema.optional(),
  status: deviceStatusSchema.optional(),
});

// Get device input
export const getDeviceInputSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
});

// ============================================================================
// User Schemas
// ============================================================================

// User role enum
export const userRoleSchema = z.enum([
  "ADMIN",
  "FINANCE",
  "TECHNICAL",
  "SALES",
  "DEVELOPER",
  "MARKETING",
  "APP_MANAGER",
  "CUSTOMER_SUPPORT",
  "ACCESS_TO_REPORTS",
  "READ_ONLY",
]);

// List users input
export const listUsersInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  roles: z.array(userRoleSchema).optional(),
});

// Get user input
export const getUserInputSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// ============================================================================
// Beta Tester Removal Schema
// ============================================================================

// Beta tester ID
export const betaTesterIdSchema = z.string().min(1, "Beta Tester ID is required");

// Remove beta tester input
export const removeBetaTesterInputSchema = z.object({
  betaGroupId: betaGroupIdSchema,
  betaTesterId: betaTesterIdSchema,
});

// ============================================================================
// Build Schemas
// ============================================================================

// List builds input
export const listBuildsInputSchema = z.object({
  appId: appIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

// Get build input
export const getBuildInputSchema = z.object({
  buildId: buildIdSchema,
});

// List beta tester invitations input
export const listBetaTesterInvitationsInputSchema = z.object({
  betaGroupId: betaGroupIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

// ============================================================================
// Category Schemas
// ============================================================================

// List app categories input
export const listAppCategoriesInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  platform: platformSchema.optional(),
});

// Get app price schedule input
export const getAppPriceScheduleInputSchema = z.object({
  appId: appIdSchema,
});

// Get app availability input
export const getAppAvailabilityInputSchema = z.object({
  appId: appIdSchema,
});
