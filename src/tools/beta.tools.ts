/**
 * Beta Testing Tools - Manage beta groups and testers
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  BetaGroup,
  BetaTester,
  CreateBetaTesterRequest,
  RemoveBetaTestersRequest,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  addBetaTesterInputSchema,
  listBetaGroupsInputSchema,
  listBetaTestersInputSchema,
  removeBetaTesterInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * List beta groups for an app
 */
export async function listBetaGroups(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listBetaGroupsInputSchema, input);

    const response = await client.get<ASCListResponse<BetaGroup>>(
      `/apps/${params.appId}/betaGroups`,
      {
        limit: params.limit,
        "fields[betaGroups]":
          "name,createdDate,isInternalGroup,hasAccessToAllBuilds,publicLinkEnabled,publicLink,feedbackEnabled",
      }
    );

    return {
      success: true,
      data: response.data.map((group) => ({
        id: group.id,
        name: group.attributes.name,
        createdDate: group.attributes.createdDate,
        isInternalGroup: group.attributes.isInternalGroup,
        hasAccessToAllBuilds: group.attributes.hasAccessToAllBuilds,
        publicLinkEnabled: group.attributes.publicLinkEnabled,
        publicLink: group.attributes.publicLink,
        feedbackEnabled: group.attributes.feedbackEnabled,
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
 * List beta testers in a beta group
 */
export async function listBetaTesters(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listBetaTestersInputSchema, input);

    const response = await client.get<ASCListResponse<BetaTester>>(
      `/betaGroups/${params.betaGroupId}/betaTesters`,
      {
        limit: params.limit,
        "fields[betaTesters]": "firstName,lastName,email,inviteType,state",
      }
    );

    return {
      success: true,
      data: response.data.map((tester) => ({
        id: tester.id,
        firstName: tester.attributes.firstName,
        lastName: tester.attributes.lastName,
        email: tester.attributes.email,
        inviteType: tester.attributes.inviteType,
        state: tester.attributes.state,
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
 * Add a beta tester to a beta group
 */
export async function addBetaTester(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(addBetaTesterInputSchema, input);

    const requestBody: CreateBetaTesterRequest = {
      data: {
        type: "betaTesters",
        attributes: {
          email: params.email,
          firstName: params.firstName,
          lastName: params.lastName,
        },
        relationships: {
          betaGroups: {
            data: [
              {
                type: "betaGroups",
                id: params.betaGroupId,
              },
            ],
          },
        },
      },
    };

    const response = await client.post<ASCResponse<BetaTester>>("/betaTesters", requestBody);

    const tester = response.data;

    return {
      success: true,
      data: {
        id: tester.id,
        firstName: tester.attributes.firstName,
        lastName: tester.attributes.lastName,
        email: tester.attributes.email,
        inviteType: tester.attributes.inviteType,
        state: tester.attributes.state,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Remove a beta tester from a beta group
 */
export async function removeBetaTester(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(removeBetaTesterInputSchema, input);

    const requestBody: RemoveBetaTestersRequest = {
      data: [
        {
          type: "betaTesters",
          id: params.betaTesterId,
        },
      ],
    };

    // Delete the beta tester from the group by deleting the relationship
    // The API endpoint is: DELETE /betaGroups/{id}/relationships/betaTesters
    // with a body containing the tester IDs to remove
    await client.delete(`/betaGroups/${params.betaGroupId}/relationships/betaTesters`, requestBody);

    return {
      success: true,
      data: {
        removed: true,
        betaGroupId: params.betaGroupId,
        betaTesterId: params.betaTesterId,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for beta testing
 */
export const betaToolDefinitions = [
  {
    name: "list_beta_groups",
    description:
      "List all beta groups for an app. Returns group names, public link info, and settings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of groups to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "list_beta_testers",
    description: "List all beta testers in a specific beta group.",
    inputSchema: {
      type: "object" as const,
      properties: {
        betaGroupId: {
          type: "string",
          description: "The beta group ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of testers to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["betaGroupId"],
    },
  },
  {
    name: "add_beta_tester",
    description: "Add a new beta tester to a beta group by email address.",
    inputSchema: {
      type: "object" as const,
      properties: {
        betaGroupId: {
          type: "string",
          description: "The beta group ID to add the tester to",
        },
        email: {
          type: "string",
          description: "Email address of the beta tester",
        },
        firstName: {
          type: "string",
          description: "First name of the beta tester (optional)",
        },
        lastName: {
          type: "string",
          description: "Last name of the beta tester (optional)",
        },
      },
      required: ["betaGroupId", "email"],
    },
  },
  {
    name: "remove_beta_tester",
    description: "Remove a beta tester from a beta group.",
    inputSchema: {
      type: "object" as const,
      properties: {
        betaGroupId: {
          type: "string",
          description: "The beta group ID to remove the tester from",
        },
        betaTesterId: {
          type: "string",
          description: "The beta tester ID to remove",
        },
      },
      required: ["betaGroupId", "betaTesterId"],
    },
  },
];
