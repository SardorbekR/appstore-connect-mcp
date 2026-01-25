/**
 * Tests for category tool handlers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  getAppAvailability,
  getAppPriceSchedule,
  listAppCategories,
} from "../src/tools/categories.tools.js";

// Create mock client
const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

describe("Category Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("listAppCategories", () => {
    it("should return formatted category list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "GAMES",
            type: "appCategories",
            attributes: {
              platforms: ["IOS", "MAC_OS"],
            },
            relationships: {
              subcategories: {
                data: [{ type: "appCategories", id: "GAMES_ACTION" }],
              },
            },
          },
        ],
        included: [
          {
            id: "GAMES_ACTION",
            type: "appCategories",
            attributes: {
              platforms: ["IOS", "MAC_OS"],
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listAppCategories(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "GAMES",
            platforms: ["IOS", "MAC_OS"],
            subcategories: [
              {
                id: "GAMES_ACTION",
                platforms: ["IOS", "MAC_OS"],
              },
            ],
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should pass platform filter", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listAppCategories(mockClient as unknown as AppStoreConnectClient, {
        limit: 50,
        platform: "IOS",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/appCategories",
        expect.objectContaining({
          limit: 50,
          "filter[platforms]": "IOS",
        })
      );
    });
  });

  describe("getAppPriceSchedule", () => {
    it("should return formatted price schedule", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "PRICE123",
          type: "appPriceSchedules",
          relationships: {
            baseTerritory: {
              data: { type: "territories", id: "USA" },
            },
            manualPrices: {
              data: [{ type: "appPrices", id: "PRICE1" }],
            },
            automaticPrices: {
              data: [],
            },
          },
        },
        included: [
          {
            id: "USA",
            type: "territories",
            attributes: {
              currency: "USD",
            },
          },
        ],
      });

      const result = await getAppPriceSchedule(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "PRICE123",
          baseTerritory: {
            id: "USA",
            currency: "USD",
          },
          hasManualPrices: true,
          hasAutomaticPrices: false,
        },
      });
    });

    it("should require appId parameter", async () => {
      const result = await getAppPriceSchedule(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("getAppAvailability", () => {
    it("should return formatted availability data", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "AVAIL123",
          type: "appAvailabilities",
          attributes: {
            availableInNewTerritories: true,
          },
        },
        included: [
          {
            id: "USA",
            type: "territories",
            attributes: {
              currency: "USD",
            },
          },
          {
            id: "GBR",
            type: "territories",
            attributes: {
              currency: "GBP",
            },
          },
        ],
      });

      const result = await getAppAvailability(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "AVAIL123",
          availableInNewTerritories: true,
          territories: [
            { id: "USA", currency: "USD" },
            { id: "GBR", currency: "GBP" },
          ],
          territoryCount: 2,
        },
      });
    });

    it("should require appId parameter", async () => {
      const result = await getAppAvailability(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });
});
