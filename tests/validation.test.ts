import { describe, it, expect } from "vitest";
import { createUrlSchema, shortCodeSchema } from "../src/utils/validation.js";

describe("Validation Schemas", () => {
  describe("createUrlSchema", () => {
    it("should validate a valid URL without TTL", () => {
      const result = createUrlSchema.safeParse({ url: "https://example.com" });
      expect(result.success).toBe(true);
    });

    it("should validate a valid URL with TTL", () => {
      const result = createUrlSchema.safeParse({
        url: "https://example.com/path",
        ttl: 3600,
      });
      expect(result.success).toBe(true);
    });

    it("should reject an empty URL", () => {
      const result = createUrlSchema.safeParse({ url: "" });
      expect(result.success).toBe(false);
    });

    it("should reject an invalid URL", () => {
      const result = createUrlSchema.safeParse({ url: "not-a-url" });
      expect(result.success).toBe(false);
    });

    it("should reject a non-HTTP URL", () => {
      const result = createUrlSchema.safeParse({ url: "ftp://files.example.com" });
      expect(result.success).toBe(false);
    });

    it("should reject negative TTL", () => {
      const result = createUrlSchema.safeParse({
        url: "https://example.com",
        ttl: -100,
      });
      expect(result.success).toBe(false);
    });

    it("should reject TTL exceeding 1 year", () => {
      const result = createUrlSchema.safeParse({
        url: "https://example.com",
        ttl: 40000000, // More than 1 year in seconds
      });
      expect(result.success).toBe(false);
    });

    it("should accept HTTP URLs", () => {
      const result = createUrlSchema.safeParse({ url: "http://example.com" });
      expect(result.success).toBe(true);
    });
  });

  describe("shortCodeSchema", () => {
    it("should validate a valid short code", () => {
      const result = shortCodeSchema.safeParse({ shortCode: "abc123" });
      expect(result.success).toBe(true);
    });

    it("should validate a short code with special characters", () => {
      const result = shortCodeSchema.safeParse({ shortCode: "abc_123-xyz" });
      expect(result.success).toBe(true);
    });

    it("should reject an empty short code", () => {
      const result = shortCodeSchema.safeParse({ shortCode: "" });
      expect(result.success).toBe(false);
    });

    it("should reject a short code with invalid characters", () => {
      const result = shortCodeSchema.safeParse({ shortCode: "abc@123" });
      expect(result.success).toBe(false);
    });

    it("should reject a short code exceeding 20 characters", () => {
      const result = shortCodeSchema.safeParse({
        shortCode: "a".repeat(21),
      });
      expect(result.success).toBe(false);
    });
  });
});
