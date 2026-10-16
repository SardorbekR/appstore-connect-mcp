/**
 * App Info Admin Tools - App Store categories, age rating declaration, app info localizations
 * (name, subtitle, privacy links), and the custom end user license agreement (EULA).
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  localeSchema,
  optionalUrlSchema,
  resourceIdSchema,
  territoryIdSchema,
  validateInput,
} from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/** Each category slot: the input name the caller uses, and the Apple relationship name. */
const CATEGORY_SLOTS = [
  { input: "primaryCategoryId", relationship: "primaryCategory" },
  { input: "primarySubcategoryOneId", relationship: "primarySubcategoryOne" },
  { input: "primarySubcategoryTwoId", relationship: "primarySubcategoryTwo" },
  { input: "secondaryCategoryId", relationship: "secondaryCategory" },
  { input: "secondarySubcategoryOneId", relationship: "secondarySubcategoryOne" },
  { input: "secondarySubcategoryTwoId", relationship: "secondarySubcategoryTwo" },
] as const;

type CategoryInputKey = (typeof CATEGORY_SLOTS)[number]["input"];
type CategoryRelationship = (typeof CATEGORY_SLOTS)[number]["relationship"];

const CATEGORY_INCLUDE = CATEGORY_SLOTS.map((slot) => slot.relationship).join(",");

const INTENSITY = [
  "NONE",
  "INFREQUENT_OR_MILD",
  "FREQUENT_OR_INTENSE",
  "INFREQUENT",
  "FREQUENT",
] as const;
const KIDS_AGE_BANDS = ["FIVE_AND_UNDER", "SIX_TO_EIGHT", "NINE_TO_ELEVEN"] as const;
const AGE_RATING_OVERRIDE = [
  "NONE",
  "NINE_PLUS",
  "THIRTEEN_PLUS",
  "SIXTEEN_PLUS",
  "SEVENTEEN_PLUS",
  "UNRATED",
] as const;
const AGE_RATING_OVERRIDE_V2 = [
  "NONE",
  "NINE_PLUS",
  "THIRTEEN_PLUS",
  "SIXTEEN_PLUS",
  "EIGHTEEN_PLUS",
  "UNRATED",
] as const;
const KOREA_AGE_RATING_OVERRIDE = [
  "NONE",
  "ALL",
  "TWELVE_PLUS",
  "FIFTEEN_PLUS",
  "NINETEEN_PLUS",
] as const;

// ============================================================================
// Types
// ============================================================================

interface AppInfoResource {
  type: "appInfos";
  id: string;
  relationships?: Partial<
    Record<CategoryRelationship, { data?: { type: "appCategories"; id: string } | null }>
  >;
}

interface AppCategoryResource {
  type: "appCategories";
  id: string;
  attributes?: { platforms?: string[] };
}

interface AgeRatingDeclarationResource {
  type: "ageRatingDeclarations";
  id: string;
  attributes: Record<string, unknown>;
}

interface AppInfoLocalizationResource {
  type: "appInfoLocalizations";
  id: string;
  attributes: {
    locale?: string;
    name?: string;
    subtitle?: string | null;
    privacyPolicyUrl?: string | null;
    privacyChoicesUrl?: string | null;
    privacyPolicyText?: string | null;
  };
}

interface EulaResource {
  type: "endUserLicenseAgreements";
  id: string;
  attributes: { agreementText?: string };
}

// ============================================================================
// Input schemas
// ============================================================================

const appInfoIdInputSchema = z.object({ appInfoId: resourceIdSchema });

const categoryIdFields: Record<CategoryInputKey, z.ZodOptional<typeof resourceIdSchema>> = {
  primaryCategoryId: resourceIdSchema.optional(),
  primarySubcategoryOneId: resourceIdSchema.optional(),
  primarySubcategoryTwoId: resourceIdSchema.optional(),
  secondaryCategoryId: resourceIdSchema.optional(),
  secondarySubcategoryOneId: resourceIdSchema.optional(),
  secondarySubcategoryTwoId: resourceIdSchema.optional(),
};

const setAppCategoriesInputSchema = z
  .object({ appInfoId: resourceIdSchema, ...categoryIdFields })
  .refine((input) => CATEGORY_SLOTS.some((slot) => input[slot.input] !== undefined), {
    message: "Provide at least one category slot to update",
  });

