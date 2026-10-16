/**
 * Proves the contract checker (tests/helpers/contract.ts) accepts real request shapes and
 * rejects the mistakes it exists to catch. Tool tests rely on it, so it needs its own fixtures.
 */

import { describe, expect, it } from "vitest";
import { contractErrors } from "./helpers/contract.js";

const introOfferBody = {
  data: {
    type: "subscriptionIntroductoryOffers",
    attributes: { duration: "ONE_WEEK", offerMode: "FREE_TRIAL", numberOfPeriods: 1 },
    relationships: {
      subscription: { data: { type: "subscriptions", id: "6700000000" } },
      territory: { data: { type: "territories", id: "USA" } },
      subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "${pp-usa}" } },
    },
  },
  included: [{ type: "subscriptionPricePoints", id: "${pp-usa}" }],
};

const winBackBody = {
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
      subscription: { data: { type: "subscriptions", id: "6700000000" } },
      prices: { data: [{ type: "winBackOfferPrices", id: "${price-1}" }] },
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
  ],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("contract checker: accepts valid requests", () => {
  it("accepts an intro offer with an included price point", () => {
    expect(
      contractErrors({
        method: "POST",
        path: "/subscriptionIntroductoryOffers",
        body: introOfferBody,
      })
    ).toEqual([]);
  });

  it("accepts a win-back offer with a nested IntegerRange and inline price relationships (spec override)", () => {
    expect(
      contractErrors({ method: "POST", path: "/v1/winBackOffers", body: winBackBody })
    ).toEqual([]);
  });

  it("accepts to-one and to-many linkage bodies", () => {
    expect(
      contractErrors({
        method: "PATCH",
        path: "/appStoreVersions/123/relationships/build",
        body: { data: { type: "builds", id: "b1" } },
      })
    ).toEqual([]);
    expect(
      contractErrors({
        method: "POST",
        path: "/betaGroups/g1/relationships/builds",
        body: { data: [{ type: "builds", id: "b1" }] },
      })
    ).toEqual([]);
  });

  it("accepts a body satisfying one anyOf requirement set", () => {
    const body = {
      data: {
        type: "appAssetLibraryPlacementOrderingRequests",
        attributes: { placementGroup: "SCREENSHOTS" },
        relationships: {
          orderedPlacements: { data: [{ type: "appAssetLibraryPlacements", id: "p1" }] },
          appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: "l1" } },
        },
      },
    };
    expect(
      contractErrors({ method: "POST", path: "/v1/appAssetLibraryPlacementOrderingRequests", body })
    ).toEqual([]);
  });

  it("accepts arbitrary keys in a declared map (StringToStringMap)", () => {
    const body = {
      data: {
        type: "gameCenterAchievements",
        attributes: {
          referenceName: "First win",
          vendorIdentifier: "first_win",
          points: 10,
          showBeforeEarned: true,
          repeatable: false,
          activityProperties: { anyKey: "value", another: "x" },
        },
      },
    };
    expect(contractErrors({ method: "POST", path: "/v1/gameCenterAchievements", body })).toEqual(
      []
    );
  });

  it("accepts declared query parameters with valid enum values", () => {
    expect(
      contractErrors({
        method: "GET",
        path: "/apps/1/appStoreVersions",
        query: {
          "filter[platform]": "IOS,MAC_OS",
          limit: 50,
          "fields[appStoreVersions]": "copyright",
        },
      })
    ).toEqual([]);
  });
});

describe("contract checker: rejects invalid requests", () => {
  it("rejects a PATCH without data.id", () => {
    const errors = contractErrors({
      method: "PATCH",
      path: "/appStoreVersions/123",
      body: { data: { type: "appStoreVersions", attributes: { copyright: "2026 Me" } } },
    });
    expect(errors.join("\n")).toContain("missing required 'id'");
  });

  it("rejects an unknown attribute", () => {
    const errors = contractErrors({
      method: "PATCH",
      path: "/appStoreVersions/123",
      body: { data: { type: "appStoreVersions", id: "123", attributes: { copyrightText: "x" } } },
    });
    expect(errors.join("\n")).toContain("unknown key 'copyrightText'");
  });

  it("rejects an invalid enum value", () => {
    const body = clone(introOfferBody);
    body.data.attributes.offerMode = "FREE";
    expect(
      contractErrors({ method: "POST", path: "/subscriptionIntroductoryOffers", body }).join("\n")
    ).toContain("'FREE' is not one of");
  });

  it("rejects an included item of the wrong type", () => {
    const body = clone(introOfferBody);
    body.included = [{ type: "territories", id: "USA" }];
    expect(
      contractErrors({ method: "POST", path: "/subscriptionIntroductoryOffers", body }).join("\n")
    ).toContain("included[0].type");
  });

  it("rejects an unknown key inside a nested object", () => {
    const body = clone(winBackBody) as typeof winBackBody & {
      data: { attributes: { customerEligibilityTimeSinceLastSubscribedInMonths: object } };
    };
    body.data.attributes.customerEligibilityTimeSinceLastSubscribedInMonths = { min: 1, max: 12 };
    expect(contractErrors({ method: "POST", path: "/winBackOffers", body }).join("\n")).toContain(
      "unknown key 'min'"
    );
  });

  it("rejects a linkage of the wrong resource type", () => {
    const errors = contractErrors({
      method: "PATCH",
      path: "/appStoreVersions/123/relationships/build",
      body: { data: { type: "apps", id: "b1" } },
    });
    expect(errors.join("\n")).toContain("'apps' is not one of builds");
  });

  it("rejects a missing required relationship", () => {
    const body = clone(introOfferBody) as { data: { relationships: Record<string, unknown> } };
    body.data.relationships = {};
    expect(
      contractErrors({ method: "POST", path: "/subscriptionIntroductoryOffers", body }).join("\n")
    ).toContain("missing required 'subscription'");
  });

  it("rejects a body that satisfies no anyOf requirement set", () => {
    const body = {
      data: {
        type: "appAssetLibraryPlacementOrderingRequests",
        attributes: { placementGroup: "SCREENSHOTS" },
        relationships: {
          orderedPlacements: { data: [{ type: "appAssetLibraryPlacements", id: "p1" }] },
        },
      },
    };
    expect(
      contractErrors({
        method: "POST",
        path: "/v1/appAssetLibraryPlacementOrderingRequests",
        body,
      }).join("\n")
    ).toContain("anyOf");
  });

  it("rejects unknown query parameters and bad query enum values", () => {
    const errors = contractErrors({
      method: "GET",
      path: "/apps/1/appStoreVersions",
      query: { "filter[platforms]": "IOS", "filter[platform]": "ANDROID" },
    });
    expect(errors.join("\n")).toContain("unknown query parameter 'filter[platforms]'");
    expect(errors.join("\n")).toContain("'ANDROID' is not one of");
  });

  it("rejects operations that do not exist", () => {
    expect(contractErrors({ method: "PATCH", path: "/apps/1/versions" })[0]).toContain(
      "no such operation"
    );
  });
});
