/**
 * Tests for user tool handlers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import { getUser, listUsers } from "../src/tools/users.tools.js";

// Create mock client
const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

describe("User Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("listUsers", () => {
    it("should return formatted user list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "USER123",
            type: "users",
            attributes: {
              username: "john.doe@example.com",
              firstName: "John",
              lastName: "Doe",
              email: "john.doe@example.com",
              roles: ["ADMIN", "DEVELOPER"],
              allAppsVisible: true,
              provisioningAllowed: true,
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listUsers(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "USER123",
            username: "john.doe@example.com",
            firstName: "John",
            lastName: "Doe",
            roles: ["ADMIN", "DEVELOPER"],
            allAppsVisible: true,
            provisioningAllowed: true,
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should pass role filter parameters", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listUsers(mockClient as unknown as AppStoreConnectClient, {
        limit: 25,
        roles: ["ADMIN", "DEVELOPER"],
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/users",
        expect.objectContaining({
          limit: 25,
          "filter[roles]": "ADMIN,DEVELOPER",
        })
      );
    });

    it("should handle validation errors for invalid limit", async () => {
      const result = await listUsers(mockClient as unknown as AppStoreConnectClient, {
        limit: 999,
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("getUser", () => {
    it("should return formatted user details", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "USER456",
          type: "users",
          attributes: {
            username: "jane.smith@example.com",
            firstName: "Jane",
            lastName: "Smith",
            email: "jane.smith@example.com",
            roles: ["DEVELOPER"],
            allAppsVisible: false,
            provisioningAllowed: false,
          },
        },
      });

      const result = await getUser(mockClient as unknown as AppStoreConnectClient, {
        userId: "USER456",
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "USER456",
          username: "jane.smith@example.com",
          firstName: "Jane",
          lastName: "Smith",
          roles: ["DEVELOPER"],
          allAppsVisible: false,
          provisioningAllowed: false,
        },
      });
    });

    it("should require userId parameter", async () => {
      const result = await getUser(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });
});
