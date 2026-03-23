/**
 * Sales & Finance Reports Tools - Download and parse sales and finance reports
 */

import { gunzipSync } from "node:zlib";
import type { AppStoreConnectClient } from "../api/client.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  getFinanceReportInputSchema,
  getSalesReportInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * Parse tab-separated values text into structured data
 */
function parseTSV(
  text: string,
  maxRows = 100
): {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  truncated: boolean;
} {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0, truncated: false };
  }

  const headers = lines[0]!.split("\t");
  const dataLines = lines.slice(1);
  const totalRows = dataLines.length;
  const truncated = totalRows > maxRows;
  const limitedLines = dataLines.slice(0, maxRows);

  const rows = limitedLines.map((line) => {
    const values = line.split("\t");
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]!] = values[i] ?? "";
    }
    return row;
  });

  return { headers, rows, totalRows, truncated };
}

/**
 * Decompress gzip response and parse as TSV
 */
async function decompressAndParse(
  response: Response,
  maxRows: number
): Promise<{
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  truncated: boolean;
}> {
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    return { headers: [], rows: [], totalRows: 0, truncated: false };
  }

  let text: string;
  try {
    text = gunzipSync(buffer).toString("utf-8");
  } catch {
    // If not gzip, try reading as plain text
    text = buffer.toString("utf-8");
  }

  if (text.trim().length === 0) {
    return { headers: [], rows: [], totalRows: 0, truncated: false };
  }

  return parseTSV(text, maxRows);
}

/**
 * Get sales report from App Store Connect
 */
export async function getSalesReport(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getSalesReportInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      "filter[vendorNumber]": params.vendorNumber,
      "filter[reportType]": params.reportType,
      "filter[reportSubType]": params.reportSubType,
      "filter[frequency]": params.frequency,
      "filter[reportDate]": params.reportDate,
    };

    if (params.reportVersion) {
      queryParams["filter[version]"] = params.reportVersion;
    }

    const response = await client.requestRaw("/salesReports", {
      params: queryParams,
    });

    const maxRows = params.maxRows ?? 100;
    const parsed = await decompressAndParse(response, maxRows);

    return {
      success: true,
      data: parsed.rows,
      meta: {
        headers: parsed.headers,
        totalRows: parsed.totalRows,
        returned: parsed.rows.length,
        truncated: parsed.truncated,
        reportType: params.reportType,
        reportSubType: params.reportSubType,
        frequency: params.frequency,
        reportDate: params.reportDate,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get finance report from App Store Connect
 */
export async function getFinanceReport(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getFinanceReportInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      "filter[vendorNumber]": params.vendorNumber,
      "filter[regionCode]": params.regionCode,
      "filter[reportDate]": params.reportDate,
      "filter[reportType]": params.reportType,
    };

    const response = await client.requestRaw("/financeReports", {
      params: queryParams,
    });

    const maxRows = params.maxRows ?? 100;
    const parsed = await decompressAndParse(response, maxRows);

    return {
      success: true,
      data: parsed.rows,
      meta: {
        headers: parsed.headers,
        totalRows: parsed.totalRows,
        returned: parsed.rows.length,
        truncated: parsed.truncated,
        reportType: params.reportType,
        regionCode: params.regionCode,
        reportDate: params.reportDate,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for sales and finance reports
 */
export const salesReportsToolDefinitions = [
  {
    name: "get_sales_report",
    description:
      "Download and parse a sales report from App Store Connect. Returns tab-delimited report data as structured rows. " +
      "Your vendor number can be found in App Store Connect under Settings > Agreements, Tax, and Banking. " +
      "Valid report type and sub-type combinations: " +
      "SALES + SUMMARY (daily/weekly/monthly/yearly), " +
      "SUBSCRIPTION + SUMMARY (daily), " +
      "SUBSCRIPTION_EVENT + SUMMARY (daily), " +
      "SUBSCRIBER + DETAILED (daily), " +
      "PRE_ORDER + SUMMARY (daily/weekly/monthly). " +
      "Report date format varies by frequency: DAILY = YYYY-MM-DD, WEEKLY = YYYY-MM-DD (Sunday start), " +
      "MONTHLY = YYYY-MM, YEARLY = YYYY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        vendorNumber: {
          type: "string",
          description:
            "Your vendor number (numeric string). Found in App Store Connect → Settings → Agreements, Tax, and Banking.",
        },
        reportType: {
          type: "string",
          enum: ["SALES", "SUBSCRIPTION", "SUBSCRIPTION_EVENT", "SUBSCRIBER", "PRE_ORDER"],
          description: "The type of sales report to download.",
        },
        reportSubType: {
          type: "string",
          enum: ["SUMMARY", "DETAILED", "OPT_IN"],
          description:
            "The sub-type of the report. SUMMARY is most common. DETAILED is for SUBSCRIBER reports. OPT_IN is for opt-in reports.",
        },
        frequency: {
          type: "string",
          enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
          description:
            "Report frequency. Not all frequencies are valid for all report types. DAILY is the most commonly available.",
        },
        reportDate: {
          type: "string",
          description:
            "The date for the report. Format depends on frequency: DAILY = YYYY-MM-DD, WEEKLY = YYYY-MM-DD (Sunday start), MONTHLY = YYYY-MM, YEARLY = YYYY.",
        },
        reportVersion: {
          type: "string",
          description: "Optional report version string (e.g., '1_3'). Defaults to latest version.",
        },
        maxRows: {
          type: "number",
          description: "Maximum number of data rows to return (1-1000, default 100).",
          minimum: 1,
          maximum: 1000,
        },
      },
      required: ["vendorNumber", "reportType", "reportSubType", "frequency", "reportDate"],
    },
  },
  {
    name: "get_finance_report",
    description:
      "Download and parse a finance report from App Store Connect. Returns financial report data as structured rows. " +
      "Your vendor number can be found in App Store Connect under Settings > Agreements, Tax, and Banking. " +
      "The regionCode is a 1-2 letter code representing the financial region (e.g., 'US' for United States, 'EU' for Europe, 'JP' for Japan, 'Z1' for rest of world). " +
      "Report date must be in YYYY-MM format. Reports are typically available 30-45 days after the end of the fiscal month. " +
      "Use FINANCIAL for revenue summary or FINANCE_DETAIL for line-item details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        vendorNumber: {
          type: "string",
          description:
            "Your vendor number (numeric string). Found in App Store Connect → Settings → Agreements, Tax, and Banking.",
        },
        regionCode: {
          type: "string",
          description:
            "Financial region code (1-2 characters). Examples: 'US' (United States), 'EU' (Europe), 'JP' (Japan), 'AU' (Australia), 'Z1' (rest of world).",
        },
        reportDate: {
          type: "string",
          description: "The fiscal month for the report in YYYY-MM format (e.g., '2024-01').",
        },
        reportType: {
          type: "string",
          enum: ["FINANCIAL", "FINANCE_DETAIL"],
          description:
            "FINANCIAL for revenue summary by territory. FINANCE_DETAIL for line-item transaction details.",
        },
        maxRows: {
          type: "number",
          description: "Maximum number of data rows to return (1-1000, default 100).",
          minimum: 1,
          maximum: 1000,
        },
      },
      required: ["vendorNumber", "regionCode", "reportDate", "reportType"],
    },
  },
];
