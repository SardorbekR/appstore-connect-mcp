/**
 * Tests for pricing tool handlers (PPP support)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  getPricePointEqualizations,
  listAppPricePoints,
  listTerritories,
  setAppPrices,
} from "../src/tools/pricing.tools.js";

// Create mock client
const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

describe("Pricing Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("listTerritories", () => {
    it("should return formatted territory list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "USA",
            type: "territories",
            attributes: { currency: "USD" },
          },
          {
            id: "GBR",
            type: "territories",
            attributes: { currency: "GBP" },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listTerritories(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: true,
        data: [
          { id: "USA", currency: "USD" },
          { id: "GBR", currency: "GBP" },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should pass limit parameter", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listTerritories(mockClient as unknown as AppStoreConnectClient, {
        limit: 50,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/territories",
        expect.objectContaining({ limit: 50 })
      );
    });
  });

  describe("listAppPricePoints", () => {
    it("should return formatted price points with territory info", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "PP_USA_099",
            type: "appPricePoints",
            attributes: { customerPrice: "0.99", proceeds: "0.69" },
            relationships: {
              territory: { data: { type: "territories", id: "USA" } },
            },
          },
        ],
        included: [
          {
            id: "USA",
            type: "territories",
            attributes: { currency: "USD" },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listAppPricePoints(
        mockClient as unknown as AppStoreConnectClient,
        { appId: "123456" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "PP_USA_099",
            customerPrice: "0.99",
            proceeds: "0.69",
            territory: { id: "USA", currency: "USD" },
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should pass territory filter", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listAppPricePoints(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
        territory: "USA",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/apps/123456/appPricePoints",
        expect.objectContaining({
          "filter[territory]": "USA",
        })
      );
    });

    it("should require appId parameter", async () => {
      const result = await listAppPricePoints(
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

    it("should handle price point without territory in included", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "PP_JPN_099",
            type: "appPricePoints",
            attributes: { customerPrice: "120", proceeds: "84" },
            relationships: {
              territory: { data: { type: "territories", id: "JPN" } },
            },
          },
        ],
        included: [],
        meta: { paging: { total: 1 } },
      });

      const result = await listAppPricePoints(
        mockClient as unknown as AppStoreConnectClient,
        { appId: "123456" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "PP_JPN_099",
            customerPrice: "120",
            proceeds: "84",
            territory: { id: "JPN" },
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });
  });

  describe("getPricePointEqualizations", () => {
    it("should return formatted equalizations with territory info", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "PP_IND_079",
            type: "appPricePoints",
            attributes: { customerPrice: "79", proceeds: "55" },
            relationships: {
              territory: { data: { type: "territories", id: "IND" } },
            },
          },
          {
            id: "PP_BRA_349",
            type: "appPricePoints",
            attributes: { customerPrice: "3.49", proceeds: "2.44" },
            relationships: {
              territory: { data: { type: "territories", id: "BRA" } },
            },
          },
        ],
        included: [
          {
            id: "IND",
            type: "territories",
            attributes: { currency: "INR" },
          },
          {
            id: "BRA",
            type: "territories",
            attributes: { currency: "BRL" },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await getPricePointEqualizations(
        mockClient as unknown as AppStoreConnectClient,
        { pricePointId: "PP_USA_099" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "PP_IND_079",
            customerPrice: "79",
            proceeds: "55",
            territory: { id: "IND", currency: "INR" },
          },
          {
            id: "PP_BRA_349",
            customerPrice: "3.49",
            proceeds: "2.44",
            territory: { id: "BRA", currency: "BRL" },
          },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should pass territories filter as comma-joined string", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await getPricePointEqualizations(mockClient as unknown as AppStoreConnectClient, {
        pricePointId: "PP_USA_099",
        territories: ["IND", "BRA", "TUR"],
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/v3/appPricePoints/PP_USA_099/equalizations",
        expect.objectContaining({
          "filter[territory]": "IND,BRA,TUR",
        })
      );
    });

    it("should use v3 endpoint path", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await getPricePointEqualizations(mockClient as unknown as AppStoreConnectClient, {
        pricePointId: "PP_USA_099",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/v3/appPricePoints/PP_USA_099/equalizations",
        expect.any(Object)
      );
    });

    it("should require pricePointId parameter", async () => {
      const result = await getPricePointEqualizations(
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

  describe("setAppPrices", () => {
    it("should create price schedule with correct request body", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "SCHEDULE123",
          type: "appPriceSchedules",
        },
      });

      const result = await setAppPrices(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
        baseTerritory: "USA",
        manualPrices: [
          { territory: "USA", pricePointId: "PP_USA_099" },
          { territory: "GBR", pricePointId: "PP_GBR_079" },
        ],
      });

      expect(mockClient.post).toHaveBeenCalledWith("/appPriceSchedules", {
        data: {
          type: "appPriceSchedules",
          relationships: {
            app: { data: { type: "apps", id: "123456" } },
            baseTerritory: { data: { type: "territories", id: "USA" } },
            manualPrices: {
              data: [
                { type: "appPrices", id: "${USA-price}" },
                { type: "appPrices", id: "${GBR-price}" },
              ],
            },
          },
        },
        included: [
          {
            type: "appPrices",
            id: "${USA-price}",
            attributes: { startDate: null },
            relationships: {
              appPricePoint: { data: { type: "appPricePoints", id: "PP_USA_099" } },
            },
          },
          {
            type: "appPrices",
            id: "${GBR-price}",
            attributes: { startDate: null },
            relationships: {
              appPricePoint: { data: { type: "appPricePoints", id: "PP_GBR_079" } },
            },
          },
        ],
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "SCHEDULE123",
          appId: "123456",
          baseTerritory: "USA",
          manualPricesCount: 2,
        },
      });
    });

    it("should require appId parameter", async () => {
      const result = await setAppPrices(mockClient as unknown as AppStoreConnectClient, {
        baseTerritory: "USA",
        manualPrices: [{ territory: "USA", pricePointId: "PP1" }],
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should require manualPrices parameter", async () => {
      const result = await setAppPrices(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
        baseTerritory: "USA",
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should validate territory format", async () => {
      const result = await setAppPrices(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
        baseTerritory: "usa",
        manualPrices: [{ territory: "usa", pricePointId: "PP1" }],
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
