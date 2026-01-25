#!/usr/bin/env tsx
/**
 * Live API Test Script
 *
 * Tests the App Store Connect API integration with real credentials.
 * Make sure environment variables are set before running.
 *
 * Usage:
 *   npx tsx scripts/test-live.ts
 */

import { createClient } from "../src/api/client.js";
import { createTokenManagerFromEnv } from "../src/auth/jwt.js";
import { getApp, listApps } from "../src/tools/apps.tools.js";
import { listVersionLocalizations } from "../src/tools/localizations.tools.js";
import { listAppVersions } from "../src/tools/versions.tools.js";

async function main() {
  console.log("App Store Connect MCP - Live API Test\n");
  console.log("=".repeat(50));

  // Check environment variables
  const requiredVars = ["APP_STORE_CONNECT_KEY_ID", "APP_STORE_CONNECT_ISSUER_ID"];

  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error("\nMissing required environment variables:");
    for (const v of missing) {
      console.error(`  - ${v}`);
    }
    console.error("\nPlease set these variables and try again.");
    process.exit(1);
  }

  if (!process.env.APP_STORE_CONNECT_P8_PATH && !process.env.APP_STORE_CONNECT_P8_CONTENT) {
    console.error("\nMissing private key. Set one of:");
    console.error("  - APP_STORE_CONNECT_P8_PATH");
    console.error("  - APP_STORE_CONNECT_P8_CONTENT");
    process.exit(1);
  }

  try {
    // Initialize client
    console.log("\n1. Initializing client...");
    const tokenManager = createTokenManagerFromEnv();
    const client = createClient(tokenManager);
    console.log("   ✓ Client initialized");

    // Test: List apps
    console.log("\n2. Testing list_apps...");
    const appsResult = await listApps(client, { limit: 5 });

    if (!isSuccess(appsResult)) {
      console.error("   ✗ Failed:", (appsResult as ErrorResult).error.message);
      process.exit(1);
    }

    const apps = (appsResult as SuccessResult).data as App[];
    console.log(`   ✓ Found ${apps.length} app(s)`);

    if (apps.length === 0) {
      console.log("\n   No apps found. Make sure your API key has access to at least one app.");
      process.exit(0);
    }

    // Display apps
    console.log("\n   Apps:");
    apps.forEach((app, i) => {
      console.log(`   ${i + 1}. ${app.name} (${app.bundleId})`);
    });

    // Test: Get first app details
    const firstApp = apps[0];
    console.log(`\n3. Testing get_app for "${firstApp.name}"...`);
    const appResult = await getApp(client, { appId: firstApp.id });

    if (!isSuccess(appResult)) {
      console.error("   ✗ Failed:", (appResult as ErrorResult).error.message);
    } else {
      console.log("   ✓ Got app details");
      const app = (appResult as SuccessResult).data as App;
      console.log(`   - SKU: ${app.sku}`);
      console.log(`   - Primary Locale: ${app.primaryLocale}`);
    }

    // Test: List versions
    console.log("\n4. Testing list_app_versions...");
    const versionsResult = await listAppVersions(client, { appId: firstApp.id, limit: 3 });

    if (!isSuccess(versionsResult)) {
      console.error("   ✗ Failed:", (versionsResult as ErrorResult).error.message);
    } else {
      const versions = (versionsResult as SuccessResult).data as Version[];
      console.log(`   ✓ Found ${versions.length} version(s)`);

      if (versions.length > 0) {
        console.log("\n   Versions:");
        versions.forEach((version, i) => {
          console.log(`   ${i + 1}. v${version.versionString} (${version.state})`);
        });

        // Test: List localizations for first version
        const firstVersion = versions[0];
        console.log(
          `\n5. Testing list_version_localizations for v${firstVersion.versionString}...`
        );
        const locsResult = await listVersionLocalizations(client, { versionId: firstVersion.id });

        if (!isSuccess(locsResult)) {
          console.error("   ✗ Failed:", (locsResult as ErrorResult).error.message);
        } else {
          const locs = (locsResult as SuccessResult).data as Localization[];
          console.log(`   ✓ Found ${locs.length} localization(s)`);

          if (locs.length > 0) {
            console.log("\n   Localizations:");
            locs.forEach((loc, i) => {
              const descPreview = loc.description
                ? loc.description.substring(0, 50) + (loc.description.length > 50 ? "..." : "")
                : "(no description)";
              console.log(`   ${i + 1}. ${loc.locale}: ${descPreview}`);
            });
          }
        }
      }
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log("All tests completed successfully!");
    console.log("=".repeat(50));

    // Cleanup
    tokenManager.destroy();
  } catch (error) {
    console.error("\n✗ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Type helpers
interface SuccessResult {
  success: true;
  data: unknown;
}

interface ErrorResult {
  success: false;
  error: { message: string; code: string };
}

interface App {
  id: string;
  name: string;
  bundleId: string;
  sku: string;
  primaryLocale: string;
}

interface Version {
  id: string;
  versionString: string;
  state: string;
}

interface Localization {
  id: string;
  locale: string;
  description?: string;
}

function isSuccess(result: unknown): result is SuccessResult {
  return (
    typeof result === "object" &&
    result !== null &&
    "success" in result &&
    (result as { success: boolean }).success === true
  );
}

main();
