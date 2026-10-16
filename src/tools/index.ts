/**
 * Tool Registry - Central registry for all MCP tools
 */

import type { AppStoreConnectClient } from "../api/client.js";
import type { ServerConfig } from "../config.js";

import {
  analyticsToolDefinitions,
  createAnalyticsReportRequest,
  deleteAnalyticsReportRequest,
  downloadAnalyticsReportSegment,
  getAnalyticsReportRequest,
  listAnalyticsReportInstances,
  listAnalyticsReportRequests,
  listAnalyticsReportSegments,
  listAnalyticsReports,
} from "./analytics.tools.js";
import { apiToolsModule } from "./api.tools.js";
import {
  appInfoToolDefinitions,
  listAppInfoLocalizations,
  listAppInfos,
  updateAppInfoLocalization,
} from "./app-info.tools.js";
// Import tool handlers
import { appsToolDefinitions, getApp, listApps } from "./apps.tools.js";
import {
  addBetaTester,
  betaToolDefinitions,
  listBetaGroups,
  listBetaTesters,
  removeBetaTester,
} from "./beta.tools.js";
import { buildsToolDefinitions, getBuild, listBuilds } from "./builds.tools.js";
import {
  bundleIdsToolDefinitions,
  createBundleId,
  deleteBundleId,
  getBundleId,
  listBundleIds,
  updateBundleId,
} from "./bundle-ids.tools.js";
import {
  categoriesToolDefinitions,
  getAppAvailability,
  getAppPriceSchedule,
  listAppCategories,
} from "./categories.tools.js";
import { devicesToolDefinitions, getDevice, listDevices } from "./devices.tools.js";
import {
  createInAppPurchase,
  createInAppPurchaseLocalization,
  deleteInAppPurchase,
  deleteInAppPurchaseLocalization,
  getInAppPurchase,
  getInAppPurchaseAvailability,
  getInAppPurchasePricePointEqualizations,
  inAppPurchaseToolDefinitions,
  listInAppPurchaseLocalizations,
  listInAppPurchasePricePoints,
  listInAppPurchasePrices,
  listInAppPurchases,
  setInAppPurchaseAvailability,
  setInAppPurchasePrice,
  submitInAppPurchaseForReview,
  updateInAppPurchase,
  updateInAppPurchaseLocalization,
} from "./in-app-purchases.tools.js";
import {
  createVersionLocalization,
  deleteVersionLocalization,
  getVersionLocalization,
  listVersionLocalizations,
  localizationsToolDefinitions,
  updateVersionLocalization,
} from "./localizations.tools.js";
import {
  getAppPerfMetrics,
  getBuildPerfMetrics,
  listDiagnosticLogs,
  listDiagnosticSignatures,
  performanceToolDefinitions,
} from "./performance.tools.js";
import {
  getPricePointEqualizations,
  listAppPricePoints,
  listTerritories,
  pricingToolDefinitions,
  setAppPrices,
} from "./pricing.tools.js";
import {
  getFinanceReport,
  getSalesReport,
  salesReportsToolDefinitions,
} from "./sales-reports.tools.js";
import {
  listScreenshotSets,
  listScreenshots,
  screenshotsToolDefinitions,
  uploadScreenshot,
} from "./screenshots.tools.js";
import {
  createPromotionalOffer,
  createSubscription,
  createSubscriptionGroup,
  createSubscriptionGroupLocalization,
  createSubscriptionLocalization,
  createSubscriptionPrice,
  deletePromotionalOffer,
  deleteSubscription,
  deleteSubscriptionLocalization,
  getSubscription,
  getSubscriptionAvailability,
  getSubscriptionGroup,
  getSubscriptionGroupLocalization,
  listPromotionalOfferPrices,
  listPromotionalOffers,
  listSubscriptionGroupLocalizations,
  listSubscriptionGroups,
  listSubscriptionLocalizations,
  listSubscriptionPricePoints,
  listSubscriptionPrices,
  listSubscriptions,
  setSubscriptionAvailability,
  subscriptionToolDefinitions,
  updatePromotionalOffer,
  updateSubscription,
  updateSubscriptionGroup,
  updateSubscriptionGroupLocalization,
  updateSubscriptionLocalization,
} from "./subscriptions.tools.js";
import type { ToolDefinition, ToolHandler, ToolModule } from "./types.js";
import { getUser, listUsers, usersToolDefinitions } from "./users.tools.js";
import { versionAdminToolsModule } from "./version-admin.tools.js";
import {
  createAppVersion,
  getAppVersion,
  listAppVersions,
  versionsToolDefinitions,
} from "./versions.tools.js";

export type { ToolDefinition, ToolHandler, ToolModule } from "./types.js";

/**
 * Every tool module, in listing order. New domain files export a ToolModule and are
 * added here with one line.
 */
