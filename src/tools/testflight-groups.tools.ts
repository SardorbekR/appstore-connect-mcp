/**
 * TestFlight Group Tools - Manage beta groups, the builds and testers linked to them, and
 * beta tester invitations. Adding a tester by email and removing a tester from a group live
 * in beta.tools.ts (add_beta_tester, remove_beta_tester).
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

interface BetaGroupResource {
  type: "betaGroups";
  id: string;
  attributes: {
    name?: string;
    createdDate?: string;
    isInternalGroup?: boolean;
    hasAccessToAllBuilds?: boolean;
    publicLinkEnabled?: boolean;
    publicLink?: string;
    publicLinkLimitEnabled?: boolean;
    publicLinkLimit?: number;
    feedbackEnabled?: boolean;
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
    buildAudienceType?: "INTERNAL_ONLY" | "APP_STORE_ELIGIBLE";
    usesNonExemptEncryption?: boolean;
  };
}

interface BetaTesterInvitationResource {
  type: "betaTesterInvitations";
  id: string;
}

// ============================================================================
// Input schemas
// ============================================================================

const betaGroupIdInputSchema = z.object({ betaGroupId: resourceIdSchema });

const listBetaGroupBuildsInputSchema = z.object({
  betaGroupId: resourceIdSchema,
  limit: z.number().int().min(1).max(200).optional(),
});

const createBetaGroupInputSchema = z.object({
  appId: resourceIdSchema,
  name: z.string().min(1, "Group name is required"),
  isInternalGroup: z.boolean().optional(),
  hasAccessToAllBuilds: z.boolean().optional(),
  publicLinkEnabled: z.boolean().optional(),
  publicLinkLimitEnabled: z.boolean().optional(),
  publicLinkLimit: z.number().int().positive().optional(),
  feedbackEnabled: z.boolean().optional(),
});

const updateBetaGroupFields = {
  name: z.string().min(1).optional(),
  publicLinkEnabled: z.boolean().optional(),
  publicLinkLimitEnabled: z.boolean().optional(),
  publicLinkLimit: z.number().int().positive().optional(),
  feedbackEnabled: z.boolean().optional(),
  iosBuildsAvailableForAppleSiliconMac: z.boolean().optional(),
  iosBuildsAvailableForAppleVision: z.boolean().optional(),
};
const UPDATE_BETA_GROUP_KEYS = Object.keys(updateBetaGroupFields) as Array<
  keyof typeof updateBetaGroupFields
>;

const updateBetaGroupInputSchema = z
  .object({ betaGroupId: resourceIdSchema, ...updateBetaGroupFields })
  .refine((input) => UPDATE_BETA_GROUP_KEYS.some((key) => input[key] !== undefined), {
    message: "Provide at least one field to update",
  });

const buildIdsSchema = z.array(resourceIdSchema).min(1, "At least one build ID is required");
const betaTesterIdsSchema = z
  .array(resourceIdSchema)
  .min(1, "At least one beta tester ID is required");

const groupBuildsInputSchema = z.object({
  betaGroupId: resourceIdSchema,
  buildIds: buildIdsSchema,
});

const groupTestersInputSchema = z.object({
  betaGroupId: resourceIdSchema,
  betaTesterIds: betaTesterIdsSchema,
});

const betaTesterIdInputSchema = z.object({ betaTesterId: resourceIdSchema });

const inviteBetaTesterInputSchema = z.object({
  appId: resourceIdSchema,
  betaTesterId: resourceIdSchema,
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

const CREATE_BETA_GROUP_KEYS = [
  "name",
  "isInternalGroup",
  "hasAccessToAllBuilds",
  "publicLinkEnabled",
  "publicLinkLimitEnabled",
  "publicLinkLimit",
  "feedbackEnabled",
] as const;

const GROUP_FIELDS =
  "name,createdDate,isInternalGroup,hasAccessToAllBuilds,publicLinkEnabled,publicLink,publicLinkLimitEnabled,publicLinkLimit,feedbackEnabled";

const BUILD_FIELDS =
  "version,uploadedDate,expirationDate,expired,processingState,buildAudienceType,usesNonExemptEncryption";

function formatBetaGroup(group: BetaGroupResource) {
  return {
    id: group.id,
    name: group.attributes.name,
    createdDate: group.attributes.createdDate,
    isInternalGroup: group.attributes.isInternalGroup,
    hasAccessToAllBuilds: group.attributes.hasAccessToAllBuilds,
    publicLinkEnabled: group.attributes.publicLinkEnabled,
    publicLink: group.attributes.publicLink,
    publicLinkLimitEnabled: group.attributes.publicLinkLimitEnabled,
    publicLinkLimit: group.attributes.publicLinkLimit,
    feedbackEnabled: group.attributes.feedbackEnabled,
  };
}

function formatBuild(build: BuildResource) {
  return {
    id: build.id,
    version: build.attributes.version,
    uploadedDate: build.attributes.uploadedDate,
    expirationDate: build.attributes.expirationDate,
    expired: build.attributes.expired,
    processingState: build.attributes.processingState,
    buildAudienceType: build.attributes.buildAudienceType,
    usesNonExemptEncryption: build.attributes.usesNonExemptEncryption,
  };
}

function toLinkage(type: "builds" | "betaTesters", ids: string[]) {
  return ids.map((id) => ({ type, id }));
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Get a beta group by ID
 */
