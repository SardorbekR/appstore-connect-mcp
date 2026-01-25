/**
 * Tests for beta tool handlers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  addBetaTester,
  listBetaGroups,
  listBetaTesters,
  removeBetaTester,
} from "../src/tools/beta.tools.js";

// Create mock client
const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

describe("Beta Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("listBetaGroups", () => {
    it("should return formatted beta group list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "GROUP123",
            type: "betaGroups",
            attributes: {
              name: "Internal Testers",
              createdDate: "2024-01-01T00:00:00Z",
              isInternalGroup: true,
              hasAccessToAllBuilds: true,
              publicLinkEnabled: false,
              publicLink: null,
              feedbackEnabled: true,
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listBetaGroups(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
      });

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "GROUP123",
            name: "Internal Testers",
            createdDate: "2024-01-01T00:00:00Z",
            isInternalGroup: true,
            hasAccessToAllBuilds: true,
            publicLinkEnabled: false,
            publicLink: null,
            feedbackEnabled: true,
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should require appId parameter", async () => {
      const result = await listBetaGroups(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("listBetaTesters", () => {
    it("should return formatted tester list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "TESTER123",
            type: "betaTesters",
            attributes: {
              firstName: "John",
              lastName: "Doe",
              email: "john@example.com",
              inviteType: "EMAIL",
              state: "ACCEPTED",
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listBetaTesters(mockClient as unknown as AppStoreConnectClient, {
        betaGroupId: "GROUP123",
      });

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "TESTER123",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            inviteType: "EMAIL",
            state: "ACCEPTED",
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should require betaGroupId parameter", async () => {
      const result = await listBetaTesters(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("addBetaTester", () => {
    it("should create beta tester with correct request body", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "NEWTESTER",
          type: "betaTesters",
          attributes: {
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
            inviteType: "EMAIL",
            state: "INVITED",
          },
        },
      });

      const result = await addBetaTester(mockClient as unknown as AppStoreConnectClient, {
        betaGroupId: "GROUP123",
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Smith",
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        "/betaTesters",
        expect.objectContaining({
          data: {
            type: "betaTesters",
            attributes: {
              email: "jane@example.com",
              firstName: "Jane",
              lastName: "Smith",
            },
            relationships: {
              betaGroups: {
                data: [{ type: "betaGroups", id: "GROUP123" }],
              },
            },
          },
        })
      );

      expect(result).toEqual({
        success: true,
        data: {
          id: "NEWTESTER",
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
          inviteType: "EMAIL",
          state: "INVITED",
        },
      });
    });

    it("should validate email format", async () => {
      const result = await addBetaTester(mockClient as unknown as AppStoreConnectClient, {
        betaGroupId: "GROUP123",
        email: "invalid-email",
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("removeBetaTester", () => {
    it("should remove beta tester and return success", async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await removeBetaTester(mockClient as unknown as AppStoreConnectClient, {
        betaGroupId: "GROUP123",
        betaTesterId: "TESTER456",
      });

      expect(mockClient.delete).toHaveBeenCalledWith(
        "/betaGroups/GROUP123/relationships/betaTesters",
        expect.objectContaining({
          data: [{ type: "betaTesters", id: "TESTER456" }],
        })
      );

      expect(result).toEqual({
        success: true,
        data: {
          removed: true,
          betaGroupId: "GROUP123",
          betaTesterId: "TESTER456",
        },
      });
    });

    it("should require betaGroupId parameter", async () => {
      const result = await removeBetaTester(mockClient as unknown as AppStoreConnectClient, {
        betaTesterId: "TESTER456",
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should require betaTesterId parameter", async () => {
      const result = await removeBetaTester(mockClient as unknown as AppStoreConnectClient, {
        betaGroupId: "GROUP123",
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });
});