export const allToolModules: readonly ToolModule[] = [
  {
    toolset: "apps",
    definitions: appsToolDefinitions,
    handlers: { list_apps: listApps, get_app: getApp },
  },
  {
    toolset: "versions",
    definitions: versionsToolDefinitions,
    handlers: {
      list_app_versions: listAppVersions,
      get_app_version: getAppVersion,
      create_app_version: createAppVersion,
    },
  },
  {
    toolset: "versions",
    definitions: localizationsToolDefinitions,
    handlers: {
      list_version_localizations: listVersionLocalizations,
      get_version_localization: getVersionLocalization,
      create_version_localization: createVersionLocalization,
      update_version_localization: updateVersionLocalization,
      delete_version_localization: deleteVersionLocalization,
    },
  },
  {
    toolset: "apps",
    definitions: appInfoToolDefinitions,
    handlers: {
      list_app_infos: listAppInfos,
      list_app_info_localizations: listAppInfoLocalizations,
      update_app_info_localization: updateAppInfoLocalization,
    },
  },
  {
    toolset: "testflight",
    definitions: betaToolDefinitions,
    handlers: {
      list_beta_groups: listBetaGroups,
      list_beta_testers: listBetaTesters,
      add_beta_tester: addBetaTester,
      remove_beta_tester: removeBetaTester,
    },
  },
  {
    toolset: "media",
    definitions: screenshotsToolDefinitions,
    handlers: {
      list_screenshot_sets: listScreenshotSets,
      list_screenshots: listScreenshots,
      upload_screenshot: uploadScreenshot,
    },
  },
  {
    toolset: "provisioning",
    definitions: bundleIdsToolDefinitions,
    handlers: {
      list_bundle_ids: listBundleIds,
      get_bundle_id: getBundleId,
      create_bundle_id: createBundleId,
      update_bundle_id: updateBundleId,
      delete_bundle_id: deleteBundleId,
    },
  },
  {
    toolset: "provisioning",
    definitions: devicesToolDefinitions,
    handlers: { list_devices: listDevices, get_device: getDevice },
  },
  {
    toolset: "users",
    definitions: usersToolDefinitions,
    handlers: { list_users: listUsers, get_user: getUser },
  },
  {
    toolset: "testflight",
    definitions: buildsToolDefinitions,
    handlers: { list_builds: listBuilds, get_build: getBuild },
  },
  {
    toolset: "apps",
    definitions: categoriesToolDefinitions,
    handlers: {
      list_app_categories: listAppCategories,
      get_app_price_schedule: getAppPriceSchedule,
      get_app_availability: getAppAvailability,
    },
  },
  {
    toolset: "pricing",
    definitions: pricingToolDefinitions,
    handlers: {
      list_territories: listTerritories,
      list_app_price_points: listAppPricePoints,
      get_price_point_equalizations: getPricePointEqualizations,
      set_app_prices: setAppPrices,
    },
  },
  {
    toolset: "subscriptions",
    definitions: subscriptionToolDefinitions,
    handlers: {
      list_subscription_groups: listSubscriptionGroups,
      get_subscription_group: getSubscriptionGroup,
      create_subscription_group: createSubscriptionGroup,
      list_subscriptions: listSubscriptions,
      get_subscription: getSubscription,
      create_subscription: createSubscription,
      update_subscription: updateSubscription,
      delete_subscription: deleteSubscription,
      list_subscription_localizations: listSubscriptionLocalizations,
      create_subscription_localization: createSubscriptionLocalization,
      update_subscription_localization: updateSubscriptionLocalization,
      delete_subscription_localization: deleteSubscriptionLocalization,
      list_subscription_price_points: listSubscriptionPricePoints,
      update_subscription_group: updateSubscriptionGroup,
      list_subscription_group_localizations: listSubscriptionGroupLocalizations,
      get_subscription_group_localization: getSubscriptionGroupLocalization,
      create_subscription_group_localization: createSubscriptionGroupLocalization,
      update_subscription_group_localization: updateSubscriptionGroupLocalization,
      list_promotional_offers: listPromotionalOffers,
      create_promotional_offer: createPromotionalOffer,
      update_promotional_offer: updatePromotionalOffer,
      delete_promotional_offer: deletePromotionalOffer,
      list_promotional_offer_prices: listPromotionalOfferPrices,
      list_subscription_prices: listSubscriptionPrices,
      get_subscription_availability: getSubscriptionAvailability,
      set_subscription_availability: setSubscriptionAvailability,
      create_subscription_price: createSubscriptionPrice,
    },
  },
  {
    toolset: "iap",
    definitions: inAppPurchaseToolDefinitions,
    handlers: {
      list_in_app_purchases: listInAppPurchases,
      get_in_app_purchase: getInAppPurchase,
      create_in_app_purchase: createInAppPurchase,
      update_in_app_purchase: updateInAppPurchase,
      delete_in_app_purchase: deleteInAppPurchase,
      list_in_app_purchase_localizations: listInAppPurchaseLocalizations,
      create_in_app_purchase_localization: createInAppPurchaseLocalization,
      update_in_app_purchase_localization: updateInAppPurchaseLocalization,
      delete_in_app_purchase_localization: deleteInAppPurchaseLocalization,
      list_in_app_purchase_price_points: listInAppPurchasePricePoints,
      set_in_app_purchase_price: setInAppPurchasePrice,
      get_in_app_purchase_availability: getInAppPurchaseAvailability,
      set_in_app_purchase_availability: setInAppPurchaseAvailability,
      submit_in_app_purchase_for_review: submitInAppPurchaseForReview,
      get_in_app_purchase_price_point_equalizations: getInAppPurchasePricePointEqualizations,
      list_in_app_purchase_prices: listInAppPurchasePrices,
    },
  },
  {
    toolset: "analytics",
    definitions: analyticsToolDefinitions,
    handlers: {
      create_analytics_report_request: createAnalyticsReportRequest,
      list_analytics_report_requests: listAnalyticsReportRequests,
      get_analytics_report_request: getAnalyticsReportRequest,
      delete_analytics_report_request: deleteAnalyticsReportRequest,
      list_analytics_reports: listAnalyticsReports,
      list_analytics_report_instances: listAnalyticsReportInstances,
      list_analytics_report_segments: listAnalyticsReportSegments,
      download_analytics_report_segment: downloadAnalyticsReportSegment,
    },
  },
  {
    toolset: "analytics",
    definitions: salesReportsToolDefinitions,
    handlers: { get_sales_report: getSalesReport, get_finance_report: getFinanceReport },
  },
  {
    toolset: "analytics",
    definitions: performanceToolDefinitions,
    handlers: {
      get_app_perf_metrics: getAppPerfMetrics,
      get_build_perf_metrics: getBuildPerfMetrics,
      list_diagnostic_signatures: listDiagnosticSignatures,
      list_diagnostic_logs: listDiagnosticLogs,
    },
  },
  versionAdminToolsModule,
  apiToolsModule,
];

