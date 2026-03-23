/**
 * Analytics Tools - Manage analytics report requests, reports, instances, segments, and downloads
 */

import { gunzipSync } from "node:zlib";
import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  ASCResponse,
  AnalyticsReport,
  AnalyticsReportInstance,
  AnalyticsReportRequest,
  AnalyticsReportSegment,
  CreateAnalyticsReportRequestBody,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  createAnalyticsReportRequestInputSchema,
  deleteAnalyticsReportRequestInputSchema,
  downloadAnalyticsReportSegmentInputSchema,
  getAnalyticsReportRequestInputSchema,
  listAnalyticsReportInstancesInputSchema,
  listAnalyticsReportRequestsInputSchema,
  listAnalyticsReportSegmentsInputSchema,
  listAnalyticsReportsInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * Create an analytics report request for an app
 */
export async function createAnalyticsReportRequest(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(createAnalyticsReportRequestInputSchema, input);

    const requestBody: CreateAnalyticsReportRequestBody = {
      data: {
        type: "analyticsReportRequests",
        attributes: {
          accessType: params.accessType,
        },
        relationships: {
          app: {
            data: {
              type: "apps",
              id: params.appId,
            },
          },
        },
      },
    };

    const response = await client.post<ASCResponse<AnalyticsReportRequest>>(
      "/analyticsReportRequests",
      requestBody
    );

    const reportRequest = response.data;

    return {
      success: true,
      data: {
        id: reportRequest.id,
        accessType: reportRequest.attributes.accessType,
        stoppedDueToInactivity: reportRequest.attributes.stoppedDueToInactivity,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List all analytics report requests for an app
 */
export async function listAnalyticsReportRequests(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAnalyticsReportRequestsInputSchema, input);

    const response = await client.get<ASCListResponse<AnalyticsReportRequest>>(
      `/apps/${params.appId}/analyticsReportRequests`,
      {
        limit: params.limit,
      }
    );

    return {
      success: true,
      data: response.data.map((reportRequest) => ({
        id: reportRequest.id,
        accessType: reportRequest.attributes.accessType,
        stoppedDueToInactivity: reportRequest.attributes.stoppedDueToInactivity,
      })),
      meta: {
        total: response.meta?.paging?.total,
        returned: response.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get a specific analytics report request
 */
export async function getAnalyticsReportRequest(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getAnalyticsReportRequestInputSchema, input);

    const response = await client.get<ASCResponse<AnalyticsReportRequest>>(
      `/analyticsReportRequests/${params.requestId}`
    );

    const reportRequest = response.data;

    return {
      success: true,
      data: {
        id: reportRequest.id,
        accessType: reportRequest.attributes.accessType,
        stoppedDueToInactivity: reportRequest.attributes.stoppedDueToInactivity,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Delete an analytics report request
 */
export async function deleteAnalyticsReportRequest(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(deleteAnalyticsReportRequestInputSchema, input);

    await client.delete(`/analyticsReportRequests/${params.requestId}`);

    return {
      success: true,
      message: `Analytics report request ${params.requestId} has been deleted.`,
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List analytics reports for a report request
 */
export async function listAnalyticsReports(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAnalyticsReportsInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };

    if (params.category) {
      queryParams["filter[category]"] = params.category;
    }

    const response = await client.get<ASCListResponse<AnalyticsReport>>(
      `/analyticsReportRequests/${params.requestId}/reports`,
      queryParams
    );

    return {
      success: true,
      data: response.data.map((report) => ({
        id: report.id,
        category: report.attributes.category,
        name: report.attributes.name,
      })),
      meta: {
        total: response.meta?.paging?.total,
        returned: response.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List analytics report instances for a report
 */
export async function listAnalyticsReportInstances(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAnalyticsReportInstancesInputSchema, input);

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
    };

    if (params.granularity) {
      queryParams["filter[granularity]"] = params.granularity;
    }

    if (params.processingDate) {
      queryParams["filter[processingDate]"] = params.processingDate;
    }

    const response = await client.get<ASCListResponse<AnalyticsReportInstance>>(
      `/analyticsReports/${params.reportId}/instances`,
      queryParams
    );

    return {
      success: true,
      data: response.data.map((instance) => ({
        id: instance.id,
        granularity: instance.attributes.granularity,
        processingDate: instance.attributes.processingDate,
      })),
      meta: {
        total: response.meta?.paging?.total,
        returned: response.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List analytics report segments for a report instance
 */
export async function listAnalyticsReportSegments(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listAnalyticsReportSegmentsInputSchema, input);

    const response = await client.get<ASCListResponse<AnalyticsReportSegment>>(
      `/analyticsReportInstances/${params.instanceId}/segments`,
      {
        limit: params.limit,
      }
    );

    return {
      success: true,
      data: response.data.map((segment) => ({
        id: segment.id,
        checksum: segment.attributes.checksum,
        sizeInBytes: segment.attributes.sizeInBytes,
        url: segment.attributes.url,
      })),
      meta: {
        total: response.meta?.paging?.total,
        returned: response.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Download and parse an analytics report segment from its pre-signed URL
 */
export async function downloadAnalyticsReportSegment(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(downloadAnalyticsReportSegmentInputSchema, input);
    const maxRows = params.maxRows ?? 100;

    const response = await client.rawRequest(params.url, { method: "GET" });

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: "DOWNLOAD_ERROR",
          message: `Failed to download report segment: HTTP ${response.status} ${response.statusText}`,
        },
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return {
        success: true,
        data: {
          headers: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        },
      };
    }

    let tsvContent: string;
    try {
      tsvContent = gunzipSync(buffer).toString("utf-8");
    } catch {
      return {
        success: false,
        error: {
          code: "DECOMPRESSION_ERROR",
          message: "Failed to decompress report segment data. The data may not be gzip-compressed.",
        },
      };
    }

    const lines = tsvContent.split("\n").filter((line) => line.length > 0);

    if (lines.length === 0) {
      return {
        success: true,
        data: {
          headers: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        },
      };
    }

    const headers = lines[0]!.split("\t");
    const dataLines = lines.slice(1);
    const totalRows = dataLines.length;
    const truncated = totalRows > maxRows;
    const limitedLines = truncated ? dataLines.slice(0, maxRows) : dataLines;

    const rows: Record<string, string>[] = limitedLines.map((line) => {
      const values = line.split("\t");
      const row: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]!] = values[i] ?? "";
      }
      return row;
    });

    return {
      success: true,
      data: {
        headers,
        rows,
        totalRows,
        truncated,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for analytics
 */
export const analyticsToolDefinitions = [
  {
    name: "create_analytics_report_request",
    description:
      "Create a new analytics report request for an app. Use ONGOING for continuous reports or ONE_TIME_SNAPSHOT for a single snapshot. Reports take time to generate after creation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        accessType: {
          type: "string",
          enum: ["ONGOING", "ONE_TIME_SNAPSHOT"],
          description:
            "ONGOING for continuous daily reports, ONE_TIME_SNAPSHOT for a single point-in-time report",
        },
      },
      required: ["appId", "accessType"],
    },
  },
  {
    name: "list_analytics_report_requests",
    description:
      "List all analytics report requests for an app. Shows whether each request is active or stopped due to inactivity.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of report requests to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["appId"],
    },
  },
  {
    name: "get_analytics_report_request",
    description: "Get details of a specific analytics report request.",
    inputSchema: {
      type: "object" as const,
      properties: {
        requestId: {
          type: "string",
          description: "The analytics report request ID",
        },
      },
      required: ["requestId"],
    },
  },
  {
    name: "delete_analytics_report_request",
    description:
      "Delete an analytics report request. This stops report generation and removes access to existing reports.",
    inputSchema: {
      type: "object" as const,
      properties: {
        requestId: {
          type: "string",
          description: "The analytics report request ID to delete",
        },
      },
      required: ["requestId"],
    },
  },
  {
    name: "list_analytics_reports",
    description:
      "List analytics reports available for a report request. Can filter by category (APP_STORE_ENGAGEMENT, COMMERCE, APP_USAGE, FRAMEWORKS_USAGE, PERFORMANCE).",
    inputSchema: {
      type: "object" as const,
      properties: {
        requestId: {
          type: "string",
          description: "The analytics report request ID",
        },
        category: {
          type: "string",
          enum: [
            "APP_STORE_ENGAGEMENT",
            "COMMERCE",
            "APP_USAGE",
            "FRAMEWORKS_USAGE",
            "PERFORMANCE",
          ],
          description: "Filter reports by category",
        },
        limit: {
          type: "number",
          description: "Maximum number of reports to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["requestId"],
    },
  },
  {
    name: "list_analytics_report_instances",
    description:
      "List report instances (dated snapshots) for an analytics report. Each instance represents data for a specific processing date. Can filter by granularity (DAILY, WEEKLY, MONTHLY) and processing date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        reportId: {
          type: "string",
          description: "The analytics report ID",
        },
        granularity: {
          type: "string",
          enum: ["DAILY", "WEEKLY", "MONTHLY"],
          description: "Filter by report granularity",
        },
        processingDate: {
          type: "string",
          description: "Filter by processing date (e.g., '2024-01-15')",
        },
        limit: {
          type: "number",
          description: "Maximum number of instances to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["reportId"],
    },
  },
  {
    name: "list_analytics_report_segments",
    description:
      "List downloadable segments for a report instance. Each segment contains a URL for downloading the report data, along with its checksum and size.",
    inputSchema: {
      type: "object" as const,
      properties: {
        instanceId: {
          type: "string",
          description: "The analytics report instance ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of segments to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["instanceId"],
    },
  },
  {
    name: "download_analytics_report_segment",
    description:
      "Download and parse an analytics report segment from its pre-signed URL. The segment data is gzip-compressed TSV. Returns parsed headers and rows (as key-value objects). Use list_analytics_report_segments to get the download URL first.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The pre-signed download URL from list_analytics_report_segments",
        },
        maxRows: {
          type: "number",
          description: "Maximum number of data rows to return (1-1000, default 100)",
          minimum: 1,
          maximum: 1000,
        },
      },
      required: ["url"],
    },
  },
];
