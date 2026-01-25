/**
 * Tests for device tool handlers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import { getDevice, listDevices } from "../src/tools/devices.tools.js";

// Create mock client
const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
});

describe("Device Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("listDevices", () => {
    it("should return formatted device list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "DEVICE123",
            type: "devices",
            attributes: {
              name: "John's iPhone",
              platform: "IOS",
              udid: "00000000-0000000000000001",
              deviceClass: "IPHONE",
              status: "ENABLED",
              model: "iPhone 14 Pro",
              addedDate: "2024-01-15T10:00:00Z",
            },
          },
        ],
        meta: { paging: { total: 1 } },
      });

      const result = await listDevices(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "DEVICE123",
            name: "John's iPhone",
            platform: "IOS",
            udid: "00000000-0000000000000001",
            deviceClass: "IPHONE",
            status: "ENABLED",
            model: "iPhone 14 Pro",
            addedDate: "2024-01-15T10:00:00Z",
          },
        ],
        meta: { total: 1, returned: 1 },
      });
    });

    it("should pass filter parameters", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listDevices(mockClient as unknown as AppStoreConnectClient, {
        limit: 50,
        platform: "IOS",
        status: "ENABLED",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/devices",
        expect.objectContaining({
          limit: 50,
          "filter[platform]": "IOS",
          "filter[status]": "ENABLED",
        })
      );
    });

    it("should handle validation errors for invalid limit", async () => {
      const result = await listDevices(mockClient as unknown as AppStoreConnectClient, {
        limit: 999,
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("getDevice", () => {
    it("should return formatted device details", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "DEVICE123",
          type: "devices",
          attributes: {
            name: "John's iPad",
            platform: "IOS",
            udid: "00000000-0000000000000002",
            deviceClass: "IPAD",
            status: "ENABLED",
            model: "iPad Pro 12.9",
            addedDate: "2024-01-10T08:00:00Z",
          },
        },
      });

      const result = await getDevice(mockClient as unknown as AppStoreConnectClient, {
        deviceId: "DEVICE123",
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: "DEVICE123",
          name: "John's iPad",
          platform: "IOS",
          udid: "00000000-0000000000000002",
          deviceClass: "IPAD",
          status: "ENABLED",
          model: "iPad Pro 12.9",
          addedDate: "2024-01-10T08:00:00Z",
        },
      });
    });

    it("should require deviceId parameter", async () => {
      const result = await getDevice(mockClient as unknown as AppStoreConnectClient, {});

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });
});
