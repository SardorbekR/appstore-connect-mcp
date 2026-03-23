/**
 * Tests for performance/diagnostics tool handlers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  getAppPerfMetrics,
  getBuildPerfMetrics,
  listDiagnosticLogs,
  listDiagnosticSignatures,
} from "../src/tools/performance.tools.js";

// Create mock client
const createMockClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  paginate: vi.fn(),
  rawRequest: vi.fn(),
  requestRaw: vi.fn(),
});

const XCODE_METRICS_ACCEPT = "application/vnd.apple.xcode-metrics+json,application/json";

describe("Performance Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("getAppPerfMetrics", () => {
    it("should return flattened metrics data", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          productData: [
            {
              metricCategories: [
                {
                  identifier: "launch",
                  metrics: [
                    {
                      identifier: "launchTime",
                      unit: { identifier: "ms", displayName: "Milliseconds" },
                      datasets: [
                        {
                          filterCriteria: {
                            percentile: "p50",
                            device: "iPhone14,5",
                            deviceMarketingName: "iPhone 14",
                          },
                          points: [{ version: "1.0", value: 350 }],
                        },
                      ],
                    },
                  ],
                },
              ],
              platform: "iOS",
              appVersion: "1.0",
            },
          ],
        }),
      });

      const result = await getAppPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
        metricType: "LAUNCH",
      });

      expect(result).toEqual({
        success: true,
        data: {
          platform: "iOS",
          appVersion: "1.0",
          metrics: [
            {
              categoryIdentifier: "launch",
              metricIdentifier: "launchTime",
              unit: { identifier: "ms", displayName: "Milliseconds" },
              datasets: [
                {
                  percentile: "p50",
                  device: "iPhone14,5",
                  deviceMarketingName: "iPhone 14",
                  points: [{ version: "1.0", value: 350 }],
                },
              ],
            },
          ],
        },
        meta: { productDataCount: 1 },
      });
    });

    it("should send the Xcode metrics Accept header", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ productData: [] }),
      });

      await getAppPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
        metricType: "LAUNCH",
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith(
        "/apps/123456/perfPowerMetrics",
        expect.objectContaining({
          headers: { Accept: XCODE_METRICS_ACCEPT },
        })
      );
    });

    it("should pass filter params correctly", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ productData: [] }),
      });

      await getAppPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        appId: "999888",
        metricType: "MEMORY",
        platform: "IOS",
        deviceType: "iPhone14,5",
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith(
        "/apps/999888/perfPowerMetrics",
        expect.objectContaining({
          params: {
            "filter[metricType]": "MEMORY",
            "filter[platform]": "IOS",
            "filter[deviceType]": "iPhone14,5",
          },
        })
      );
    });

    it("should return validation error when appId is missing", async () => {
      const result = await getAppPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        metricType: "LAUNCH",
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should return validation error when metricType is missing", async () => {
      const result = await getAppPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should handle empty productData", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ productData: [] }),
      });

      const result = await getAppPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        appId: "123456",
        metricType: "HANG",
      });

      expect(result).toEqual({
        success: true,
        data: {
          platform: "",
          appVersion: "",
          metrics: [],
        },
        meta: { productDataCount: 0 },
      });
    });
  });

  describe("getBuildPerfMetrics", () => {
    it("should return flattened metrics data for a build", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          productData: [
            {
              metricCategories: [
                {
                  identifier: "battery",
                  metrics: [
                    {
                      identifier: "batteryDrain",
                      unit: { identifier: "percent", displayName: "Percent" },
                      datasets: [
                        {
                          filterCriteria: {
                            percentile: "p90",
                            device: "iPhone15,2",
                            deviceMarketingName: "iPhone 14 Pro",
                          },
                          points: [{ version: "2.1", value: 4.5 }],
                        },
                      ],
                    },
                  ],
                },
              ],
              platform: "iOS",
              appVersion: "2.1",
            },
          ],
        }),
      });

      const result = await getBuildPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        buildId: "BUILD789",
        metricType: "BATTERY",
      });

      expect(result).toEqual({
        success: true,
        data: {
          platform: "iOS",
          appVersion: "2.1",
          metrics: [
            {
              categoryIdentifier: "battery",
              metricIdentifier: "batteryDrain",
              unit: { identifier: "percent", displayName: "Percent" },
              datasets: [
                {
                  percentile: "p90",
                  device: "iPhone15,2",
                  deviceMarketingName: "iPhone 14 Pro",
                  points: [{ version: "2.1", value: 4.5 }],
                },
              ],
            },
          ],
        },
        meta: { productDataCount: 1 },
      });
    });

    it("should use the build-scoped URL", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ productData: [] }),
      });

      await getBuildPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        buildId: "BUILD789",
        metricType: "DISK",
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith(
        "/builds/BUILD789/perfPowerMetrics",
        expect.objectContaining({
          headers: { Accept: XCODE_METRICS_ACCEPT },
        })
      );
    });

    it("should pass filter params correctly", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ productData: [] }),
      });

      await getBuildPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        buildId: "BUILD789",
        metricType: "ANIMATION",
        platform: "MAC_OS",
        deviceType: "Mac14,2",
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith(
        "/builds/BUILD789/perfPowerMetrics",
        expect.objectContaining({
          params: {
            "filter[metricType]": "ANIMATION",
            "filter[platform]": "MAC_OS",
            "filter[deviceType]": "Mac14,2",
          },
        })
      );
    });

    it("should return validation error when buildId is missing", async () => {
      const result = await getBuildPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        metricType: "LAUNCH",
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should return validation error when metricType is missing", async () => {
      const result = await getBuildPerfMetrics(mockClient as unknown as AppStoreConnectClient, {
        buildId: "BUILD789",
      });

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("listDiagnosticSignatures", () => {
    it("should return formatted diagnostic signatures", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "SIG001",
              type: "diagnosticSignatures",
              attributes: {
                diagnosticType: "DISK_WRITES",
                signature: "CoreData+SQLite.saveContext()",
                weight: 85.5,
              },
            },
            {
              id: "SIG002",
              type: "diagnosticSignatures",
              attributes: {
                diagnosticType: "HANGS",
                signature: "UIKit.layoutSubviews()",
                weight: 42.3,
              },
            },
          ],
          meta: { paging: { total: 2 } },
        }),
      });

      const result = await listDiagnosticSignatures(
        mockClient as unknown as AppStoreConnectClient,
        { buildId: "BUILD123" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "SIG001",
            diagnosticType: "DISK_WRITES",
            signature: "CoreData+SQLite.saveContext()",
            weight: 85.5,
          },
          {
            id: "SIG002",
            diagnosticType: "HANGS",
            signature: "UIKit.layoutSubviews()",
            weight: 42.3,
          },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should use the build-scoped diagnosticSignatures URL", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          meta: { paging: { total: 0 } },
        }),
      });

      await listDiagnosticSignatures(mockClient as unknown as AppStoreConnectClient, {
        buildId: "BUILD123",
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith(
        "/builds/BUILD123/diagnosticSignatures",
        expect.objectContaining({
          headers: { Accept: XCODE_METRICS_ACCEPT },
        })
      );
    });

    it("should pass diagnosticType filter", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          meta: { paging: { total: 0 } },
        }),
      });

      await listDiagnosticSignatures(mockClient as unknown as AppStoreConnectClient, {
        buildId: "BUILD123",
        diagnosticType: "HANGS",
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith(
        "/builds/BUILD123/diagnosticSignatures",
        expect.objectContaining({
          params: expect.objectContaining({
            "filter[diagnosticType]": "HANGS",
          }),
        })
      );
    });

    it("should pass limit parameter", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          meta: { paging: { total: 0 } },
        }),
      });

      await listDiagnosticSignatures(mockClient as unknown as AppStoreConnectClient, {
        buildId: "BUILD123",
        limit: 50,
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith(
        "/builds/BUILD123/diagnosticSignatures",
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 50,
          }),
        })
      );
    });

    it("should return validation error when buildId is missing", async () => {
      const result = await listDiagnosticSignatures(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("listDiagnosticLogs", () => {
    it("should return formatted diagnostic logs", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "LOG001",
              type: "diagnosticLogs",
              attributes: {
                diagnosticType: "DISK_WRITES",
              },
            },
            {
              id: "LOG002",
              type: "diagnosticLogs",
              attributes: {
                diagnosticType: "DISK_WRITES",
              },
            },
          ],
          meta: { paging: { total: 2 } },
        }),
      });

      const result = await listDiagnosticLogs(mockClient as unknown as AppStoreConnectClient, {
        signatureId: "SIG001",
      });

      expect(result).toEqual({
        success: true,
        data: [
          { id: "LOG001", diagnosticType: "DISK_WRITES" },
          { id: "LOG002", diagnosticType: "DISK_WRITES" },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should send the Xcode metrics Accept header", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          meta: { paging: { total: 0 } },
        }),
      });

      await listDiagnosticLogs(mockClient as unknown as AppStoreConnectClient, {
        signatureId: "SIG001",
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith(
        "/diagnosticSignatures/SIG001/logs",
        expect.objectContaining({
          headers: { Accept: XCODE_METRICS_ACCEPT },
        })
      );
    });

    it("should pass limit parameter", async () => {
      mockClient.requestRaw.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
          meta: { paging: { total: 0 } },
        }),
      });

      await listDiagnosticLogs(mockClient as unknown as AppStoreConnectClient, {
        signatureId: "SIG001",
        limit: 25,
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith(
        "/diagnosticSignatures/SIG001/logs",
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 25,
          }),
        })
      );
    });

    it("should return validation error when signatureId is missing", async () => {
      const result = await listDiagnosticLogs(
        mockClient as unknown as AppStoreConnectClient,
        {}
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });
});
