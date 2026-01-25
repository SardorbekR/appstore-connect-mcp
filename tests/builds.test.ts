/**
 * Tests for build tool handlers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import { getBuild, listBetaTesterInvitations, listBuilds } from "../src/tools/builds.tools.js";

// Create mock client
const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

describe("Build Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("listBuilds", () => {
    it("should return formatted build list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "BUILD123",
            type: "builds",
            attributes: {
              version: "1.0.42",
              uploadedDate: "2024-01-15T10:00:00Z",
              expirationDate: "2024-04-15T10:00:00Z",
              expired: false,
              minOsVersion: "16.0",
              processingState: "VALID",
              buildAudienceType: "APP_STORE_ELIGIBLE",
              usesNonExemptEncryption: false,
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listBuilds(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
      });

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "BUILD123",
            version: "1.0.42",
            uploadedDate: "2024-01-15T10:00:00Z",
            expirationDate: "2024-04-15T10:00:00Z",
            expired: false,
            minOsVersion: "16.0",
            processingState: "VALID",
            buildAudienceType: "APP_STORE_ELIGIBLE",
            usesNonExemptEncryption: false,
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should require appId parameter", async () => {
      const result = await listBuilds(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should pass limit parameter", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listBuilds(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
        limit: 10,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/apps/123456/builds",
        expect.objectContaining({
          limit: 10,
        })
      );
    });
  });

  describe("getBuild", () => {
    it("should return formatted build details", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "BUILD456",
          type: "builds",
          attributes: {
            version: "2.0.1",
            uploadedDate: "2024-02-01T14:30:00Z",
            expirationDate: "2024-05-01T14:30:00Z",
            expired: false,
            minOsVersion: "17.0",
            processingState: "VALID",
            buildAudienceType: "INTERNAL_ONLY",
            usesNonExemptEncryption: true,
          },
        },
      });

      const result = await getBuild(mockClient as unknown as AppStoreConnectClient, {
        buildId: "BUILD456",
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "BUILD456",
          version: "2.0.1",
          uploadedDate: "2024-02-01T14:30:00Z",
          expirationDate: "2024-05-01T14:30:00Z",
          expired: false,
          minOsVersion: "17.0",
          processingState: "VALID",
          buildAudienceType: "INTERNAL_ONLY",
          usesNonExemptEncryption: true,
        },
      });
    });

    it("should require buildId parameter", async () => {
      const result = await getBuild(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("listBetaTesterInvitations", () => {
    it("should return invitation list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "INV123",
            type: "betaTesterInvitations",
          },
          {
            id: "INV456",
            type: "betaTesterInvitations",
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listBetaTesterInvitations(
        mockClient as unknown as AppStoreConnectClient,
        { betaGroupId: "GROUP123" }
      );

      expect(result).toEqual({
        success: true,
        data: [{ id: "INV123" }, { id: "INV456" }],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should require betaGroupId parameter", async () => {
      const result = await listBetaTesterInvitations(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });
});
