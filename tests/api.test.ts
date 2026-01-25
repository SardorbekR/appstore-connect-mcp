/**
 * Tests for API client module
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppStoreConnectClient } from "../src/api/client.js";
import type { TokenManager } from "../src/auth/jwt.js";
import { ASCError, RateLimitError } from "../src/utils/errors.js";

// Mock TokenManager
const mockTokenManager = {
  getToken: vi.fn().mockResolvedValue("mock-token"),
  destroy: vi.fn(),
} as unknown as TokenManager;

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AppStoreConnectClient", () => {
  let client: AppStoreConnectClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AppStoreConnectClient(mockTokenManager);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("get", () => {
    it("should make GET request with authorization header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      await client.get("/apps");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/apps"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        })
      );
    });

    it("should append query parameters to URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      await client.get("/apps", { limit: 50, "fields[apps]": "name,bundleId" });

      expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/limit=50/), expect.anything());
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/fields%5Bapps%5D=name%2CbundleId/),
        expect.anything()
      );
    });

    it("should parse JSON response", async () => {
      const mockData = {
        data: [{ id: "123", type: "apps", attributes: { name: "Test App" } }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const result = await client.get("/apps");
      expect(result).toEqual(mockData);
    });
  });

  describe("post", () => {
    it("should make POST request with JSON body", async () => {
      const requestBody = {
        data: {
          type: "appStoreVersions",
          attributes: { versionString: "1.0.0" },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: "456" } }),
      });

      await client.post("/appStoreVersions", requestBody);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/appStoreVersions"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(requestBody),
        })
      );
    });
  });

  describe("patch", () => {
    it("should make PATCH request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "123" } }),
      });

      await client.patch("/appStoreVersions/123", { data: {} });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/appStoreVersions/123"),
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });
  });

  describe("delete", () => {
    it("should make DELETE request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      });

      await client.delete("/appStoreVersionLocalizations/123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/appStoreVersionLocalizations/123"),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should handle 204 No Content response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await client.delete("/resource/123");
      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should throw ASCError for 4xx responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          errors: [{ code: "NOT_FOUND", title: "Not Found", detail: "App not found" }],
        }),
      });

      await expect(client.get("/apps/invalid")).rejects.toThrow(ASCError);
    });

    it("should throw RateLimitError for 429 responses", async () => {
      // Mock implementation that throws immediately on 429
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => "1" }, // 1 second retry
        json: async () => ({ errors: [] }),
      });

      // The client will retry with rate limits, but since all calls return 429,
      // it will eventually exhaust retries and throw
      await expect(client.get("/apps")).rejects.toThrow(RateLimitError);
    }, 15000); // Increase timeout for retries

    it("should throw ASCError for 401 responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          errors: [{ code: "AUTHENTICATION_ERROR", title: "Unauthorized" }],
        }),
      });

      await expect(client.get("/apps")).rejects.toThrow(ASCError);
    });
  });

  describe("retry logic", () => {
    it("should retry on 5xx errors", async () => {
      // First call fails with 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ errors: [] }),
      });

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      const result = await client.get("/apps");
      expect(result).toEqual({ data: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry on 4xx errors (except 429)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          errors: [{ code: "INVALID_REQUEST", title: "Bad Request" }],
        }),
      });

      await expect(client.get("/apps")).rejects.toThrow(ASCError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("paginate", () => {
    it("should yield items from all pages", async () => {
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "1" }, { id: "2" }],
          links: { self: "/apps", next: "/apps?cursor=abc" },
        }),
      });

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "3" }],
          links: { self: "/apps?cursor=abc" },
        }),
      });

      const items: unknown[] = [];
      for await (const item of client.paginate("/apps")) {
        items.push(item);
      }

      expect(items).toHaveLength(3);
      expect(items.map((i) => (i as { id: string }).id)).toEqual(["1", "2", "3"]);
    });

    it("should respect maxItems limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "1" }, { id: "2" }, { id: "3" }],
          links: { self: "/apps", next: "/apps?cursor=abc" },
        }),
      });

      const items: unknown[] = [];
      for await (const item of client.paginate("/apps", undefined, 2)) {
        items.push(item);
      }

      expect(items).toHaveLength(2);
    });
  });
});
