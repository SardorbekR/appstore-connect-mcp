/**
 * Tests for subscription offer code tools (offer codes, one-time use code batches, custom codes)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createSubscriptionCustomCode,
  createSubscriptionOfferCode,
  createSubscriptionOneTimeCodes,
  getSubscriptionOfferCode,
  getSubscriptionOneTimeCodeValues,
  listSubscriptionCustomCodes,
  listSubscriptionOfferCodes,
  listSubscriptionOneTimeCodeBatches,
  subscriptionOfferCodesToolsModule,
  updateSubscriptionOfferCode,
} from "../src/tools/subscription-offer-codes.tools.js";
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
  type: "subscriptionOfferCodes",
  id: "oc1",
  attributes: {
    name: "Spring",
    active: true,
    offerMode: "PAY_AS_YOU_GO",
    duration: "ONE_MONTH",
    numberOfPeriods: 3,
    totalNumberOfCodes: 0,
  },
};

const paidOfferInput = {
  subscriptionId: "s1",
  name: "Spring",
  customerEligibilities: ["NEW"],
  offerEligibility: "STACK_WITH_INTRO_OFFERS",
  duration: "ONE_MONTH",
  offerMode: "PAY_AS_YOU_GO",
  numberOfPeriods: 3,
};

describe("subscription offer code tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("list_subscription_offer_codes", () => {
    it("lists a subscription's offer codes filtered by territory", async () => {
      client.get.mockResolvedValueOnce({
        data: [offerCode],
        meta: { paging: { total: 1, limit: 10 } },
      });

      const result = await listSubscriptionOfferCodes(asClient(client), {
        subscriptionId: "s1",
        territories: ["USA", "GBR"],
        limit: 10,
      });

      expect(client.get).toHaveBeenCalledWith("/subscriptions/s1/offerCodes", {
        "filter[territory]": "USA,GBR",
        limit: 10,
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "oc1", name: "Spring" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });
  });

  describe("get_subscription_offer_code", () => {
    it("gets one offer code by ID", async () => {
      client.get.mockResolvedValueOnce({ data: offerCode });

      const result = await getSubscriptionOfferCode(asClient(client), { offerCodeId: "oc1" });

      expect(client.get).toHaveBeenCalledWith("/subscriptionOfferCodes/oc1");
      expect(result).toMatchObject({ success: true, data: { id: "oc1", active: true } });
      expectContract(client);
    });
  });

  describe("create_subscription_offer_code", () => {
    it("creates a paid offer with prices sent as temporary inline items", async () => {
      client.post.mockResolvedValueOnce({ data: offerCode });

      await createSubscriptionOfferCode(asClient(client), {
        ...paidOfferInput,
        prices: [
          { territoryId: "USA", pricePointId: "pp-usa" },
          { territoryId: "GBR", pricePointId: "pp-gbr" },
        ],
      });

      expect(client.post).toHaveBeenCalledWith("/subscriptionOfferCodes", {
        data: {
          type: "subscriptionOfferCodes",
          attributes: {
            name: "Spring",
            customerEligibilities: ["NEW"],
            offerEligibility: "STACK_WITH_INTRO_OFFERS",
            duration: "ONE_MONTH",
            offerMode: "PAY_AS_YOU_GO",
            numberOfPeriods: 3,
          },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "s1" } },
            prices: {
              data: [
                { type: "subscriptionOfferCodePrices", id: "${price-1}" },
                { type: "subscriptionOfferCodePrices", id: "${price-2}" },
              ],
            },
          },
        },
        included: [
          {
            type: "subscriptionOfferCodePrices",
            id: "${price-1}",
            relationships: {
              territory: { data: { type: "territories", id: "USA" } },
              subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp-usa" } },
            },
          },
          {
            type: "subscriptionOfferCodePrices",
            id: "${price-2}",
            relationships: {
              territory: { data: { type: "territories", id: "GBR" } },
              subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp-gbr" } },
            },
          },
        ],
      });
      expectContract(client);
    });

    it("creates a free-trial offer with territory-only prices", async () => {
      client.post.mockResolvedValueOnce({ data: offerCode });

      await createSubscriptionOfferCode(asClient(client), {
        ...paidOfferInput,
        offerMode: "FREE_TRIAL",
        prices: [{ territoryId: "USA" }],
      });

      expect(client.post.mock.calls[0]?.[1].included).toEqual([
        {
          type: "subscriptionOfferCodePrices",
          id: "${price-1}",
          relationships: { territory: { data: { type: "territories", id: "USA" } } },
        },
      ]);
      expectContract(client);
    });

    it("refuses a paid offer price without a price point", async () => {
      const result = await createSubscriptionOfferCode(asClient(client), {
        ...paidOfferInput,
        prices: [{ territoryId: "USA" }],
      });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).not.toHaveBeenCalled();
    });

    it("refuses a paid offer with no prices before calling the API", async () => {
      const result = await createSubscriptionOfferCode(asClient(client), paidOfferInput);

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).not.toHaveBeenCalled();
    });
  });

  describe("update_subscription_offer_code", () => {
    it("deactivates an offer code by patching only the active flag", async () => {
      client.patch.mockResolvedValueOnce({ data: { ...offerCode, attributes: { active: false } } });

      const result = await updateSubscriptionOfferCode(asClient(client), {
        offerCodeId: "oc1",
        active: false,
      });

      expect(client.patch).toHaveBeenCalledWith("/subscriptionOfferCodes/oc1", {
        data: { type: "subscriptionOfferCodes", id: "oc1", attributes: { active: false } },
      });
      expect(result).toMatchObject({ success: true, data: { id: "oc1", active: false } });
      expectContract(client);
    });

    it("refuses an update that does not say whether to activate or deactivate", async () => {
      const result = await updateSubscriptionOfferCode(asClient(client), { offerCodeId: "oc1" });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("is annotated destructive because deactivation is irreversible for holders of the code", () => {
      const definition = subscriptionOfferCodesToolsModule.definitions.find(
        (tool) => tool.name === "update_subscription_offer_code"
      );
      expect(definition?.annotations).toMatchObject({ destructiveHint: true });
    });
  });

  describe("create_subscription_one_time_codes", () => {
    it("generates a batch linked to the offer code", async () => {
      client.post.mockResolvedValueOnce({
        data: {
          type: "subscriptionOfferCodeOneTimeUseCodes",
          id: "b1",
          attributes: { numberOfCodes: 100, expirationDate: "2026-12-31", active: true },
        },
      });

      const result = await createSubscriptionOneTimeCodes(asClient(client), {
        offerCodeId: "oc1",
        numberOfCodes: 100,
        expirationDate: "2026-12-31",
      });

      expect(client.post).toHaveBeenCalledWith("/subscriptionOfferCodeOneTimeUseCodes", {
        data: {
          type: "subscriptionOfferCodeOneTimeUseCodes",
          attributes: { numberOfCodes: 100, expirationDate: "2026-12-31" },
          relationships: { offerCode: { data: { type: "subscriptionOfferCodes", id: "oc1" } } },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "b1", numberOfCodes: 100 } });
      expectContract(client);
    });
  });

  describe("list_subscription_one_time_code_batches", () => {
    it("lists the batches for an offer code", async () => {
      client.get.mockResolvedValueOnce({
        data: [{ type: "subscriptionOfferCodeOneTimeUseCodes", id: "b1", attributes: {} }],
      });

      const result = await listSubscriptionOneTimeCodeBatches(asClient(client), {
        offerCodeId: "oc1",
        limit: 20,
      });

      expect(client.get).toHaveBeenCalledWith("/subscriptionOfferCodes/oc1/oneTimeUseCodes", {
        limit: 20,
      });
      expect(result).toMatchObject({ success: true, data: [{ id: "b1" }] });
      expectContract(client);
    });

    it("reads JSON listings through client.get, never through the raw CSV path", async () => {
      client.get.mockResolvedValueOnce({ data: [] });

      await listSubscriptionOneTimeCodeBatches(asClient(client), { offerCodeId: "oc1" });

      expect(client.get).toHaveBeenCalledTimes(1);
      expect(client.requestRaw).not.toHaveBeenCalled();
    });
  });

  describe("get_subscription_one_time_code_values", () => {
    it("downloads a batch as CSV text through requestRaw and counts its lines", async () => {
      client.requestRaw.mockResolvedValueOnce(new Response("code\nAAA-111\nBBB-222\n"));

      const result = await getSubscriptionOneTimeCodeValues(asClient(client), {
        oneTimeUseCodeBatchId: "b1",
      });

      expect(client.requestRaw).toHaveBeenCalledWith(
        "/subscriptionOfferCodeOneTimeUseCodes/b1/values",
        { headers: { Accept: "text/csv" } }
      );
      expect(result).toMatchObject({
        success: true,
        data: { oneTimeUseCodeBatchId: "b1", csv: "code\nAAA-111\nBBB-222\n", lineCount: 3 },
      });
      expectContract(client);
    });
  });

  describe("create_subscription_custom_code", () => {
    it("creates a custom code linked to the offer code", async () => {
      client.post.mockResolvedValueOnce({
        data: {
          type: "subscriptionOfferCodeCustomCodes",
          id: "cc1",
          attributes: { customCode: "SPRING26", numberOfCodes: 50, active: true },
        },
      });

      const result = await createSubscriptionCustomCode(asClient(client), {
        offerCodeId: "oc1",
        customCode: "SPRING26",
        numberOfCodes: 50,
        expirationDate: "2026-12-31",
      });

      expect(client.post).toHaveBeenCalledWith("/subscriptionOfferCodeCustomCodes", {
        data: {
          type: "subscriptionOfferCodeCustomCodes",
          attributes: { customCode: "SPRING26", numberOfCodes: 50, expirationDate: "2026-12-31" },
          relationships: { offerCode: { data: { type: "subscriptionOfferCodes", id: "oc1" } } },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "cc1", customCode: "SPRING26" } });
      expectContract(client);
    });
  });

  describe("list_subscription_custom_codes", () => {
    it("lists the custom codes for an offer code", async () => {
      client.get.mockResolvedValueOnce({ data: [] });

      const result = await listSubscriptionCustomCodes(asClient(client), {
        offerCodeId: "oc1",
        limit: 5,
      });

      expect(client.get).toHaveBeenCalledWith("/subscriptionOfferCodes/oc1/customCodes", {
        limit: 5,
      });
      expect(result).toMatchObject({ success: true, data: [], meta: { returned: 0 } });
      expectContract(client);
    });
  });
});
