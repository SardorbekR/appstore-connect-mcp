/**
 * Tests for in-app purchase offer code tools (offer codes, one-time and custom codes)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createIapCustomCode,
  createIapOfferCode,
  createIapOneTimeCodes,
  getIapOfferCode,
  getIapOneTimeCodeValues,
  iapOfferCodesToolsModule,
  listIapCustomCodes,
  listIapOfferCodes,
  listIapOneTimeCodeBatches,
  updateIapOfferCode,
} from "../src/tools/iap-offer-codes.tools.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  requestRaw: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const offerCode = {
  type: "inAppPurchaseOfferCodes",
  id: "oc1",
  attributes: {
    name: "Spring",
    customerEligibilities: ["NON_SPENDER"],
    productionCodeCount: 0,
    sandboxCodeCount: 0,
    active: true,
  },
};

const oneTimeBatch = {
  type: "inAppPurchaseOfferCodeOneTimeUseCodes",
  id: "ot1",
  attributes: {
    numberOfCodes: 100,
    expirationDate: "2026-12-31",
    active: true,
    environment: "SANDBOX",
  },
};

const customCode = {
  type: "inAppPurchaseOfferCodeCustomCodes",
  id: "cc1",
  attributes: { customCode: "SPRING-2026", numberOfCodes: 50, active: true },
};

describe("iap offer code tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("list_iap_offer_codes", () => {
    it("lists offer codes through the v2 in-app purchase path", async () => {
      client.get.mockResolvedValueOnce({
        data: [offerCode],
        meta: { paging: { total: 1, limit: 10 } },
      });

      const result = await listIapOfferCodes(asClient(client), {
        inAppPurchaseId: "123",
        limit: 10,
      });

      expect(client.get).toHaveBeenCalledWith("/v2/inAppPurchases/123/offerCodes", { limit: 10 });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "oc1", name: "Spring", active: true }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });
  });

  describe("get_iap_offer_code", () => {
    it("gets one offer code", async () => {
      client.get.mockResolvedValueOnce({ data: offerCode });

      const result = await getIapOfferCode(asClient(client), { offerCodeId: "oc1" });

      expect(client.get).toHaveBeenCalledWith("/inAppPurchaseOfferCodes/oc1");
      expect(result).toMatchObject({ success: true, data: { id: "oc1", productionCodeCount: 0 } });
      expectContract(client);
    });

    it("rejects an ID that could change the request path", async () => {
      const result = await getIapOfferCode(asClient(client), { offerCodeId: "../apps/1" });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.get).not.toHaveBeenCalled();
    });
  });

  describe("create_iap_offer_code", () => {
    it("creates the offer code with its per-territory prices sent inline", async () => {
      client.post.mockResolvedValueOnce({ data: offerCode });

      const result = await createIapOfferCode(asClient(client), {
        inAppPurchaseId: "123",
        name: "Spring",
        customerEligibilities: ["NON_SPENDER"],
        prices: [
          { territoryId: "USA", pricePointId: "pp-usa" },
          { territoryId: "GBR", pricePointId: "pp-gbr" },
        ],
      });

      expect(client.post).toHaveBeenCalledWith("/inAppPurchaseOfferCodes", {
        data: {
          type: "inAppPurchaseOfferCodes",
          attributes: { name: "Spring", customerEligibilities: ["NON_SPENDER"] },
          relationships: {
            inAppPurchase: { data: { type: "inAppPurchases", id: "123" } },
            prices: {
              data: [
                { type: "inAppPurchaseOfferPrices", id: "${price-1}" },
                { type: "inAppPurchaseOfferPrices", id: "${price-2}" },
              ],
            },
          },
        },
        included: [
          {
            type: "inAppPurchaseOfferPrices",
            id: "${price-1}",
            relationships: {
              territory: { data: { type: "territories", id: "USA" } },
              pricePoint: { data: { type: "inAppPurchasePricePoints", id: "pp-usa" } },
            },
          },
          {
            type: "inAppPurchaseOfferPrices",
            id: "${price-2}",
            relationships: {
              territory: { data: { type: "territories", id: "GBR" } },
              pricePoint: { data: { type: "inAppPurchasePricePoints", id: "pp-gbr" } },
            },
          },
        ],
      });
      expect(result).toMatchObject({ success: true, data: { id: "oc1" } });
      expectContract(client);
    });

    it("refuses an offer code with no prices", async () => {
      const result = await createIapOfferCode(asClient(client), {
        inAppPurchaseId: "123",
        name: "Spring",
        customerEligibilities: ["NON_SPENDER"],
        prices: [],
      });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).not.toHaveBeenCalled();
    });
  });

  describe("update_iap_offer_code", () => {
    it("sets only the active flag", async () => {
      client.patch.mockResolvedValueOnce({ data: { ...offerCode, attributes: { active: false } } });

      const result = await updateIapOfferCode(asClient(client), {
        offerCodeId: "oc1",
        active: false,
      });

      expect(client.patch).toHaveBeenCalledWith("/inAppPurchaseOfferCodes/oc1", {
        data: { type: "inAppPurchaseOfferCodes", id: "oc1", attributes: { active: false } },
      });
      expect(result).toMatchObject({ success: true, data: { id: "oc1" } });
      expectContract(client);
    });

    it("refuses an update that does not say whether the code is active", async () => {
      const result = await updateIapOfferCode(asClient(client), { offerCodeId: "oc1" });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("is marked destructive because deactivating stops live redemptions", () => {
      const definition = iapOfferCodesToolsModule.definitions.find(
        (tool) => tool.name === "update_iap_offer_code"
      );
      expect(definition?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    });
  });

  describe("create_iap_one_time_codes", () => {
    it("generates a batch of one-time codes for the offer code", async () => {
      client.post.mockResolvedValueOnce({ data: oneTimeBatch });

      const result = await createIapOneTimeCodes(asClient(client), {
        offerCodeId: "oc1",
        numberOfCodes: 100,
        expirationDate: "2026-12-31",
        environment: "SANDBOX",
      });

      expect(client.post).toHaveBeenCalledWith("/inAppPurchaseOfferCodeOneTimeUseCodes", {
        data: {
          type: "inAppPurchaseOfferCodeOneTimeUseCodes",
          attributes: { numberOfCodes: 100, expirationDate: "2026-12-31", environment: "SANDBOX" },
          relationships: {
            offerCode: { data: { type: "inAppPurchaseOfferCodes", id: "oc1" } },
          },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "ot1", numberOfCodes: 100 } });
      expectContract(client);
    });

    it("refuses an expiration date that is not YYYY-MM-DD", async () => {
      const result = await createIapOneTimeCodes(asClient(client), {
        offerCodeId: "oc1",
        numberOfCodes: 100,
        expirationDate: "12/31/2026",
      });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).not.toHaveBeenCalled();
    });
  });

  describe("list_iap_one_time_code_batches", () => {
    it("lists the batches of an offer code", async () => {
      client.get.mockResolvedValueOnce({ data: [oneTimeBatch] });

      const result = await listIapOneTimeCodeBatches(asClient(client), {
        offerCodeId: "oc1",
        limit: 5,
      });

      expect(client.get).toHaveBeenCalledWith("/inAppPurchaseOfferCodes/oc1/oneTimeUseCodes", {
        limit: 5,
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "ot1", environment: "SANDBOX" }],
        meta: { returned: 1 },
      });
      expectContract(client);
    });

    it("reads batches through client.get and never through the raw client", async () => {
      client.get.mockResolvedValueOnce({ data: [] });

      await listIapOneTimeCodeBatches(asClient(client), { offerCodeId: "oc1" });

      expect(client.requestRaw).not.toHaveBeenCalled();
    });
  });

  describe("get_iap_one_time_code_values", () => {
    it("returns the CSV values and their non-empty line count", async () => {
      client.requestRaw.mockResolvedValueOnce(new Response("code\nAAA-1\nBBB-2\n"));

      const result = await getIapOneTimeCodeValues(asClient(client), {
        oneTimeUseCodeBatchId: "ot1",
      });

      expect(client.requestRaw).toHaveBeenCalledWith(
        "/inAppPurchaseOfferCodeOneTimeUseCodes/ot1/values",
        { headers: { Accept: "text/csv" } }
      );
      expect(result).toMatchObject({
        success: true,
        data: { oneTimeUseCodeBatchId: "ot1", lineCount: 3, csv: "code\nAAA-1\nBBB-2\n" },
      });
      expectContract(client);
    });
  });

  describe("create_iap_custom_code", () => {
    it("creates a custom code for the offer code", async () => {
      client.post.mockResolvedValueOnce({ data: customCode });

      const result = await createIapCustomCode(asClient(client), {
        offerCodeId: "oc1",
        customCode: "SPRING-2026",
        numberOfCodes: 50,
      });

      expect(client.post).toHaveBeenCalledWith("/inAppPurchaseOfferCodeCustomCodes", {
        data: {
          type: "inAppPurchaseOfferCodeCustomCodes",
          attributes: { customCode: "SPRING-2026", numberOfCodes: 50 },
          relationships: {
            offerCode: { data: { type: "inAppPurchaseOfferCodes", id: "oc1" } },
          },
        },
      });
      expect(result).toMatchObject({
        success: true,
        data: { id: "cc1", customCode: "SPRING-2026" },
      });
      expectContract(client);
    });
  });

  describe("list_iap_custom_codes", () => {
    it("lists the custom codes of an offer code", async () => {
      client.get.mockResolvedValueOnce({ data: [customCode] });

      const result = await listIapCustomCodes(asClient(client), { offerCodeId: "oc1" });

      expect(client.get).toHaveBeenCalledWith("/inAppPurchaseOfferCodes/oc1/customCodes", {});
      expect(result).toMatchObject({ success: true, data: [{ id: "cc1", numberOfCodes: 50 }] });
      expectContract(client);
    });
  });
});
