# App Store Connect MCP Server

[![npm version](https://img.shields.io/npm/v/asc-mcp.svg)](https://www.npmjs.com/package/asc-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/asc-mcp.svg)](https://nodejs.org)

A Model Context Protocol (MCP) server for Apple's App Store Connect API. Manage your iOS, macOS, tvOS, and visionOS apps directly from Claude, Cursor, or any MCP-compatible client.

## Features

- **App Store Localizations** - Full CRUD for version descriptions, keywords, and what's new
- **App Management** - List and inspect apps across all platforms
- **Version Control** - Create and manage app store versions
- **Beta Testing** - Manage TestFlight groups and testers
- **Screenshot Management** - Upload and organize app screenshots
- **Bundle ID Management** - Full CRUD for bundle identifiers
- **Device Management** - List and inspect registered devices
- **User Management** - List and inspect team users
- **Build Management** - List and inspect app builds
- **Category & Pricing** - Browse categories, check pricing and availability
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

```bash
# 1. Install
npm install -g asc-mcp

# 2. Set credentials (get from App Store Connect > Users and Access > Keys)
export APP_STORE_CONNECT_KEY_ID="YOUR_KEY_ID"
export APP_STORE_CONNECT_ISSUER_ID="YOUR_ISSUER_ID"
export APP_STORE_CONNECT_P8_PATH="/path/to/AuthKey.p8"

# 3. Add to your MCP client config and start using!
```

## Installation

### npm (recommended)

```bash
npm install -g asc-mcp
```

### Using npx

```bash
npx asc-mcp
```

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
      "command": "asc-mcp",
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
      "args": ["-y", "asc-mcp"],
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
      "command": "asc-mcp",
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
      "command": "asc-mcp",
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

### Check Version Status

> "What's the status of all versions of MyApp?"

Claude will use `list_app_versions` to show version states (PREPARE_FOR_SUBMISSION, IN_REVIEW, READY_FOR_SALE, etc.)

## Security

### Credential Handling

- **Private keys** are never logged or exposed in error messages
- **JWT tokens** are automatically redacted from any error output
- **Issuer IDs** (UUIDs) are redacted from logs
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
│   ├── client.ts     # HTTP client with retry logic
│   └── types.ts      # TypeScript interfaces
├── tools/
│   ├── index.ts      # Tool registry
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
│   └── categories.tools.ts
└── utils/
    ├── errors.ts     # Error classes with redaction
    └── validation.ts # Zod schemas
```

### Running Locally

```bash
# Development mode with auto-reload
npm run dev

# Or run the built version
npm start
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run `npm test` and `npm run lint`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Security Policy](SECURITY.md)
- [App Store Connect API Documentation](https://developer.apple.com/documentation/appstoreconnectapi)
- [Model Context Protocol](https://modelcontextprotocol.io)
