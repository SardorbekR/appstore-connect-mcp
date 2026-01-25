/**
 * Tool Registry - Central registry for all MCP tools
 */

import type { AppStoreConnectClient } from "../api/client.js";

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
  createVersionLocalization,
  deleteVersionLocalization,
  getVersionLocalization,
  listVersionLocalizations,
  localizationsToolDefinitions,
  updateVersionLocalization,
} from "./localizations.tools.js";
import {
  listScreenshotSets,
  listScreenshots,
  screenshotsToolDefinitions,
  uploadScreenshot,
} from "./screenshots.tools.js";
import { getUser, listUsers, usersToolDefinitions } from "./users.tools.js";
import {
  createAppVersion,
  getAppVersion,
  listAppVersions,
  versionsToolDefinitions,
} from "./versions.tools.js";

// Tool handler type
type ToolHandler = (client: AppStoreConnectClient, input: unknown) => Promise<unknown>;

// Tool handler registry
const toolHandlers: Record<string, ToolHandler> = {
  // Apps
  list_apps: listApps,
  get_app: getApp,

  // Versions
  list_app_versions: listAppVersions,
  get_app_version: getAppVersion,
  create_app_version: createAppVersion,

  // Localizations
  list_version_localizations: listVersionLocalizations,
  get_version_localization: getVersionLocalization,
  create_version_localization: createVersionLocalization,
  update_version_localization: updateVersionLocalization,
  delete_version_localization: deleteVersionLocalization,

  // App Info
  list_app_infos: listAppInfos,
  list_app_info_localizations: listAppInfoLocalizations,
  update_app_info_localization: updateAppInfoLocalization,

  // Beta
  list_beta_groups: listBetaGroups,
  list_beta_testers: listBetaTesters,
  add_beta_tester: addBetaTester,
  remove_beta_tester: removeBetaTester,

  // Screenshots
  list_screenshot_sets: listScreenshotSets,
  list_screenshots: listScreenshots,
  upload_screenshot: uploadScreenshot,

  // Bundle IDs
  list_bundle_ids: listBundleIds,
  get_bundle_id: getBundleId,
  create_bundle_id: createBundleId,
  update_bundle_id: updateBundleId,
  delete_bundle_id: deleteBundleId,

  // Devices
  list_devices: listDevices,
  get_device: getDevice,

  // Users
  list_users: listUsers,
  get_user: getUser,

  // Builds
  list_builds: listBuilds,
  get_build: getBuild,

  // Categories
  list_app_categories: listAppCategories,
  get_app_price_schedule: getAppPriceSchedule,
  get_app_availability: getAppAvailability,
};

// All tool definitions
export const allToolDefinitions = [
  ...appsToolDefinitions,
  ...versionsToolDefinitions,
  ...localizationsToolDefinitions,
  ...appInfoToolDefinitions,
  ...betaToolDefinitions,
  ...screenshotsToolDefinitions,
  ...bundleIdsToolDefinitions,
  ...devicesToolDefinitions,
  ...usersToolDefinitions,
  ...buildsToolDefinitions,
  ...categoriesToolDefinitions,
];

/**
 * Get a tool handler by name
 */
export function getToolHandler(name: string): ToolHandler | undefined {
  return toolHandlers[name];
}

/**
 * Check if a tool exists
 */
export function hasToolHandler(name: string): boolean {
  return name in toolHandlers;
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  client: AppStoreConnectClient,
  name: string,
  input: unknown
): Promise<unknown> {
  const handler = toolHandlers[name];
  if (!handler) {
    return {
      success: false,
      error: {
        code: "UNKNOWN_TOOL",
        message: `Unknown tool: ${name}`,
      },
    };
  }

  return handler(client, input);
}
