/**
 * Contract sweep for existing write tools. Each tool runs against a mock client with a minimal
 * valid input, and every request it would send is checked against Apple's OpenAPI spec.
 *
 * A failing test is a finding about the tool's request: fix the tool, not the test.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createAnalyticsReportRequest,
  deleteAnalyticsReportRequest,
} from "../src/tools/analytics.tools.js";
import { updateAppInfoLocalization } from "../src/tools/app-info.tools.js";
import { addBetaTester, removeBetaTester } from "../src/tools/beta.tools.js";
import { createBundleId, deleteBundleId, updateBundleId } from "../src/tools/bundle-ids.tools.js";
import {
  createInAppPurchase,
  createInAppPurchaseLocalization,
  deleteInAppPurchase,
  deleteInAppPurchaseLocalization,
  setInAppPurchaseAvailability,
  setInAppPurchasePrice,
  submitInAppPurchaseForReview,
  updateInAppPurchase,
  updateInAppPurchaseLocalization,
} from "../src/tools/in-app-purchases.tools.js";
import {
  createVersionLocalization,
  deleteVersionLocalization,
  updateVersionLocalization,
} from "../src/tools/localizations.tools.js";
import { setAppPrices } from "../src/tools/pricing.tools.js";
import { uploadScreenshot } from "../src/tools/screenshots.tools.js";
import {
  createPromotionalOffer,
  createSubscription,
  createSubscriptionGroup,
  createSubscriptionGroupLocalization,
  createSubscriptionLocalization,
  createSubscriptionPrice,
  deletePromotionalOffer,
  deleteSubscription,
  deleteSubscriptionLocalization,
  setSubscriptionAvailability,
  updatePromotionalOffer,
  updateSubscription,
  updateSubscriptionGroup,
  updateSubscriptionGroupLocalization,
  updateSubscriptionLocalization,
} from "../src/tools/subscriptions.tools.js";
import { createAppVersion } from "../src/tools/versions.tools.js";
import { contractErrors, recordedCalls } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  requestRaw: vi.fn(),
  rawRequest: vi.fn(),
  paginate: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const resource = (type: string, id: string, attributes: Record<string, unknown> = {}) => ({
  data: { type, id, attributes },
});

/** Contract errors for every API request the tool sent. Sending no request is a failure. */
function contractOf(client: MockClient): string[] {
  const calls = recordedCalls(client);
  expect(calls.length, "tool sent no API request").toBeGreaterThan(0);
  return calls.flatMap((call) => contractErrors(call));
}