export async function getBetaGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(betaGroupIdInputSchema, input);
    const response = await client.get<ASCResponse<BetaGroupResource>>(
      `/betaGroups/${params.betaGroupId}`,
      { "fields[betaGroups]": GROUP_FIELDS }
    );
    return { success: true, data: formatBetaGroup(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Create a beta group for an app
 */
export async function createBetaGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createBetaGroupInputSchema, input);

    const response = await client.post<ASCResponse<BetaGroupResource>>("/betaGroups", {
      data: {
        type: "betaGroups",
        attributes: pickDefined(params, CREATE_BETA_GROUP_KEYS),
        relationships: {
          app: { data: { type: "apps", id: params.appId } },
        },
      },
    });

    return { success: true, data: formatBetaGroup(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Update a beta group's settings (only the fields provided are changed)
 */
export async function updateBetaGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(updateBetaGroupInputSchema, input);

    const response = await client.patch<ASCResponse<BetaGroupResource>>(
      `/betaGroups/${params.betaGroupId}`,
      {
        data: {
          type: "betaGroups",
          id: params.betaGroupId,
          attributes: pickDefined(params, UPDATE_BETA_GROUP_KEYS),
        },
      }
    );

    return { success: true, data: formatBetaGroup(response.data) };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a beta group
 */
export async function deleteBetaGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(betaGroupIdInputSchema, input);
    await client.delete(`/betaGroups/${params.betaGroupId}`);
    return { success: true, data: { deleted: true, betaGroupId: params.betaGroupId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List the builds available to a beta group
 */
export async function listBetaGroupBuilds(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listBetaGroupBuildsInputSchema, input);

    const response = await client.get<ASCListResponse<BuildResource>>(
      `/betaGroups/${params.betaGroupId}/builds`,
      { "fields[builds]": BUILD_FIELDS, limit: params.limit }
    );

    const builds = response.data.map(formatBuild);
    return {
      success: true,
      data: builds,
      meta: { total: response.meta?.paging?.total, returned: builds.length },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Make builds available to a beta group
 */
export async function addBuildsToBetaGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(groupBuildsInputSchema, input);

    await client.post(`/betaGroups/${params.betaGroupId}/relationships/builds`, {
      data: toLinkage("builds", params.buildIds),
    });

    return { success: true, data: { betaGroupId: params.betaGroupId, buildIds: params.buildIds } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Remove builds from a beta group (the builds themselves are kept)
 */
export async function removeBuildsFromBetaGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(groupBuildsInputSchema, input);

    await client.delete(`/betaGroups/${params.betaGroupId}/relationships/builds`, {
      data: toLinkage("builds", params.buildIds),
    });

    return { success: true, data: { betaGroupId: params.betaGroupId, buildIds: params.buildIds } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Add existing beta testers to a beta group
 */
export async function addTestersToBetaGroup(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(groupTestersInputSchema, input);

    await client.post(`/betaGroups/${params.betaGroupId}/relationships/betaTesters`, {
      data: toLinkage("betaTesters", params.betaTesterIds),
    });

    return {
      success: true,
      data: { betaGroupId: params.betaGroupId, betaTesterIds: params.betaTesterIds },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete a beta tester. This removes the tester from all groups and apps.
 */
export async function deleteBetaTester(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(betaTesterIdInputSchema, input);
    await client.delete(`/betaTesters/${params.betaTesterId}`);
    return { success: true, data: { deleted: true, betaTesterId: params.betaTesterId } };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Invite an existing beta tester to an app's TestFlight. Apple emails the invitation.
 */
export async function inviteBetaTester(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(inviteBetaTesterInputSchema, input);

    const response = await client.post<ASCResponse<BetaTesterInvitationResource>>(
      "/betaTesterInvitations",
      {
        data: {
          type: "betaTesterInvitations",
          relationships: {
            app: { data: { type: "apps", id: params.appId } },
            betaTester: { data: { type: "betaTesters", id: params.betaTesterId } },
          },
        },
      }
    );

    return {
      success: true,
      data: {
        invitationId: response.data.id,
        appId: params.appId,
        betaTesterId: params.betaTesterId,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// ============================================================================
// Definitions
// ============================================================================

const betaGroupIdProperty = { type: "string", description: "The beta group ID" };

export const testflightGroupsToolDefinitions = [
  {
    name: "get_beta_group",
    description: "Get a beta group's settings, including its public TestFlight link.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: { betaGroupId: betaGroupIdProperty },
      required: ["betaGroupId"],
    },
  },
  {
    name: "create_beta_group",
    description:
      "Create a beta group for an app. Set isInternalGroup for an internal group of team members.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        name: { type: "string", description: "Name of the beta group" },
        isInternalGroup: {
          type: "boolean",
          description: "True for an internal group of App Store Connect users",
        },
        hasAccessToAllBuilds: {
          type: "boolean",
          description: "True to give the group access to every build of the app",
        },
        publicLinkEnabled: {
          type: "boolean",
          description: "True to enable the public TestFlight link",
        },
        publicLinkLimitEnabled: {
          type: "boolean",
          description: "True to cap how many testers can join through the public link",
        },
        publicLinkLimit: {
          type: "integer",
          description: "Maximum testers who can join through the public link",
        },
        feedbackEnabled: {
          type: "boolean",
          description: "True to allow testers to send feedback",
        },
      },
      required: ["appId", "name"],
    },
  },
  {
    name: "update_beta_group",
    description:
      "Update a beta group's settings. Only the fields provided are changed; the group's internal flag and build access cannot be changed here.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        betaGroupId: betaGroupIdProperty,
        name: { type: "string", description: "New name of the beta group" },
        publicLinkEnabled: {
          type: "boolean",
          description: "True to enable the public TestFlight link",
        },
        publicLinkLimitEnabled: {
          type: "boolean",
          description: "True to cap how many testers can join through the public link",
        },
        publicLinkLimit: {
          type: "integer",
          description: "Maximum testers who can join through the public link",
        },
        feedbackEnabled: {
          type: "boolean",
          description: "True to allow testers to send feedback",
        },
        iosBuildsAvailableForAppleSiliconMac: {
          type: "boolean",
          description: "True to make iOS builds available to Apple silicon Macs",
        },
        iosBuildsAvailableForAppleVision: {
          type: "boolean",
          description: "True to make iOS builds available to Apple Vision Pro",
        },
      },
      required: ["betaGroupId"],
    },
  },
  {
    name: "delete_beta_group",
    description: "Delete a beta group.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: { betaGroupId: betaGroupIdProperty },
      required: ["betaGroupId"],
    },
  },
  {
    name: "list_beta_group_builds",
    description: "List the builds available to a beta group.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        betaGroupId: betaGroupIdProperty,
        limit: {
          type: "integer",
          description: "Maximum number of builds to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["betaGroupId"],
    },
  },
  {
    name: "add_builds_to_beta_group",
    description:
      "Make one or more builds available to a beta group. Use list_builds to find build IDs.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        betaGroupId: betaGroupIdProperty,
        buildIds: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Build IDs to add (at least one)",
        },
      },
      required: ["betaGroupId", "buildIds"],
    },
  },
  {
    name: "remove_builds_from_beta_group",
    description:
      "Remove one or more builds from a beta group. The builds themselves are kept, and testers in the group lose access to them.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        betaGroupId: betaGroupIdProperty,
        buildIds: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Build IDs to remove (at least one)",
        },
      },
      required: ["betaGroupId", "buildIds"],
    },
  },
  {
    name: "add_testers_to_beta_group",
    description:
      "Add existing beta testers to a beta group by tester ID. To add a new tester by email, use add_beta_tester.",
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: "object" as const,
      properties: {
        betaGroupId: betaGroupIdProperty,
        betaTesterIds: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Beta tester IDs to add (at least one)",
        },
      },
      required: ["betaGroupId", "betaTesterIds"],
    },
  },
  {
    name: "delete_beta_tester",
    description:
      "Delete a beta tester from the account. The tester is removed from all beta groups and apps.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        betaTesterId: { type: "string", description: "The beta tester ID to delete" },
      },
      required: ["betaTesterId"],
    },
  },
  {
    name: "invite_beta_tester",
    description: "Send an existing beta tester an invitation to test an app.",
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: { type: "string", description: "The App Store Connect app ID" },
        betaTesterId: { type: "string", description: "The beta tester ID to invite" },
      },
      required: ["appId", "betaTesterId"],
    },
  },
];

export const testflightGroupsToolsModule: ToolModule = {
  toolset: "testflight",
  definitions: testflightGroupsToolDefinitions,
  handlers: {
    get_beta_group: getBetaGroup,
    create_beta_group: createBetaGroup,
    update_beta_group: updateBetaGroup,
    delete_beta_group: deleteBetaGroup,
    list_beta_group_builds: listBetaGroupBuilds,
    add_builds_to_beta_group: addBuildsToBetaGroup,
    remove_builds_from_beta_group: removeBuildsFromBetaGroup,
    add_testers_to_beta_group: addTestersToBetaGroup,
    delete_beta_tester: deleteBetaTester,
    invite_beta_tester: inviteBetaTester,
  },
};
