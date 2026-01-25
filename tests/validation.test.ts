/**
 * Tests for input validation module
 */

import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/utils/errors.js";
import {
  appIdSchema,
  createVersionLocalizationInputSchema,
  listAppsInputSchema,
  localeSchema,
  platformSchema,
  safeValidate,
  urlSchema,
  validateInput,
  versionStringSchema,
} from "../src/utils/validation.js";

describe("Validation Schemas", () => {
  describe("appIdSchema", () => {
    it("should accept valid numeric string", () => {
      expect(appIdSchema.parse("123456789")).toBe("123456789");
    });

    it("should reject non-numeric string", () => {
      expect(() => appIdSchema.parse("abc123")).toThrow();
    });

    it("should reject empty string", () => {
      expect(() => appIdSchema.parse("")).toThrow();
    });
  });

  describe("localeSchema", () => {
    it("should accept simple locale code", () => {
      expect(localeSchema.parse("en")).toBe("en");
      expect(localeSchema.parse("ja")).toBe("ja");
    });

    it("should accept locale with region", () => {
      expect(localeSchema.parse("en-US")).toBe("en-US");
      expect(localeSchema.parse("pt-BR")).toBe("pt-BR");
    });

    it("should accept locale with script", () => {
      expect(localeSchema.parse("zh-Hans")).toBe("zh-Hans");
      expect(localeSchema.parse("zh-Hant")).toBe("zh-Hant");
    });

    it("should reject invalid locale formats", () => {
      expect(() => localeSchema.parse("english")).toThrow();
      expect(() => localeSchema.parse("EN-us")).toThrow();
    });
  });

  describe("urlSchema", () => {
    it("should accept valid HTTPS URLs", () => {
      expect(urlSchema.parse("https://example.com")).toBe("https://example.com");
      expect(urlSchema.parse("https://example.com/path")).toBe("https://example.com/path");
    });

    it("should reject HTTP URLs", () => {
      expect(() => urlSchema.parse("http://example.com")).toThrow();
    });

    it("should reject invalid URLs", () => {
      expect(() => urlSchema.parse("not-a-url")).toThrow();
    });
  });

  describe("versionStringSchema", () => {
    it("should accept valid version strings", () => {
      expect(versionStringSchema.parse("1.0.0")).toBe("1.0.0");
      expect(versionStringSchema.parse("2.1")).toBe("2.1");
      expect(versionStringSchema.parse("1")).toBe("1");
    });

    it("should reject invalid version strings", () => {
      expect(() => versionStringSchema.parse("v1.0.0")).toThrow();
      expect(() => versionStringSchema.parse("1.0.0-beta")).toThrow();
    });
  });

  describe("platformSchema", () => {
    it("should accept valid platforms", () => {
      expect(platformSchema.parse("IOS")).toBe("IOS");
      expect(platformSchema.parse("MAC_OS")).toBe("MAC_OS");
      expect(platformSchema.parse("TV_OS")).toBe("TV_OS");
      expect(platformSchema.parse("VISION_OS")).toBe("VISION_OS");
    });

    it("should reject invalid platforms", () => {
      expect(() => platformSchema.parse("iOS")).toThrow();
      expect(() => platformSchema.parse("android")).toThrow();
    });
  });
});

describe("validateInput", () => {
  it("should return parsed data for valid input", () => {
    const result = validateInput(listAppsInputSchema, { limit: 50 });
    expect(result).toEqual({ limit: 50 });
  });

  it("should throw ValidationError for invalid input", () => {
    expect(() => {
      validateInput(listAppsInputSchema, { limit: 500 });
    }).toThrow(ValidationError);
  });

  it("should include field name in ValidationError", () => {
    try {
      validateInput(createVersionLocalizationInputSchema, {
        versionId: "123",
        locale: "invalid-locale",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).field).toBe("locale");
    }
  });
});

describe("safeValidate", () => {
  it("should return success result for valid input", () => {
    const result = safeValidate(listAppsInputSchema, { limit: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ limit: 50 });
    }
  });

  it("should return error result for invalid input", () => {
    const result = safeValidate(listAppsInputSchema, { limit: 500 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });
});
