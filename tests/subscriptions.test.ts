/**
 * Tests for subscription tool handlers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
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
  getSubscription,
  getSubscriptionAvailability,
  getSubscriptionGroup,
  getSubscriptionGroupLocalization,
  listPromotionalOfferPrices,
  listPromotionalOffers,
  listSubscriptionGroupLocalizations,
  listSubscriptionGroups,
  listSubscriptionLocalizations,
  listSubscriptionPricePoints,
  listSubscriptionPrices,
  listSubscriptions,
  setSubscriptionAvailability,
  updatePromotionalOffer,
  updateSubscription,
  updateSubscriptionGroup,
  updateSubscriptionGroupLocalization,
  updateSubscriptionLocalization,
} from "../src/tools/subscriptions.tools.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

describe("Subscription Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  // ============================================================================
  // listSubscriptionGroups
  // ============================================================================

  describe("listSubscriptionGroups", () => {
    it("should return formatted subscription groups", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "group1",
            type: "subscriptionGroups",
            attributes: { referenceName: "Premium Tier" },
          },
          {
            id: "group2",
            type: "subscriptionGroups",
            attributes: { referenceName: "Basic Tier" },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listSubscriptionGroups(
        mockClient as unknown as AppStoreConnectClient,
        { appId: "123456" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          { id: "group1", referenceName: "Premium Tier" },
          { id: "group2", referenceName: "Basic Tier" },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should call correct endpoint with appId", async () => {
      mockClient.get.mockResolvedValueOnce({ data: [], meta: { paging: { total: 0 } } });

      await listSubscriptionGroups(mockClient as unknown as AppStoreConnectClient, {
        appId: "999",
        limit: 10,
      });

      expect(mockClient.get).toHaveBeenCalledWith("/apps/999/subscriptionGroups", { limit: 10 });
    });

    it("should require appId", async () => {
      const result = await listSubscriptionGroups(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // getSubscriptionGroup
  // ============================================================================

  describe("getSubscriptionGroup", () => {
    it("should return subscription group details", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "group1",
          type: "subscriptionGroups",
          attributes: { referenceName: "Premium Tier" },
        },
      });

      const result = await getSubscriptionGroup(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionGroupId: "group1" }
      );

      expect(result).toEqual({
        success: true,
        data: { id: "group1", referenceName: "Premium Tier" },
      });
      expect(mockClient.get).toHaveBeenCalledWith("/subscriptionGroups/group1");
    });

    it("should require subscriptionGroupId", async () => {
      const result = await getSubscriptionGroup(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // createSubscriptionGroup
  // ============================================================================

  describe("createSubscriptionGroup", () => {
    it("should create group with correct request body", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "newGroup",
          type: "subscriptionGroups",
          attributes: { referenceName: "Pro Plan" },
        },
      });

      const result = await createSubscriptionGroup(
        mockClient as unknown as AppStoreConnectClient,
        { appId: "123456", referenceName: "Pro Plan" }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionGroups", {
        data: {
          type: "subscriptionGroups",
          attributes: { referenceName: "Pro Plan" },
          relationships: {
            app: { data: { type: "apps", id: "123456" } },
          },
        },
      });

      expect(result).toEqual({
        success: true,
        data: { id: "newGroup", referenceName: "Pro Plan" },
      });
    });

    it("should require appId and referenceName", async () => {
      const result = await createSubscriptionGroup(
        mockClient as unknown as AppStoreConnectClient,
        { appId: "123456" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // updateSubscriptionGroup
  // ============================================================================

  describe("updateSubscriptionGroup", () => {
    it("should update reference name with correct request body", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "group1",
          type: "subscriptionGroups",
          attributes: { referenceName: "Updated Name" },
        },
      });

      const result = await updateSubscriptionGroup(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionGroupId: "group1", referenceName: "Updated Name" }
      );

      expect(mockClient.patch).toHaveBeenCalledWith("/subscriptionGroups/group1", {
        data: {
          type: "subscriptionGroups",
          id: "group1",
          attributes: { referenceName: "Updated Name" },
        },
      });

      expect(result).toEqual({
        success: true,
        data: { id: "group1", referenceName: "Updated Name" },
      });
    });

    it("should require subscriptionGroupId and referenceName", async () => {
      const result = await updateSubscriptionGroup(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionGroupId: "group1" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // listSubscriptionGroupLocalizations
  // ============================================================================

  describe("listSubscriptionGroupLocalizations", () => {
    it("should return formatted localizations list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "gl1",
            type: "subscriptionGroupLocalizations",
            attributes: {
              name: "Premium",
              locale: "en-US",
              customAppName: "My App",
              customAppDescription: "Best app ever",
              state: "APPROVED",
            },
          },
          {
            id: "gl2",
            type: "subscriptionGroupLocalizations",
            attributes: {
              name: "プレミアム",
              locale: "ja",
              customAppName: undefined,
              customAppDescription: undefined,
              state: "APPROVED",
            },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listSubscriptionGroupLocalizations(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionGroupId: "group1" }
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        "/subscriptionGroups/group1/subscriptionGroupLocalizations",
        { limit: undefined }
      );

      expect(result).toEqual({
        success: true,
        data: [
          { id: "gl1", name: "Premium", locale: "en-US", customAppName: "My App", customAppDescription: "Best app ever", state: "APPROVED" },
          { id: "gl2", name: "プレミアム", locale: "ja", customAppName: undefined, customAppDescription: undefined, state: "APPROVED" },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should pass limit parameter", async () => {
      mockClient.get.mockResolvedValueOnce({ data: [], meta: { paging: { total: 0 } } });

      await listSubscriptionGroupLocalizations(mockClient as unknown as AppStoreConnectClient, {
        subscriptionGroupId: "group1",
        limit: 5,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/subscriptionGroups/group1/subscriptionGroupLocalizations",
        { limit: 5 }
      );
    });

    it("should require subscriptionGroupId", async () => {
      const result = await listSubscriptionGroupLocalizations(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // getSubscriptionGroupLocalization
  // ============================================================================

  describe("getSubscriptionGroupLocalization", () => {
    it("should return a single localization by ID", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "gl1",
          type: "subscriptionGroupLocalizations",
          attributes: {
            name: "Premium",
            locale: "en-US",
            customAppName: "My App",
            customAppDescription: "Best app ever",
            state: "APPROVED",
          },
        },
      });

      const result = await getSubscriptionGroupLocalization(
        mockClient as unknown as AppStoreConnectClient,
        { localizationId: "gl1" }
      );

      expect(mockClient.get).toHaveBeenCalledWith("/subscriptionGroupLocalizations/gl1");
      expect(result).toEqual({
        success: true,
        data: {
          id: "gl1",
          name: "Premium",
          locale: "en-US",
          customAppName: "My App",
          customAppDescription: "Best app ever",
          state: "APPROVED",
        },
      });
    });

    it("should require localizationId", async () => {
      const result = await getSubscriptionGroupLocalization(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // createSubscriptionGroupLocalization
  // ============================================================================

  describe("createSubscriptionGroupLocalization", () => {
    it("should create localization with required fields", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "gl-new",
          type: "subscriptionGroupLocalizations",
          attributes: {
            name: "Premium",
            locale: "en-US",
            customAppName: undefined,
            customAppDescription: undefined,
            state: "PREPARE_FOR_SUBMISSION",
          },
        },
      });

      const result = await createSubscriptionGroupLocalization(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionGroupId: "group1", name: "Premium", locale: "en-US" }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionGroupLocalizations", {
        data: {
          type: "subscriptionGroupLocalizations",
          attributes: { name: "Premium", locale: "en-US" },
          relationships: {
            subscriptionGroup: { data: { type: "subscriptionGroups", id: "group1" } },
          },
        },
      });
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ id: "gl-new", name: "Premium", locale: "en-US" }),
      });
    });

    it("should include optional customAppName and customAppDescription", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "gl-new",
          type: "subscriptionGroupLocalizations",
          attributes: {
            name: "Premium",
            locale: "pt-BR",
            customAppName: "Meu App",
            customAppDescription: "Melhor app",
            state: "PREPARE_FOR_SUBMISSION",
          },
        },
      });

      await createSubscriptionGroupLocalization(
        mockClient as unknown as AppStoreConnectClient,
        {
          subscriptionGroupId: "group1",
          name: "Premium",
          locale: "pt-BR",
          customAppName: "Meu App",
          customAppDescription: "Melhor app",
        }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionGroupLocalizations", {
        data: {
          type: "subscriptionGroupLocalizations",
          attributes: {
            name: "Premium",
            locale: "pt-BR",
            customAppName: "Meu App",
            customAppDescription: "Melhor app",
          },
          relationships: {
            subscriptionGroup: { data: { type: "subscriptionGroups", id: "group1" } },
          },
        },
      });
    });

    it("should require subscriptionGroupId, name, and locale", async () => {
      const result = await createSubscriptionGroupLocalization(
        mockClient as unknown as AppStoreConnectClient,
        { name: "Premium" }
      );
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // updateSubscriptionGroupLocalization
  // ============================================================================

  describe("updateSubscriptionGroupLocalization", () => {
    it("should update localization with provided fields", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "gl1",
          type: "subscriptionGroupLocalizations",
          attributes: {
            name: "Updated Premium",
            locale: "en-US",
            customAppName: "Updated App",
            customAppDescription: undefined,
            state: "APPROVED",
          },
        },
      });

      const result = await updateSubscriptionGroupLocalization(
        mockClient as unknown as AppStoreConnectClient,
        { localizationId: "gl1", name: "Updated Premium", customAppName: "Updated App" }
      );

      expect(mockClient.patch).toHaveBeenCalledWith("/subscriptionGroupLocalizations/gl1", {
        data: {
          type: "subscriptionGroupLocalizations",
          id: "gl1",
          attributes: { name: "Updated Premium", customAppName: "Updated App" },
        },
      });
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ id: "gl1", name: "Updated Premium" }),
      });
    });

    it("should require localizationId", async () => {
      const result = await updateSubscriptionGroupLocalization(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // listSubscriptions
  // ============================================================================

  describe("listSubscriptions", () => {
    it("should return formatted subscriptions list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "sub1",
            type: "subscriptions",
            attributes: {
              name: "Monthly",
              productId: "com.example.monthly",
              familySharable: false,
              state: "APPROVED",
              subscriptionPeriod: "ONE_MONTH",
              groupLevel: 1,
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listSubscriptions(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionGroupId: "group1" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "sub1",
            name: "Monthly",
            productId: "com.example.monthly",
            familySharable: false,
            state: "APPROVED",
            subscriptionPeriod: "ONE_MONTH",
            groupLevel: 1,
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should call correct endpoint", async () => {
      mockClient.get.mockResolvedValueOnce({ data: [], meta: { paging: { total: 0 } } });

      await listSubscriptions(mockClient as unknown as AppStoreConnectClient, {
        subscriptionGroupId: "group1",
        limit: 20,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/subscriptionGroups/group1/subscriptions",
        { limit: 20 }
      );
    });

    it("should require subscriptionGroupId", async () => {
      const result = await listSubscriptions(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // getSubscription
  // ============================================================================

  describe("getSubscription", () => {
    it("should return subscription details", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "sub1",
          type: "subscriptions",
          attributes: {
            name: "Annual Plan",
            productId: "com.example.annual",
            familySharable: true,
            state: "APPROVED",
            subscriptionPeriod: "ONE_YEAR",
            reviewNote: "Annual subscription",
            groupLevel: 1,
          },
        },
      });

      const result = await getSubscription(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(result).toEqual({
        success: true,
        data: {
          id: "sub1",
          name: "Annual Plan",
          productId: "com.example.annual",
          familySharable: true,
          state: "APPROVED",
          subscriptionPeriod: "ONE_YEAR",
          reviewNote: "Annual subscription",
          groupLevel: 1,
        },
      });
      expect(mockClient.get).toHaveBeenCalledWith("/subscriptions/sub1");
    });

    it("should require subscriptionId", async () => {
      const result = await getSubscription(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // createSubscription
  // ============================================================================

  describe("createSubscription", () => {
    it("should create subscription with correct request body", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "newSub",
          type: "subscriptions",
          attributes: {
            name: "Monthly",
            productId: "com.example.monthly",
            subscriptionPeriod: "ONE_MONTH",
            state: "MISSING_METADATA",
          },
        },
      });

      const result = await createSubscription(
        mockClient as unknown as AppStoreConnectClient,
        {
          subscriptionGroupId: "group1",
          name: "Monthly",
          productId: "com.example.monthly",
          subscriptionPeriod: "ONE_MONTH",
          familySharable: false,
          groupLevel: 1,
        }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptions", {
        data: {
          type: "subscriptions",
          attributes: {
            name: "Monthly",
            productId: "com.example.monthly",
            subscriptionPeriod: "ONE_MONTH",
            familySharable: false,
            reviewNote: undefined,
            groupLevel: 1,
          },
          relationships: {
            group: {
              data: { type: "subscriptionGroups", id: "group1" },
            },
          },
        },
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "newSub",
          name: "Monthly",
          productId: "com.example.monthly",
          subscriptionPeriod: "ONE_MONTH",
          state: "MISSING_METADATA",
        },
      });
    });

    it("should require subscriptionGroupId, name, productId, and subscriptionPeriod", async () => {
      const result = await createSubscription(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionGroupId: "group1", name: "Monthly", productId: "com.example.monthly" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });

    it("should reject invalid subscriptionPeriod", async () => {
      const result = await createSubscription(
        mockClient as unknown as AppStoreConnectClient,
        {
          subscriptionGroupId: "group1",
          name: "Monthly",
          productId: "com.example.monthly",
          subscriptionPeriod: "TWO_YEARS",
        }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // updateSubscription
  // ============================================================================

  describe("updateSubscription", () => {
    it("should update subscription with provided fields", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "sub1",
          type: "subscriptions",
          attributes: {
            name: "Updated Monthly",
            productId: "com.example.monthly",
            subscriptionPeriod: "ONE_MONTH",
            state: "APPROVED",
            familySharable: true,
            groupLevel: 2,
          },
        },
      });

      const result = await updateSubscription(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1", name: "Updated Monthly", familySharable: true, groupLevel: 2 }
      );

      expect(mockClient.patch).toHaveBeenCalledWith(
        "/subscriptions/sub1",
        expect.objectContaining({
          data: {
            type: "subscriptions",
            id: "sub1",
            attributes: expect.objectContaining({
              name: "Updated Monthly",
              familySharable: true,
              groupLevel: 2,
            }),
          },
        })
      );

      expect(result).toEqual({
        success: true,
        data: {
          id: "sub1",
          name: "Updated Monthly",
          productId: "com.example.monthly",
          subscriptionPeriod: "ONE_MONTH",
          state: "APPROVED",
          familySharable: true,
          groupLevel: 2,
        },
      });
    });

    it("should require subscriptionId", async () => {
      const result = await updateSubscription(
        mockClient as unknown as AppStoreConnectClient,
        { name: "Updated" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // deleteSubscription
  // ============================================================================

  describe("deleteSubscription", () => {
    it("should delete subscription and return success", async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await deleteSubscription(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(mockClient.delete).toHaveBeenCalledWith("/subscriptions/sub1");
      expect(result).toEqual({ success: true });
    });

    it("should require subscriptionId", async () => {
      const result = await deleteSubscription(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // listSubscriptionLocalizations
  // ============================================================================

  describe("listSubscriptionLocalizations", () => {
    it("should return formatted localizations list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "loc1",
            type: "subscriptionLocalizations",
            attributes: {
              name: "Monthly Plan",
              locale: "en-US",
              description: "Billed monthly",
              state: "APPROVED",
            },
          },
          {
            id: "loc2",
            type: "subscriptionLocalizations",
            attributes: {
              name: "月額プラン",
              locale: "ja",
              description: "毎月請求",
              state: "APPROVED",
            },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listSubscriptionLocalizations(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          { id: "loc1", name: "Monthly Plan", locale: "en-US", description: "Billed monthly", state: "APPROVED" },
          { id: "loc2", name: "月額プラン", locale: "ja", description: "毎月請求", state: "APPROVED" },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should call correct endpoint", async () => {
      mockClient.get.mockResolvedValueOnce({ data: [], meta: { paging: { total: 0 } } });

      await listSubscriptionLocalizations(mockClient as unknown as AppStoreConnectClient, {
        subscriptionId: "sub1",
        limit: 5,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/subscriptions/sub1/subscriptionLocalizations",
        { limit: 5 }
      );
    });

    it("should require subscriptionId", async () => {
      const result = await listSubscriptionLocalizations(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // createSubscriptionLocalization
  // ============================================================================

  describe("createSubscriptionLocalization", () => {
    it("should create localization with correct request body", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "newLoc",
          type: "subscriptionLocalizations",
          attributes: {
            name: "Monthly Plan",
            locale: "en-US",
            description: "Billed monthly",
            state: "PREPARE_FOR_SUBMISSION",
          },
        },
      });

      const result = await createSubscriptionLocalization(
        mockClient as unknown as AppStoreConnectClient,
        {
          subscriptionId: "sub1",
          name: "Monthly Plan",
          locale: "en-US",
          description: "Billed monthly",
        }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionLocalizations", {
        data: {
          type: "subscriptionLocalizations",
          attributes: {
            name: "Monthly Plan",
            locale: "en-US",
            description: "Billed monthly",
          },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "sub1" } },
          },
        },
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "newLoc",
          name: "Monthly Plan",
          locale: "en-US",
          description: "Billed monthly",
          state: "PREPARE_FOR_SUBMISSION",
        },
      });
    });

    it("should require subscriptionId, name, and locale", async () => {
      const result = await createSubscriptionLocalization(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1", name: "Monthly Plan" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // updateSubscriptionLocalization
  // ============================================================================

  describe("updateSubscriptionLocalization", () => {
    it("should update localization with provided fields", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "loc1",
          type: "subscriptionLocalizations",
          attributes: {
            name: "Updated Plan",
            locale: "en-US",
            description: "New description",
            state: "APPROVED",
          },
        },
      });

      const result = await updateSubscriptionLocalization(
        mockClient as unknown as AppStoreConnectClient,
        { localizationId: "loc1", name: "Updated Plan", description: "New description" }
      );

      expect(mockClient.patch).toHaveBeenCalledWith(
        "/subscriptionLocalizations/loc1",
        expect.objectContaining({
          data: {
            type: "subscriptionLocalizations",
            id: "loc1",
            attributes: { name: "Updated Plan", description: "New description" },
          },
        })
      );

      expect(result).toEqual({
        success: true,
        data: {
          id: "loc1",
          name: "Updated Plan",
          locale: "en-US",
          description: "New description",
          state: "APPROVED",
        },
      });
    });

    it("should require localizationId", async () => {
      const result = await updateSubscriptionLocalization(
        mockClient as unknown as AppStoreConnectClient,
        { name: "Updated" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // deleteSubscriptionLocalization
  // ============================================================================

  describe("deleteSubscriptionLocalization", () => {
    it("should delete localization and return success", async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await deleteSubscriptionLocalization(
        mockClient as unknown as AppStoreConnectClient,
        { localizationId: "loc1" }
      );

      expect(mockClient.delete).toHaveBeenCalledWith("/subscriptionLocalizations/loc1");
      expect(result).toEqual({ success: true });
    });

    it("should require localizationId", async () => {
      const result = await deleteSubscriptionLocalization(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // listSubscriptionPricePoints
  // ============================================================================

  describe("listSubscriptionPricePoints", () => {
    it("should return formatted price points", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "pp1",
            type: "subscriptionPricePoints",
            attributes: { customerPrice: "0.99", proceeds: "0.69", proceedsYear2: "0.85" },
          },
          {
            id: "pp2",
            type: "subscriptionPricePoints",
            attributes: { customerPrice: "1.99", proceeds: "1.39", proceedsYear2: "1.69" },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listSubscriptionPricePoints(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          { id: "pp1", customerPrice: "0.99", proceeds: "0.69", proceedsYear2: "0.85" },
          { id: "pp2", customerPrice: "1.99", proceeds: "1.39", proceedsYear2: "1.69" },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should pass territory filter", async () => {
      mockClient.get.mockResolvedValueOnce({ data: [], meta: { paging: { total: 0 } } });

      await listSubscriptionPricePoints(mockClient as unknown as AppStoreConnectClient, {
        subscriptionId: "sub1",
        territory: "USA",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/subscriptions/sub1/pricePoints",
        expect.objectContaining({ "filter[territory]": "USA" })
      );
    });

    it("should not include territory filter when not provided", async () => {
      mockClient.get.mockResolvedValueOnce({ data: [], meta: { paging: { total: 0 } } });

      await listSubscriptionPricePoints(mockClient as unknown as AppStoreConnectClient, {
        subscriptionId: "sub1",
      });

      const callArgs = mockClient.get.mock.calls[0][1] as Record<string, unknown>;
      expect(callArgs).not.toHaveProperty("filter[territory]");
    });

    it("should require subscriptionId", async () => {
      const result = await listSubscriptionPricePoints(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });

    it("should reject invalid territory format", async () => {
      const result = await listSubscriptionPricePoints(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1", territory: "us" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // listSubscriptionPrices
  // ============================================================================

  describe("listSubscriptionPrices", () => {
    it("should return prices with resolved pricePoint and territory", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "sp1",
            type: "subscriptionPrices",
            attributes: { startDate: null },
            relationships: {
              subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp1" } },
              territory: { data: { type: "territories", id: "USA" } },
            },
          },
        ],
        included: [
          { id: "pp1", type: "subscriptionPricePoints", attributes: { customerPrice: "0.99", proceeds: "0.69" } },
          { id: "USA", type: "territories", attributes: { currency: "USD" } },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listSubscriptionPrices(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "sp1",
            startDate: null,
            pricePoint: { id: "pp1", customerPrice: "0.99", proceeds: "0.69" },
            territory: { id: "USA", currency: "USD" },
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should pass territory filter and include params", async () => {
      mockClient.get.mockResolvedValueOnce({ data: [], meta: { paging: { total: 0 } } });

      await listSubscriptionPrices(mockClient as unknown as AppStoreConnectClient, {
        subscriptionId: "sub1",
        territory: "GBR",
        limit: 10,
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/subscriptions/sub1/prices",
        expect.objectContaining({
          "filter[territory]": "GBR",
          limit: 10,
          include: "subscriptionPricePoint,territory",
        })
      );
    });

    it("should require subscriptionId", async () => {
      const result = await listSubscriptionPrices(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // getSubscriptionAvailability
  // ============================================================================

  describe("getSubscriptionAvailability", () => {
    it("should return availability with territory list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "avail1",
          type: "subscriptionAvailabilities",
          attributes: { availableInNewTerritories: true },
        },
        included: [
          { id: "USA", type: "territories", attributes: { currency: "USD" } },
          { id: "GBR", type: "territories", attributes: { currency: "GBP" } },
        ],
      });

      const result = await getSubscriptionAvailability(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        "/subscriptions/sub1/subscriptionAvailability",
        expect.objectContaining({ include: "availableTerritories" })
      );

      expect(result).toEqual({
        success: true,
        data: {
          id: "avail1",
          subscriptionId: "sub1",
          availableInNewTerritories: true,
          availableTerritories: [
            { id: "USA", currency: "USD" },
            { id: "GBR", currency: "GBP" },
          ],
        },
      });
    });

    it("should return empty territories when none included", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "avail2",
          type: "subscriptionAvailabilities",
          attributes: { availableInNewTerritories: false },
        },
        included: [],
      });

      const result = await getSubscriptionAvailability(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ availableTerritories: [] }),
      });
    });

    it("should require subscriptionId", async () => {
      const result = await getSubscriptionAvailability(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // setSubscriptionAvailability
  // ============================================================================

  describe("setSubscriptionAvailability", () => {
    it("should set availability with explicit territories", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "avail1",
          type: "subscriptionAvailabilities",
          attributes: { availableInNewTerritories: false },
        },
      });

      const result = await setSubscriptionAvailability(
        mockClient as unknown as AppStoreConnectClient,
        {
          subscriptionId: "sub1",
          availableInNewTerritories: false,
          territories: ["USA", "GBR", "BRA"],
        }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionAvailabilities", {
        data: {
          type: "subscriptionAvailabilities",
          attributes: { availableInNewTerritories: false },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "sub1" } },
            availableTerritories: {
              data: [
                { type: "territories", id: "USA" },
                { type: "territories", id: "GBR" },
                { type: "territories", id: "BRA" },
              ],
            },
          },
        },
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "avail1",
          subscriptionId: "sub1",
          availableInNewTerritories: false,
          territoriesCount: 3,
        },
      });
    });

    it("should set availability without territories list", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "avail2",
          type: "subscriptionAvailabilities",
          attributes: { availableInNewTerritories: true },
        },
      });

      const result = await setSubscriptionAvailability(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1", availableInNewTerritories: true }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionAvailabilities", {
        data: {
          type: "subscriptionAvailabilities",
          attributes: { availableInNewTerritories: true },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "sub1" } },
          },
        },
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "avail2",
          subscriptionId: "sub1",
          availableInNewTerritories: true,
          territoriesCount: 0,
        },
      });
    });

    it("should require subscriptionId and availableInNewTerritories", async () => {
      const result = await setSubscriptionAvailability(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });

    it("should reject invalid territory format", async () => {
      const result = await setSubscriptionAvailability(
        mockClient as unknown as AppStoreConnectClient,
        {
          subscriptionId: "sub1",
          availableInNewTerritories: false,
          territories: ["us"],
        }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // createSubscriptionPrice
  // ============================================================================

  describe("createSubscriptionPrice", () => {
    it("should create a price with startDate and preserveCurrentPrice", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "price1",
          type: "subscriptionPrices",
          attributes: { startDate: "2026-04-01", preserveCurrentPrice: true },
        },
      });

      const result = await createSubscriptionPrice(
        mockClient as unknown as AppStoreConnectClient,
        {
          subscriptionId: "sub1",
          subscriptionPricePointId: "pp1",
          startDate: "2026-04-01",
          preserveCurrentPrice: true,
        }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionPrices", {
        data: {
          type: "subscriptionPrices",
          attributes: { startDate: "2026-04-01", preserveCurrentPrice: true },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "sub1" } },
            subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp1" } },
          },
        },
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "price1",
          subscriptionId: "sub1",
          subscriptionPricePointId: "pp1",
          startDate: "2026-04-01",
          preserveCurrentPrice: true,
        },
      });
    });

    it("should default preserveCurrentPrice to false and startDate to null", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "price2",
          type: "subscriptionPrices",
          attributes: { startDate: null, preserveCurrentPrice: false },
        },
      });

      await createSubscriptionPrice(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1", subscriptionPricePointId: "pp1" }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionPrices", {
        data: {
          type: "subscriptionPrices",
          attributes: { startDate: null, preserveCurrentPrice: false },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "sub1" } },
            subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp1" } },
          },
        },
      });
    });

    it("should require subscriptionId and subscriptionPricePointId", async () => {
      const result = await createSubscriptionPrice(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    });
  });

  // ============================================================================
  // listPromotionalOffers
  // ============================================================================

  describe("listPromotionalOffers", () => {
    it("should return formatted promotional offers list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "po1",
            type: "subscriptionPromotionalOffers",
            attributes: { name: "Trial Offer", offerCode: "TRIAL2026", duration: "ONE_MONTH", offerMode: "FREE_TRIAL", periodCount: undefined },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listPromotionalOffers(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1" }
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        "/subscriptions/sub1/promotionalOffers",
        { limit: undefined }
      );
      expect(result).toEqual({
        success: true,
        data: [{ id: "po1", name: "Trial Offer", offerCode: "TRIAL2026", duration: "ONE_MONTH", offerMode: "FREE_TRIAL", periodCount: undefined }],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should require subscriptionId", async () => {
      const result = await listPromotionalOffers(mockClient as unknown as AppStoreConnectClient, {});
      expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) });
    });
  });

  // ============================================================================
  // createPromotionalOffer
  // ============================================================================

  describe("createPromotionalOffer", () => {
    it("should create a FREE_TRIAL offer with empty prices", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "po1",
          type: "subscriptionPromotionalOffers",
          attributes: { name: "Trial", offerCode: "FREETRIAL", duration: "ONE_MONTH", offerMode: "FREE_TRIAL", periodCount: undefined },
        },
      });

      const result = await createPromotionalOffer(
        mockClient as unknown as AppStoreConnectClient,
        {
          subscriptionId: "sub1",
          name: "Trial",
          offerCode: "FREETRIAL",
          duration: "ONE_MONTH",
          offerMode: "FREE_TRIAL",
        }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionPromotionalOffers", {
        data: {
          type: "subscriptionPromotionalOffers",
          attributes: { name: "Trial", offerCode: "FREETRIAL", duration: "ONE_MONTH", offerMode: "FREE_TRIAL", periodCount: undefined },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "sub1" } },
            prices: { data: [] },
          },
        },
      });

      expect(result).toEqual({
        success: true,
        data: { id: "po1", name: "Trial", offerCode: "FREETRIAL", duration: "ONE_MONTH", offerMode: "FREE_TRIAL", periodCount: undefined },
      });
    });

    it("should create a PAY_AS_YOU_GO offer with price includes", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "po2",
          type: "subscriptionPromotionalOffers",
          attributes: { name: "Discount", offerCode: "HALF", duration: "THREE_MONTHS", offerMode: "PAY_AS_YOU_GO", periodCount: 3 },
        },
      });

      await createPromotionalOffer(
        mockClient as unknown as AppStoreConnectClient,
        {
          subscriptionId: "sub1",
          name: "Discount",
          offerCode: "HALF",
          duration: "THREE_MONTHS",
          offerMode: "PAY_AS_YOU_GO",
          periodCount: 3,
          prices: [{ territory: "USA", pricePointId: "pp1" }],
        }
      );

      expect(mockClient.post).toHaveBeenCalledWith("/subscriptionPromotionalOffers", {
        data: {
          type: "subscriptionPromotionalOffers",
          attributes: { name: "Discount", offerCode: "HALF", duration: "THREE_MONTHS", offerMode: "PAY_AS_YOU_GO", numberOfPeriods: 3 },
          relationships: {
            subscription: { data: { type: "subscriptions", id: "sub1" } },
            prices: { data: [{ type: "subscriptionPromotionalOfferPrices", id: "${USA-promo}" }] },
          },
        },
        included: [
          {
            type: "subscriptionPromotionalOfferPrices",
            id: "${USA-promo}",
            attributes: {},
            relationships: {
              subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp1" } },
              territory: { data: { type: "territories", id: "USA" } },
            },
          },
        ],
      });
    });

    it("should require subscriptionId, name, offerCode, duration, and offerMode", async () => {
      const result = await createPromotionalOffer(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1", name: "Trial", offerCode: "X", duration: "ONE_MONTH" }
      );
      expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) });
    });

    it("should reject invalid offerMode", async () => {
      const result = await createPromotionalOffer(
        mockClient as unknown as AppStoreConnectClient,
        { subscriptionId: "sub1", name: "Trial", offerCode: "X", duration: "ONE_MONTH", offerMode: "GIFT" }
      );
      expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) });
    });
  });

  // ============================================================================
  // updatePromotionalOffer
  // ============================================================================

  describe("updatePromotionalOffer", () => {
    it("should update offer attributes", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "po1",
          type: "subscriptionPromotionalOffers",
          attributes: { name: "New Name", offerCode: "NEW", duration: "ONE_WEEK", offerMode: "FREE_TRIAL", periodCount: undefined },
        },
      });

      const result = await updatePromotionalOffer(
        mockClient as unknown as AppStoreConnectClient,
        { promotionalOfferId: "po1", name: "New Name", offerCode: "NEW", duration: "ONE_WEEK" }
      );

      expect(mockClient.patch).toHaveBeenCalledWith(
        "/subscriptionPromotionalOffers/po1",
        expect.objectContaining({
          data: expect.objectContaining({
            type: "subscriptionPromotionalOffers",
            id: "po1",
            attributes: expect.objectContaining({ name: "New Name", offerCode: "NEW", duration: "ONE_WEEK" }),
          }),
        })
      );

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ id: "po1", name: "New Name" }),
      });
    });

    it("should include prices in request when provided", async () => {
      mockClient.patch.mockResolvedValueOnce({
        data: {
          id: "po1",
          type: "subscriptionPromotionalOffers",
          attributes: { name: "Offer", offerCode: "X", duration: "ONE_MONTH", offerMode: "PAY_AS_YOU_GO", periodCount: 1 },
        },
      });

      await updatePromotionalOffer(
        mockClient as unknown as AppStoreConnectClient,
        { promotionalOfferId: "po1", prices: [{ territory: "GBR", pricePointId: "pp2" }] }
      );

      const callArg = mockClient.patch.mock.calls[0][1] as Record<string, unknown>;
      expect(callArg).toHaveProperty("included");
      expect((callArg.data as Record<string, unknown>)).toHaveProperty("relationships");
    });

    it("should require promotionalOfferId", async () => {
      const result = await updatePromotionalOffer(mockClient as unknown as AppStoreConnectClient, {});
      expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) });
    });
  });

  // ============================================================================
  // deletePromotionalOffer
  // ============================================================================

  describe("deletePromotionalOffer", () => {
    it("should delete offer and return success", async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await deletePromotionalOffer(
        mockClient as unknown as AppStoreConnectClient,
        { promotionalOfferId: "po1" }
      );

      expect(mockClient.delete).toHaveBeenCalledWith("/subscriptionPromotionalOffers/po1");
      expect(result).toEqual({ success: true });
    });

    it("should require promotionalOfferId", async () => {
      const result = await deletePromotionalOffer(mockClient as unknown as AppStoreConnectClient, {});
      expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) });
    });
  });

  // ============================================================================
  // listPromotionalOfferPrices
  // ============================================================================

  describe("listPromotionalOfferPrices", () => {
    it("should return prices with resolved price point and territory", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "pop1",
            type: "subscriptionPromotionalOfferPrices",
            attributes: {},
            relationships: {
              subscriptionPricePoint: { data: { type: "subscriptionPricePoints", id: "pp1" } },
              territory: { data: { type: "territories", id: "USA" } },
            },
          },
        ],
        included: [
          { id: "pp1", type: "subscriptionPricePoints", attributes: { customerPrice: "0.49", proceeds: "0.34" } },
          { id: "USA", type: "territories", attributes: { currency: "USD" } },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listPromotionalOfferPrices(
        mockClient as unknown as AppStoreConnectClient,
        { promotionalOfferId: "po1" }
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        "/subscriptionPromotionalOffers/po1/prices",
        expect.objectContaining({ include: "subscriptionPricePoint,territory" })
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "pop1",
            pricePoint: { id: "pp1", customerPrice: "0.49", proceeds: "0.34" },
            territory: { id: "USA", currency: "USD" },
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should require promotionalOfferId", async () => {
      const result = await listPromotionalOfferPrices(mockClient as unknown as AppStoreConnectClient, {});
      expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) });
    });
  });
});
