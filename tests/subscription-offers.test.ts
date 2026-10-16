/**
 * Tests for subscription offer tools (introductory offers and win-back offers)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createIntroductoryOffer,
  createWinBackOffer,
  deleteIntroductoryOffer,
  deleteWinBackOffer,
  listIntroductoryOffers,
  listWinBackOfferPrices,
  listWinBackOffers,
  subscriptionOffersToolsModule,
  updateIntroductoryOffer,
  updateWinBackOffer,
} from "../src/tools/subscription-offers.tools.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const introOffer = {
  type: "subscriptionIntroductoryOffers",
  id: "io1",
  attributes: {
    duration: "ONE_WEEK",
    offerMode: "FREE_TRIAL",
    numberOfPeriods: 1,
    startDate: "2026-11-01",
  },
  relationships: { territory: { data: { type: "territories", id: "USA" } } },
};

const winBackOffer = {
  type: "winBackOffers",
  id: "wb1",
  attributes: {
    referenceName: "Come back",
    offerId: "comeback_1",
    duration: "ONE_MONTH",
    offerMode: "PAY_AS_YOU_GO",
    periodCount: 1,
    priority: "NORMAL",
  },
};

const winBackInput = {
  subscriptionId: "s1",
  referenceName: "Come back",
  offerId: "comeback_1",
  duration: "ONE_MONTH",
  offerMode: "PAY_AS_YOU_GO",
  periodCount: 1,
  customerEligibilityPaidSubscriptionDurationInMonths: 3,
  customerEligibilityTimeSinceLastSubscribedInMonths: { minimum: 1, maximum: 12 },
  startDate: "2026-11-01",
  priority: "NORMAL",
};

describe("subscription offer tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("introductory offers", () => {
    it("lists offers filtered by territory with their price point IDs", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          {
            ...introOffer,
            relationships: {
              territory: { data: { type: "territories", id: "USA" } },
              subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp-usa" } },
            },
          },
        ],
        meta: { paging: { total: 1, limit: 10 } },
      });

      const result = await listIntroductoryOffers(asClient(client), {
        subscriptionId: "s1",
        territoryId: "USA",
        limit: 10,
      });

      expect(client.get).toHaveBeenCalledWith("/subscriptions/s1/introductoryOffers", {
        "filter[territory]": "USA",
        include: "territory,subscriptionPricePoint",
        limit: 10,
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "io1", territoryId: "USA", pricePointId: "pp-usa" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });

    it("creates a paid offer linked to the subscription, territory and price point", async () => {
      client.post.mockResolvedValueOnce({ data: introOffer });

      await createIntroductoryOffer(asClient(client), {
        subscriptionId: "s1",
        duration: "ONE_MONTH",
        offerMode: "PAY_AS_YOU_GO",
        numberOfPeriods: 1,
        territoryId: "USA",
        pricePointId: "pp-usa",
      });

      expect(client.post).toHaveBeenCalledWith("/subscriptionIntroductoryOffers", {
        data: {
          type: "subscriptionIntroductoryOffers",
          attributes: { duration: "ONE_MONTH", offerMode: "PAY_AS_YOU_GO", numberOfPeriods: 1 },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "s1" } },
            territory: { data: { type: "territories", id: "USA" } },
            subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp-usa" } },
          },
        },
      });
      expectContract(client);
    });

    it("refuses a paid offer without a price point before calling the API", async () => {
      const result = await createIntroductoryOffer(asClient(client), {
        subscriptionId: "s1",
        duration: "ONE_MONTH",
        offerMode: "PAY_UP_FRONT",
        numberOfPeriods: 1,
        territoryId: "USA",
      });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).not.toHaveBeenCalled();
    });

    it("never sends a price point for a free trial, and refuses one if given", async () => {
      client.post.mockResolvedValueOnce({ data: introOffer });

      await createIntroductoryOffer(asClient(client), {
        subscriptionId: "s1",
        duration: "ONE_WEEK",
        offerMode: "FREE_TRIAL",
        numberOfPeriods: 1,
        territoryId: "USA",
      });

      const [, body] = client.post.mock.calls[0] ?? [];
      expect(body.data.relationships).not.toHaveProperty("subscriptionPricePoint");
      expectContract(client);

      const refused = await createIntroductoryOffer(asClient(client), {
        subscriptionId: "s1",
        duration: "ONE_WEEK",
        offerMode: "FREE_TRIAL",
        numberOfPeriods: 1,
        territoryId: "USA",
        pricePointId: "pp-usa",
      });

      expect(refused).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).toHaveBeenCalledTimes(1);
    });

    it("patches only the end date", async () => {
      client.patch.mockResolvedValueOnce({ data: introOffer });

      await updateIntroductoryOffer(asClient(client), {
        introductoryOfferId: "io1",
        endDate: "2026-12-31",
      });

      expect(client.patch).toHaveBeenCalledWith("/subscriptionIntroductoryOffers/io1", {
        data: {
          type: "subscriptionIntroductoryOffers",
          id: "io1",
          attributes: { endDate: "2026-12-31" },
        },
      });
      expectContract(client);
    });

    it("deletes an introductory offer", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteIntroductoryOffer(asClient(client), {
        introductoryOfferId: "io1",
      });

      expect(client.delete).toHaveBeenCalledWith("/subscriptionIntroductoryOffers/io1");
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });
  });

  describe("win-back offers", () => {
    it("lists win-back offers for a subscription", async () => {
      client.get.mockResolvedValueOnce({
        data: [winBackOffer],
        meta: { paging: { total: 1, limit: 20 } },
      });

      const result = await listWinBackOffers(asClient(client), { subscriptionId: "s1", limit: 20 });

      expect(client.get).toHaveBeenCalledWith("/subscriptions/s1/winBackOffers", { limit: 20 });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "wb1", offerId: "comeback_1" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });

    it("creates a paid win-back offer with one linked price per territory", async () => {
      client.post.mockResolvedValueOnce({ data: winBackOffer });

      await createWinBackOffer(asClient(client), {
        ...winBackInput,
        prices: [
          { territoryId: "USA", pricePointId: "pp-usa" },
          { territoryId: "GBR", pricePointId: "pp-gbr" },
        ],
      });

      expect(client.post).toHaveBeenCalledWith("/winBackOffers", {
        data: {
          type: "winBackOffers",
          attributes: {
            referenceName: "Come back",
            offerId: "comeback_1",
            duration: "ONE_MONTH",
            offerMode: "PAY_AS_YOU_GO",
            periodCount: 1,
            customerEligibilityPaidSubscriptionDurationInMonths: 3,
            customerEligibilityTimeSinceLastSubscribedInMonths: { minimum: 1, maximum: 12 },
            startDate: "2026-11-01",
            priority: "NORMAL",
          },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "s1" } },
            prices: {
              data: [
                { type: "winBackOfferPrices", id: "${price-1}" },
                { type: "winBackOfferPrices", id: "${price-2}" },
              ],
            },
          },
        },
        included: [
          {
            type: "winBackOfferPrices",
            id: "${price-1}",
            relationships: {
              territory: { data: { type: "territories", id: "USA" } },
              subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp-usa" } },
            },
          },
          {
            type: "winBackOfferPrices",
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

    it("refuses a paid price without a price point before calling the API", async () => {
      const result = await createWinBackOffer(asClient(client), {
        ...winBackInput,
        prices: [{ territoryId: "USA" }],
      });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).not.toHaveBeenCalled();
    });

    it("never sends a price point for a free trial, and refuses one if given", async () => {
      client.post.mockResolvedValueOnce({ data: winBackOffer });

      await createWinBackOffer(asClient(client), {
        ...winBackInput,
        offerMode: "FREE_TRIAL",
        prices: [{ territoryId: "USA" }],
      });

      const [, body] = client.post.mock.calls[0] ?? [];
      expect(body.included[0].relationships).not.toHaveProperty("subscriptionPricePoint");
      expectContract(client);

      const refused = await createWinBackOffer(asClient(client), {
        ...winBackInput,
        offerMode: "FREE_TRIAL",
        prices: [{ territoryId: "USA", pricePointId: "pp-usa" }],
      });

      expect(refused).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).toHaveBeenCalledTimes(1);
    });

    it("patches only the provided attributes, including clearing the end date", async () => {
      client.patch.mockResolvedValueOnce({ data: winBackOffer });

      await updateWinBackOffer(asClient(client), {
        winBackOfferId: "wb1",
        priority: "HIGH",
        endDate: null,
      });

      expect(client.patch).toHaveBeenCalledWith("/winBackOffers/wb1", {
        data: {
          type: "winBackOffers",
          id: "wb1",
          attributes: { priority: "HIGH", endDate: null },
        },
      });
      expectContract(client);
    });

    it("deletes a win-back offer", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteWinBackOffer(asClient(client), { winBackOfferId: "wb1" });

      expect(client.delete).toHaveBeenCalledWith("/winBackOffers/wb1");
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });

    it("lists win-back prices with their territory and price point IDs", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          {
            type: "winBackOfferPrices",
            id: "wp1",
            relationships: {
              territory: { data: { type: "territories", id: "USA" } },
              subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp-usa" } },
            },
          },
        ],
      });

      const result = await listWinBackOfferPrices(asClient(client), {
        winBackOfferId: "wb1",
        territoryId: "USA",
      });

      expect(client.get).toHaveBeenCalledWith("/winBackOffers/wb1/prices", {
        "filter[territory]": "USA",
        include: "territory,subscriptionPricePoint",
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "wp1", territoryId: "USA", pricePointId: "pp-usa" }],
      });
      expectContract(client);
    });
  });

  it("marks every delete tool destructive", () => {
    const deletes = subscriptionOffersToolsModule.definitions.filter((tool) =>
      tool.name.startsWith("delete_")
    );

    expect(deletes.map((tool) => tool.name)).toEqual([
      "delete_introductory_offer",
      "delete_win_back_offer",
    ]);
    for (const tool of deletes) {
      expect(tool.annotations?.destructiveHint).toBe(true);
    }
  });
});
