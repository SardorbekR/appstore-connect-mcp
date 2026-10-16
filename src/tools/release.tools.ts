/**
 * Release Tools - Phased releases, releasing an approved version, export compliance
 * (encryption) declarations, and build expiry and encryption flags.
 */

import { z } from "zod";
import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import { resourceIdSchema, validateInput } from "../utils/validation.js";
import type { ToolModule } from "./types.js";

// ============================================================================
// Types
// ============================================================================

interface PhasedReleaseResource {
  type: "appStoreVersionPhasedReleases";
  id: string;
  attributes: {
    phasedReleaseState?: "INACTIVE" | "ACTIVE" | "PAUSED" | "COMPLETE";
    startDate?: string | null;
    totalPauseDuration?: number;
    currentDayNumber?: number;
  };
}

interface ReleaseRequestResource {
  type: "appStoreVersionReleaseRequests";
  id: string;
}

interface EncryptionDeclarationResource {
  type: "appEncryptionDeclarations";
  id: string;
  attributes: {
    appDescription?: string;
    createdDate?: string;
    usesEncryption?: boolean;
    exempt?: boolean;
    containsProprietaryCryptography?: boolean;
    containsThirdPartyCryptography?: boolean;
    availableOnFrenchStore?: boolean;
    platform?: "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";
    uploadedDate?: string;
    appEncryptionDeclarationState?:
      | "CREATED"
      | "IN_REVIEW"
      | "APPROVED"
      | "REJECTED"
      | "INVALID"
      | "EXPIRED";
    codeValue?: string;
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

// ============================================================================
// Input schemas
// ============================================================================

const versionIdInputSchema = z.object({ versionId: resourceIdSchema });

const phasedReleaseIdInputSchema = z.object({ phasedReleaseId: resourceIdSchema });

const declarationIdInputSchema = z.object({ declarationId: resourceIdSchema });

const createPhasedReleaseInputSchema = z.object({
  versionId: resourceIdSchema,
  phasedReleaseState: z.enum(["INACTIVE", "ACTIVE"]).optional(),
});

const updatePhasedReleaseInputSchema = z
  .object({
    phasedReleaseId: resourceIdSchema,
    phasedReleaseState: z.enum(["ACTIVE", "PAUSED", "COMPLETE"]),
    confirmReleaseToAll: z.boolean().optional(),
  })
  .refine(
    (input) => input.phasedReleaseState !== "COMPLETE" || input.confirmReleaseToAll === true,
    {
      message:
        "COMPLETE releases the version to all users immediately; set confirmReleaseToAll to true to proceed",
      path: ["confirmReleaseToAll"],
    }
  );

const listEncryptionDeclarationsInputSchema = z.object({
  appId: resourceIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

const createEncryptionDeclarationInputSchema = z.object({
  appId: resourceIdSchema,
  appDescription: z.string().min(1, "App description is required"),
  containsProprietaryCryptography: z.boolean(),
  containsThirdPartyCryptography: z.boolean(),
  availableOnFrenchStore: z.boolean(),
});

const assignBuildsInputSchema = z.object({
  declarationId: resourceIdSchema,
  buildIds: z.array(resourceIdSchema).min(1, "At least one build ID is required"),
});

const updateBuildInputSchema = z
  .object({
    buildId: resourceIdSchema,
    expired: z.boolean().optional(),
    confirmExpire: z.boolean().optional(),
    usesNonExemptEncryption: z.boolean().optional(),
    appEncryptionDeclarationId: resourceIdSchema.optional(),
  })
  .refine(
    (input) =>
      input.expired !== undefined ||
      input.usesNonExemptEncryption !== undefined ||
      input.appEncryptionDeclarationId !== undefined,
    { message: "Provide at least one field to update" }
  )
  .refine((input) => input.expired !== true || input.confirmExpire === true, {
    message: "Expiring a build ends its TestFlight testing; set confirmExpire to true to proceed",
    path: ["confirmExpire"],
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

function formatPhasedRelease(release: PhasedReleaseResource) {
  return {
    id: release.id,
    phasedReleaseState: release.attributes.phasedReleaseState,
    startDate: release.attributes.startDate,
    totalPauseDuration: release.attributes.totalPauseDuration,
    currentDayNumber: release.attributes.currentDayNumber,
  };
}

function formatEncryptionDeclaration(declaration: EncryptionDeclarationResource) {
  const attributes = declaration.attributes;
  return {
    id: declaration.id,
    appDescription: attributes.appDescription,
    platform: attributes.platform,
    state: attributes.appEncryptionDeclarationState,
    usesEncryption: attributes.usesEncryption,
    exempt: attributes.exempt,
    containsProprietaryCryptography: attributes.containsProprietaryCryptography,
    containsThirdPartyCryptography: attributes.containsThirdPartyCryptography,
    availableOnFrenchStore: attributes.availableOnFrenchStore,
    codeValue: attributes.codeValue,
    uploadedDate: attributes.uploadedDate,
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

// ============================================================================
// Handlers
// ============================================================================

/**
 * Get the phased release (gradual rollout) of an App Store version
 */
export async function getPhasedRelease(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(versionIdInputSchema, input);
    const response = await client.get<ASCResponse<PhasedReleaseResource | null>>(
      `/appStoreVersions/${params.versionId}/appStoreVersionPhasedRelease`
    );
    return { success: true, data: response.data ? formatPhasedRelease(response.data) : null };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a phased release for an App Store version
 */
export async function createPhasedRelease(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createPhasedReleaseInputSchema, input);
    const attributes = pickDefined(params, ["phasedReleaseState"]);

    const response = await client.post<ASCResponse<PhasedReleaseResource>>(
      "/appStoreVersionPhasedReleases",
      {
        data: {
          type: "appStoreVersionPhasedReleases",
          ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: params.versionId } },
          },
        },
      }
    );

    return { success: true, data: formatPhasedRelease(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Change a phased release's state. COMPLETE releases to all users at once and needs confirmation.
 */
export async function updatePhasedRelease(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updatePhasedReleaseInputSchema, input);

    const response = await client.patch<ASCResponse<PhasedReleaseResource>>(
      `/appStoreVersionPhasedReleases/${params.phasedReleaseId}`,
      {
        data: {
          type: "appStoreVersionPhasedReleases",
          id: params.phasedReleaseId,
          attributes: pickDefined(params, ["phasedReleaseState"]),
        },
      }
    );

    return { success: true, data: formatPhasedRelease(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a phased release
 */
export async function deletePhasedRelease(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(phasedReleaseIdInputSchema, input);
    await client.delete(`/appStoreVersionPhasedReleases/${params.phasedReleaseId}`);
    return { success: true, data: { deleted: true, phasedReleaseId: params.phasedReleaseId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Release an approved version that is waiting for developer release
 */
export async function releaseAppVersion(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(versionIdInputSchema, input);

    const response = await client.post<ASCResponse<ReleaseRequestResource>>(
      "/appStoreVersionReleaseRequests",
      {
        data: {
          type: "appStoreVersionReleaseRequests",
          relationships: {
            appStoreVersion: { data: { type: "appStoreVersions", id: params.versionId } },
          },
        },
      }
    );

    return {
      success: true,
      data: { versionId: params.versionId, releaseRequestId: response.data.id },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List export compliance (encryption) declarations for an app
 */
export async function listEncryptionDeclarations(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listEncryptionDeclarationsInputSchema, input);

    const response = await client.get<ASCListResponse<EncryptionDeclarationResource>>(
      `/apps/${params.appId}/appEncryptionDeclarations`,
      { limit: params.limit }
    );

    return {
      success: true,
      data: response.data.map((declaration) => formatEncryptionDeclaration(declaration)),
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
 * Get one export compliance (encryption) declaration
 */
export async function getEncryptionDeclaration(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(declarationIdInputSchema, input);
    const response = await client.get<ASCResponse<EncryptionDeclarationResource>>(
      `/appEncryptionDeclarations/${params.declarationId}`
    );
    return { success: true, data: formatEncryptionDeclaration(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create an export compliance (encryption) declaration for an app
 */
export async function createEncryptionDeclaration(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createEncryptionDeclarationInputSchema, input);

    const response = await client.post<ASCResponse<EncryptionDeclarationResource>>(
      "/appEncryptionDeclarations",
      {
        data: {
          type: "appEncryptionDeclarations",
          attributes: {
            appDescription: params.appDescription,
            containsProprietaryCryptography: params.containsProprietaryCryptography,
            containsThirdPartyCryptography: params.containsThirdPartyCryptography,
            availableOnFrenchStore: params.availableOnFrenchStore,
          },
          relationships: {
            app: { data: { type: "apps", id: params.appId } },
          },
        },
      }
    );

    return { success: true, data: formatEncryptionDeclaration(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Link builds to an encryption declaration (Apple marks this endpoint deprecated)
 */
export async function assignBuildsToEncryptionDeclaration(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(assignBuildsInputSchema, input);

    await client.post(`/appEncryptionDeclarations/${params.declarationId}/relationships/builds`, {
      data: params.buildIds.map((id) => ({ type: "builds", id })),
    });

    return {
      success: true,
      data: { declarationId: params.declarationId, buildIds: params.buildIds },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update a build's encryption flag, encryption declaration, or expiry.
 * Expiring a build ends its TestFlight testing and needs confirmExpire.
 */
export async function updateBuild(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(updateBuildInputSchema, input);
    const attributes = pickDefined(params, ["expired", "usesNonExemptEncryption"]);

    const response = await client.patch<ASCResponse<BuildResource>>(`/builds/${params.buildId}`, {
      data: {
        type: "builds",
        id: params.buildId,
        ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
        ...(params.appEncryptionDeclarationId !== undefined
          ? {
              relationships: {
                appEncryptionDeclaration: {
                  data: {
                    type: "appEncryptionDeclarations",
                    id: params.appEncryptionDeclarationId,
                  },
                },
              },
            }
          : {}),
      },
    });

    return { success: true, data: formatBuild(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

export const releaseToolDefinitions = [
  {
    name: "get_phased_release",
    description:
      "Get the phased release (gradual rollout) of an App Store version. Returns null when the version has no phased release.",
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
    name: "create_phased_release",
    description:
      "Create a phased release for an App Store version. Use update_phased_release to change its state afterwards.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The App Store version ID" },
        phasedReleaseState: {
          type: "string",
          enum: ["INACTIVE", "ACTIVE"],
          description: "Initial state (defaults to INACTIVE)",
        },
      },
      required: ["versionId"],
    },
  },
  {
    name: "update_phased_release",
    description:
      "Change a phased release to ACTIVE, PAUSED, or COMPLETE. COMPLETE releases the version to all users immediately and requires confirmReleaseToAll=true.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        phasedReleaseId: { type: "string", description: "The phased release ID" },
        phasedReleaseState: {
          type: "string",
          enum: ["ACTIVE", "PAUSED", "COMPLETE"],
          description: "New state of the phased release",
        },
        confirmReleaseToAll: {
          type: "boolean",
          description: "Must be true when phasedReleaseState is COMPLETE",
        },
      },
      required: ["phasedReleaseId", "phasedReleaseState"],
    },
  },
  {
    name: "delete_phased_release",
    description: "Delete a phased release for an App Store version.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        phasedReleaseId: { type: "string", description: "The phased release ID to delete" },
      },
      required: ["phasedReleaseId"],
    },
  },
  {
    name: "release_app_version",
    description:
      "Release an App Store version that is approved and waiting for developer release (PENDING_DEVELOPER_RELEASE). The version becomes available to users.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        versionId: { type: "string", description: "The App Store version ID to release" },
      },
      required: ["versionId"],
    },
  },
  {
    name: "list_encryption_declarations",
    description: "List export compliance (encryption) declarations for an app.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        limit: {
          type: "number",
          description: "Maximum number of declarations to return (1-200)",
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_encryption_declaration",
    description: "Get one export compliance (encryption) declaration by ID.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        declarationId: { type: "string", description: "The encryption declaration ID" },
      },
      required: ["declarationId"],
    },
  },
  {
    name: "create_encryption_declaration",
    description:
      "Create an export compliance (encryption) declaration for an app. All four compliance answers are required.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        appDescription: {
          type: "string",
          description: "Description of the encryption the app uses",
        },
        containsProprietaryCryptography: {
          type: "boolean",
          description: "Whether the app contains proprietary cryptography",
        },
        containsThirdPartyCryptography: {
          type: "boolean",
          description: "Whether the app contains third-party cryptography",
        },
        availableOnFrenchStore: {
          type: "boolean",
          description: "Whether the app is available on the French App Store",
        },
      },
      required: [
        "appId",
        "appDescription",
        "containsProprietaryCryptography",
        "containsThirdPartyCryptography",
        "availableOnFrenchStore",
      ],
    },
  },
  {
    name: "assign_builds_to_encryption_declaration",
    description:
      "Link builds to an encryption declaration. Apple marks this endpoint deprecated; update_build can set a build's declaration instead.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        declarationId: { type: "string", description: "The encryption declaration ID" },
        buildIds: {
          type: "array",
          items: { type: "string" },
          description: "Build IDs to link to the declaration",
        },
      },
      required: ["declarationId", "buildIds"],
    },
  },
  {
    name: "update_build",
    description:
      "Update a build's usesNonExemptEncryption flag, its encryption declaration, or expire it. Expiring ends TestFlight testing of the build and requires confirmExpire=true.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        buildId: { type: "string", description: "The build ID" },
        expired: {
          type: "boolean",
          description: "Set true to expire the build (irreversible for TestFlight testing)",
        },
        confirmExpire: {
          type: "boolean",
          description: "Must be true when expired is true",
        },
        usesNonExemptEncryption: {
          type: "boolean",
          description: "Whether the build uses non-exempt encryption",
        },
        appEncryptionDeclarationId: {
          type: "string",
          description: "Encryption declaration to attach to the build",
        },
      },
      required: ["buildId"],
    },
  },
];

export const releaseToolsModule: ToolModule = {
  toolset: "versions",
  definitions: releaseToolDefinitions,
  handlers: {
    get_phased_release: getPhasedRelease,
    create_phased_release: createPhasedRelease,
    update_phased_release: updatePhasedRelease,
    delete_phased_release: deletePhasedRelease,
    release_app_version: releaseAppVersion,
    list_encryption_declarations: listEncryptionDeclarations,
    get_encryption_declaration: getEncryptionDeclaration,
    create_encryption_declaration: createEncryptionDeclaration,
    assign_builds_to_encryption_declaration: assignBuildsToEncryptionDeclaration,
    update_build: updateBuild,
  },
};
