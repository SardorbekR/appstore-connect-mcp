/**
 * Performance Tools - App performance metrics and diagnostics
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type {
  ASCListResponse,
  DiagnosticLog,
  DiagnosticSignature,
  XcodeMetricsPayload,
} from "../api/types.js";
import { formatErrorResponse } from "../utils/errors.js";
import {
  getAppPerfMetricsInputSchema,
  getBuildPerfMetricsInputSchema,
  listDiagnosticLogsInputSchema,
  listDiagnosticSignaturesInputSchema,
  validateInput,
} from "../utils/validation.js";

/**
 * Flatten an XcodeMetrics payload into a simpler summary structure.
 * Extracts the latest productData entry and flattens its metricCategories.
 */
function flattenXcodeMetrics(payload: XcodeMetricsPayload): {
  platform: string;
  appVersion: string;
  metrics: Array<{
    categoryIdentifier: string;
    metricIdentifier: string;
    unit: { identifier: string; displayName: string };
    datasets: Array<{
      percentile: string;
      device: string;
      deviceMarketingName: string;
      points: Array<{
        version: string;
        value: number;
        percentageBreakdown?: Record<string, number>;
      }>;
    }>;
  }>;
} {
  if (!payload.productData || payload.productData.length === 0) {
    return { platform: "", appVersion: "", metrics: [] };
  }

  // Use the latest productData entry (first in the array)
  const latest = payload.productData[0];
  const metrics: Array<{
    categoryIdentifier: string;
    metricIdentifier: string;
    unit: { identifier: string; displayName: string };
    datasets: Array<{
      percentile: string;
      device: string;
      deviceMarketingName: string;
      points: Array<{
        version: string;
        value: number;
        percentageBreakdown?: Record<string, number>;
      }>;
    }>;
  }> = [];

  for (const category of latest.metricCategories) {
    for (const metric of category.metrics) {
      metrics.push({
        categoryIdentifier: category.identifier,
        metricIdentifier: metric.identifier,
        unit: metric.unit,
        datasets: metric.datasets.map((dataset) => ({
          percentile: dataset.filterCriteria.percentile,
          device: dataset.filterCriteria.device,
          deviceMarketingName: dataset.filterCriteria.deviceMarketingName,
          points: dataset.points.map((point) => ({
            version: point.version,
            value: point.value,
            ...(point.percentageBreakdown && {
              percentageBreakdown: point.percentageBreakdown,
            }),
          })),
        })),
      });
    }
  }

  return {
    platform: latest.platform,
    appVersion: latest.appVersion,
    metrics,
  };
}

/**
 * Get performance and power metrics for an app
 */
