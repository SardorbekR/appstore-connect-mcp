/**
 * Tests for analytics tool handlers
 */

import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  createAnalyticsReportRequest,
  deleteAnalyticsReportRequest,
  downloadAnalyticsReportSegment,
  getAnalyticsReportRequest,
  listAnalyticsReportInstances,
  listAnalyticsReportRequests,
  listAnalyticsReportSegments,
  listAnalyticsReports,
} from "../src/tools/analytics.tools.js";

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

describe("Analytics Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("createAnalyticsReportRequest", () => {
    it("should create a report request and return formatted data", async () => {
      mockClient.post.mockResolvedValueOnce({
        data: {
          id: "REQ123",
          type: "analyticsReportRequests",
          attributes: {
            accessType: "ONGOING",
            stoppedDueToInactivity: false,
          },
        },
      });

      const result = await createAnalyticsReportRequest(
        mockClient as unknown as AppStoreConnectClient,
        { appId: "123456", accessType: "ONGOING" }
      );

      expect(result).toEqual({
        success: true,
        data: {
          id: "REQ123",
          accessType: "ONGOING",
          stoppedDueToInactivity: false,
        },
      });

      expect(mockClient.post).toHaveBeenCalledWith("/analyticsReportRequests", {
        data: {
          type: "analyticsReportRequests",
          attributes: {
            accessType: "ONGOING",
          },
          relationships: {
            app: {
              data: {
                type: "apps",
                id: "123456",
              },
            },
          },
        },
      });
    });

    it("should return validation error when appId is missing", async () => {
      const result = await createAnalyticsReportRequest(
        mockClient as unknown as AppStoreConnectClient,
        { accessType: "ONGOING" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should return validation error when accessType is missing", async () => {
      const result = await createAnalyticsReportRequest(
        mockClient as unknown as AppStoreConnectClient,
        { appId: "123456" }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  describe("listAnalyticsReportRequests", () => {
    it("should return formatted report request list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "REQ001",
            type: "analyticsReportRequests",
            attributes: {
              accessType: "ONGOING",
              stoppedDueToInactivity: false,
            },
          },
          {
            id: "REQ002",
            type: "analyticsReportRequests",
            attributes: {
              accessType: "ONE_TIME_SNAPSHOT",
              stoppedDueToInactivity: true,
            },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listAnalyticsReportRequests(
        mockClient as unknown as AppStoreConnectClient,
        { appId: "123456" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "REQ001",
            accessType: "ONGOING",
            stoppedDueToInactivity: false,
          },
          {
            id: "REQ002",
            accessType: "ONE_TIME_SNAPSHOT",
            stoppedDueToInactivity: true,
          },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should pass correct URL and limit parameter", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listAnalyticsReportRequests(
        mockClient as unknown as AppStoreConnectClient,
        { appId: "123456", limit: 50 }
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        "/apps/123456/analyticsReportRequests",
        expect.objectContaining({ limit: 50 })
      );
    });

    it("should require appId parameter", async () => {
      const result = await listAnalyticsReportRequests(
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

  describe("getAnalyticsReportRequest", () => {
    it("should return formatted report request details", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: {
          id: "REQ456",
          type: "analyticsReportRequests",
          attributes: {
            accessType: "ONE_TIME_SNAPSHOT",
            stoppedDueToInactivity: false,
          },
        },
      });

      const result = await getAnalyticsReportRequest(
        mockClient as unknown as AppStoreConnectClient,
        { requestId: "REQ456" }
      );

      expect(result).toEqual({
        success: true,
        data: {
          id: "REQ456",
          accessType: "ONE_TIME_SNAPSHOT",
          stoppedDueToInactivity: false,
        },
      });

      expect(mockClient.get).toHaveBeenCalledWith("/analyticsReportRequests/REQ456");
    });

    it("should require requestId parameter", async () => {
      const result = await getAnalyticsReportRequest(
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

  describe("deleteAnalyticsReportRequest", () => {
    it("should delete report request and return success message", async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await deleteAnalyticsReportRequest(
        mockClient as unknown as AppStoreConnectClient,
        { requestId: "REQ789" }
      );

      expect(result).toEqual({
        success: true,
        message: "Analytics report request REQ789 has been deleted.",
      });

      expect(mockClient.delete).toHaveBeenCalledWith("/analyticsReportRequests/REQ789");
    });

    it("should require requestId parameter", async () => {
      const result = await deleteAnalyticsReportRequest(
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

  describe("listAnalyticsReports", () => {
    it("should return formatted report list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "RPT001",
            type: "analyticsReports",
            attributes: {
              category: "APP_USAGE",
              name: "App Sessions",
            },
          },
          {
            id: "RPT002",
            type: "analyticsReports",
            attributes: {
              category: "COMMERCE",
              name: "App Store Commerce",
            },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listAnalyticsReports(
        mockClient as unknown as AppStoreConnectClient,
        { requestId: "REQ001" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          { id: "RPT001", category: "APP_USAGE", name: "App Sessions" },
          { id: "RPT002", category: "COMMERCE", name: "App Store Commerce" },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should pass category filter", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listAnalyticsReports(mockClient as unknown as AppStoreConnectClient, {
        requestId: "REQ001",
        category: "PERFORMANCE",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/analyticsReportRequests/REQ001/reports",
        expect.objectContaining({
          "filter[category]": "PERFORMANCE",
        })
      );
    });

    it("should use correct URL with requestId", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listAnalyticsReports(mockClient as unknown as AppStoreConnectClient, {
        requestId: "REQ999",
      });

      expect(mockClient.get).toHaveBeenCalledWith(
        "/analyticsReportRequests/REQ999/reports",
        expect.any(Object)
      );
    });

    it("should require requestId parameter", async () => {
      const result = await listAnalyticsReports(
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

  describe("listAnalyticsReportInstances", () => {
    it("should return formatted instance list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "INST001",
            type: "analyticsReportInstances",
            attributes: {
              granularity: "DAILY",
              processingDate: "2024-01-15",
            },
          },
          {
            id: "INST002",
            type: "analyticsReportInstances",
            attributes: {
              granularity: "WEEKLY",
              processingDate: "2024-01-08",
            },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listAnalyticsReportInstances(
        mockClient as unknown as AppStoreConnectClient,
        { reportId: "RPT001" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          { id: "INST001", granularity: "DAILY", processingDate: "2024-01-15" },
          { id: "INST002", granularity: "WEEKLY", processingDate: "2024-01-08" },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should pass granularity filter", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listAnalyticsReportInstances(
        mockClient as unknown as AppStoreConnectClient,
        { reportId: "RPT001", granularity: "MONTHLY" }
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        "/analyticsReports/RPT001/instances",
        expect.objectContaining({
          "filter[granularity]": "MONTHLY",
        })
      );
    });

    it("should pass processingDate filter", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listAnalyticsReportInstances(
        mockClient as unknown as AppStoreConnectClient,
        { reportId: "RPT001", processingDate: "2024-01-15" }
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        "/analyticsReports/RPT001/instances",
        expect.objectContaining({
          "filter[processingDate]": "2024-01-15",
        })
      );
    });

    it("should use correct URL with reportId", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listAnalyticsReportInstances(
        mockClient as unknown as AppStoreConnectClient,
        { reportId: "RPT555" }
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        "/analyticsReports/RPT555/instances",
        expect.any(Object)
      );
    });

    it("should require reportId parameter", async () => {
      const result = await listAnalyticsReportInstances(
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

  describe("listAnalyticsReportSegments", () => {
    it("should return formatted segment list", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [
          {
            id: "SEG001",
            type: "analyticsReportSegments",
            attributes: {
              checksum: "abc123def456",
              sizeInBytes: 1024,
              url: "https://example.com/segment1.tsv.gz",
            },
          },
          {
            id: "SEG002",
            type: "analyticsReportSegments",
            attributes: {
              checksum: "789ghi012jkl",
              sizeInBytes: 2048,
              url: "https://example.com/segment2.tsv.gz",
            },
          },
        ],
        meta: { paging: { total: 2 } },
      });

      const result = await listAnalyticsReportSegments(
        mockClient as unknown as AppStoreConnectClient,
        { instanceId: "INST001" }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: "SEG001",
            checksum: "abc123def456",
            sizeInBytes: 1024,
            url: "https://example.com/segment1.tsv.gz",
          },
          {
            id: "SEG002",
            checksum: "789ghi012jkl",
            sizeInBytes: 2048,
            url: "https://example.com/segment2.tsv.gz",
          },
        ],
        meta: { total: 2, returned: 2 },
      });
    });

    it("should pass limit and use correct URL", async () => {
      mockClient.get.mockResolvedValueOnce({
        data: [],
        meta: { paging: { total: 0 } },
      });

      await listAnalyticsReportSegments(
        mockClient as unknown as AppStoreConnectClient,
        { instanceId: "INST001", limit: 10 }
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        "/analyticsReportInstances/INST001/segments",
        expect.objectContaining({ limit: 10 })
      );
    });

    it("should require instanceId parameter", async () => {
      const result = await listAnalyticsReportSegments(
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

  describe("downloadAnalyticsReportSegment", () => {
    it("should download, decompress, and parse TSV data", async () => {
      const tsvContent = "Date\tMetric\tValue\n2024-01-15\tSessions\t1500\n2024-01-16\tSessions\t1600";
      const gzippedBuffer = gzipSync(Buffer.from(tsvContent));

      mockClient.rawRequest.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(gzippedBuffer.buffer.slice(
          gzippedBuffer.byteOffset,
          gzippedBuffer.byteOffset + gzippedBuffer.byteLength
        )),
      });

      const result = await downloadAnalyticsReportSegment(
        mockClient as unknown as AppStoreConnectClient,
        { url: "https://example.com/segment.tsv.gz" }
      );

      expect(result).toEqual({
        success: true,
        data: {
          headers: ["Date", "Metric", "Value"],
          rows: [
            { Date: "2024-01-15", Metric: "Sessions", Value: "1500" },
            { Date: "2024-01-16", Metric: "Sessions", Value: "1600" },
          ],
          totalRows: 2,
          truncated: false,
        },
      });

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "https://example.com/segment.tsv.gz",
        { method: "GET" }
      );
    });

    it("should truncate rows when exceeding maxRows", async () => {
      const lines = ["Col1\tCol2"];
      for (let i = 0; i < 10; i++) {
        lines.push(`row${i}\tval${i}`);
      }
      const tsvContent = lines.join("\n");
      const gzippedBuffer = gzipSync(Buffer.from(tsvContent));

      mockClient.rawRequest.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(gzippedBuffer.buffer.slice(
          gzippedBuffer.byteOffset,
          gzippedBuffer.byteOffset + gzippedBuffer.byteLength
        )),
      });

      const result = (await downloadAnalyticsReportSegment(
        mockClient as unknown as AppStoreConnectClient,
        { url: "https://example.com/segment.tsv.gz", maxRows: 3 }
      )) as { success: boolean; data: { headers: string[]; rows: Record<string, string>[]; totalRows: number; truncated: boolean } };

      expect(result.success).toBe(true);
      expect(result.data.totalRows).toBe(10);
      expect(result.data.truncated).toBe(true);
      expect(result.data.rows).toHaveLength(3);
      expect(result.data.rows[0]).toEqual({ Col1: "row0", Col2: "val0" });
      expect(result.data.rows[2]).toEqual({ Col1: "row2", Col2: "val2" });
    });

    it("should return validation error when url is missing", async () => {
      const result = await downloadAnalyticsReportSegment(
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

    it("should handle HTTP error response", async () => {
      mockClient.rawRequest.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await downloadAnalyticsReportSegment(
        mockClient as unknown as AppStoreConnectClient,
        { url: "https://example.com/missing.tsv.gz" }
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: "DOWNLOAD_ERROR",
          message: "Failed to download report segment: HTTP 404 Not Found",
        },
      });
    });

    it("should handle empty buffer", async () => {
      const emptyBuffer = Buffer.alloc(0);

      mockClient.rawRequest.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(emptyBuffer.buffer),
      });

      const result = await downloadAnalyticsReportSegment(
        mockClient as unknown as AppStoreConnectClient,
        { url: "https://example.com/empty.tsv.gz" }
      );

      expect(result).toEqual({
        success: true,
        data: {
          headers: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        },
      });
    });

    it("should default maxRows to 100 when not specified", async () => {
      const lines = ["Header"];
      for (let i = 0; i < 150; i++) {
        lines.push(`row${i}`);
      }
      const tsvContent = lines.join("\n");
      const gzippedBuffer = gzipSync(Buffer.from(tsvContent));

      mockClient.rawRequest.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(gzippedBuffer.buffer.slice(
          gzippedBuffer.byteOffset,
          gzippedBuffer.byteOffset + gzippedBuffer.byteLength
        )),
      });

      const result = (await downloadAnalyticsReportSegment(
        mockClient as unknown as AppStoreConnectClient,
        { url: "https://example.com/large.tsv.gz" }
      )) as { success: boolean; data: { rows: Record<string, string>[]; totalRows: number; truncated: boolean } };

      expect(result.success).toBe(true);
      expect(result.data.totalRows).toBe(150);
      expect(result.data.truncated).toBe(true);
      expect(result.data.rows).toHaveLength(100);
    });
  });
});
