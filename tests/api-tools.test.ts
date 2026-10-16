/**
 * Generic API tools: asc_api_request / asc_api_search / asc_api_describe.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import { apiDescribe, apiRequest, apiSearch } from "../src/tools/api.tools.js";

const ORIGIN = "https://api.appstoreconnect.apple.com";

const createMockClient = (readOnly = false) => ({
  readOnly,
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  requestRaw: vi.fn(),
});

type MockClient = ReturnType<typeof createMockClient>;

function call(client: MockClient, input: unknown) {
  return apiRequest(client as unknown as AppStoreConnectClient, input) as Promise<
    Record<string, unknown>
  >;
}

describe("asc_api_request", () => {
  let client: MockClient;

  beforeEach(() => {
    client = createMockClient();
  });

  describe("path safety", () => {
    it.each([
      ["/apps", "start with /v1/"],
      ["https://api.appstoreconnect.apple.com/v1/apps", "start with /v1/"],
      ["/v1/apps/../users", "'.' or '..'"],
      ["/v1/apps/%2e%2e", "disallowed character"],
      ["/v1/apps?limit=1", "query parameters in `query`"],
      ["/v1/apps//builds", "empty segment"],
      ["/v1/apps/{id}", "real ID"],
    ])("rejects %s", async (path, message) => {
      const result = await call(client, { path });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(JSON.stringify(result)).toContain(message);
      expect(client.get).not.toHaveBeenCalled();
    });

    it("rejects a cursor on another host", async () => {
      const result = await call(client, { cursor: "https://evil.example.com/v1/apps?cursor=x" });
      expect(result).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
      expect(client.get).not.toHaveBeenCalled();
    });
  });

  describe("validation against the spec index", () => {
    it("suggests the nearest operations for an unknown path", async () => {
      const result = await call(client, { path: "/v1/app/123/versions" });
      expect(JSON.stringify(result)).toContain("/v1/apps/{id}/appStoreVersions");
    });

    it("explains a method the path does not support", async () => {
      const result = await call(client, { method: "POST", path: "/v1/apps/123" });
      expect(JSON.stringify(result)).toContain("Supported methods: GET, PATCH");
    });

    it("rejects undeclared query parameters and invalid enum values", async () => {
      const unknown = await call(client, {
        path: "/v1/apps/1/appStoreVersions",
        query: { "filter[platforms]": "IOS" },
      });
      expect(JSON.stringify(unknown)).toContain("Unknown query parameter 'filter[platforms]'");
      const badEnum = await call(client, {
        path: "/v1/apps/1/appStoreVersions",
        query: { "filter[platform]": ["IOS", "ANDROID"] },
      });
      expect(JSON.stringify(badEnum)).toContain("ANDROID");
      expect(client.get).not.toHaveBeenCalled();
    });

    it("rejects unknown body attributes and a data.id that differs from the path", async () => {
      const unknown = await call(client, {
        method: "PATCH",
        path: "/v1/appStoreVersions/1",
        body: { data: { type: "appStoreVersions", id: "1", attributes: { copyrightText: "x" } } },
      });
      expect(JSON.stringify(unknown)).toContain("Unknown attribute 'copyrightText'");
      const mismatch = await call(client, {
        method: "PATCH",
        path: "/v1/appStoreVersions/1",
        body: { data: { type: "appStoreVersions", id: "2", attributes: { copyright: "x" } } },
      });
      expect(JSON.stringify(mismatch)).toContain("must match the path ID");
      expect(client.patch).not.toHaveBeenCalled();
    });

    it("sends a valid write with its query string", async () => {
      client.patch.mockResolvedValueOnce({ data: { type: "appStoreVersions", id: "1" } });
      const result = await call(client, {
        method: "PATCH",
        path: "/v1/appStoreVersions/1",
        body: { data: { type: "appStoreVersions", id: "1", attributes: { copyright: "2026 Me" } } },
      });
      expect(result).toMatchObject({ success: true, operation: "PATCH /v1/appStoreVersions/{id}" });
      expect(client.patch).toHaveBeenCalledWith("/v1/appStoreVersions/1", {
        data: { type: "appStoreVersions", id: "1", attributes: { copyright: "2026 Me" } },
      });
    });

    it("lets allowUnknown reach an operation missing from the spec, still enforcing path rules", async () => {
      client.get.mockResolvedValueOnce({ data: [] });
      const result = await call(client, { path: "/v1/notInSpec/1", allowUnknown: true });
      expect(result).toMatchObject({ success: true });
      const unsafe = await call(client, { path: "/v1/../x", allowUnknown: true });
      expect(unsafe).toMatchObject({ success: false });
    });
  });

  describe("response media types", () => {
    it("refuses file downloads and names the typed tool", async () => {
      const result = await call(client, {
        path: "/v1/salesReports",
        query: {
          "filter[vendorNumber]": "1",
          "filter[reportType]": "SALES",
          "filter[reportSubType]": "SUMMARY",
          "filter[frequency]": "DAILY",
        },
      });
      expect(JSON.stringify(result)).toContain("get_sales_report");
      expect(client.get).not.toHaveBeenCalled();
    });

    it("fetches vendor JSON with its Accept header", async () => {
      client.requestRaw.mockResolvedValueOnce({ text: async () => '{"productData":[]}' });
      const result = await call(client, { path: "/v1/apps/1/performanceOverviews" });
      expect(client.requestRaw).toHaveBeenCalledWith("/v1/apps/1/performanceOverviews", {
        params: {},
        headers: { Accept: "application/vnd.apple.xcode-overview+json" },
      });
      expect(result).toMatchObject({ success: true, response: { productData: [] } });
    });
  });

  it("refuses writes in read-only mode before calling the API", async () => {
    const readOnlyClient = createMockClient(true);
    const result = await call(readOnlyClient, {
      method: "DELETE",
      path: "/v1/appStoreVersions/1",
    });
    expect(result).toMatchObject({ success: false, error: { code: "READ_ONLY" } });
    expect(readOnlyClient.delete).not.toHaveBeenCalled();
  });

  describe("pagination and size cap", () => {
    const PAGE_SIZE = 5;
    const PAGES = 6;
    let previousCap: string | undefined;

    // Six pages of five resources, each resource ~200 characters when serialized
    function page(index: number) {
      const data = Array.from({ length: PAGE_SIZE }, (_, item) => ({
        type: "apps",
        id: `app-${index * PAGE_SIZE + item}`,
        attributes: { name: "x".repeat(120) },
      }));
      const next =
        index + 1 < PAGES ? `${ORIGIN}/v1/apps?cursor=${index + 1}&limit=${PAGE_SIZE}` : undefined;
      return {
        data,
        links: { self: "", ...(next ? { next } : {}) },
        meta: { paging: { total: 30 } },
      };
    }

    beforeEach(() => {
      previousCap = process.env.ASC_MAX_RESPONSE_CHARS;
      client.get.mockImplementation(async (_path: string, query: Record<string, string>) =>
        page(Number(query.cursor ?? 0))
      );
    });

    afterEach(() => {
      if (previousCap === undefined) Reflect.deleteProperty(process.env, "ASC_MAX_RESPONSE_CHARS");
      else process.env.ASC_MAX_RESPONSE_CHARS = previousCap;
    });

    it("collects every page when the result fits", async () => {
      const result = await call(client, { path: "/v1/apps", paginate: true, query: { limit: 5 } });
      const pagination = result.pagination as Record<string, unknown>;
      expect(pagination).toMatchObject({ pages: 6, returned: 30, truncated: false });
    });

    it("stops at a page boundary under the size cap and resumes without losing or repeating records", async () => {
      process.env.ASC_MAX_RESPONSE_CHARS = "5000";
      const ids: string[] = [];
      let input: Record<string, unknown> = {
        path: "/v1/apps",
        paginate: true,
        query: { limit: 5 },
      };

      let rounds = 0;
      for (let round = 0; round < 10; round++) {
        rounds++;
        const result = await call(client, input);
        expect(JSON.stringify(result, null, 2).length).toBeLessThanOrEqual(5000);
        const response = result.response as { data: Array<{ id: string }> };
        ids.push(...response.data.map((resource) => resource.id));
        const pagination = result.pagination as { truncated: boolean; cursor?: string };
        if (!pagination.truncated) break;
        expect(pagination.cursor).toMatch(
          /^https:\/\/api\.appstoreconnect\.apple\.com\/v1\/apps\?/
        );
        input = { cursor: pagination.cursor, paginate: true };
      }

      expect(rounds).toBeGreaterThan(1);
      expect(ids).toEqual(Array.from({ length: 30 }, (_, index) => `app-${index}`));
    });

    it("summarizes instead of returning a first page that is too large on its own", async () => {
      process.env.ASC_MAX_RESPONSE_CHARS = "5000";
      client.get.mockReset();
      client.get.mockResolvedValueOnce({
        data: Array.from({ length: 40 }, (_, item) => ({
          type: "apps",
          id: `big-${item}`,
          attributes: { name: "y".repeat(200) },
        })),
      });
      const result = await call(client, { path: "/v1/apps", paginate: true });
      expect(result).toMatchObject({ success: true, tooLarge: true, count: 40 });
      expect(JSON.stringify(result, null, 2).length).toBeLessThanOrEqual(5000);
    });

    it("stops at maxItems with a cursor to the next page", async () => {
      const result = await call(client, {
        path: "/v1/apps",
        paginate: true,
        maxItems: 10,
        query: { limit: 5 },
      });
      expect(result.pagination).toMatchObject({ pages: 2, returned: 10, truncated: true });
      expect((result.pagination as { cursor: string }).cursor).toContain("cursor=2");
    });

    it("stops when a next link repeats", async () => {
      client.get.mockReset();
      client.get.mockResolvedValue({
        data: [{ type: "apps", id: "1" }],
        links: { next: `${ORIGIN}/v1/apps?cursor=same` },
      });
      const result = await call(client, { path: "/v1/apps", paginate: true });
      expect(client.get).toHaveBeenCalledTimes(2);
      expect(result.pagination).toMatchObject({ truncated: true, stopReason: "repeatedNextLink" });
    });

    it("flags a first page larger than maxItems when the operation has no limit parameter", async () => {
      client.get.mockReset();
      client.get.mockResolvedValueOnce({
        data: [
          { type: "appAssetLibraryRefData", id: "r1" },
          { type: "appAssetLibraryRefData", id: "r2" },
        ],
      });
      const result = await call(client, {
        path: "/v1/appAssetLibraryRefData",
        paginate: true,
        maxItems: 1,
      });
      expect(result.pagination).toMatchObject({ returned: 2, maxItemsExceeded: true });
    });

    it("clamps an explicit page limit so the first page cannot exceed maxItems", async () => {
      await call(client, { path: "/v1/apps", paginate: true, maxItems: 3, query: { limit: 50 } });
      expect(client.get.mock.calls[0]?.[1]).toMatchObject({ limit: "3" });
    });
  });

  it("refuses file downloads even with allowUnknown", async () => {
    const result = await call(client, { path: "/v1/salesReports", allowUnknown: true });
    expect(JSON.stringify(result)).toContain("get_sales_report");
    expect(client.get).not.toHaveBeenCalled();
  });

  describe("secrets", () => {
    it("masks webhook signing secrets in responses", async () => {
      client.post.mockResolvedValueOnce({
        data: { type: "webhooks", id: "w1", attributes: { name: "hook", secret: "whsec_123" } },
      });
      const result = await call(client, {
        method: "POST",
        path: "/v1/webhooks",
        allowUnknown: true,
        body: { data: { type: "webhooks", attributes: { secret: "whsec_123" } } },
      });
      expect(JSON.stringify(result)).not.toContain("whsec_123");
    });

    it("masks demo account passwords in responses", async () => {
      client.get.mockResolvedValueOnce({
        data: {
          type: "appStoreReviewDetails",
          id: "rd1",
          attributes: { demoAccountName: "demo", demoAccountPassword: "s3cret-demo" },
        },
      });
      const result = await call(client, { path: "/v1/appStoreVersions/1/appStoreReviewDetail" });
      expect(JSON.stringify(result)).not.toContain("s3cret-demo");
      expect(JSON.stringify(result)).toContain("demoAccountName");
    });

    it("redacts a supplied password that the API echoes in an error", async () => {
      const { ASCError } = await import("../src/utils/errors.js");
      client.patch.mockRejectedValueOnce(
        new ASCError("demoAccountPassword 'abc' is invalid", "API_ERROR", 409, [{ detail: "abc" }])
      );
      const result = await call(client, {
        method: "PATCH",
        path: "/v1/appStoreReviewDetails/rd1",
        body: {
          data: {
            type: "appStoreReviewDetails",
            id: "rd1",
            attributes: { demoAccountPassword: "abc" },
          },
        },
      });
      expect(result).toMatchObject({ success: false });
      expect(JSON.stringify(result)).not.toContain("abc");
    });
  });
});

describe("asc_api_search and asc_api_describe", () => {
  const client = createMockClient() as unknown as AppStoreConnectClient;

  it("finds operations by keyword", async () => {
    const result = (await apiSearch(client, { query: "phased release", method: "POST" })) as {
      data: Array<{ path: string }>;
    };
    expect(result.data.map((operation) => operation.path)).toContain(
      "/v1/appStoreVersionPhasedReleases"
    );
  });

  it("describes an operation with a minimal body template", async () => {
    const result = (await apiDescribe(client, {
      method: "POST",
      path: "/v1/appStoreVersionPhasedReleases",
    })) as { data: { minimalBody: unknown } };
    expect(result.data.minimalBody).toEqual({
      data: {
        type: "appStoreVersionPhasedReleases",
        relationships: {
          appStoreVersion: { data: { type: "appStoreVersions", id: "<id>" } },
        },
      },
    });
  });
});
