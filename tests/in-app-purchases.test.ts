/**
 * Tests for in-app purchase tool handlers (In-App Purchases v2 API)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createInAppPurchase,
  createInAppPurchaseLocalization,
  deleteInAppPurchase,
  deleteInAppPurchaseLocalization,
  getInAppPurchase,
  getInAppPurchaseAvailability,
  listInAppPurchaseLocalizations,
  listInAppPurchasePricePoints,
  listInAppPurchases,
  setInAppPurchaseAvailability,
  setInAppPurchasePrice,
  submitInAppPurchaseForReview,
  updateInAppPurchase,
  updateInAppPurchaseLocalization,
} from "../src/tools/in-app-purchases.tools.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

const asClient = (c: ReturnType<typeof createMockClient>) => c as unknown as AppStoreConnectClient;

describe("In-App Purchase Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  // ==========================================================================
  // listInAppPurchases
  // ==========================================================================

  describe("listInAppPurchases", () => {
    it("should return formatted in-app purchases", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "iap1",
            type: "inAppPurchases",
            attributes: {
              name: "Lifetime",
              productId: "com.app.lifetime",
              inAppPurchaseType: "NON_CONSUMABLE",
              state: "READY_TO_SUBMIT",
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listInAppPurchases(asClient(mockClient), { appId: "123456" });

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "iap1",
            name: "Lifetime",
            productId: "com.app.lifetime",
            inAppPurchaseType: "NON_CONSUMABLE",
            state: "READY_TO_SUBMIT",
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should call the v1 app relationship endpoint with type filter", async () => {
      mockClient.get.mockResolvedValueOnce({ data: [], meta: { paging: { total: 0 } } });

      await listInAppPurchases(asClient(mockClient), {
        appId: "999",
        inAppPurchaseType: "NON_CONSUMABLE",
        limit: 10,
      });

      expect(mockClient.get).toHaveBeenCalledWith("/apps/999/inAppPurchasesV2", {
        limit: 10,
        "filter[inAppPurchaseType]": "NON_CONSUMABLE",
      });
    });

    it("should require appId", async () => {
      const result = await listInAppPurchases(asClient(mockClient), {});
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });

    it("should reject an invalid inAppPurchaseType", async () => {
      const result = await listInAppPurchases(asClient(mockClient), {
        appId: "123",
        inAppPurchaseType: "AUTO_RENEWABLE",
      });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ==========================================================================
  // getInAppPurchase
  // ==========================================================================

  describe("getInAppPurchase", () => {
    it("should return in-app purchase details from the v2 endpoint", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "iap1",
          type: "inAppPurchases",
          attributes: {
            name: "Lifetime",
            productId: "com.app.lifetime",
            inAppPurchaseType: "NON_CONSUMABLE",
            state: "APPROVED",
            familySharable: true,
            reviewNote: "note",
          },
        },
      });

      const result = await getInAppPurchase(asClient(mockClient), { inAppPurchaseId: "iap1" });

      expect(mockClient.get).toHaveBeenCalledWith("/v2/inAppPurchases/iap1");
      expect(result).toEqual({
        success: true,
        data: {
          id: "iap1",
          name: "Lifetime",
          productId: "com.app.lifetime",
          inAppPurchaseType: "NON_CONSUMABLE",
          state: "APPROVED",
          familySharable: true,
          reviewNote: "note",
        },
      });
    });

    it("should require inAppPurchaseId", async () => {
      const result = await getInAppPurchase(asClient(mockClient), {});
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ==========================================================================
  // createInAppPurchase
  // ==========================================================================

  describe("createInAppPurchase", () => {
    it("should POST to /v2/inAppPurchases with the app relationship and default to NON_CONSUMABLE", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "iap1",
          type: "inAppPurchases",
          attributes: {
            name: "Lifetime",
            productId: "com.app.lifetime",
            inAppPurchaseType: "NON_CONSUMABLE",
            state: "MISSING_METADATA",
          },
        },
      });

      const result = await createInAppPurchase(asClient(mockClient), {
        appId: "123456",
        name: "Lifetime",
        productId: "com.app.lifetime",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/v2/inAppPurchases", {
        data: {
          type: "inAppPurchases",
          attributes: {
            name: "Lifetime",
            productId: "com.app.lifetime",
            inAppPurchaseType: "NON_CONSUMABLE",
            familySharable: undefined,
            reviewNote: undefined,
          },
          relationships: {
            app: { data: { type: "apps", id: "123456" } },
          },
        },
      });
      expect(result).toEqual({
        success: true,
        data: {
          id: "iap1",
          name: "Lifetime",
          productId: "com.app.lifetime",
          inAppPurchaseType: "NON_CONSUMABLE",
          state: "MISSING_METADATA",
        },
      });
    });

    it("should pass through an explicit type and optional attributes", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { id: "iap2", type: "inAppPurchases", attributes: {} },
      });

      await createInAppPurchase(asClient(mockClient), {
        appId: "123456",
        name: "Coins",
        productId: "com.app.coins",
        inAppPurchaseType: "CONSUMABLE",
        familySharable: false,
        reviewNote: "consumable coins",
      });

      const body = mockClient.post.mock.calls[0][1] as {
        data: { attributes: Record<string, unknown> };
      };
      expect(body.data.attributes.inAppPurchaseType).toBe("CONSUMABLE");
      expect(body.data.attributes.familySharable).toBe(false);
      expect(body.data.attributes.reviewNote).toBe("consumable coins");
    });

    it("should require appId, name, and productId", async () => {
      const result = await createInAppPurchase(asClient(mockClient), {
        name: "Lifetime",
        productId: "com.app.lifetime",
      });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ==========================================================================
  // updateInAppPurchase
  // ==========================================================================

  describe("updateInAppPurchase", () => {
    it("should PATCH the v2 endpoint with writable attributes only", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "iap1",
          type: "inAppPurchases",
          attributes: { name: "New Name", familySharable: true, state: "READY_TO_SUBMIT" },
        },
      });

      const result = await updateInAppPurchase(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        name: "New Name",
        familySharable: true,
      });

      expect(mockClient.patch).toHaveBeenCalledWith("/v2/inAppPurchases/iap1", {
        data: {
          type: "inAppPurchases",
          id: "iap1",
          attributes: { name: "New Name", familySharable: true, reviewNote: undefined },
        },
      });
      expect(result).toEqual({
        success: true,
        data: { id: "iap1", name: "New Name", familySharable: true, state: "READY_TO_SUBMIT" },
      });
    });

    it("should require inAppPurchaseId", async () => {
      const result = await updateInAppPurchase(asClient(mockClient), { name: "x" });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ==========================================================================
  // deleteInAppPurchase
  // ==========================================================================

  describe("deleteInAppPurchase", () => {
    it("should DELETE the v2 endpoint", async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await deleteInAppPurchase(asClient(mockClient), { inAppPurchaseId: "iap1" });

      expect(mockClient.delete).toHaveBeenCalledWith("/v2/inAppPurchases/iap1");
      expect(result).toEqual({ success: true });
    });

    it("should require inAppPurchaseId", async () => {
      const result = await deleteInAppPurchase(asClient(mockClient), {});
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ==========================================================================
  // listInAppPurchaseLocalizations
  // ==========================================================================

  describe("listInAppPurchaseLocalizations", () => {
    it("should list localizations from the v2 sub-resource endpoint", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "loc1",
            type: "inAppPurchaseLocalizations",
            attributes: {
              name: "Lifetime",
              locale: "en-US",
              description: "Unlock forever",
              state: "APPROVED",
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listInAppPurchaseLocalizations(asClient(mockClient), {
        inAppPurchaseId: "iap1",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/v2/inAppPurchases/iap1/inAppPurchaseLocalizations",
        { limit: undefined }
      );
      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "loc1",
            name: "Lifetime",
            locale: "en-US",
            description: "Unlock forever",
            state: "APPROVED",
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });
  });

  // ==========================================================================
  // createInAppPurchaseLocalization
  // ==========================================================================

  describe("createInAppPurchaseLocalization", () => {
    it("should POST with the inAppPurchaseV2 relationship", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "loc1",
          type: "inAppPurchaseLocalizations",
          attributes: {
            name: "Lifetime",
            locale: "en-US",
            description: "Unlock forever",
            state: "PREPARE_FOR_SUBMISSION",
          },
        },
      });

      const result = await createInAppPurchaseLocalization(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        locale: "en-US",
        name: "Lifetime",
        description: "Unlock forever",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/inAppPurchaseLocalizations", {
        data: {
          type: "inAppPurchaseLocalizations",
          attributes: { name: "Lifetime", locale: "en-US", description: "Unlock forever" },
          relationships: {
            inAppPurchaseV2: { data: { type: "inAppPurchases", id: "iap1" } },
          },
        },
      });
      expect(result).toEqual({
        success: true,
        data: {
          id: "loc1",
          name: "Lifetime",
          locale: "en-US",
          description: "Unlock forever",
          state: "PREPARE_FOR_SUBMISSION",
        },
      });
    });

    it("should require inAppPurchaseId, locale, and name", async () => {
      const result = await createInAppPurchaseLocalization(asClient(mockClient), {
        inAppPurchaseId: "iap1",
      });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ==========================================================================
  // updateInAppPurchaseLocalization
  // ==========================================================================

  describe("updateInAppPurchaseLocalization", () => {
    it("should PATCH the localization endpoint", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "loc1",
          type: "inAppPurchaseLocalizations",
          attributes: {
            name: "Updated",
            locale: "en-US",
            description: "New",
            state: "PREPARE_FOR_SUBMISSION",
          },
        },
      });

      await updateInAppPurchaseLocalization(asClient(mockClient), {
        localizationId: "loc1",
        name: "Updated",
        description: "New",
      });

      expect(mockClient.patch).toHaveBeenCalledWith("/inAppPurchaseLocalizations/loc1", {
        data: {
          type: "inAppPurchaseLocalizations",
          id: "loc1",
          attributes: { name: "Updated", description: "New" },
        },
      });
    });

    it("should require localizationId", async () => {
      const result = await updateInAppPurchaseLocalization(asClient(mockClient), { name: "x" });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ==========================================================================
  // deleteInAppPurchaseLocalization
  // ==========================================================================

  describe("deleteInAppPurchaseLocalization", () => {
    it("should DELETE the localization endpoint", async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await deleteInAppPurchaseLocalization(asClient(mockClient), {
        localizationId: "loc1",
      });

      expect(mockClient.delete).toHaveBeenCalledWith("/inAppPurchaseLocalizations/loc1");
      expect(result).toEqual({ success: true });
    });
  });

  // ==========================================================================
  // listInAppPurchasePricePoints
  // ==========================================================================

  describe("listInAppPurchasePricePoints", () => {
    it("should return formatted price points from the v2 endpoint", async () => {
      mockClient.paginate.mockImplementationOnce(async function* () {
        yield {
          id: "pp1",
          type: "inAppPurchasePricePoints",
          attributes: { customerPrice: "9.99", proceeds: "6.99" },
        };
        yield {
          id: "pp2",
          type: "inAppPurchasePricePoints",
          attributes: { customerPrice: "19.99", proceeds: "13.99" },
        };
      });

      const result = await listInAppPurchasePricePoints(asClient(mockClient), {
        inAppPurchaseId: "iap1",
      });

      expect(result).toEqual({
        success: true,
        data: [
          { id: "pp1", customerPrice: "9.99", proceeds: "6.99" },
          { id: "pp2", customerPrice: "19.99", proceeds: "13.99" },
        ],
        meta: { total: undefined, returned: 2 },
      });
    });

    it("should pass the territory filter and v2 path", async () => {
      mockClient.paginate.mockImplementationOnce(async function* () {});

      await listInAppPurchasePricePoints(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        territory: "USA",
      });

      expect(mockClient.paginate).toHaveBeenCalledWith(
        "/v2/inAppPurchases/iap1/pricePoints",
        expect.objectContaining({ "filter[territory]": "USA" }),
        200
      );
    });

    it("should apply offset to the pagination cap and skip leading results", async () => {
      mockClient.paginate.mockImplementationOnce(async function* () {
        yield {
          id: "pp1",
          type: "inAppPurchasePricePoints",
          attributes: { customerPrice: "9.99", proceeds: "6.99" },
        };
        yield {
          id: "pp2",
          type: "inAppPurchasePricePoints",
          attributes: { customerPrice: "19.99", proceeds: "13.99" },
        };
      });

      const result = await listInAppPurchasePricePoints(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        limit: 1,
        offset: 1,
      });

      expect(mockClient.paginate).toHaveBeenCalledWith(
        "/v2/inAppPurchases/iap1/pricePoints",
        expect.objectContaining({ limit: 1 }),
        2
      );
      expect(result).toEqual({
        success: true,
        data: [{ id: "pp2", customerPrice: "19.99", proceeds: "13.99" }],
        meta: { total: undefined, returned: 1 },
      });
    });

    it("should reject invalid territory format", async () => {
      const result = await listInAppPurchasePricePoints(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        territory: "us",
      });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ==========================================================================
  // setInAppPurchasePrice
  // ==========================================================================

  describe("setInAppPurchasePrice", () => {
    it("should POST a price schedule with the inAppPurchase relationship and included prices", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { id: "sched1", type: "inAppPurchasePriceSchedules" },
      });

      const result = await setInAppPurchasePrice(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        baseTerritory: "USA",
        manualPrices: [
          { territory: "USA", pricePointId: "ppUSA" },
          { territory: "IND", pricePointId: "ppIND" },
        ],
      });

      expect(mockClient.post).toHaveBeenCalledWith("/inAppPurchasePriceSchedules", {
        data: {
          type: "inAppPurchasePriceSchedules",
          relationships: {
            inAppPurchase: { data: { type: "inAppPurchases", id: "iap1" } },
            baseTerritory: { data: { type: "territories", id: "USA" } },
            manualPrices: {
              data: [
                { type: "inAppPurchasePrices", id: "${USA-price}" },
                { type: "inAppPurchasePrices", id: "${IND-price}" },
              ],
            },
          },
        },
        included: [
          {
            type: "inAppPurchasePrices",
            id: "${USA-price}",
            attributes: { startDate: null },
            relationships: {
              inAppPurchasePricePoint: {
                data: { type: "inAppPurchasePricePoints", id: "ppUSA" },
              },
            },
          },
          {
            type: "inAppPurchasePrices",
            id: "${IND-price}",
            attributes: { startDate: null },
            relationships: {
              inAppPurchasePricePoint: {
                data: { type: "inAppPurchasePricePoints", id: "ppIND" },
              },
            },
          },
        ],
      });
      expect(result).toEqual({
        success: true,
        data: {
          id: "sched1",
          inAppPurchaseId: "iap1",
          baseTerritory: "USA",
          manualPricesCount: 2,
        },
      });
    });

    it("should require at least one manual price", async () => {
      const result = await setInAppPurchasePrice(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        baseTerritory: "USA",
        manualPrices: [],
      });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });

    it("should reject manualPrices that omit the baseTerritory", async () => {
      const result = await setInAppPurchasePrice(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        baseTerritory: "USA",
        manualPrices: [{ territory: "GBR", pricePointId: "ppGBR" }],
      });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
      expect(mockClient.post).not.toHaveBeenCalled();
    });

    it("should reject duplicate territories in manualPrices", async () => {
      const result = await setInAppPurchasePrice(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        baseTerritory: "USA",
        manualPrices: [
          { territory: "USA", pricePointId: "ppUSA" },
          { territory: "USA", pricePointId: "ppUSA2" },
        ],
      });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
      expect(mockClient.post).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getInAppPurchaseAvailability
  // ==========================================================================

  describe("getInAppPurchaseAvailability", () => {
    it("should GET the corrected inAppPurchaseAvailability sub-resource path", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "avail1",
          type: "inAppPurchaseAvailabilities",
          attributes: { availableInNewTerritories: true },
        },
        included: [
          { id: "USA", type: "territories", attributes: { currency: "USD" } },
          { id: "GBR", type: "territories", attributes: { currency: "GBP" } },
        ],
      });

      const result = await getInAppPurchaseAvailability(asClient(mockClient), {
        inAppPurchaseId: "iap1",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/v2/inAppPurchases/iap1/inAppPurchaseAvailability",
        { include: "availableTerritories", "fields[territories]": "currency" }
      );
      expect(result).toEqual({
        success: true,
        data: {
          id: "avail1",
          inAppPurchaseId: "iap1",
          availableInNewTerritories: true,
          availableTerritories: [
            { id: "USA", currency: "USD" },
            { id: "GBR", currency: "GBP" },
          ],
        },
      });
    });
  });

  // ==========================================================================
  // setInAppPurchaseAvailability
  // ==========================================================================

  describe("setInAppPurchaseAvailability", () => {
    it("should POST availability with the inAppPurchase relationship and territories", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "avail1",
          type: "inAppPurchaseAvailabilities",
          attributes: { availableInNewTerritories: false },
        },
      });

      const result = await setInAppPurchaseAvailability(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        availableInNewTerritories: false,
        territories: ["USA", "GBR"],
      });

      expect(mockClient.post).toHaveBeenCalledWith("/inAppPurchaseAvailabilities", {
        data: {
          type: "inAppPurchaseAvailabilities",
          attributes: { availableInNewTerritories: false },
          relationships: {
            inAppPurchase: { data: { type: "inAppPurchases", id: "iap1" } },
            availableTerritories: {
              data: [
                { type: "territories", id: "USA" },
                { type: "territories", id: "GBR" },
              ],
            },
          },
        },
      });
      expect(result).toEqual({
        success: true,
        data: {
          id: "avail1",
          inAppPurchaseId: "iap1",
          availableInNewTerritories: false,
          territoriesCount: 2,
        },
      });
    });

    it("should omit availableTerritories when none provided", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "avail1",
          type: "inAppPurchaseAvailabilities",
          attributes: { availableInNewTerritories: true },
        },
      });

      await setInAppPurchaseAvailability(asClient(mockClient), {
        inAppPurchaseId: "iap1",
        availableInNewTerritories: true,
      });

      const body = mockClient.post.mock.calls[0][1] as {
        data: { relationships: Record<string, unknown> };
      };
      expect(body.data.relationships).not.toHaveProperty("availableTerritories");
    });

    it("should require availableInNewTerritories", async () => {
      const result = await setInAppPurchaseAvailability(asClient(mockClient), {
        inAppPurchaseId: "iap1",
      });
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ==========================================================================
  // submitInAppPurchaseForReview
  // ==========================================================================

  describe("submitInAppPurchaseForReview", () => {
    it("should POST a submission with the inAppPurchaseV2 relationship", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: { id: "sub1", type: "inAppPurchaseSubmissions" },
      });

      const result = await submitInAppPurchaseForReview(asClient(mockClient), {
        inAppPurchaseId: "iap1",
      });

      expect(mockClient.post).toHaveBeenCalledWith("/inAppPurchaseSubmissions", {
        data: {
          type: "inAppPurchaseSubmissions",
          relationships: {
            inAppPurchaseV2: { data: { type: "inAppPurchases", id: "iap1" } },
          },
        },
      });
      expect(result).toEqual({
        success: true,
        data: { id: "sub1", inAppPurchaseId: "iap1" },
      });
    });

    it("should require inAppPurchaseId", async () => {
      const result = await submitInAppPurchaseForReview(asClient(mockClient), {});
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });
});
