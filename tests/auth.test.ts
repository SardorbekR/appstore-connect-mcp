/**
 * Tests for JWT authentication module
 */

import { describe, expect, it, vi } from "vitest";
import { TokenManager } from "../src/auth/jwt.js";
import { ConfigError } from "../src/utils/errors.js";

// Mock jose module
vi.mock("jose", () => ({
  importPKCS8: vi.fn().mockResolvedValue("mock-key"),
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuer: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setAudience: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock.jwt.token"),
  })),
}));

describe("TokenManager", () => {
  const validConfig = {
    keyId: "ABC123",
    issuerId: "12345678-1234-1234-1234-123456789012",
    privateKeyContent: "-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----",
  };

  describe("constructor", () => {
    it("should create instance with valid config using privateKeyContent", () => {
      const manager = new TokenManager(validConfig);
      expect(manager).toBeInstanceOf(TokenManager);
    });

    it("should create instance with valid config using privateKeyPath", () => {
      const manager = new TokenManager({
        ...validConfig,
        privateKeyContent: undefined,
        privateKeyPath: "/path/to/key.p8",
      });
      expect(manager).toBeInstanceOf(TokenManager);
    });

    it("should throw ConfigError when neither path nor content provided", () => {
      expect(() => {
        new TokenManager({
          keyId: validConfig.keyId,
          issuerId: validConfig.issuerId,
        });
      }).toThrow(ConfigError);
    });

    it("should throw ConfigError for path traversal attempt", () => {
      expect(() => {
        new TokenManager({
          ...validConfig,
          privateKeyContent: undefined,
          privateKeyPath: "../../../etc/passwd",
        });
      }).toThrow(ConfigError);
    });
  });

  describe("getToken", () => {
    it("should generate a new token on first call", async () => {
      const manager = new TokenManager(validConfig);
      const token = await manager.getToken();
      expect(token).toBe("mock.jwt.token");
    });

    it("should return cached token on subsequent calls", async () => {
      const manager = new TokenManager(validConfig);
      const token1 = await manager.getToken();
      const token2 = await manager.getToken();
      expect(token1).toBe(token2);
    });

    it("should handle raw key content without PEM headers", async () => {
      const manager = new TokenManager({
        ...validConfig,
        privateKeyContent: "MOCK_RAW_KEY_CONTENT",
      });
      const token = await manager.getToken();
      expect(token).toBe("mock.jwt.token");
    });
  });

  describe("hasValidToken", () => {
    it("should return false before generating token", () => {
      const manager = new TokenManager(validConfig);
      expect(manager.hasValidToken()).toBe(false);
    });

    it("should return true after generating token", async () => {
      const manager = new TokenManager(validConfig);
      await manager.getToken();
      expect(manager.hasValidToken()).toBe(true);
    });
  });

  describe("destroy", () => {
    it("should clear cached token", async () => {
      const manager = new TokenManager(validConfig);
      await manager.getToken();
      expect(manager.hasValidToken()).toBe(true);

      manager.destroy();
      expect(manager.hasValidToken()).toBe(false);
    });
  });
});
