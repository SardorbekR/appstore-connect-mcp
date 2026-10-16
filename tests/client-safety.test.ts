/**
 * Client write-safety guards: read-only mode and no blind retry of POST.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStoreConnectClient } from "../src/api/client.js";
import type { TokenManager } from "../src/auth/jwt.js";

const getToken = vi.fn();
const tokenManager = { getToken, destroy: vi.fn() } as unknown as TokenManager;
const mockFetch = vi.fn();
global.fetch = mockFetch;

function serverError() {
  return { ok: false, status: 500, json: async () => ({ errors: [] }) };
}

describe("client write safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getToken.mockResolvedValue("mock-token");
  });

  describe("read-only mode", () => {
    const client = new AppStoreConnectClient(tokenManager, undefined, { readOnly: true });

    it("refuses POST, PATCH and DELETE before signing a token or calling fetch", async () => {
      await expect(client.post("/apps", { data: {} })).rejects.toMatchObject({ code: "READ_ONLY" });
      await expect(client.patch("/apps/1", { data: {} })).rejects.toMatchObject({
        code: "READ_ONLY",
      });
      await expect(client.delete("/apps/1")).rejects.toMatchObject({ code: "READ_ONLY" });
      expect(getToken).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("refuses non-GET raw requests such as upload chunk PUTs", async () => {
      await expect(
        client.rawRequest("https://upload.example.com/x", { method: "PUT", body: "x" })
      ).rejects.toMatchObject({ code: "READ_ONLY" });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("still allows GET", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [] }) });
      await expect(client.get("/apps")).resolves.toEqual({ data: [] });
    });
  });

  describe("retries", () => {
    const client = new AppStoreConnectClient(tokenManager);

    it("does not retry a POST after a server error, which may have been applied", async () => {
      mockFetch.mockResolvedValue(serverError());
      await expect(client.post("/reviewSubmissions", { data: {} })).rejects.toMatchObject({
        status: 500,
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("still retries a PATCH after a server error", async () => {
      mockFetch.mockResolvedValueOnce(serverError());
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: {} }) });
      await expect(client.patch("/apps/1", { data: {} })).resolves.toEqual({ data: {} });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