export async function getAppPerfMetrics(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getAppPerfMetricsInputSchema, input);

    const response = await client.requestRaw(`/apps/${params.appId}/perfPowerMetrics`, {
      params: {
        "filter[metricType]": params.metricType,
        ...(params.platform && { "filter[platform]": params.platform }),
        ...(params.deviceType && { "filter[deviceType]": params.deviceType }),
      },
      headers: {
        Accept: "application/vnd.apple.xcode-metrics+json,application/json",
      },
    });

    const data = (await response.json()) as XcodeMetricsPayload;
    const summary = flattenXcodeMetrics(data);

    return {
      success: true,
      data: {
        platform: summary.platform,
        appVersion: summary.appVersion,
        metrics: summary.metrics,
      },
      meta: {
        productDataCount: data.productData?.length ?? 0,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get performance and power metrics for a specific build
 */
export async function getBuildPerfMetrics(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(getBuildPerfMetricsInputSchema, input);

    const response = await client.requestRaw(`/builds/${params.buildId}/perfPowerMetrics`, {
      params: {
        "filter[metricType]": params.metricType,
        ...(params.platform && { "filter[platform]": params.platform }),
        ...(params.deviceType && { "filter[deviceType]": params.deviceType }),
      },
      headers: {
        Accept: "application/vnd.apple.xcode-metrics+json,application/json",
      },
    });

    const data = (await response.json()) as XcodeMetricsPayload;
    const summary = flattenXcodeMetrics(data);

    return {
      success: true,
      data: {
        platform: summary.platform,
        appVersion: summary.appVersion,
        metrics: summary.metrics,
      },
      meta: {
        productDataCount: data.productData?.length ?? 0,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List diagnostic signatures for a build (power/performance diagnostics)
 */
export async function listDiagnosticSignatures(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listDiagnosticSignaturesInputSchema, input);

    const response = await client.requestRaw(`/builds/${params.buildId}/diagnosticSignatures`, {
      params: {
        ...(params.diagnosticType && { "filter[diagnosticType]": params.diagnosticType }),
        ...(params.limit && { limit: params.limit }),
      },
      headers: {
        Accept: "application/vnd.apple.xcode-metrics+json,application/json",
      },
    });

    const data = (await response.json()) as ASCListResponse<DiagnosticSignature>;

    return {
      success: true,
      data: data.data.map((signature) => ({
        id: signature.id,
        diagnosticType: signature.attributes.diagnosticType,
        signature: signature.attributes.signature,
        weight: signature.attributes.weight,
      })),
      meta: {
        total: data.meta?.paging?.total,
        returned: data.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * List diagnostic logs for a specific diagnostic signature
 */
export async function listDiagnosticLogs(
  client: AppStoreConnectClient,
  input: unknown
): Promise<unknown> {
  try {
    const params = validateInput(listDiagnosticLogsInputSchema, input);

    const response = await client.requestRaw(`/diagnosticSignatures/${params.signatureId}/logs`, {
      params: {
        ...(params.limit && { limit: params.limit }),
      },
      headers: {
        Accept: "application/vnd.apple.xcode-metrics+json,application/json",
      },
    });

    const data = (await response.json()) as ASCListResponse<DiagnosticLog>;

    return {
      success: true,
      data: data.data.map((log) => ({
        id: log.id,
        diagnosticType: log.attributes.diagnosticType,
      })),
      meta: {
        total: data.meta?.paging?.total,
        returned: data.data.length,
      },
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Tool definitions for performance metrics and diagnostics
 */
export const performanceToolDefinitions = [
  {
    name: "get_app_perf_metrics",
    description:
      "Get performance and power metrics for an app (e.g., launch time, memory, battery, hangs). Returns Xcode-style metrics data with values per device and percentile. Use this for app-level aggregate metrics across all builds.",
    inputSchema: {
      type: "object" as const,
      properties: {
        appId: {
          type: "string",
          description: "The App Store Connect app ID",
        },
        metricType: {
          type: "string",
          enum: ["DISK", "HANG", "BATTERY", "LAUNCH", "MEMORY", "ANIMATION", "TERMINATION"],
          description: "The type of performance metric to retrieve",
        },
        platform: {
          type: "string",
          enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"],
          description: "Filter by platform (optional)",
        },
        deviceType: {
          type: "string",
          description:
            "Filter by device type identifier (e.g., 'iPhone14,5' for iPhone 13). Optional.",
        },
      },
      required: ["appId", "metricType"],
    },
  },
  {
    name: "get_build_perf_metrics",
    description:
      "Get performance and power metrics for a specific build. Same metric types as get_app_perf_metrics but scoped to a single build. Useful for comparing performance between builds.",
    inputSchema: {
      type: "object" as const,
      properties: {
        buildId: {
          type: "string",
          description: "The build resource ID",
        },
        metricType: {
          type: "string",
          enum: ["DISK", "HANG", "BATTERY", "LAUNCH", "MEMORY", "ANIMATION", "TERMINATION"],
          description: "The type of performance metric to retrieve",
        },
        platform: {
          type: "string",
          enum: ["IOS", "MAC_OS", "TV_OS", "VISION_OS"],
          description: "Filter by platform (optional)",
        },
        deviceType: {
          type: "string",
          description:
            "Filter by device type identifier (e.g., 'iPhone14,5' for iPhone 13). Optional.",
        },
      },
      required: ["buildId", "metricType"],
    },
  },
  {
    name: "list_diagnostic_signatures",
    description:
      "List power and performance diagnostic signatures for a build. Signatures represent recurring performance issues (disk writes, hangs, slow launches) grouped by call stack. Use list_diagnostic_logs with a signature ID to get detailed logs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        buildId: {
          type: "string",
          description: "The build resource ID",
        },
        diagnosticType: {
          type: "string",
          enum: ["DISK_WRITES", "HANGS", "LAUNCHES"],
          description: "Filter by diagnostic type (optional)",
        },
        limit: {
          type: "number",
          description: "Maximum number of signatures to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["buildId"],
    },
  },
  {
    name: "list_diagnostic_logs",
    description:
      "List diagnostic logs for a specific diagnostic signature. Returns individual log entries for a given performance issue. Use list_diagnostic_signatures first to get a signature ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        signatureId: {
          type: "string",
          description: "The diagnostic signature ID (from list_diagnostic_signatures)",
        },
        limit: {
          type: "number",
          description: "Maximum number of logs to return (1-200)",
          minimum: 1,
          maximum: 200,
        },
      },
      required: ["signatureId"],
    },
  },
];