export interface ToolRegistry {
  definitions: ToolDefinition[];
  has(name: string): boolean;
  execute(client: AppStoreConnectClient, name: string, input: unknown): Promise<unknown>;
}

/**
 * Check that every definition has exactly one handler and names are unique.
 * Throws at startup rather than failing on the first call.
 */
export function assertModulesConsistent(modules: readonly ToolModule[]): void {
  const seen = new Set<string>();
  for (const module of modules) {
    const handlerNames = new Set(Object.keys(module.handlers));
    for (const definition of module.definitions) {
      if (seen.has(definition.name)) {
        throw new Error(`Duplicate tool name: ${definition.name}`);
      }
      seen.add(definition.name);
      if (!handlerNames.has(definition.name)) {
        throw new Error(`Tool ${definition.name} has a definition but no handler`);
      }
      handlerNames.delete(definition.name);
    }
    for (const definition of module.readOnlyDefinitions ?? []) {
      if (!(definition.name in module.handlers)) {
        throw new Error(`Read-only definition ${definition.name} has no handler`);
      }
    }
    if (handlerNames.size > 0) {
      throw new Error(`Handlers without definitions: ${[...handlerNames].join(", ")}`);
    }
  }
}

/**
 * Build the set of tools exposed for a server configuration.
 * Filtering applies to both listing and dispatch: a tool that is not listed cannot be called.
 */
export function createToolRegistry(
  config: Pick<ServerConfig, "toolsets" | "readOnly">,
  modules: readonly ToolModule[] = allToolModules
): ToolRegistry {
  assertModulesConsistent(modules);

  const definitions: ToolDefinition[] = [];
  const handlers = new Map<string, ToolHandler>();

  for (const module of modules) {
    if (config.toolsets && !config.toolsets.has(module.toolset)) continue;

    const exposed = config.readOnly
      ? (module.readOnlyDefinitions ??
        module.definitions.filter((definition) => definition.annotations?.readOnlyHint === true))
      : module.definitions;

    for (const definition of exposed) {
      const handler = module.handlers[definition.name];
      if (!handler) continue;
      definitions.push(definition);
      handlers.set(definition.name, handler);
    }
  }

  return {
    definitions,
    has: (name) => handlers.has(name),
    async execute(client, name, input) {
      const handler = handlers.get(name);
      if (!handler) {
        return {
          success: false,
          error: {
            code: "UNKNOWN_TOOL",
            message: `Unknown or disabled tool: ${name}`,
          },
        };
      }
      return handler(client, input);
    },
  };
}
