/**
 * Tests for customer review tools (list and read reviews, developer responses)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createReviewResponse,
  customerReviewsToolsModule,
  deleteReviewResponse,
  getCustomerReview,
  getReviewResponse,
  listCustomerReviews,
} from "../src/tools/customer-reviews.tools.js";
import { expectContract } from "./helpers/contract.js";

const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;
const asClient = (client: MockClient) => client as unknown as AppStoreConnectClient;

const review = {
  type: "customerReviews",
  id: "r1",
  attributes: {
    rating: 2,
    title: "Crashes",
    body: "Quits on launch",
    reviewerNickname: "Ada",
    createdDate: "2026-09-30T08:00:00Z",
    territory: "USA",
  },
  relationships: { response: { data: { type: "customerReviewResponses", id: "resp1" } } },
};

const reviewResponse = {
  type: "customerReviewResponses",
  id: "resp1",
  attributes: {
    responseBody: "Thanks for the feedback!",
    state: "PUBLISHED",
    lastModifiedDate: "2026-10-01T10:00:00Z",
  },
};

describe("customer review tools", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("list_customer_reviews", () => {
    it("sends the filters and attaches each review's response from included", async () => {
      client.get.mockResolvedValueOnce({
        data: [review],
        included: [reviewResponse],
        meta: { paging: { total: 1, limit: 50 } },
      });

      const result = await listCustomerReviews(asClient(client), {
        appId: "1",
        rating: 2,
        territory: "USA",
        hasResponse: true,
      });

      expect(client.get).toHaveBeenCalledWith("/apps/1/customerReviews", {
        "filter[rating]": "2",
        "filter[territory]": "USA",
        "exists[publishedResponse]": true,
        sort: "-createdDate",
        include: "response",
      });
      expect(result).toMatchObject({
        success: true,
        data: [{ id: "r1", rating: 2, response: { id: "resp1", state: "PUBLISHED" } }],
        meta: { total: 1, returned: 1 },
      });
      expectContract(client);
    });
  });

  describe("get_customer_review", () => {
    it("reads one review with its response included", async () => {
      client.get.mockResolvedValueOnce({ data: review, included: [reviewResponse] });

      const result = await getCustomerReview(asClient(client), { reviewId: "r1" });

      expect(client.get).toHaveBeenCalledWith("/customerReviews/r1", { include: "response" });
      expect(result).toMatchObject({
        success: true,
        data: { id: "r1", response: { id: "resp1", responseBody: "Thanks for the feedback!" } },
      });
      expectContract(client);
    });
  });

  describe("get_review_response", () => {
    it("returns null when the review has no response", async () => {
      client.get.mockResolvedValueOnce({ data: null });

      const result = await getReviewResponse(asClient(client), { reviewId: "r1" });

      expect(client.get).toHaveBeenCalledWith("/customerReviews/r1/response");
      expect(result).toEqual({ success: true, data: null });
      expectContract(client);
    });
  });

  describe("create_review_response", () => {
    it("posts the response linked to the review", async () => {
      client.post.mockResolvedValueOnce({ data: reviewResponse });

      const result = await createReviewResponse(asClient(client), {
        reviewId: "r1",
        responseBody: "Thanks for the feedback!",
      });

      expect(client.post).toHaveBeenCalledWith("/customerReviewResponses", {
        data: {
          type: "customerReviewResponses",
          attributes: { responseBody: "Thanks for the feedback!" },
          relationships: { review: { data: { type: "customerReviews", id: "r1" } } },
        },
      });
      expect(result).toMatchObject({ success: true, data: { id: "resp1", state: "PUBLISHED" } });
      expectContract(client);
    });

    it("refuses an empty or whitespace-only response", async () => {
      const result = await createReviewResponse(asClient(client), {
        reviewId: "r1",
        responseBody: "   ",
      });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).not.toHaveBeenCalled();
    });

    it("refuses a response longer than 5970 characters", async () => {
      const result = await createReviewResponse(asClient(client), {
        reviewId: "r1",
        responseBody: "x".repeat(5971),
      });

      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.post).not.toHaveBeenCalled();
    });
  });

  describe("delete_review_response", () => {
    it("deletes the response by ID", async () => {
      client.delete.mockResolvedValueOnce(undefined);

      const result = await deleteReviewResponse(asClient(client), { responseId: "resp1" });

      expect(client.delete).toHaveBeenCalledWith("/customerReviewResponses/resp1");
      expect(result).toMatchObject({ success: true, data: { deleted: true } });
      expectContract(client);
    });

    it("is annotated destructive so clients confirm before removing a public reply", () => {
      const definition = customerReviewsToolsModule.definitions.find(
        (tool) => tool.name === "delete_review_response"
      );

      expect(definition?.annotations).toMatchObject({ destructiveHint: true });
    });
  });
});
