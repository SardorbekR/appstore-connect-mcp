# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in asc-mcp, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainers directly with details of the vulnerability
3. Include steps to reproduce if possible
4. Allow reasonable time for a fix before public disclosure

## Security Best Practices

### Protecting Your API Key

Your App Store Connect API key is extremely sensitive. It can be used to:
- Modify app metadata
- Manage beta testers
- Access app analytics
- And more...

**Never:**
- Commit your .p8 key file to version control
- Share your key in public channels
- Store your key in plain text in scripts

**Always:**
- Store your key file with restricted permissions (`chmod 600`)
- Use environment variables for configuration
- Rotate keys periodically
- Use the minimum required access level for your key

### Environment Variable Security

When using `APP_STORE_CONNECT_P8_CONTENT`:
- Avoid storing the full key in shell history
- Consider using a secrets manager
- Be cautious with logging that might capture environment variables

### Recommended .gitignore

Ensure these patterns are in your `.gitignore`:

```gitignore
# API Keys
*.p8
*.pem

# Environment files
.env
.env.local
.env.*.local
```

## Security Features

### Credential Redaction

All error messages are automatically sanitized to remove:
- JWT tokens
- Private key content
- UUIDs that might be issuer IDs

### Path Traversal Prevention

The server validates that key file paths don't contain path traversal attempts (`..`).

### HTTPS Only

All API communication uses HTTPS. The server rejects any HTTP URLs.

### Token Lifecycle

- JWT tokens expire after 15 minutes
- Tokens are automatically refreshed 5 minutes before expiry
- Tokens are cleared from memory on server shutdown

## Dependencies

This project uses well-maintained dependencies:
- `jose` - For JWT operations (maintained by auth0)
- `zod` - For input validation
- `@modelcontextprotocol/sdk` - Official MCP SDK

All dependencies are regularly audited. Run `npm audit` to check for known vulnerabilities.
