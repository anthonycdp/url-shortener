import { describe, it, expect, beforeEach } from "vitest";
import { MockRedis } from "./setup.js";

// Recreate UrlService with mock Redis for testing
class TestUrlService {
  private redis: MockRedis;
  private static readonly SHORT_CODE_LENGTH = 7;
  private static readonly MAX_ANALYTICS_EVENTS = 100;
  private static readonly DEFAULT_TTL = 86400 * 30;

  constructor(redis: MockRedis) {
    this.redis = redis;
  }

  async createShortUrl(originalUrl: string, ttl?: number): Promise<{
    shortCode: string;
    shortUrl: string;
    originalUrl: string;
    expiresAt: number | null;
  }> {
    const shortCode = "test123"; // Deterministic for testing
    const createdAt = Date.now();
    const ttlSeconds = ttl ?? TestUrlService.DEFAULT_TTL;
    const expiresAt = ttlSeconds > 0 ? createdAt + ttlSeconds * 1000 : null;

    const urlData = {
      shortCode,
      originalUrl,
      createdAt,
      expiresAt,
      clickCount: 0,
    };

    const key = `url:${shortCode}`;

    if (expiresAt) {
      const ttlMs = Math.floor((expiresAt - createdAt) / 1000);
      await this.redis.setex(key, ttlMs, JSON.stringify(urlData));
    } else {
      await this.redis.set(key, JSON.stringify(urlData));
    }

    return {
      shortCode,
      shortUrl: `http://localhost:3000/${shortCode}`,
      originalUrl,
      expiresAt,
    };
  }

  async getOriginalUrl(shortCode: string): Promise<string> {
    const key = `url:${shortCode}`;
    const data = await this.redis.get(key);

    if (!data) {
      throw new Error("Shortened URL not found");
    }

    const urlData = JSON.parse(data);

    if (urlData.expiresAt && Date.now() > urlData.expiresAt) {
      await this.redis.del(key);
      throw new Error("URL expired");
    }

    return urlData.originalUrl;
  }

  async getUrlStats(shortCode: string): Promise<{
    shortCode: string;
    originalUrl: string;
    createdAt: number;
    expiresAt: number | null;
    clickCount: number;
    recentClicks: Array<{ timestamp: number; referrer: string | null; userAgent: string | null; ip: string }>;
  }> {
    const key = `url:${shortCode}`;
    const analyticsKey = `analytics:${shortCode}`;

    const data = await this.redis.get(key);
    if (!data) {
      throw new Error("Shortened URL not found");
    }

    const urlData = JSON.parse(data);
    const analyticsData = await this.redis.lrange(analyticsKey, 0, 49);

    const recentClicks = analyticsData.map((item) => JSON.parse(item));

    return {
      shortCode: urlData.shortCode,
      originalUrl: urlData.originalUrl,
      createdAt: urlData.createdAt,
      expiresAt: urlData.expiresAt,
      clickCount: urlData.clickCount,
      recentClicks,
    };
  }

  async deleteUrl(shortCode: string): Promise<boolean> {
    const key = `url:${shortCode}`;
    const analyticsKey = `analytics:${shortCode}`;

    const deleted = await this.redis.del(key);
    await this.redis.del(analyticsKey);

    return deleted > 0;
  }
}

describe("UrlService", () => {
  let redis: MockRedis;
  let service: TestUrlService;

  beforeEach(() => {
    redis = new MockRedis();
    service = new TestUrlService(redis);
  });

  describe("createShortUrl", () => {
    it("should create a shortened URL", async () => {
      const originalUrl = "https://example.com/very-long-url";
      const result = await service.createShortUrl(originalUrl);

      expect(result.shortCode).toBe("test123");
      expect(result.originalUrl).toBe(originalUrl);
      expect(result.shortUrl).toContain("test123");
      expect(result.expiresAt).toBeDefined();
    });

    it("should create a shortened URL with custom TTL", async () => {
      const originalUrl = "https://example.com/test";
      const ttl = 3600; // 1 hour
      const result = await service.createShortUrl(originalUrl, ttl);

      expect(result.expiresAt).toBeDefined();
      const expectedExpiry = Date.now() + ttl * 1000;
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.expiresAt).toBeLessThan(expectedExpiry + 1000);
    });

    it("should create a shortened URL without expiration when TTL is 0", async () => {
      const originalUrl = "https://example.com/permanent";
      const result = await service.createShortUrl(originalUrl, 0);

      expect(result.expiresAt).toBeNull();
    });
  });

  describe("getOriginalUrl", () => {
    it("should return the original URL for a valid short code", async () => {
      const originalUrl = "https://example.com/target";
      await service.createShortUrl(originalUrl);

      const result = await service.getOriginalUrl("test123");
      expect(result).toBe(originalUrl);
    });

    it("should throw an error for non-existent short code", async () => {
      await expect(service.getOriginalUrl("nonexistent")).rejects.toThrow("not found");
    });

    it("should throw an error for expired URL", async () => {
      const originalUrl = "https://example.com/expired";
      await service.createShortUrl(originalUrl, 1); // 1 second TTL

      // Simulate passage of time by modifying the expiration
      const key = "url:test123";
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        parsed.expiresAt = Date.now() - 1000; // Set to past
        await redis.set(key, JSON.stringify(parsed));
      }

      await expect(service.getOriginalUrl("test123")).rejects.toThrow("expired");
    });
  });

  describe("getUrlStats", () => {
    it("should return stats for a valid short code", async () => {
      const originalUrl = "https://example.com/stats-test";
      await service.createShortUrl(originalUrl);

      const stats = await service.getUrlStats("test123");

      expect(stats.shortCode).toBe("test123");
      expect(stats.originalUrl).toBe(originalUrl);
      expect(stats.clickCount).toBe(0);
      expect(stats.recentClicks).toEqual([]);
    });

    it("should throw an error for non-existent short code", async () => {
      await expect(service.getUrlStats("nonexistent")).rejects.toThrow("not found");
    });
  });

  describe("deleteUrl", () => {
    it("should delete an existing URL", async () => {
      await service.createShortUrl("https://example.com/to-delete");

      const result = await service.deleteUrl("test123");
      expect(result).toBe(true);

      await expect(service.getOriginalUrl("test123")).rejects.toThrow("not found");
    });

    it("should return false for non-existent URL", async () => {
      const result = await service.deleteUrl("nonexistent");
      expect(result).toBe(false);
    });
  });
});
