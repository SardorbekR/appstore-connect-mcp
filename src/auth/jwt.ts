/**
 * JWT Token Manager for App Store Connect API authentication
 *
 * Generates ES256 signed JWTs with automatic caching and refresh.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type KeyLike, SignJWT, importPKCS8 } from "jose";
import { AuthError, ConfigError } from "../utils/errors.js";

const TOKEN_LIFETIME_SECONDS = 15 * 60; // 15 minutes
const TOKEN_REFRESH_BUFFER_SECONDS = 5 * 60; // Refresh 5 minutes before expiry
const AUDIENCE = "appstoreconnect-v1";

export interface TokenManagerConfig {
  keyId: string;
  issuerId: string;
  privateKeyPath?: string;
  privateKeyContent?: string;
}

/**
 * Manages JWT token generation and caching for App Store Connect API
 */
export class TokenManager {
  private readonly keyId: string;
  private readonly issuerId: string;
  private readonly privateKeySource:
    | { type: "path"; path: string }
    | { type: "content"; content: string };

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private privateKey: KeyLike | null = null;
  private pendingTokenGeneration: Promise<string> | null = null;

  constructor(config: TokenManagerConfig) {
    this.keyId = config.keyId;
    this.issuerId = config.issuerId;

    if (config.privateKeyPath) {
      // Validate path doesn't contain directory traversal
      if (config.privateKeyPath.includes("..")) {
        throw new ConfigError("Private key path cannot contain '..'");
      }
      this.privateKeySource = { type: "path", path: config.privateKeyPath };
    } else if (config.privateKeyContent) {
      this.privateKeySource = { type: "content", content: config.privateKeyContent };
    } else {
      throw new ConfigError("Either privateKeyPath or privateKeyContent must be provided");
    }
  }

  /**
   * Get a valid JWT token, generating a new one if needed.
   * Uses a pending promise pattern to prevent concurrent token generation.
   */
  async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    // Return cached token if still valid (with buffer)
    if (this.cachedToken && this.tokenExpiresAt > now + TOKEN_REFRESH_BUFFER_SECONDS) {
      return this.cachedToken;
    }

    // If a token generation is already in progress, wait for it
    if (this.pendingTokenGeneration) {
      return this.pendingTokenGeneration;
    }

    // Generate new token with mutex pattern
    this.pendingTokenGeneration = this.generateToken().finally(() => {
      this.pendingTokenGeneration = null;
    });

    return this.pendingTokenGeneration;
  }

  /**
   * Generate a new JWT token
   */
  async generateToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + TOKEN_LIFETIME_SECONDS;

    // Load private key if not already loaded
    if (!this.privateKey) {
      await this.loadPrivateKey();
    }

    if (!this.privateKey) {
      throw new AuthError("Failed to load private key");
    }

    try {
      const jwt = await new SignJWT({})
        .setProtectedHeader({
          alg: "ES256",
          kid: this.keyId,
          typ: "JWT",
        })
        .setIssuer(this.issuerId)
        .setIssuedAt(now)
        .setExpirationTime(expiresAt)
        .setAudience(AUDIENCE)
        .sign(this.privateKey);

      // Cache the token
      this.cachedToken = jwt;
      this.tokenExpiresAt = expiresAt;

      return jwt;
    } catch (error) {
      throw new AuthError(
        `Failed to generate JWT: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Load the private key from file or content
   */
  private async loadPrivateKey(): Promise<void> {
    let keyContent: string;

    if (this.privateKeySource.type === "path") {
      try {
        // Resolve to absolute path
        const absolutePath = path.resolve(this.privateKeySource.path);
        keyContent = await fs.readFile(absolutePath, "utf-8");
      } catch (error) {
        throw new ConfigError(
          `Failed to read private key from ${this.privateKeySource.path}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    } else {
      keyContent = this.privateKeySource.content;
    }

    // Handle raw key content (without PEM headers)
    keyContent = keyContent.trim();
    if (!keyContent.startsWith("-----BEGIN")) {
      keyContent = `-----BEGIN PRIVATE KEY-----\n${keyContent}\n-----END PRIVATE KEY-----`;
    }

    try {
      this.privateKey = await importPKCS8(keyContent, "ES256");
    } catch (error) {
      throw new AuthError(
        `Failed to parse private key: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Clear cached token (call on shutdown)
   */
  destroy(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
    this.privateKey = null;
    this.pendingTokenGeneration = null;
  }

  /**
   * Check if a token is currently cached and valid
   */
  hasValidToken(): boolean {
    const now = Math.floor(Date.now() / 1000);
    return this.cachedToken !== null && this.tokenExpiresAt > now + TOKEN_REFRESH_BUFFER_SECONDS;
  }
}

/**
 * Create a TokenManager from environment variables
 */
export function createTokenManagerFromEnv(): TokenManager {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID;
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID;
  const privateKeyPath = process.env.APP_STORE_CONNECT_P8_PATH;
  const privateKeyContent = process.env.APP_STORE_CONNECT_P8_CONTENT;

  if (!keyId) {
    throw new ConfigError("APP_STORE_CONNECT_KEY_ID environment variable is required");
  }

  if (!issuerId) {
    throw new ConfigError("APP_STORE_CONNECT_ISSUER_ID environment variable is required");
  }

  if (!privateKeyPath && !privateKeyContent) {
    throw new ConfigError(
      "Either APP_STORE_CONNECT_P8_PATH or APP_STORE_CONNECT_P8_CONTENT environment variable is required"
    );
  }

  return new TokenManager({
    keyId,
    issuerId,
    privateKeyPath,
    privateKeyContent,
  });
}
