/**
 * Tests for review submission tools (create, items, submit, cancel)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  addReviewSubmissionItem,
  cancelReviewSubmission,
  createReviewSubmission,
  getReviewSubmission,
  listReviewSubmissions,
  removeReviewSubmissionItem,
  reviewSubmissionsToolsModule,
  submitReviewSubmission,
} from "../src/tools/review-submissions.tools.js";
import { ASCError } from "../src/utils/errors.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const submission = {
  type: "reviewSubmissions",
  id: "rs1",
  attributes: { platform: "MAC_OS", state: "READY_FOR_REVIEW" },
};

const item = (id: string) => ({
  type: "reviewSubmissionItems",
  id,
  attributes: { state: "READY_FOR_REVIEW" },
  relationships: {
    appStoreVersion: { data: { type: "appStoreVersions", id: "v1" } },
    inAppPurchaseVersion: { data: null },
  },
});

describe("review submission tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("list_review_submissions", () => {
    it("lists submissions for an app with comma-joined filters", async () => {
      client.get.mockResolvedValueOnce({
        data: [submission],
        meta: { paging: { total: 1, limit: 20 } },
      });

      const result = await listReviewSubmissions(asClient(client), {
        appId: "app1",
        state: ["WAITING_FOR_REVIEW", "IN_REVIEW"],
        platform: ["MAC_OS"],
        limit: 20,
      });

      expect(client.get).toHaveBeenCalledWith("/reviewSubmissions", {
        "filter[app]": "app1",
        "filter[state]": "WAITING_FOR_REVIEW,IN_REVIEW",
        "filter[platform]": "MAC_OS",
        limit: 20,
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "rs1", state: "READY_FOR_REVIEW" }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });
  });

  describe("get_review_submission", () => {
    it("returns the submission with its items and linked resource IDs", async () => {
      client.get
        .mockResolvedValueOnce({ data: submission })
        .mockResolvedValueOnce({ data: [item("i1")], meta: { paging: { total: 1, limit: 200 } } });

      const result = await getReviewSubmission(asClient(client), { submissionId: "rs1" });

      expect(client.get).toHaveBeenCalledWith("/reviewSubmissions/rs1");
      expect(client.get).toHaveBeenCalledWith("/reviewSubmissions/rs1/items", {
        "fields[reviewSubmissionItems]":
          "state,appStoreVersion,appCustomProductPageVersion,appStoreVersionExperiment,appStoreVersionExperimentV2,appEvent,appAssetLibraryImage,appAssetLibraryVideo,backgroundAssetVersion,gameCenterAchievementVersion,gameCenterActivityVersion,gameCenterChallengeVersion,gameCenterLeaderboardSetVersion,gameCenterLeaderboardVersion,inAppPurchaseVersion,subscriptionVersion,subscriptionGroupVersion",
        include:
          "appStoreVersion,appCustomProductPageVersion,appStoreVersionExperiment,appStoreVersionExperimentV2,appEvent,appAssetLibraryImage,appAssetLibraryVideo,backgroundAssetVersion,gameCenterAchievementVersion,gameCenterActivityVersion,gameCenterChallengeVersion,gameCenterLeaderboardSetVersion,gameCenterLeaderboardVersion,inAppPurchaseVersion,subscriptionVersion,subscriptionGroupVersion",
        limit: 200,
      });
      expect(result).toMatchObject({
        success: true,
        data: {
          id: "rs1",
          items: [
            {
              id: "i1",
              state: "READY_FOR_REVIEW",
              relationshipIds: { appStoreVersion: "v1" },
            },
          ],
        },
      });
      expectContract(client);
    });
  });

  describe("create_review_submission", () => {
    it("creates a submission for the app and platform", async () => {
      client.post.mockResolvedValueOnce({ data: submission });

      const result = await createReviewSubmission(asClient(client), {
        appId: "app1",
        platform: "MAC_OS",
      });

      expect(client.post).toHaveBeenCalledWith("/reviewSubmissions", {
        data: {
          type: "reviewSubmissions",
          attributes: { platform: "MAC_OS" },
          relationships: { app: { data: { type: "apps", id: "app1" } } },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "rs1", platform: "MAC_OS" } });
      expectContract(client);
    });
  });

  describe("add_review_submission_item", () => {
    it("links the item through the relationship named by itemType", async () => {
      client.post.mockResolvedValueOnce({
        data: {
          type: "reviewSubmissionItems",
          id: "i1",
          attributes: { state: "READY_FOR_REVIEW" },
        },
      });

      const result = await addReviewSubmissionItem(asClient(client), {
        submissionId: "rs1",
        itemType: "appStoreVersion",
        itemId: "v1",
      });

      expect(client.post).toHaveBeenCalledWith("/reviewSubmissionItems", {
        data: {
          type: "reviewSubmissionItems",
          relationships: {
            reviewSubmission: { data: { type: "reviewSubmissions", id: "rs1" } },
            appStoreVersion: { data: { type: "appStoreVersions", id: "v1" } },
          },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "i1" } });
      expectContract(client);
    });

    it("reports the conflicting submission when Apple's 409 message names it", async () => {
      client.post.mockRejectedValueOnce(
        new ASCError("The item is already in reviewSubmission with id rs-9", "CONFLICT", 409)
      );

      const result = await addReviewSubmissionItem(asClient(client), {
        submissionId: "rs1",
        itemType: "appStoreVersion",
        itemId: "v1",
      });

      expect(result).toMatchObject({
        success: false,
        error: { code: "CONFLICT", conflictingSubmissionId: "rs-9" },
      });
    });

    it("reports a conflicting submission ID that Apple wraps in quotes", async () => {
      client.post.mockRejectedValueOnce(
        new ASCError(
          "Item was already added to another reviewSubmission with id 'rs-9'",
          "CONFLICT",
          409
        )
      );

      const result = await addReviewSubmissionItem(asClient(client), {
        submissionId: "rs1",
        itemType: "appStoreVersion",
        itemId: "v1",
      });

      expect(result).toMatchObject({ error: { conflictingSubmissionId: "rs-9" } });
    });

    it("finds the conflicting submission in the error details when the message does not name it", async () => {
      client.post.mockRejectedValueOnce(
        new ASCError("Conflict with current state", "CONFLICT", 409, [
          { detail: "Item belongs to reviewSubmission rs-9" },
        ])
      );

      const result = await addReviewSubmissionItem(asClient(client), {
        submissionId: "rs1",
        itemType: "appStoreVersion",
        itemId: "v1",
      });

      expect(result).toMatchObject({
        success: false,
        error: { code: "CONFLICT", conflictingSubmissionId: "rs-9" },
      });
    });
  });

  describe("remove_review_submission_item", () => {
    it("deletes the item", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await removeReviewSubmissionItem(asClient(client), { itemId: "i1" });

      expect(client.delete).toHaveBeenCalledWith("/reviewSubmissionItems/i1");
      expect(result).toMatchObject({ success: true, data: { deleted: true, itemId: "i1" } });
      expectContract(client);
    });

    it("rejects an ID that could change the request path", async () => {
      const result = await removeReviewSubmissionItem(asClient(client), { itemId: "../apps/1" });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.delete).not.toHaveBeenCalled();
    });
  });

  describe("submit_review_submission", () => {
    it("submits when the listed items exactly match expectedItemIds", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          { type: "reviewSubmissionItems", id: "i1" },
          { type: "reviewSubmissionItems", id: "i2" },
        ],
      });
      client.patch.mockResolvedValueOnce({
        data: { type: "reviewSubmissions", id: "rs1", attributes: { state: "WAITING_FOR_REVIEW" } },
      });

      const result = await submitReviewSubmission(asClient(client), {
        submissionId: "rs1",
        expectedItemIds: ["i2", "i1"],
      });

      expect(client.get).toHaveBeenCalledWith("/reviewSubmissions/rs1/items", { limit: 200 });
      expect(client.patch).toHaveBeenCalledWith("/reviewSubmissions/rs1", {
        data: { type: "reviewSubmissions", id: "rs1", attributes: { submitted: true } },
      });
      expect(result).toMatchObject({ success: true, data: { state: "WAITING_FOR_REVIEW" } });
      expectContract(client);
    });

    it("refuses on extra or missing items and never removes or submits", async () => {
      client.get.mockResolvedValueOnce({
        data: [
          { type: "reviewSubmissionItems", id: "i1" },
          { type: "reviewSubmissionItems", id: "i2" },
          { type: "reviewSubmissionItems", id: "i3" },
        ],
      });

      const result = await submitReviewSubmission(asClient(client), {
        submissionId: "rs1",
        expectedItemIds: ["i1", "i4"],
      });

      expect(result).toMatchObject({
        success: false,
        error: { code: "ITEMS_MISMATCH", extraItemIds: ["i2", "i3"], missingItemIds: ["i4"] },
      });
      expect(client.patch).not.toHaveBeenCalled();
      expect(client.delete).not.toHaveBeenCalled();
    });

    it("refuses when the item list is incomplete, since the exact set cannot be proven", async () => {
      client.get.mockResolvedValueOnce({
        data: [{ type: "reviewSubmissionItems", id: "i1" }],
        links: {
          self: "https://api.appstoreconnect.apple.com/v1/reviewSubmissions/rs1/items",
          next: "https://api.appstoreconnect.apple.com/v1/reviewSubmissions/rs1/items?cursor=abc",
        },
      });

      const result = await submitReviewSubmission(asClient(client), {
        submissionId: "rs1",
        expectedItemIds: ["i1"],
      });

      expect(result).toMatchObject({ success: false, error: { code: "ITEMS_MISMATCH" } });
      expect(client.patch).not.toHaveBeenCalled();
    });
  });

  describe("cancel_review_submission", () => {
    it("treats a CANCELING response as a successful cancel", async () => {
      client.patch.mockResolvedValueOnce({
        data: { type: "reviewSubmissions", id: "rs1", attributes: { state: "CANCELING" } },
      });

      const result = await cancelReviewSubmission(asClient(client), { submissionId: "rs1" });

      expect(client.patch).toHaveBeenCalledWith("/reviewSubmissions/rs1", {
        data: { type: "reviewSubmissions", id: "rs1", attributes: { canceled: true } },
      });
      expect(result).toMatchObject({ success: true, data: { state: "CANCELING" } });
      expectContract(client);
    });

    it("does not report success when Apple still shows the submission as open", async () => {
      client.patch.mockResolvedValueOnce({
        data: { type: "reviewSubmissions", id: "rs1", attributes: { state: "WAITING_FOR_REVIEW" } },
      });

      const result = await cancelReviewSubmission(asClient(client), { submissionId: "rs1" });

      expect(result).toMatchObject({ success: false, error: { code: "CANCEL_NOT_CONFIRMED" } });
    });
  });

  describe("safety annotations", () => {
    it("marks submit and cancel as destructive", () => {
      const annotationsOf = (name: string) =>
        reviewSubmissionsToolsModule.definitions.find((definition) => definition.name === name)
          ?.annotations;

      expect(annotationsOf("submit_review_submission")).toMatchObject({ destructiveHint: true });
      expect(annotationsOf("cancel_review_submission")).toMatchObject({ destructiveHint: true });
    });
  });
});
