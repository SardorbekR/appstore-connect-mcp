# App Store Connect MCP Server

[![npm version](https://img.shields.io/npm/v/asc-mcp.svg)](https://www.npmjs.com/package/asc-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/asc-mcp.svg)](https://nodejs.org)

A Model Context Protocol (MCP) server for Apple's App Store Connect API. Manage your iOS, macOS, tvOS, and visionOS apps directly from Claude, Cursor, or any MCP-compatible client.

## Features

- **Any API Operation** - Call any of the 1,303 App Store Connect API operations through `asc_api_request`, validated against Apple's OpenAPI spec, with `asc_api_search` and `asc_api_describe` to find and inspect them
- **Submission & Release** - Edit version metadata (copyright, version string, release type), attach builds, App Review details, review submissions, phased and manual release, export compliance
- **App Info** - Categories, age rating declaration, app info localizations, custom EULA
- **App Store Localizations** - Full CRUD for version descriptions, keywords, and what's new
- **App Management** - List and inspect apps across all platforms
- **Version Control** - Create and manage app store versions
- **TestFlight** - Groups, build access, testers and invitations, What to Test notes, beta app localizations, beta review submissions
- **Screenshots & Previews** - Upload, reorder, and delete screenshots and app previews; review screenshots for subscriptions and in-app purchases
- **Customer Reviews** - Read reviews and publish or remove responses
- **Bundle ID Management** - Full CRUD for bundle identifiers
- **Device Management** - List and inspect registered devices
- **User Management** - List and inspect team users
- **Build Management** - List and inspect app builds
- **Category & Pricing** - Browse categories, check pricing and availability
- **Pricing & PPP** - Set per-territory pricing with Purchase Power Parity support
- **Subscriptions** - Groups, subscriptions, localizations, pricing & PPP, availability, promotional, introductory and win-back offers, offer codes
- **In-App Purchases** - Create and manage one-time purchases (lifetime/non-consumable, consumable, non-renewing): metadata, localization, pricing & PPP, availability, offer codes, review screenshots, and review submission
- **Custom Product Pages** - Pages, versions, and per-locale promotional text
- **Analytics Reports** - Request and download app analytics reports (engagement, commerce, usage, performance)
- **Sales & Finance** - Download sales, trends, and financial reports
- **Performance & Diagnostics** - App/build power & performance metrics and diagnostic logs
- **Toolsets & Read-Only Mode** - Expose only the tool groups you need, or block every write with `ASC_READ_ONLY=1`
- **Secure by Default** - ES256 JWT auth with automatic token refresh, credential redaction in logs

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Available Tools](#available-tools)
- [Usage Examples](#usage-examples)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Quick Start

1. Get an App Store Connect API key (see [Prerequisites](#prerequisites-get-your-apple-api-credentials)).
2. Add the server to your MCP client with `npx -y asc-mcp@latest` and your credentials (see [MCP Client Configuration](#mcp-client-configuration)).
3. Restart the client. New releases are picked up on each restart.

## Installation

### npx (recommended)

```bash
npx -y asc-mcp@latest
```

Your MCP client runs this command itself (see [MCP Client Configuration](#mcp-client-configuration)). npx fetches the newest release whenever the client starts, so you stay up to date.

### Global install

```bash
npm install -g asc-mcp
```

Then use `"command": "asc-mcp"` in your client config. A global install does not update by itself: run `npm install -g asc-mcp@latest` to update.

### Updating

- **npx:** restart your MCP client. A running client keeps the version it started with.
- **Global install:** `npm install -g asc-mcp@latest`, then restart the client.
- **Pin a version** for stability with `asc-mcp@2.0.3` (or any version) instead of `asc-mcp@latest`.

Once a day the server asks npm for the latest version in the background, without delaying startup. If yours is older, the next time the server starts it tells your assistant, which mentions it to you once. It sends nothing but that request, and installs nothing. Set `ASC_DISABLE_UPDATE_CHECK=1` to turn it off.

### From Source

```bash
git clone https://github.com/SardorbekR/appstore-connect-mcp.git
cd appstore-connect-mcp
npm install
npm run build
```

## Configuration

### Prerequisites: Get Your Apple API Credentials

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com)
2. Go to **Users and Access** → **Integrations** → **App Store Connect API**
3. Click **Generate API Key** (or use existing)
4. Select appropriate role (Admin or App Manager recommended)
5. **Download the .p8 file** - you can only download it once!
6. Note your **Key ID** (shown in the keys list)
7. Note your **Issuer ID** (shown at the top of the page)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_STORE_CONNECT_KEY_ID` | Yes | Your API Key ID (e.g., `ABC123DEFG`) |
| `APP_STORE_CONNECT_ISSUER_ID` | Yes | Your Issuer ID (UUID format) |
| `APP_STORE_CONNECT_P8_PATH` | Yes* | Path to your `.p8` private key file |
| `APP_STORE_CONNECT_P8_CONTENT` | Yes* | Raw content of `.p8` key (alternative to path) |

*One of `P8_PATH` or `P8_CONTENT` is required.

Optional settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `ASC_TOOLSETS` | all | Comma-separated tool groups to expose: `apps`, `versions`, `media`, `testflight`, `pricing`, `subscriptions`, `iap`, `reviews`, `product-pages`, `provisioning`, `users`, `analytics`, `api`. Fewer tools means less context in clients with small tool budgets. The `api` group reaches every operation, including ones outside the other groups. |
| `ASC_READ_ONLY` | off | `1` exposes only read tools and makes the client refuse every non-GET request |
| `ASC_MAX_RESPONSE_CHARS` | 80000 | Size cap for `asc_api_request` results; larger results end at a page boundary with a `cursor` to continue |
| `ASC_DISABLE_UPDATE_CHECK` | off | `1` skips the once-a-day check for a newer asc-mcp release |

### MCP Client Configuration

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "app-store-connect": {
      "command": "npx",
      "args": ["-y", "asc-mcp@latest"],
      "env": {
        "APP_STORE_CONNECT_KEY_ID": "YOUR_KEY_ID",
        "APP_STORE_CONNECT_ISSUER_ID": "YOUR_ISSUER_ID",
        "APP_STORE_CONNECT_P8_PATH": "/absolute/path/to/AuthKey.p8"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to your Cursor MCP settings (Settings → MCP Servers):

```json
{
  "mcpServers": {
    "app-store-connect": {
      "command": "npx",
      "args": ["-y", "asc-mcp@latest"],
      "env": {
        "APP_STORE_CONNECT_KEY_ID": "YOUR_KEY_ID",
        "APP_STORE_CONNECT_ISSUER_ID": "YOUR_ISSUER_ID",
        "APP_STORE_CONNECT_P8_PATH": "/absolute/path/to/AuthKey.p8"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>VS Code with Continue</strong></summary>

Add to your Continue configuration:

```json
{
  "mcpServers": {
    "app-store-connect": {
      "command": "npx",
      "args": ["-y", "asc-mcp@latest"],
      "env": {
        "APP_STORE_CONNECT_KEY_ID": "YOUR_KEY_ID",
        "APP_STORE_CONNECT_ISSUER_ID": "YOUR_ISSUER_ID",
        "APP_STORE_CONNECT_P8_PATH": "/absolute/path/to/AuthKey.p8"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Using P8 Content Instead of Path</strong></summary>

For CI/CD or containerized environments, you can pass the key content directly:

```json
{
  "mcpServers": {
    "app-store-connect": {
      "command": "npx",
      "args": ["-y", "asc-mcp@latest"],
      "env": {
        "APP_STORE_CONNECT_KEY_ID": "YOUR_KEY_ID",
        "APP_STORE_CONNECT_ISSUER_ID": "YOUR_ISSUER_ID",
        "APP_STORE_CONNECT_P8_CONTENT": "-----BEGIN PRIVATE KEY-----\nMIGT...your key here...AB12\n-----END PRIVATE KEY-----"
      }
    }
  }
}
```

</details>

## Available Tools

### Apps

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_apps` | List all apps in your account | `limit?` (number, 1-200) |
| `get_app` | Get details of a specific app | `appId` (string, required) |

### Versions

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_app_versions` | List all versions for an app | `appId`, `platform?`, `versionState?`, `limit?` |
| `get_app_version` | Get version details | `versionId` |
| `create_app_version` | Create a new app version | `appId`, `platform`, `versionString`, `releaseType?` |

### Version Localizations

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_version_localizations` | List localizations for a version | `versionId`, `limit?` |
| `get_version_localization` | Get localization details | `localizationId` |
| `create_version_localization` | Add a new locale | `versionId`, `locale`, `description?`, `keywords?`, `whatsNew?` |
| `update_version_localization` | Update localization | `localizationId`, `description?`, `keywords?`, `whatsNew?`, `promotionalText?` |
| `delete_version_localization` | Remove a locale | `localizationId` |

### App Info Localizations

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_app_infos` | List app info records | `appId`, `limit?` |
| `list_app_info_localizations` | List name/subtitle localizations | `appInfoId`, `limit?` |
| `update_app_info_localization` | Update app name, subtitle | `localizationId`, `name?`, `subtitle?`, `privacyPolicyUrl?` |

### Beta Testing (TestFlight)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_beta_groups` | List beta groups for an app | `appId`, `limit?` |
| `list_beta_testers` | List testers in a group | `betaGroupId`, `limit?` |
| `add_beta_tester` | Add a tester to a group | `betaGroupId`, `email`, `firstName?`, `lastName?` |
| `remove_beta_tester` | Remove a tester from a group | `betaGroupId`, `betaTesterId` |

### Screenshots

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_screenshot_sets` | List screenshot sets | `localizationId`, `limit?` |
| `list_screenshots` | List screenshots in a set | `screenshotSetId`, `limit?` |
| `upload_screenshot` | Upload a new screenshot | `screenshotSetId`, `fileName`, `fileSize`, `filePath` |

### Bundle IDs

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_bundle_ids` | List all bundle IDs | `limit?`, `platform?` |
| `get_bundle_id` | Get bundle ID details | `bundleIdId` |
| `create_bundle_id` | Register a new bundle ID | `identifier`, `name`, `platform` |
| `update_bundle_id` | Update bundle ID name | `bundleIdId`, `name` |
| `delete_bundle_id` | Delete a bundle ID | `bundleIdId` |

### Devices

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_devices` | List registered devices | `limit?`, `platform?`, `status?` |
| `get_device` | Get device details | `deviceId` |

### Users

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_users` | List team users | `limit?`, `roles?` |
| `get_user` | Get user details | `userId` |

### Builds

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_builds` | List builds for an app | `appId`, `limit?` |
| `get_build` | Get build details | `buildId` |

### Categories & Pricing

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_app_categories` | List app categories | `limit?`, `platform?` |
| `get_app_price_schedule` | Get app pricing info | `appId` |
| `get_app_availability` | Get app territory availability | `appId` |

### Pricing (PPP)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_territories` | List all territories with currencies | `limit?` |
| `list_app_price_points` | List available price tiers for an app | `appId`, `territory?`, `limit?` |
| `get_price_point_equalizations` | Get PPP equivalent prices across countries | `pricePointId`, `territories?`, `limit?` |
| `set_app_prices` | Set per-territory manual pricing (replaces entire schedule) | `appId`, `baseTerritory`, `manualPrices` |

### In-App Purchases (Lifetime / Non-Consumable)

One-time purchases via Apple's In-App Purchases v2 API. `create_in_app_purchase` defaults to `NON_CONSUMABLE` — a "lifetime" unlock. To ship one: create → add a localization → set a price → set availability → submit for review.

> **Note:** App Review usually requires a review screenshot on the in-app purchase. Uploading IAP review screenshots is not yet covered by these tools — add one in App Store Connect if `submit_in_app_purchase_for_review` is rejected for a missing screenshot.

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_in_app_purchases` | List an app's in-app purchases, optionally by type | `appId`, `inAppPurchaseType?`, `limit?` |
| `get_in_app_purchase` | Get a single in-app purchase's details and state | `inAppPurchaseId` |
| `create_in_app_purchase` | Create an IAP (defaults to NON_CONSUMABLE / lifetime) | `appId`, `name`, `productId`, `inAppPurchaseType?`, `familySharable?`, `reviewNote?` |
| `update_in_app_purchase` | Update name, Family Sharing, or review note (productId/type immutable) | `inAppPurchaseId`, `name?`, `familySharable?`, `reviewNote?` |
| `delete_in_app_purchase` | Delete an in-app purchase | `inAppPurchaseId` |
| `list_in_app_purchase_localizations` | List localized names/descriptions | `inAppPurchaseId`, `limit?` |
| `create_in_app_purchase_localization` | Add a localized display name (+ description) | `inAppPurchaseId`, `locale`, `name`, `description?` |
| `update_in_app_purchase_localization` | Update a localization | `localizationId`, `name?`, `description?` |
| `delete_in_app_purchase_localization` | Delete a localization | `localizationId` |
| `list_in_app_purchase_price_points` | List price points (customer price & proceeds) | `inAppPurchaseId`, `territory?`, `limit?`, `offset?` |
| `get_in_app_purchase_price_point_equalizations` | Apple's PPP-equivalent price points for a base price point | `pricePointId`, `territories?`, `limit?` |
| `set_in_app_purchase_price` | Set pricing (replaces schedule; one base territory to auto-equalize, or full PPP list) | `inAppPurchaseId`, `baseTerritory`, `manualPrices` |
| `list_in_app_purchase_prices` | Read current per-territory prices (manual; optional automatic) | `inAppPurchaseId`, `territory?`, `includeAutomatic?`, `limit?` |
| `get_in_app_purchase_availability` | Get territory availability | `inAppPurchaseId` |
| `set_in_app_purchase_availability` | Set territory availability | `inAppPurchaseId`, `availableInNewTerritories`, `territories?` |
| `submit_in_app_purchase_for_review` | Submit the IAP to App Review (independent of an app version) | `inAppPurchaseId` |

### Analytics Reports

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_analytics_report_request` | Request an analytics report (ongoing or one-time snapshot) | `appId`, `accessType` |
| `list_analytics_report_requests` | List analytics report requests for an app | `appId` |
| `get_analytics_report_request` | Get an analytics report request | `requestId` |
| `delete_analytics_report_request` | Delete an analytics report request | `requestId` |
| `list_analytics_reports` | List reports available within a request | `requestId` |
| `list_analytics_report_instances` | List instances (by date) of a report | `reportId` |
| `list_analytics_report_segments` | List downloadable segments of a report instance | `instanceId` |
| `download_analytics_report_segment` | Download a report segment | `url` |

### Sales & Finance

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_sales_report` | Download a sales/trends report | `vendorNumber`, `reportType`, `reportSubType`, `frequency`, `reportDate` |
| `get_finance_report` | Download a financial report | `vendorNumber`, `regionCode`, `reportDate`, `reportType` |

### Performance & Diagnostics

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_app_perf_metrics` | Get an app's power & performance metrics | `appId`, `metricType` |
| `get_build_perf_metrics` | Get a build's performance metrics | `buildId`, `metricType` |
| `list_diagnostic_signatures` | List diagnostic signatures for a build | `buildId` |
| `list_diagnostic_logs` | List diagnostic logs for a signature | `signatureId` |

### Any API Operation (generic)

| Tool | Description | Parameters |
|------|-------------|------------|
| `asc_api_request` | Call any App Store Connect API operation (1303 operations from Apple's OpenAPI 4.5.1). | `method?`, `path?`, `query?`, `body?`, `paginate?`, `maxItems?`, `cursor?`, `allowUnknown?` |
| `asc_api_search` | Search the App Store Connect API operation index by keywords (matches paths, operation IDs, resource types), e.g. 'phased release', 'customer reviews', 'offer codes'. | `query`, `method?`, `limit?` |
| `asc_api_describe` | Describe one App Store Connect API operation: query parameters with allowed values, body attributes (types, enums, required), relationships, and a minimal body template. | `method`, `path` |

### Subscriptions

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_subscription_groups` | List all subscription groups for an app. | `appId`, `limit?` |
| `get_subscription_group` | Get details of a specific subscription group by its ID. | `subscriptionGroupId` |
| `create_subscription_group` | Create a new subscription group for an app. | `appId`, `referenceName` |
| `update_subscription_group` | Update the reference name of a subscription group. | `subscriptionGroupId`, `referenceName` |
| `list_subscription_group_localizations` | List the localizations for a subscription group. | `subscriptionGroupId`, `limit?` |
| `get_subscription_group_localization` | Get a single subscription group localization by its ID. | `localizationId` |
| `create_subscription_group_localization` | Create a localization for a subscription group. | `subscriptionGroupId`, `name`, `locale`, `customAppName?`, `customAppDescription?` |
| `update_subscription_group_localization` | Update an existing subscription group localization. | `localizationId`, `name?`, `customAppName?`, `customAppDescription?` |
| `list_subscriptions` | List all auto-renewable subscriptions within a subscription group. | `subscriptionGroupId`, `limit?` |
| `get_subscription` | Get details of a specific auto-renewable subscription by its ID. | `subscriptionId` |
| `create_subscription` | Create a new auto-renewable subscription within a subscription group. | `subscriptionGroupId`, `name`, `productId`, `subscriptionPeriod`, `familySharable?`, `reviewNote?`, `groupLevel?` |
| `update_subscription` | Update the metadata of an existing auto-renewable subscription. | `subscriptionId`, `name?`, `familySharable?`, `subscriptionPeriod?`, `reviewNote?`, `groupLevel?` |
| `delete_subscription` | Delete an auto-renewable subscription. | `subscriptionId` |
| `list_subscription_localizations` | List all localizations (translated names and descriptions) for a subscription. | `subscriptionId`, `limit?` |
| `create_subscription_localization` | Create a localized name and description for a subscription in a specific locale. | `subscriptionId`, `name`, `locale`, `description?` |
| `update_subscription_localization` | Update the localized name or description for a subscription localization. | `localizationId`, `name?`, `description?` |
| `delete_subscription_localization` | Delete a localization for a subscription. | `localizationId` |
| `list_subscription_price_points` | List available price points for a subscription, showing customer price and developer proceeds. | `subscriptionId`, `territory?`, `limit?`, `offset?` |
| `list_subscription_prices` | List the current prices set for a subscription, including price tier and territory details. | `subscriptionId`, `territory?`, `limit?` |
| `get_subscription_availability` | Get the territory availability configuration for a subscription — shows which territories it is available in and whether it is automatically available in new territories. | `subscriptionId` |
| `set_subscription_availability` | Set the territory availability for a subscription. | `subscriptionId`, `availableInNewTerritories`, `territories?` |
| `create_subscription_price` | Set the price for a subscription in a specific territory. | `subscriptionId`, `subscriptionPricePointId`, `startDate?`, `preserveCurrentPrice?` |
| `list_promotional_offers` | List all promotional offers configured for a subscription. | `subscriptionId`, `limit?` |
| `create_promotional_offer` | Create a promotional offer for a subscription. | `subscriptionId`, `name`, `offerCode`, `duration`, `offerMode`, `periodCount?`, `prices?` |
| `update_promotional_offer` | Update an existing promotional offer's attributes or prices. | `promotionalOfferId`, `name?`, `offerCode?`, `duration?`, `offerMode?`, `periodCount?`, `prices?` |
| `delete_promotional_offer` | Delete a promotional offer from a subscription. | `promotionalOfferId` |
| `list_promotional_offer_prices` | List the prices set for a promotional offer, with resolved price tier and territory details. | `promotionalOfferId`, `limit?` |

### Version Admin & App Review Details

| Tool | Description | Parameters |
|------|-------------|------------|
| `update_app_version` | Update an App Store version's version string, copyright, release type, or scheduled release date. | `versionId`, `versionString?`, `copyright?`, `releaseType?`, `earliestReleaseDate?` |
| `delete_app_version` | Delete an App Store version. | `versionId` |
| `get_app_version_build` | Get the build attached to an App Store version (null when none is attached). | `versionId` |
| `set_app_version_build` | Attach a build to an App Store version. | `versionId`, `buildId` |
| `get_review_detail` | Get the App Review details for a version: contact, demo account, and review notes. | `versionId` |
| `create_review_detail` | Create App Review details for a version that has none. contactFirstName and contactPhone are required. | `versionId`, `contactFirstName`, `contactPhone`, `contactLastName?`, `contactEmail?`, `demoAccountName?`, `demoAccountPassword?`, `demoAccountRequired?`, `notes?` |
| `update_review_detail` | Update App Review details (contact, demo account, notes). | `reviewDetailId`, `contactFirstName?`, `contactLastName?`, `contactPhone?`, `contactEmail?`, `demoAccountName?`, `demoAccountPassword?`, `demoAccountRequired?`, `notes?` |

### Release & Export Compliance

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_phased_release` | Get the phased release (gradual rollout) of an App Store version. | `versionId` |
| `create_phased_release` | Create a phased release for an App Store version. | `versionId`, `phasedReleaseState?` |
| `update_phased_release` | Change a phased release to ACTIVE, PAUSED, or COMPLETE. | `phasedReleaseId`, `phasedReleaseState`, `confirmReleaseToAll?` |
| `delete_phased_release` | Delete a phased release for an App Store version. | `phasedReleaseId` |
| `release_app_version` | Release an App Store version that is approved and waiting for developer release (PENDING_DEVELOPER_RELEASE). | `versionId` |
| `list_encryption_declarations` | List export compliance (encryption) declarations for an app. | `appId`, `limit?` |
| `get_encryption_declaration` | Get one export compliance (encryption) declaration by ID. | `declarationId` |
| `create_encryption_declaration` | Create an export compliance (encryption) declaration for an app. | `appId`, `appDescription`, `containsProprietaryCryptography`, `containsThirdPartyCryptography`, `availableOnFrenchStore` |
| `assign_builds_to_encryption_declaration` | Link builds to an encryption declaration. | `declarationId`, `buildIds` |
| `update_build` | Update a build's usesNonExemptEncryption flag, its encryption declaration, or expire it. | `buildId`, `expired?`, `confirmExpire?`, `usesNonExemptEncryption?`, `appEncryptionDeclarationId?` |

### App Review Submissions

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_review_submissions` | List review submissions for an app, optionally filtered by state or platform. | `appId`, `state?`, `platform?`, `limit?` |
| `get_review_submission` | Get a review submission with the items it contains. | `submissionId` |
| `create_review_submission` | Create a review submission for one platform of an app. | `appId`, `platform` |
| `add_review_submission_item` | Add one item to a review submission. | `submissionId`, `itemType`, `itemId` |
| `remove_review_submission_item` | Remove an item from a review submission. | `itemId` |
| `submit_review_submission` | Submit a review submission to App Review. | `submissionId`, `expectedItemIds` |
| `cancel_review_submission` | Cancel a review submission that is in progress. | `submissionId` |

### App Info: Categories, Age Rating, EULA

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_app_info_categories` | Get the primary and secondary App Store categories and subcategories of an app info record. | `appInfoId` |
| `set_app_categories` | Set one or more App Store categories or subcategories on an app info record. | `appInfoId`, `primaryCategoryId?`, `primarySubcategoryOneId?`, `primarySubcategoryTwoId?`, `secondaryCategoryId?`, `secondarySubcategoryOneId?`, `secondarySubcategoryTwoId?` |
| `list_app_subcategories` | List the subcategories of an App Store category, for example the subcategories of GAMES. | `categoryId`, `limit?` |
| `get_age_rating_declaration` | Get the age rating questionnaire answers for an app info record. | `appInfoId` |
| `update_age_rating_declaration` | Update age rating questionnaire answers. | `declarationId`, `attributes` |
| `create_app_info_localization` | Create an app info localization (name, subtitle, privacy links) for a locale. | `appInfoId`, `locale`, `name`, `subtitle?`, `privacyPolicyUrl?`, `privacyChoicesUrl?`, `privacyPolicyText?` |
| `delete_app_info_localization` | Delete an app info localization. | `localizationId` |
| `get_eula` | Get the custom end user license agreement for an app. | `appId` |
| `create_eula` | Create a custom end user license agreement for an app, applied to the given territories (e.g. | `appId`, `agreementText`, `territories` |
| `update_eula` | Update an app's custom EULA text and/or territories. | `eulaId`, `agreementText?`, `territories?` |
| `delete_eula` | Delete an app's custom end user license agreement. | `eulaId` |

### Media: Screenshot Sets, App Previews, Review Screenshots

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_screenshot_set` | Create a screenshot set for one device display size in an App Store version localization. | `localizationId`, `screenshotDisplayType` |
| `delete_screenshot_set` | Delete a screenshot set and every screenshot in it. | `screenshotSetId` |
| `delete_screenshot` | Delete one screenshot from its screenshot set. | `screenshotId` |
| `reorder_screenshots` | Set the display order of the screenshots in a set. screenshotIds must list every current screenshot in the set exactly once, in the new order; get the IDs with list_screenshots. | `screenshotSetId`, `screenshotIds` |
| `list_preview_sets` | List the app preview sets (one per device type) in an App Store version localization. | `localizationId`, `limit?` |
| `create_preview_set` | Create an app preview set for one device type in an App Store version localization. | `localizationId`, `previewType` |
| `delete_preview_set` | Delete an app preview set and every app preview in it. | `previewSetId` |
| `list_previews` | List the app previews (videos) in an app preview set. | `previewSetId`, `limit?` |
| `upload_app_preview` | Upload a .mov, .m4v, or .mp4 video as an app preview. | `previewSetId`, `filePath`, `fileName?`, `previewFrameTimeCode?`, `waitForProcessing?` |
| `delete_app_preview` | Delete one app preview from its preview set. | `previewId` |
| `reorder_previews` | Set the display order of the app previews in a preview set. previewIds must list every current preview in the set exactly once, in the new order; get the IDs with list_previews. | `previewSetId`, `previewIds` |
| `upload_subscription_review_screenshot` | Upload the App Review screenshot for a subscription from a local file. | `subscriptionId`, `filePath`, `fileName?` |
| `upload_iap_review_screenshot` | Upload the App Review screenshot for an in-app purchase from a local file. | `inAppPurchaseId`, `filePath`, `fileName?` |

### TestFlight Groups

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_beta_group` | Get a beta group's settings, including its public TestFlight link. | `betaGroupId` |
| `create_beta_group` | Create a beta group for an app. | `appId`, `name`, `isInternalGroup?`, `hasAccessToAllBuilds?`, `publicLinkEnabled?`, `publicLinkLimitEnabled?`, `publicLinkLimit?`, `feedbackEnabled?` |
| `update_beta_group` | Update a beta group's settings. | `betaGroupId`, `name?`, `publicLinkEnabled?`, `publicLinkLimitEnabled?`, `publicLinkLimit?`, `feedbackEnabled?`, `iosBuildsAvailableForAppleSiliconMac?`, `iosBuildsAvailableForAppleVision?` |
| `delete_beta_group` | Delete a beta group. | `betaGroupId` |
| `list_beta_group_builds` | List the builds available to a beta group. | `betaGroupId`, `limit?` |
| `add_builds_to_beta_group` | Make one or more builds available to a beta group. | `betaGroupId`, `buildIds` |
| `remove_builds_from_beta_group` | Remove one or more builds from a beta group. | `betaGroupId`, `buildIds` |
| `add_testers_to_beta_group` | Add existing beta testers to a beta group by tester ID. | `betaGroupId`, `betaTesterIds` |
| `delete_beta_tester` | Delete a beta tester from the account. | `betaTesterId` |
| `invite_beta_tester` | Send an existing beta tester an invitation to test an app. | `appId`, `betaTesterId` |

### TestFlight Builds & Beta Review

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_beta_build_localizations` | List the TestFlight 'What to Test' notes for a build, one per locale. | `buildId`, `limit?` |
| `create_beta_build_localization` | Add 'What to Test' notes for a build in one locale. | `buildId`, `locale`, `whatsNew?` |
| `update_beta_build_localization` | Replace the 'What to Test' notes of a build localization. | `localizationId`, `whatsNew` |
| `delete_beta_build_localization` | Delete the 'What to Test' notes of a build for one locale. | `localizationId` |
| `list_beta_app_localizations` | List the TestFlight app details (description, feedback email, URLs) for an app, one per locale. | `appId`, `limit?` |
| `create_beta_app_localization` | Add TestFlight app details for an app in one locale. | `appId`, `locale`, `description?`, `feedbackEmail?`, `marketingUrl?`, `privacyPolicyUrl?`, `tvOsPrivacyPolicy?` |
| `update_beta_app_localization` | Update the TestFlight app details for one locale. | `localizationId`, `description?`, `feedbackEmail?`, `marketingUrl?`, `privacyPolicyUrl?`, `tvOsPrivacyPolicy?` |
| `delete_beta_app_localization` | Delete the TestFlight app details for one locale. | `localizationId` |
| `get_beta_app_review_detail` | Get the TestFlight beta App Review details for an app: contact, demo account, and notes. | `appId` |
| `update_beta_app_review_detail` | Update the TestFlight beta App Review details (contact, demo account, notes). | `reviewDetailId`, `contactFirstName?`, `contactLastName?`, `contactPhone?`, `contactEmail?`, `demoAccountName?`, `demoAccountPassword?`, `demoAccountRequired?`, `notes?` |
| `submit_build_for_beta_review` | Submit a build to TestFlight beta App Review so it can be shared with external testers. | `buildId` |
| `list_beta_review_submissions` | List the TestFlight beta App Review submissions for a build, optionally filtered by review state. | `buildId`, `betaReviewState?`, `limit?` |
| `get_build_beta_detail` | Get the TestFlight settings and processing states for a build (auto-notify, internal and external state). | `buildId` |
| `update_build_beta_detail` | Turn automatic tester notifications on or off for a build. | `buildBetaDetailId`, `autoNotifyEnabled` |
| `list_pre_release_versions` | List the TestFlight pre-release versions (version string and platform) of an app. | `appId`, `limit?` |

### Customer Reviews

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_customer_reviews` | List customer reviews for an app, each with its developer response when one exists. | `appId`, `rating?`, `territory?`, `sort?`, `hasResponse?`, `limit?` |
| `get_customer_review` | Get one customer review by ID, including its developer response when one exists. | `reviewId` |
| `get_review_response` | Get the developer response to a customer review (null when there is none). | `reviewId` |
| `create_review_response` | Publish a developer response to a customer review. | `reviewId`, `responseBody` |
| `delete_review_response` | Delete a developer response to a customer review. | `responseId` |

### Subscription Offers (Introductory & Win-Back)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_introductory_offers` | List introductory offers for a subscription, with territory and price point IDs. | `subscriptionId`, `territoryId?`, `limit?` |
| `create_introductory_offer` | Create an introductory offer for a subscription in one territory. | `subscriptionId`, `duration`, `offerMode`, `numberOfPeriods`, `startDate?`, `endDate?`, `targetSubscriptionPlanType?`, `territoryId?`, `pricePointId?` |
| `update_introductory_offer` | Change the end date of an introductory offer. | `introductoryOfferId`, `endDate` |
| `delete_introductory_offer` | Delete an introductory offer by ID. | `introductoryOfferId` |
| `list_win_back_offers` | List win-back offers for a subscription. | `subscriptionId`, `limit?` |
| `create_win_back_offer` | Create a win-back offer for lapsed subscribers, with one price entry per territory. | `subscriptionId`, `referenceName`, `offerId`, `duration`, `offerMode`, `periodCount`, `customerEligibilityPaidSubscriptionDurationInMonths`, `customerEligibilityTimeSinceLastSubscribedInMonths`, `startDate`, `priority`, `prices`, `customerEligibilityWaitBetweenOffersInMonths?`, `endDate?`, `promotionIntent?`, `targetSubscriptionPlanType?` |
| `update_win_back_offer` | Update a win-back offer's eligibility, dates, priority, or promotion intent. | `winBackOfferId`, `customerEligibilityPaidSubscriptionDurationInMonths?`, `customerEligibilityTimeSinceLastSubscribedInMonths?`, `customerEligibilityWaitBetweenOffersInMonths?`, `startDate?`, `endDate?`, `priority?`, `promotionIntent?` |
| `delete_win_back_offer` | Delete a win-back offer by ID. | `winBackOfferId` |
| `list_win_back_offer_prices` | List the per-territory prices of a win-back offer, with territory and price point IDs. | `winBackOfferId`, `territoryId?`, `limit?` |

### Subscription Offer Codes

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_subscription_offer_codes` | List the offer codes for a subscription, optionally filtered by territory codes such as USA. | `subscriptionId`, `territories?`, `limit?` |
| `get_subscription_offer_code` | Get one subscription offer code by ID, including its code counts and state. | `offerCodeId` |
| `create_subscription_offer_code` | Create a subscription offer code. | `subscriptionId`, `name`, `customerEligibilities`, `offerEligibility`, `duration`, `offerMode`, `numberOfPeriods`, `autoRenewEnabled?`, `targetSubscriptionPlanType?`, `prices?` |
| `update_subscription_offer_code` | Activate or deactivate a subscription offer code. | `offerCodeId`, `active` |
| `create_subscription_one_time_codes` | Generate a batch of one-time use redemption codes for a subscription offer code. | `offerCodeId`, `numberOfCodes`, `expirationDate`, `environment?` |
| `list_subscription_one_time_code_batches` | List the one-time use code batches generated for a subscription offer code. | `offerCodeId`, `limit?` |
| `get_subscription_one_time_code_values` | Download the redemption codes of a one-time use code batch as CSV, inline or (for large batches) to a new file via savePath. | `oneTimeUseCodeBatchId`, `savePath?` |
| `create_subscription_custom_code` | Create a custom (vanity) redemption code for a subscription offer code, optionally with an expiration date. | `offerCodeId`, `customCode`, `numberOfCodes`, `expirationDate?` |
| `list_subscription_custom_codes` | List the custom codes created for a subscription offer code. | `offerCodeId`, `limit?` |

### In-App Purchase Offer Codes

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_iap_offer_codes` | List the offer codes configured for an in-app purchase. | `inAppPurchaseId`, `limit?` |
| `get_iap_offer_code` | Get one in-app purchase offer code by ID. | `offerCodeId` |
| `create_iap_offer_code` | Create an in-app purchase offer code with a price per territory. | `inAppPurchaseId`, `name`, `customerEligibilities`, `prices` |
| `update_iap_offer_code` | Activate or deactivate an in-app purchase offer code. | `offerCodeId`, `active` |
| `create_iap_one_time_codes` | Generate a batch of one-time-use redemption codes for an offer code. | `offerCodeId`, `numberOfCodes`, `expirationDate`, `environment?` |
| `list_iap_one_time_code_batches` | List the one-time-use code batches generated for an offer code, with counts and expiry dates. | `offerCodeId`, `limit?` |
| `get_iap_one_time_code_values` | Get the redemption code values of a one-time-use batch as CSV, inline or (for large batches) to a new file via savePath, with the number of non-empty lines. | `oneTimeUseCodeBatchId`, `savePath?` |
| `create_iap_custom_code` | Create a custom redemption code for an offer code. | `offerCodeId`, `customCode`, `numberOfCodes`, `expirationDate?` |
| `list_iap_custom_codes` | List the custom redemption codes for an offer code, with redemption counts and expiry dates. | `offerCodeId`, `limit?` |

### Custom Product Pages

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_custom_product_pages` | List the custom product pages of an app, optionally filtered by visibility. | `appId`, `visible?`, `limit?` |
| `get_custom_product_page` | Get one custom product page by ID. | `customProductPageId` |
| `create_custom_product_page` | Create a custom product page for an app, with its first version and one localization (the app's primary locale unless locale is given). | `appId`, `name`, `locale?`, `promotionalText?`, `deepLink?` |
| `update_custom_product_page` | Update a custom product page's name or visibility. | `customProductPageId`, `name?`, `visible?` |
| `delete_custom_product_page` | Delete a custom product page by ID. | `customProductPageId` |
| `list_cpp_versions` | List the versions of a custom product page, optionally filtered by review state. | `customProductPageId`, `states?`, `limit?` |
| `create_cpp_version` | Create a new version of a custom product page, optionally with a deep link. | `customProductPageId`, `deepLink?` |
| `list_cpp_localizations` | List the per-locale localizations of a custom product page version, optionally filtered by locale. | `versionId`, `locales?`, `limit?` |
| `create_cpp_localization` | Add a locale with promotional text to a custom product page version. | `versionId`, `locale`, `promotionalText?` |
| `update_cpp_localization` | Set the promotional text of a custom product page localization. | `localizationId`, `promotionalText` |
| `delete_cpp_localization` | Delete a custom product page localization by ID. | `localizationId` |

## Usage Examples

### List Your Apps

> "Show me all my apps in App Store Connect"

Claude will use `list_apps` to retrieve and display your apps.

### Update App Description

> "Update the English description for version 2.0 of MyApp to: 'A revolutionary app that simplifies your daily tasks.'"

Claude will:
1. Find the app using `list_apps`
2. Get the version using `list_app_versions`
3. Find the English localization using `list_version_localizations`
4. Update it using `update_version_localization`

### Add Japanese Localization

> "Add Japanese localization to MyApp version 2.0 with description '素晴らしいアプリです' and keywords 'アプリ,便利,簡単'"

Claude will use `create_version_localization` with locale `ja`.

### Add a Beta Tester

> "Add john@example.com as a beta tester to the Internal Testing group for MyApp"

Claude will:
1. Find the app and beta group using `list_beta_groups`
2. Add the tester using `add_beta_tester`

### Set PPP Pricing

> "Show me the equivalent prices for my $9.99 tier in India, Brazil, and Turkey"

Claude will:
1. Find the $9.99 price point using `list_app_price_points`
2. Get equivalent prices using `get_price_point_equalizations`
3. Show you the PPP-adjusted prices in each territory

> "Set my app to $9.99 in the US and use PPP pricing for India and Brazil"

Claude will use `set_app_prices` with the appropriate price point IDs for each territory.

### Create a Lifetime Purchase

> "Add a $99.99 lifetime unlock to MyApp with PPP pricing for India and Brazil"

Claude will:
1. Create a non-consumable IAP with `create_in_app_purchase`
2. Add a display name with `create_in_app_purchase_localization`
3. Find the $99.99 tier with `list_in_app_purchase_price_points`, then PPP equivalents with `get_in_app_purchase_price_point_equalizations`
4. Apply per-territory pricing with `set_in_app_purchase_price` and open availability with `set_in_app_purchase_availability`
5. Confirm the result with `list_in_app_purchase_prices`

### Check Version Status

> "What's the status of all versions of MyApp?"

Claude will use `list_app_versions` to show version states (PREPARE_FOR_SUBMISSION, IN_REVIEW, READY_FOR_SALE, etc.)

### Prepare and Submit a Version

> "Set the copyright of MyApp 2.1 to '2026 Example Inc.', attach build 42, add review notes, and submit it for review"

Claude will use `update_app_version`, `set_app_version_build` (only VALID builds attach), `update_review_detail`, then `create_review_submission`, `add_review_submission_item`, and `submit_review_submission`, which refuses if the submission holds anything besides the items you expect.

### Anything Without a Dedicated Tool

> "Turn on Game Center for MyApp's next version"

Claude will use `asc_api_search` to find the operation, `asc_api_describe` to see its body, and `asc_api_request` to call it.

## Security

### Credential Handling

- **Private keys** are never logged or exposed in error messages
- **JWT tokens** are automatically redacted from any error output
- **Issuer ID** is redacted from error messages and details; demo account passwords are never returned and are redacted from errors
- **Read-only mode** (`ASC_READ_ONLY=1`) blocks writes in the HTTP client itself, not just in the tool list
- **Generic requests** only reach relative `/v1`-`/v3` paths on the App Store Connect host, with `..`, encoded, and absolute paths rejected; they must match Apple's spec unless `allowUnknown` is set. Demo account passwords and webhook secrets are masked in responses
- **Offer code CSVs** are written only to new files (`savePath`, owner-only permissions), never over existing ones
- Token caching minimizes key usage (15-min tokens, refreshed at 10 min)

### Path Validation

- P8 file paths are validated against directory traversal attacks (`..` not allowed)
- Only absolute paths are resolved

### Best Practices

1. **Never commit credentials** - Use environment variables or a secrets manager
2. **Restrict API key permissions** - Use minimal required role (App Manager for most operations)
3. **Rotate keys periodically** - Generate new API keys and revoke old ones
4. **Secure your .p8 file** - Set file permissions to `600` (owner read/write only)

```bash
chmod 600 /path/to/AuthKey.p8
```

## Troubleshooting

### "Configuration error: APP_STORE_CONNECT_KEY_ID environment variable is required"

Ensure all required environment variables are set:
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_P8_PATH` or `APP_STORE_CONNECT_P8_CONTENT`

### "Failed to read private key"

1. Verify the path in `APP_STORE_CONNECT_P8_PATH` is correct and absolute
2. Check file permissions: `ls -la /path/to/AuthKey.p8`
3. Ensure the file is a valid `.p8` from Apple (starts with `-----BEGIN PRIVATE KEY-----`)

### "Authentication failed"

This usually means:
1. The API key was revoked in App Store Connect
2. The Key ID or Issuer ID doesn't match the .p8 file
3. The .p8 file is corrupted or incomplete

### "Rate limit exceeded"

The server includes built-in rate limiting (50 requests/minute). If you hit Apple's limits:
1. Wait for the indicated retry time
2. Batch your operations when possible
3. The server automatically retries with exponential backoff

### Tools Not Appearing in Claude

1. Verify the server is running: check Claude Desktop logs
2. Ensure the config file path is correct for your OS
3. Restart Claude Desktop after config changes

## Development

### Prerequisites

- Node.js 20+
- npm or pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/SardorbekR/appstore-connect-mcp.git
cd appstore-connect-mcp

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

### Project Structure

```
src/
├── index.ts          # MCP server entry point
├── auth/
│   └── jwt.ts        # JWT token generation & caching
├── api/
│   ├── client.ts     # HTTP client with retry logic and read-only guard
│   ├── upload.ts     # Shared asset upload (reserve, upload chunks, commit, poll)
│   └── types.ts      # TypeScript interfaces
├── openapi/
│   ├── schema-index.json  # Operation index generated from spec/openapi.oas.json
│   └── index.ts           # Match, search, and describe operations
├── tools/
│   ├── index.ts      # Tool registry (toolsets, read-only filtering)
│   ├── api.tools.ts  # Generic asc_api_* tools
│   ├── apps.tools.ts
│   ├── versions.tools.ts
│   ├── localizations.tools.ts
│   ├── app-info.tools.ts
│   ├── beta.tools.ts
│   ├── screenshots.tools.ts
│   ├── bundle-ids.tools.ts
│   ├── devices.tools.ts
│   ├── users.tools.ts
│   ├── builds.tools.ts
│   ├── categories.tools.ts
│   └── ...           # One file per domain (subscriptions, release, media, ...)
└── utils/
    ├── errors.ts     # Error classes with redaction
    └── validation.ts # Zod schemas
```

### OpenAPI Spec

`spec/openapi.oas.json` is Apple's App Store Connect OpenAPI spec, pinned (see `spec/README.md`). Tests check every request a tool sends against it.

```bash
npm run check-openapi   # fail if src/openapi/schema-index.json is stale
npm run update-openapi  # download Apple's latest spec and regenerate the index
npx tsx scripts/spec-sheet.ts "PATCH /v1/appInfos/{id}"  # print an operation's resolved shape
```

### Running Locally

```bash
# Development mode with auto-reload
npm run dev

# Or run the built version
npm start
```

### Releasing

Releases publish from GitHub Actions (`.github/workflows/publish.yml`) when a version tag is pushed. npm uses [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no token, provenance attached) and the MCP Registry uses GitHub OIDC.

1. Set the new version in `package.json` and `package-lock.json` (`npm version X.Y.Z --no-git-tag-version`), both fields in `server.json`, and `SERVER_VERSION` in `src/index.ts`
2. Merge to `main`
3. `git tag vX.Y.Z && git push origin vX.Y.Z`

The workflow refuses to publish if any version field differs from the tag, or if typecheck, lint, tests, or the OpenAPI index check fail.

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run `npm test` and `npm run lint`
5. Submit a pull request

## Acknowledgements

The generic API tools, the OpenAPI index format, and several workflow details (review submissions, asset uploads, offer pricing) follow [rorkai/App-Store-Connect-CLI](https://github.com/rorkai/App-Store-Connect-CLI) (MIT).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Security Policy](SECURITY.md)
- [App Store Connect API Documentation](https://developer.apple.com/documentation/appstoreconnectapi)
- [Model Context Protocol](https://modelcontextprotocol.io)
