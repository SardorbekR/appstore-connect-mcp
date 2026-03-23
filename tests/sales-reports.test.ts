/**
 * Tests for sales & finance report tool handlers
 */

import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppStoreConnectClient } from "../src/api/client.js";
import {
  getFinanceReport,
  getSalesReport,
} from "../src/tools/sales-reports.tools.js";

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

/**
 * Helper: create a mock Response returning gzip-compressed TSV content
 */
function mockGzipResponse(tsvContent: string) {
  const gzipped = gzipSync(Buffer.from(tsvContent));
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () =>
      gzipped.buffer.slice(
        gzipped.byteOffset,
        gzipped.byteOffset + gzipped.byteLength
      ),
  };
}

describe("Sales & Finance Report Tools", () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  // ==========================================================================
  // getSalesReport
  // ==========================================================================
  describe("getSalesReport", () => {
    it("should return parsed TSV data from gzip response", async () => {
      const tsvContent =
        "Provider\tProvider Country\tSKU\tUnits\n" +
        "123\tUS\tSKU001\t50\n" +
        "123\tGB\tSKU002\t25";

      mockClient.requestRaw.mockResolvedValueOnce(mockGzipResponse(tsvContent));

      const result = await getSalesReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "88888888",
          reportType: "SALES",
          reportSubType: "SUMMARY",
          frequency: "DAILY",
          reportDate: "2024-01-15",
        }
      );

      expect(result).toEqual({
        success: true,
        data: [
          { Provider: "123", "Provider Country": "US", SKU: "SKU001", Units: "50" },
          { Provider: "123", "Provider Country": "GB", SKU: "SKU002", Units: "25" },
        ],
        meta: {
          headers: ["Provider", "Provider Country", "SKU", "Units"],
          totalRows: 2,
          returned: 2,
          truncated: false,
          reportType: "SALES",
          reportSubType: "SUMMARY",
          frequency: "DAILY",
          reportDate: "2024-01-15",
        },
      });
    });

    it("should send correct query parameters", async () => {
      const tsvContent = "Header1\n";
      mockClient.requestRaw.mockResolvedValueOnce(mockGzipResponse(tsvContent));

      await getSalesReport(mockClient as unknown as AppStoreConnectClient, {
        vendorNumber: "88888888",
        reportType: "SUBSCRIPTION",
        reportSubType: "SUMMARY",
        frequency: "DAILY",
        reportDate: "2024-03-01",
        reportVersion: "1_3",
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith("/salesReports", {
        params: {
          "filter[vendorNumber]": "88888888",
          "filter[reportType]": "SUBSCRIPTION",
          "filter[reportSubType]": "SUMMARY",
          "filter[frequency]": "DAILY",
          "filter[reportDate]": "2024-03-01",
          "filter[version]": "1_3",
        },
      });
    });

    it("should not include filter[version] when reportVersion is omitted", async () => {
      const tsvContent = "Header1\n";
      mockClient.requestRaw.mockResolvedValueOnce(mockGzipResponse(tsvContent));

      await getSalesReport(mockClient as unknown as AppStoreConnectClient, {
        vendorNumber: "88888888",
        reportType: "SALES",
        reportSubType: "SUMMARY",
        frequency: "DAILY",
        reportDate: "2024-01-15",
      });

      const calledParams = mockClient.requestRaw.mock.calls[0][1].params;
      expect(calledParams).not.toHaveProperty("filter[version]");
    });

    it("should truncate rows when maxRows is specified", async () => {
      // Build TSV with 5 data rows
      const headerRow = "Col1\tCol2";
      const dataRows = Array.from(
        { length: 5 },
        (_, i) => `val${i + 1}\tdata${i + 1}`
      );
      const tsvContent = [headerRow, ...dataRows].join("\n");

      mockClient.requestRaw.mockResolvedValueOnce(mockGzipResponse(tsvContent));

      const result = (await getSalesReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "88888888",
          reportType: "SALES",
          reportSubType: "SUMMARY",
          frequency: "DAILY",
          reportDate: "2024-01-15",
          maxRows: 3,
        }
      )) as { success: boolean; data: unknown[]; meta: { totalRows: number; returned: number; truncated: boolean } };

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.meta.totalRows).toBe(5);
      expect(result.meta.returned).toBe(3);
      expect(result.meta.truncated).toBe(true);
    });

    it("should return validation error when required fields are missing", async () => {
      const result = await getSalesReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "88888888",
          // missing reportType, reportSubType, frequency, reportDate
        }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should return validation error for non-numeric vendorNumber", async () => {
      const result = await getSalesReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "abc",
          reportType: "SALES",
          reportSubType: "SUMMARY",
          frequency: "DAILY",
          reportDate: "2024-01-15",
        }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should return validation error for invalid reportType", async () => {
      const result = await getSalesReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "88888888",
          reportType: "INVALID",
          reportSubType: "SUMMARY",
          frequency: "DAILY",
          reportDate: "2024-01-15",
        }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });
  });

  // ==========================================================================
  // getFinanceReport
  // ==========================================================================
  describe("getFinanceReport", () => {
    it("should return parsed TSV data from gzip response", async () => {
      const tsvContent =
        "Start Date\tEnd Date\tCurrency\tAmount\n" +
        "01/01/2024\t01/31/2024\tUSD\t1234.56\n" +
        "01/01/2024\t01/31/2024\tEUR\t987.65";

      mockClient.requestRaw.mockResolvedValueOnce(mockGzipResponse(tsvContent));

      const result = await getFinanceReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "88888888",
          regionCode: "US",
          reportDate: "2024-01",
          reportType: "FINANCIAL",
        }
      );

      expect(result).toEqual({
        success: true,
        data: [
          {
            "Start Date": "01/01/2024",
            "End Date": "01/31/2024",
            Currency: "USD",
            Amount: "1234.56",
          },
          {
            "Start Date": "01/01/2024",
            "End Date": "01/31/2024",
            Currency: "EUR",
            Amount: "987.65",
          },
        ],
        meta: {
          headers: ["Start Date", "End Date", "Currency", "Amount"],
          totalRows: 2,
          returned: 2,
          truncated: false,
          reportType: "FINANCIAL",
          regionCode: "US",
          reportDate: "2024-01",
        },
      });
    });

    it("should send correct query parameters", async () => {
      const tsvContent = "Header1\n";
      mockClient.requestRaw.mockResolvedValueOnce(mockGzipResponse(tsvContent));

      await getFinanceReport(mockClient as unknown as AppStoreConnectClient, {
        vendorNumber: "88888888",
        regionCode: "EU",
        reportDate: "2024-06",
        reportType: "FINANCE_DETAIL",
      });

      expect(mockClient.requestRaw).toHaveBeenCalledWith("/financeReports", {
        params: {
          "filter[vendorNumber]": "88888888",
          "filter[regionCode]": "EU",
          "filter[reportDate]": "2024-06",
          "filter[reportType]": "FINANCE_DETAIL",
        },
      });
    });

    it("should return validation error for invalid reportDate format", async () => {
      const result = await getFinanceReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "88888888",
          regionCode: "US",
          reportDate: "2024-01-15", // must be YYYY-MM, not YYYY-MM-DD
          reportType: "FINANCIAL",
        }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should return validation error when required fields are missing", async () => {
      const result = await getFinanceReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "88888888",
          // missing regionCode, reportDate, reportType
        }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should return validation error for invalid reportType", async () => {
      const result = await getFinanceReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "88888888",
          regionCode: "US",
          reportDate: "2024-01",
          reportType: "INVALID_TYPE",
        }
      );

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      });
    });

    it("should truncate rows when maxRows is specified", async () => {
      const headerRow = "Col1\tCol2\tCol3";
      const dataRows = Array.from(
        { length: 10 },
        (_, i) => `a${i + 1}\tb${i + 1}\tc${i + 1}`
      );
      const tsvContent = [headerRow, ...dataRows].join("\n");

      mockClient.requestRaw.mockResolvedValueOnce(mockGzipResponse(tsvContent));

      const result = (await getFinanceReport(
        mockClient as unknown as AppStoreConnectClient,
        {
          vendorNumber: "88888888",
          regionCode: "US",
          reportDate: "2024-01",
          reportType: "FINANCIAL",
          maxRows: 5,
        }
      )) as { success: boolean; data: unknown[]; meta: { totalRows: number; returned: number; truncated: boolean } };

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(5);
      expect(result.meta.totalRows).toBe(10);
      expect(result.meta.returned).toBe(5);
      expect(result.meta.truncated).toBe(true);
    });
  });
});
