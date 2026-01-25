/**
 * Tests for tool handlers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import { getApp, listApps } from "../src/tools/apps.tools.js";
import {
  createVersionLocalization,
  deleteVersionLocalization,
  listVersionLocalizations,
  updateVersionLocalization,
} from "../src/tools/localizations.tools.js";

// Create mock client
const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

describe("Apps Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("listApps", () => {
    it("should return formatted app list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "123",
            type: "apps",
            attributes: {
              name: "Test App",
              bundleId: "com.example.app",
              sku: "APP001",
              primaryLocale: "en-US",
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listApps(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "123",
            name: "Test App",
            bundleId: "com.example.app",
            sku: "APP001",
            primaryLocale: "en-US",
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should pass limit parameter", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listApps(mockClient as unknown as AppStoreConnectClient, { limit: 25 });

      expect(mockClient.get).toHaveBeenCalledWith("/apps", expect.objectContaining({ limit: 25 }));
    });

    it("should handle validation errors", async () => {
      const result = await listApps(mockClient as unknown as AppStoreConnectClient, { limit: 999 });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("getApp", () => {
    it("should return formatted app details", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "123",
          type: "apps",
          attributes: {
            name: "Test App",
            bundleId: "com.example.app",
            sku: "APP001",
            primaryLocale: "en-US",
            contentRightsDeclaration: "DOES_NOT_USE_THIRD_PARTY_CONTENT",
            isOrEverWasMadeForKids: false,
          },
        },
      });

      const result = await getApp(mockClient as unknown as AppStoreConnectClient, { appId: "123" });

      expect(result).toEqual({
        success: true,
        data: {
          id: "123",
          name: "Test App",
          bundleId: "com.example.app",
          sku: "APP001",
          primaryLocale: "en-US",
          contentRightsDeclaration: "DOES_NOT_USE_THIRD_PARTY_CONTENT",
          isOrEverWasMadeForKids: false,
        },
      });
    });

    it("should require appId parameter", async () => {
      const result = await getApp(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });
});

describe("Localizations Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("listVersionLocalizations", () => {
    it("should return formatted localization list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "loc1",
            type: "appStoreVersionLocalizations",
            attributes: {
              locale: "en-US",
              description: "English description",
              keywords: "app,test",
              whatsNew: "Bug fixes",
            },
          },
          {
            id: "loc2",
            type: "appStoreVersionLocalizations",
            attributes: {
              locale: "ja",
              description: "Japanese description",
              keywords: "アプリ",
              whatsNew: "バグ修正",
            },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listVersionLocalizations(
        mockClient as unknown as AppStoreConnectClient,
        { versionId: "123" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "loc1",
            locale: "en-US",
            description: "English description",
            keywords: "app,test",
            whatsNew: "Bug fixes",
            marketingUrl: undefined,
            promotionalText: undefined,
            supportUrl: undefined,
          },
          {
            id: "loc2",
            locale: "ja",
            description: "Japanese description",
            keywords: "アプリ",
            whatsNew: "バグ修正",
            marketingUrl: undefined,
            promotionalText: undefined,
            supportUrl: undefined,
          },
        ],
        meta: { total: 2, returned: 2 },
      });
    });
  });

  describe("createVersionLocalization", () => {
    it("should create localization with correct request body", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "newLoc",
          type: "appStoreVersionLocalizations",
          attributes: {
            locale: "fr",
            description: "French description",
          },
        },
      });

      const result = await createVersionLocalization(
        mockClient as unknown as AppStoreConnectClient,
        {
          versionId: "123",
          locale: "fr",
          description: "French description",
        }
      );

      expect(mockClient.post).toHaveBeenCalledWith(
        "/appStoreVersionLocalizations",
        expect.objectContaining({
          data: {
            type: "appStoreVersionLocalizations",
            attributes: {
              locale: "fr",
              description: "French description",
              keywords: undefined,
              marketingUrl: undefined,
              promotionalText: undefined,
              supportUrl: undefined,
              whatsNew: undefined,
            },
            relationships: {
              appStoreVersion: {
                data: {
                  type: "appStoreVersions",
                  id: "123",
                },
              },
            },
          },
        })
      );

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          id: "newLoc",
          locale: "fr",
        }),
      });
    });
  });

  describe("updateVersionLocalization", () => {
    it("should update localization with provided fields", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "123456",
          type: "appStoreVersionLocalizations",
          attributes: {
            locale: "en-US",
            description: "Updated description",
            whatsNew: "New features",
          },
        },
      });

      const result = await updateVersionLocalization(
        mockClient as unknown as AppStoreConnectClient,
        {
          localizationId: "123456",
          description: "Updated description",
          whatsNew: "New features",
        }
      );

      expect(mockClient.patch).toHaveBeenCalledWith(
        "/appStoreVersionLocalizations/123456",
        expect.objectContaining({
          data: {
            type: "appStoreVersionLocalizations",
            id: "123456",
            attributes: expect.objectContaining({
              description: "Updated description",
              whatsNew: "New features",
            }),
          },
        })
      );

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          id: "123456",
          description: "Updated description",
        }),
      });
    });
  });

  describe("deleteVersionLocalization", () => {
    it("should delete localization and return success", async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await deleteVersionLocalization(
        mockClient as unknown as AppStoreConnectClient,
        { localizationId: "123456" }
      );

      expect(mockClient.delete).toHaveBeenCalledWith("/appStoreVersionLocalizations/123456");

      expect(result).toEqual({
        success: true,
        data: {
          deleted: true,
          localizationId: "123456",
        },
      });
    });
  });
});