const listAppSubcategoriesInputSchema = z.object({
  categoryId: resourceIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

const intensitySchema = z.enum(INTENSITY);

const ageRatingAttributesSchema = z
  .object({
    advertising: z.boolean().optional(),
    alcoholTobaccoOrDrugUseOrReferences: intensitySchema.optional(),
    contests: intensitySchema.optional(),
    gambling: z.boolean().optional(),
    gamblingSimulated: intensitySchema.optional(),
    gunsOrOtherWeapons: intensitySchema.optional(),
    healthOrWellnessTopics: z.boolean().optional(),
    kidsAgeBand: z.enum(KIDS_AGE_BANDS).nullable().optional(),
    lootBox: z.boolean().optional(),
    medicalOrTreatmentInformation: intensitySchema.optional(),
    messagingAndChat: z.boolean().optional(),
    parentalControls: z.boolean().optional(),
    profanityOrCrudeHumor: intensitySchema.optional(),
    ageAssurance: z.boolean().optional(),
    sexualContentGraphicAndNudity: intensitySchema.optional(),
    sexualContentOrNudity: intensitySchema.optional(),
    socialMedia: z.boolean().optional(),
    socialMediaAgeRestricted: z.boolean().optional(),
    horrorOrFearThemes: intensitySchema.optional(),
    matureOrSuggestiveThemes: intensitySchema.optional(),
    unrestrictedWebAccess: z.boolean().optional(),
    userGeneratedContent: z.boolean().optional(),
    violenceCartoonOrFantasy: intensitySchema.optional(),
    violenceRealisticProlongedGraphicOrSadistic: intensitySchema.optional(),
    violenceRealistic: intensitySchema.optional(),
    ageRatingOverride: z.enum(AGE_RATING_OVERRIDE).nullable().optional(),
    ageRatingOverrideV2: z.enum(AGE_RATING_OVERRIDE_V2).nullable().optional(),
    koreaAgeRatingOverride: z.enum(KOREA_AGE_RATING_OVERRIDE).nullable().optional(),
    gracRatingClassificationNumber: z.string().nullable().optional(),
    developerAgeRatingInfoUrl: z.string().url().nullable().optional(),
  })
  .strict();

type AgeRatingAttributes = z.infer<typeof ageRatingAttributesSchema>;

const updateAgeRatingAttributesSchema = ageRatingAttributesSchema
  .refine((attributes) => Object.keys(attributes).length > 0, {
    message: "Provide at least one attribute to update",
  })
  .refine(
    (attributes) => !(attributes.socialMedia === true && attributes.userGeneratedContent === false),
    {
      message:
        "socialMedia cannot be true while userGeneratedContent is false; Apple requires user-generated content for social media apps",
    }
  );

const updateAgeRatingDeclarationInputSchema = z.object({
  declarationId: resourceIdSchema,
  attributes: updateAgeRatingAttributesSchema,
});

const createAppInfoLocalizationInputSchema = z.object({
  appInfoId: resourceIdSchema,
  locale: localeSchema,
  name: z.string().min(1, "Name is required").max(30, "Name can be at most 30 characters"),
  subtitle: z.string().max(30, "Subtitle can be at most 30 characters").optional(),
  privacyPolicyUrl: optionalUrlSchema,
  privacyChoicesUrl: optionalUrlSchema,
  privacyPolicyText: z.string().optional(),
});

const deleteAppInfoLocalizationInputSchema = z.object({
  localizationId: resourceIdSchema,
});

const appIdInputSchema = z.object({ appId: resourceIdSchema });
const eulaIdInputSchema = z.object({ eulaId: resourceIdSchema });

const eulaTerritoriesSchema = z
  .array(territoryIdSchema)
  .min(1, "At least one territory is required");

const createEulaInputSchema = z.object({
  appId: resourceIdSchema,
  agreementText: z.string().min(1, "Agreement text is required"),
  territories: eulaTerritoriesSchema,
});

const updateEulaInputSchema = z
  .object({
    eulaId: resourceIdSchema,
    agreementText: z.string().min(1, "Agreement text cannot be empty").optional(),
    territories: eulaTerritoriesSchema.optional(),
  })
  .refine((input) => input.agreementText !== undefined || input.territories !== undefined, {
    message: "Provide agreementText and/or territories to update",
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

const AGE_RATING_KEYS = Object.keys(ageRatingAttributesSchema.shape) as Array<
  keyof AgeRatingAttributes
>;

const APP_INFO_LOCALIZATION_ATTRIBUTES = [
  "locale",
  "name",
  "subtitle",
  "privacyPolicyUrl",
  "privacyChoicesUrl",
  "privacyPolicyText",
] as const;

/** The category slots the caller provided, in CATEGORY_SLOTS order. */
function providedCategorySlots(params: Partial<Record<CategoryInputKey, string | undefined>>) {
  return CATEGORY_SLOTS.flatMap((slot) => {
    const id = params[slot.input];
    return id === undefined ? [] : [{ input: slot.input, relationship: slot.relationship, id }];
  });
}

function formatCategories(appInfo: AppInfoResource) {
  const slotIds = Object.fromEntries(
    CATEGORY_SLOTS.map((slot) => [
      slot.input,
      appInfo.relationships?.[slot.relationship]?.data?.id ?? null,
    ])
  );
  return { id: appInfo.id, ...slotIds };
}

function formatAgeRatingDeclaration(declaration: AgeRatingDeclarationResource) {
  return { id: declaration.id, ...declaration.attributes };
}

function formatAppInfoLocalization(localization: AppInfoLocalizationResource) {
  return {
    id: localization.id,
    locale: localization.attributes.locale,
    name: localization.attributes.name,
    subtitle: localization.attributes.subtitle,
    privacyPolicyUrl: localization.attributes.privacyPolicyUrl,
    privacyChoicesUrl: localization.attributes.privacyChoicesUrl,
    privacyPolicyText: localization.attributes.privacyPolicyText,
  };
}

function formatEula(eula: EulaResource) {
  return { id: eula.id, agreementText: eula.attributes.agreementText };
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Get the App Store categories and subcategories set on an app info record
 */
export async function getAppInfoCategories(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(appInfoIdInputSchema, input);
    const response = await client.get<ASCResponse<AppInfoResource>>(
      `/appInfos/${params.appInfoId}`,
      { include: CATEGORY_INCLUDE }
    );
    return { success: true, data: formatCategories(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Set one or more App Store categories or subcategories on an app info record
 */
export async function setAppCategories(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(setAppCategoriesInputSchema, input);
    const slots = providedCategorySlots(params);

    await client.patch(`/appInfos/${params.appInfoId}`, {
      data: {
        type: "appInfos",
        id: params.appInfoId,
        relationships: Object.fromEntries(
          slots.map((slot) => [slot.relationship, { data: { type: "appCategories", id: slot.id } }])
        ),
      },
    });

    return {
      success: true,
      data: {
        appInfoId: params.appInfoId,
        updated: Object.fromEntries(slots.map((slot) => [slot.input, slot.id])),
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List the subcategories of an App Store category
 */
export async function listAppSubcategories(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAppSubcategoriesInputSchema, input);
    const response = await client.get<ASCListResponse<AppCategoryResource>>(
      `/appCategories/${params.categoryId}/subcategories`,
      { limit: params.limit }
    );
    return {
      success: true,
      data: response.data.map((category) => ({
        id: category.id,
        platforms: category.attributes?.platforms,
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
 * Get the age rating declaration (questionnaire answers) for an app info record
 */
export async function getAgeRatingDeclaration(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(appInfoIdInputSchema, input);
    const response = await client.get<ASCResponse<AgeRatingDeclarationResource>>(
      `/appInfos/${params.appInfoId}/ageRatingDeclaration`
    );
    return { success: true, data: formatAgeRatingDeclaration(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update age rating questionnaire answers (only the attributes provided are changed)
 */
export async function updateAgeRatingDeclaration(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateAgeRatingDeclarationInputSchema, input);

    const response = await client.patch<ASCResponse<AgeRatingDeclarationResource>>(
      `/ageRatingDeclarations/${params.declarationId}`,
      {
        data: {
          type: "ageRatingDeclarations",
          id: params.declarationId,
          attributes: pickDefined(params.attributes, AGE_RATING_KEYS),
        },
      }
    );

    return { success: true, data: formatAgeRatingDeclaration(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create an app info localization (name, subtitle, privacy links) for a locale
 */
export async function createAppInfoLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createAppInfoLocalizationInputSchema, input);

    const response = await client.post<ASCResponse<AppInfoLocalizationResource>>(
      "/appInfoLocalizations",
      {
        data: {
          type: "appInfoLocalizations",
          attributes: pickDefined(params, APP_INFO_LOCALIZATION_ATTRIBUTES),
          relationships: {
            appInfo: { data: { type: "appInfos", id: params.appInfoId } },
          },
        },
      }
    );

    return { success: true, data: formatAppInfoLocalization(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete an app info localization
 */
export async function deleteAppInfoLocalization(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deleteAppInfoLocalizationInputSchema, input);
    await client.delete(`/appInfoLocalizations/${params.localizationId}`);
    return {
      success: true,
      data: { deleted: true, localizationId: params.localizationId },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get the custom end user license agreement for an app (null when none is set)
 */
export async function getEula(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(appIdInputSchema, input);
    const response = await client.get<ASCResponse<EulaResource | null>>(
      `/apps/${params.appId}/endUserLicenseAgreement`
    );
    return { success: true, data: response.data ? formatEula(response.data) : null };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a custom end user license agreement for an app in the given territories
 */
export async function createEula(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(createEulaInputSchema, input);

    const response = await client.post<ASCResponse<EulaResource>>("/endUserLicenseAgreements", {
      data: {
        type: "endUserLicenseAgreements",
        attributes: { agreementText: params.agreementText },
        relationships: {
          app: { data: { type: "apps", id: params.appId } },
          territories: {
            data: params.territories.map((id) => ({ type: "territories", id })),
          },
        },
      },
    });

    return { success: true, data: formatEula(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update a custom EULA's text and/or territories (territories replaces the current list)
 */
export async function updateEula(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(updateEulaInputSchema, input);

    const data: Record<string, unknown> = { type: "endUserLicenseAgreements", id: params.eulaId };
    if (params.agreementText !== undefined) {
      data.attributes = { agreementText: params.agreementText };
    }
    if (params.territories !== undefined) {
      data.relationships = {
        territories: {
          data: params.territories.map((id) => ({ type: "territories", id })),
        },
      };
    }

    const response = await client.patch<ASCResponse<EulaResource>>(
      `/endUserLicenseAgreements/${params.eulaId}`,
      { data }
    );

    return { success: true, data: formatEula(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a custom end user license agreement
 */
export async function deleteEula(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(eulaIdInputSchema, input);
    await client.delete(`/endUserLicenseAgreements/${params.eulaId}`);
    return { success: true, data: { deleted: true, eulaId: params.eulaId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

const categoryProperties = {
  primaryCategoryId: { type: "string", description: "Primary category ID, e.g. GAMES" },
  primarySubcategoryOneId: { type: "string", description: "Primary subcategory 1 ID" },
  primarySubcategoryTwoId: { type: "string", description: "Primary subcategory 2 ID" },
  secondaryCategoryId: { type: "string", description: "Secondary category ID" },
  secondarySubcategoryOneId: { type: "string", description: "Secondary subcategory 1 ID" },
  secondarySubcategoryTwoId: { type: "string", description: "Secondary subcategory 2 ID" },
};

const intensityJsonSchema = { type: "string", enum: INTENSITY };

/** A string attribute that may also be null, which clears it. */
const clearableJsonSchema = (values?: readonly string[]) => ({
  type: ["string", "null"],
  ...(values ? { enum: [...values, null] } : {}),
});

/** JSON Schema mirror of ageRatingAttributesSchema (same names, same enums). */
const ageRatingAttributeProperties = {
  advertising: { type: "boolean" },
  alcoholTobaccoOrDrugUseOrReferences: intensityJsonSchema,
  contests: intensityJsonSchema,
  gambling: { type: "boolean" },
  gamblingSimulated: intensityJsonSchema,
  gunsOrOtherWeapons: intensityJsonSchema,
  healthOrWellnessTopics: { type: "boolean" },
  kidsAgeBand: clearableJsonSchema(KIDS_AGE_BANDS),
  lootBox: { type: "boolean" },
  medicalOrTreatmentInformation: intensityJsonSchema,
  messagingAndChat: { type: "boolean" },
  parentalControls: { type: "boolean" },
  profanityOrCrudeHumor: intensityJsonSchema,
  ageAssurance: { type: "boolean" },
  sexualContentGraphicAndNudity: intensityJsonSchema,
  sexualContentOrNudity: intensityJsonSchema,
  socialMedia: { type: "boolean" },
  socialMediaAgeRestricted: { type: "boolean" },
  horrorOrFearThemes: intensityJsonSchema,
  matureOrSuggestiveThemes: intensityJsonSchema,
  unrestrictedWebAccess: { type: "boolean" },
  userGeneratedContent: { type: "boolean" },
  violenceCartoonOrFantasy: intensityJsonSchema,
  violenceRealisticProlongedGraphicOrSadistic: intensityJsonSchema,
  violenceRealistic: intensityJsonSchema,
  ageRatingOverride: clearableJsonSchema(AGE_RATING_OVERRIDE),
  ageRatingOverrideV2: clearableJsonSchema(AGE_RATING_OVERRIDE_V2),
  koreaAgeRatingOverride: clearableJsonSchema(KOREA_AGE_RATING_OVERRIDE),
  gracRatingClassificationNumber: clearableJsonSchema(),
  developerAgeRatingInfoUrl: { ...clearableJsonSchema(), format: "uri" },
};

export const appInfoAdminToolDefinitions = [
  {
    name: "get_app_info_categories",
    description:
      "Get the primary and secondary App Store categories and subcategories of an app info record. Unset slots are null.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appInfoId: { type: "string", description: "The app info ID" },
      },
      required: ["appInfoId"],
    },
  },
  {
    name: "set_app_categories",
    description:
      "Set one or more App Store categories or subcategories on an app info record. Only the slots provided are changed; at least one is required.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appInfoId: { type: "string", description: "The app info ID" },
        ...categoryProperties,
      },
      required: ["appInfoId"],
    },
  },
  {
    name: "list_app_subcategories",
    description:
      "List the subcategories of an App Store category, for example the subcategories of GAMES.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        categoryId: { type: "string", description: "The App Store category ID, e.g. GAMES" },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Max results (1-200)" },
      },
      required: ["categoryId"],
    },
  },
  {
    name: "get_age_rating_declaration",
    description: "Get the age rating questionnaire answers for an app info record.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appInfoId: { type: "string", description: "The app info ID" },
      },
      required: ["appInfoId"],
    },
  },
  {
    name: "update_age_rating_declaration",
    description:
      "Update age rating questionnaire answers. Only the attributes provided are changed; socialMedia cannot be true while userGeneratedContent is false.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        declarationId: { type: "string", description: "The age rating declaration ID" },
        attributes: {
          type: "object",
          description:
            "Age rating answers to change; keys not listed are rejected. null clears kidsAgeBand, the overrides, gracRatingClassificationNumber, and developerAgeRatingInfoUrl.",
          properties: ageRatingAttributeProperties,
          additionalProperties: false,
        },
      },
      required: ["declarationId", "attributes"],
    },
  },
  {
    name: "create_app_info_localization",
    description:
      "Create an app info localization (name, subtitle, privacy links) for a locale. The name is required.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appInfoId: { type: "string", description: "The app info ID" },
        locale: { type: "string", description: "Locale code, e.g. en-US or de-DE" },
        name: { type: "string", maxLength: 30, description: "App name for the locale (max 30)" },
        subtitle: { type: "string", maxLength: 30, description: "Subtitle (max 30 characters)" },
        privacyPolicyUrl: {
          type: "string",
          format: "uri",
          description: "HTTPS privacy policy URL",
        },
        privacyChoicesUrl: {
          type: "string",
          format: "uri",
          description: "HTTPS privacy choices URL",
        },
        privacyPolicyText: { type: "string", description: "Privacy policy text" },
      },
      required: ["appInfoId", "locale", "name"],
    },
  },
  {
    name: "delete_app_info_localization",
    description: "Delete an app info localization.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        localizationId: { type: "string", description: "The app info localization ID" },
      },
      required: ["localizationId"],
    },
  },
  {
    name: "get_eula",
    description:
      "Get the custom end user license agreement for an app. Returns null when the app has none.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The app ID" },
      },
      required: ["appId"],
    },
  },
  {
    name: "create_eula",
    description:
      "Create a custom end user license agreement for an app, applied to the given territories (e.g. USA, GBR).",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The app ID" },
        agreementText: { type: "string", description: "Full license agreement text" },
        territories: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Territory codes such as USA or GBR",
        },
      },
      required: ["appId", "agreementText", "territories"],
    },
  },
  {
    name: "update_eula",
    description:
      "Update an app's custom EULA text and/or territories. Only the fields provided are changed; territories replaces the current list.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        eulaId: { type: "string", description: "The EULA ID" },
        agreementText: { type: "string", description: "New license agreement text" },
        territories: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Territory codes that replace the current list, e.g. USA",
        },
      },
      required: ["eulaId"],
    },
  },
  {
    name: "delete_eula",
    description: "Delete an app's custom end user license agreement.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        eulaId: { type: "string", description: "The EULA ID to delete" },
      },
      required: ["eulaId"],
    },
  },
];

export const appInfoAdminToolsModule: ToolModule = {
  toolset: "apps",
  definitions: appInfoAdminToolDefinitions,
  handlers: {
    get_app_info_categories: getAppInfoCategories,
    set_app_categories: setAppCategories,
    list_app_subcategories: listAppSubcategories,
    get_age_rating_declaration: getAgeRatingDeclaration,
    update_age_rating_declaration: updateAgeRatingDeclaration,
    create_app_info_localization: createAppInfoLocalization,
    delete_app_info_localization: deleteAppInfoLocalization,
    get_eula: getEula,
    create_eula: createEula,
    update_eula: updateEula,
    delete_eula: deleteEula,
  },
};