let tempDir: string;
let screenshotPath: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "asc-contract-"));
  screenshotPath = join(tempDir, "shot.png");
  await writeFile(screenshotPath, Buffer.from("0123456789abcdefghij")); // 20 bytes
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("contract sweep: app versions and localizations", () => {
  it("create_app_version", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(resource("appStoreVersions", "v1", { platform: "IOS" }));
    const result = await createAppVersion(asClient(client), {
      appId: "123",
      platform: "IOS",
      versionString: "1.0.0",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("create_version_localization", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("appStoreVersionLocalizations", "l1", { locale: "en-US" })
    );
    const result = await createVersionLocalization(asClient(client), {
      versionId: "v1",
      locale: "en-US",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_version_localization", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(
      resource("appStoreVersionLocalizations", "l1", { description: "Desc" })
    );
    const result = await updateVersionLocalization(asClient(client), {
      localizationId: "l1",
      description: "Desc",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("delete_version_localization", async () => {
    const client = createMockClient();
    const result = await deleteVersionLocalization(asClient(client), { localizationId: "l1" });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_app_info_localization", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(resource("appInfoLocalizations", "al1", { name: "Name" }));
    const result = await updateAppInfoLocalization(asClient(client), {
      localizationId: "al1",
      name: "Name",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });
});

describe("contract sweep: beta testers and screenshots", () => {
  it("add_beta_tester", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("betaTesters", "t1", { email: "tester@example.com", state: "INVITED" })
    );
    const result = await addBetaTester(asClient(client), {
      betaGroupId: "g1",
      email: "tester@example.com",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("remove_beta_tester", async () => {
    const client = createMockClient();
    const result = await removeBetaTester(asClient(client), {
      betaGroupId: "g1",
      betaTesterId: "t1",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("upload_screenshot", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("appScreenshots", "shot1", {
        uploadOperations: [
          {
            method: "PUT",
            url: "https://upload.example/1",
            offset: 0,
            length: 20,
            requestHeaders: [],
          },
        ],
      })
    );
    client.rawRequest.mockResolvedValue({ ok: true, status: 200 });
    client.patch.mockResolvedValue(
      resource("appScreenshots", "shot1", {
        uploaded: true,
        assetDeliveryState: { state: "UPLOAD_COMPLETE" },
      })
    );
    const result = await uploadScreenshot(asClient(client), {
      screenshotSetId: "set1",
      fileName: "shot.png",
      fileSize: 20,
      filePath: screenshotPath,
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });
});

describe("contract sweep: bundle IDs and app prices", () => {
  it("create_bundle_id", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("bundleIds", "b1", { identifier: "com.example.app", platform: "IOS" })
    );
    const result = await createBundleId(asClient(client), {
      identifier: "com.example.app",
      name: "Example",
      platform: "IOS",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_bundle_id", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(resource("bundleIds", "b1", { name: "Renamed" }));
    const result = await updateBundleId(asClient(client), {
      bundleIdId: "b1",
      name: "Renamed",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("delete_bundle_id", async () => {
    const client = createMockClient();
    const result = await deleteBundleId(asClient(client), { bundleIdId: "b1" });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("set_app_prices", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(resource("appPriceSchedules", "ps1"));
    const result = await setAppPrices(asClient(client), {
      appId: "123",
      baseTerritory: "USA",
      manualPrices: [{ territory: "USA", pricePointId: "pp1" }],
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });
});

describe("contract sweep: subscriptions", () => {
  it("create_subscription_group", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(resource("subscriptionGroups", "g1", { referenceName: "Pro" }));
    const result = await createSubscriptionGroup(asClient(client), {
      appId: "123",
      referenceName: "Pro",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_subscription_group", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(
      resource("subscriptionGroups", "g1", { referenceName: "Pro 2" })
    );
    const result = await updateSubscriptionGroup(asClient(client), {
      subscriptionGroupId: "g1",
      referenceName: "Pro 2",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("create_subscription_group_localization", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("subscriptionGroupLocalizations", "gl1", { name: "Pro", locale: "en-US" })
    );
    const result = await createSubscriptionGroupLocalization(asClient(client), {
      subscriptionGroupId: "g1",
      name: "Pro",
      locale: "en-US",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_subscription_group_localization", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(
      resource("subscriptionGroupLocalizations", "gl1", { name: "Pro" })
    );
    const result = await updateSubscriptionGroupLocalization(asClient(client), {
      localizationId: "gl1",
      name: "Pro",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("create_subscription", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("subscriptions", "s1", { name: "Monthly", productId: "com.example.monthly" })
    );
    const result = await createSubscription(asClient(client), {
      subscriptionGroupId: "g1",
      name: "Monthly",
      productId: "com.example.monthly",
      subscriptionPeriod: "ONE_MONTH",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_subscription", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(resource("subscriptions", "s1", { name: "Monthly" }));
    const result = await updateSubscription(asClient(client), {
      subscriptionId: "s1",
      name: "Monthly",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("delete_subscription", async () => {
    const client = createMockClient();
    const result = await deleteSubscription(asClient(client), { subscriptionId: "s1" });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("create_subscription_localization", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("subscriptionLocalizations", "sl1", { name: "Monthly", locale: "en-US" })
    );
    const result = await createSubscriptionLocalization(asClient(client), {
      subscriptionId: "s1",
      name: "Monthly",
      locale: "en-US",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_subscription_localization", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(
      resource("subscriptionLocalizations", "sl1", { name: "Monthly" })
    );
    const result = await updateSubscriptionLocalization(asClient(client), {
      localizationId: "sl1",
      name: "Monthly",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("delete_subscription_localization", async () => {
    const client = createMockClient();
    const result = await deleteSubscriptionLocalization(asClient(client), {
      localizationId: "sl1",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  // Without territories the current ones are re-sent (Apple requires the relationship)
  it("set_subscription_availability", async () => {
    const client = createMockClient();
    client.get.mockResolvedValue(resource("subscriptionAvailabilities", "a0"));
    client.paginate.mockImplementation(async function* () {
      yield resource("territories", "USA", { currency: "USD" }).data;
    });
    client.post.mockResolvedValue(resource("subscriptionAvailabilities", "a1"));
    const result = await setSubscriptionAvailability(asClient(client), {
      subscriptionId: "s1",
      availableInNewTerritories: true,
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("create_subscription_price", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(resource("subscriptionPrices", "p1"));
    const result = await createSubscriptionPrice(asClient(client), {
      subscriptionId: "s1",
      subscriptionPricePointId: "pp1",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("create_promotional_offer", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("subscriptionPromotionalOffers", "po1", { name: "Trial", offerCode: "TRIAL" })
    );
    const result = await createPromotionalOffer(asClient(client), {
      subscriptionId: "s1",
      name: "Trial",
      offerCode: "TRIAL",
      duration: "ONE_WEEK",
      offerMode: "FREE_TRIAL",
      periodCount: 1,
      prices: [{ territory: "USA" }],
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_promotional_offer", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(
      resource("subscriptionPromotionalOffers", "po1", { name: "Trial" })
    );
    const result = await updatePromotionalOffer(asClient(client), {
      promotionalOfferId: "po1",
      prices: [{ territory: "USA", pricePointId: "pp1" }],
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("delete_promotional_offer", async () => {
    const client = createMockClient();
    const result = await deletePromotionalOffer(asClient(client), { promotionalOfferId: "po1" });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });
});

describe("contract sweep: in-app purchases", () => {
  it("create_in_app_purchase", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("inAppPurchases", "i1", { name: "Lifetime", productId: "com.example.lifetime" })
    );
    const result = await createInAppPurchase(asClient(client), {
      appId: "123",
      name: "Lifetime",
      productId: "com.example.lifetime",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_in_app_purchase", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(resource("inAppPurchases", "i1", { name: "Lifetime 2" }));
    const result = await updateInAppPurchase(asClient(client), {
      inAppPurchaseId: "i1",
      name: "Lifetime 2",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("delete_in_app_purchase", async () => {
    const client = createMockClient();
    const result = await deleteInAppPurchase(asClient(client), { inAppPurchaseId: "i1" });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("create_in_app_purchase_localization", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("inAppPurchaseLocalizations", "il1", { name: "Lifetime", locale: "en-US" })
    );
    const result = await createInAppPurchaseLocalization(asClient(client), {
      inAppPurchaseId: "i1",
      locale: "en-US",
      name: "Lifetime",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("update_in_app_purchase_localization", async () => {
    const client = createMockClient();
    client.patch.mockResolvedValue(
      resource("inAppPurchaseLocalizations", "il1", { name: "Lifetime" })
    );
    const result = await updateInAppPurchaseLocalization(asClient(client), {
      localizationId: "il1",
      name: "Lifetime",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("delete_in_app_purchase_localization", async () => {
    const client = createMockClient();
    const result = await deleteInAppPurchaseLocalization(asClient(client), {
      localizationId: "il1",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("set_in_app_purchase_price", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(resource("inAppPurchasePriceSchedules", "ps1"));
    const result = await setInAppPurchasePrice(asClient(client), {
      inAppPurchaseId: "i1",
      baseTerritory: "USA",
      manualPrices: [{ territory: "USA", pricePointId: "pp1" }],
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  // Without territories the current ones are re-sent (Apple requires the relationship)
  it("set_in_app_purchase_availability", async () => {
    const client = createMockClient();
    client.get.mockResolvedValue(resource("inAppPurchaseAvailabilities", "av0"));
    client.paginate.mockImplementation(async function* () {
      yield resource("territories", "USA", { currency: "USD" }).data;
    });
    client.post.mockResolvedValue(
      resource("inAppPurchaseAvailabilities", "av1", { availableInNewTerritories: true })
    );
    const result = await setInAppPurchaseAvailability(asClient(client), {
      inAppPurchaseId: "i1",
      availableInNewTerritories: true,
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("submit_in_app_purchase_for_review", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(resource("inAppPurchaseSubmissions", "sub1"));
    const result = await submitInAppPurchaseForReview(asClient(client), {
      inAppPurchaseId: "i1",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });
});

describe("contract sweep: analytics report requests", () => {
  it("create_analytics_report_request", async () => {
    const client = createMockClient();
    client.post.mockResolvedValue(
      resource("analyticsReportRequests", "r1", { accessType: "ONGOING" })
    );
    const result = await createAnalyticsReportRequest(asClient(client), {
      appId: "123",
      accessType: "ONGOING",
    });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });

  it("delete_analytics_report_request", async () => {
    const client = createMockClient();
    const result = await deleteAnalyticsReportRequest(asClient(client), { requestId: "r1" });
    expect(result).toMatchObject({ success: true });
    expect(contractOf(client)).toEqual([]);
  });
});
