/**
 * User Tools - Manage team users
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type { ASCListResponse, ASCResponse, User } from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import { getUserInputSchema, listUsersInputSchema, validateInput } from "../utils/validation.js";

/**
 * List all users in the team
 */
export async function listUsers(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(listUsersInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      "fields[users]": "username,firstName,lastName,roles,allAppsVisible,provisioningAllowed",
    };

    if (params.roles && params.roles.length > 0) {
      queryParams["filter[roles]"] = params.roles.join(",");
    }

    const response = await client.get<ASCListResponse<User>>("/users", queryParams);

    return {
      success: true,
      data: response.data.map((user) => ({
        id: user.id,
        username: user.attributes.username,
        firstName: user.attributes.firstName,
        lastName: user.attributes.lastName,
        roles: user.attributes.roles,
        allAppsVisible: user.attributes.allAppsVisible,
        provisioningAllowed: user.attributes.provisioningAllowed,
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
 * Get a specific user
 */
export async function getUser(client: AppStoreConnectClient, input: unknown): Promise<unknown> {
  try {
    const params = validateInput(getUserInputSchema, input);

    const response = await client.get<ASCResponse<User>>(`/users/${params.userId}`, {
      "fields[users]": "username,firstName,lastName,roles,allAppsVisible,provisioningAllowed",
    });

    const user = response.data;

    return {
      success: true,
      data: {
        id: user.id,
        username: user.attributes.username,
        firstName: user.attributes.firstName,
        lastName: user.attributes.lastName,
        roles: user.attributes.roles,
        allAppsVisible: user.attributes.allAppsVisible,
        provisioningAllowed: user.attributes.provisioningAllowed,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for users
 */
export const usersToolDefinitions = [
  {
    name: "list_users",
    description: "List all users in your App Store Connect team. Can filter by roles.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of users to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
        roles: {
          type: "array",
          items: {
            type: "string",
            enum: [
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
            ],
          },
          description: "Filter by user roles",
        },
      },
      required: [],
    },
  },
  {
    name: "get_user",
    description: "Get details of a specific team user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "The user resource ID",
        },
      },
      required: ["userId"],
    },
  },
];
