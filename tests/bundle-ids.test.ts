/**
 * Tests for bundle ID tool handlers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createBundleId,
  deleteBundleId,
  getBundleId,
  listBundleIds,
  updateBundleId,
} from "../src/tools/bundle-ids.tools.js";

// Create mock client
const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

describe("Bundle ID Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("listBundleIds", () => {
    it("should return formatted bundle ID list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "ABC123",
            type: "bundleIds",
            attributes: {
              name: "My App",
              identifier: "com.example.myapp",
              platform: "IOS",
              seedId: "ABCD1234",
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listBundleIds(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "ABC123",
            name: "My App",
            identifier: "com.example.myapp",
            platform: "IOS",
            seedId: "ABCD1234",
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should pass filter parameters", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listBundleIds(mockClient as unknown as AppStoreConnectClient, {
        limit: 25,
        platform: "IOS",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/bundleIds",
        expect.objectContaining({
          limit: 25,
          "filter[platform]": "IOS",
        })
      );
    });

    it("should handle validation errors for invalid limit", async () => {
      const result = await listBundleIds(mockClient as unknown as AppStoreConnectClient, {
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

  describe("getBundleId", () => {
    it("should return formatted bundle ID details", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "ABC123",
          type: "bundleIds",
          attributes: {
            name: "My App",
            identifier: "com.example.myapp",
            platform: "IOS",
            seedId: "ABCD1234",
          },
        },
      });

      const result = await getBundleId(mockClient as unknown as AppStoreConnectClient, {
        bundleIdId: "ABC123",
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "ABC123",
          name: "My App",
          identifier: "com.example.myapp",
          platform: "IOS",
          seedId: "ABCD1234",
        },
      });
    });

    it("should require bundleIdId parameter", async () => {
      const result = await getBundleId(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("createBundleId", () => {
    it("should create bundle ID with correct request body", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "NEW123",
          type: "bundleIds",
          attributes: {
            name: "New App",
            identifier: "com.example.newapp",
            platform: "IOS",
          },
        },
      });

      const result = await createBundleId(mockClient as unknown as AppStoreConnectClient, {
        identifier: "com.example.newapp",
        name: "New App",
        platform: "IOS",
      });

      expect(mockClient.post).toHaveBeenCalledWith(
        "/bundleIds",
        expect.objectContaining({
          data: {
            type: "bundleIds",
            attributes: {
              identifier: "com.example.newapp",
              name: "New App",
              platform: "IOS",
            },
          },
        })
      );

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          id: "NEW123",
          identifier: "com.example.newapp",
        }),
      });
    });

    it("should validate bundle identifier format", async () => {
      const result = await createBundleId(mockClient as unknown as AppStoreConnectClient, {
        identifier: "123-invalid",
        name: "Test",
        platform: "IOS",
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("updateBundleId", () => {
    it("should update bundle ID with correct request body", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "ABC123",
          type: "bundleIds",
          attributes: {
            name: "Updated Name",
            identifier: "com.example.myapp",
            platform: "IOS",
          },
        },
      });

      const result = await updateBundleId(mockClient as unknown as AppStoreConnectClient, {
        bundleIdId: "ABC123",
        name: "Updated Name",
      });

      expect(mockClient.patch).toHaveBeenCalledWith(
        "/bundleIds/ABC123",
        expect.objectContaining({
          data: {
            type: "bundleIds",
            id: "ABC123",
            attributes: {
              name: "Updated Name",
            },
          },
        })
      );

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          id: "ABC123",
          name: "Updated Name",
        }),
      });
    });
  });

  describe("deleteBundleId", () => {
    it("should delete bundle ID and return success", async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await deleteBundleId(mockClient as unknown as AppStoreConnectClient, {
        bundleIdId: "ABC123",
      });

      expect(mockClient.delete).toHaveBeenCalledWith("/bundleIds/ABC123");

      expect(result).toEqual({
        success: true,
        data: {
          deleted: true,
          bundleIdId: "ABC123",
        },
      });
    });

    it("should require bundleIdId parameter", async () => {
      const result = await deleteBundleId(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });
});
