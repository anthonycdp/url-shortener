import { nanoid } from "nanoid";
import { redis, KEYS } from "../utils/redis.js";
import type { UrlData, ClickAnalytics, CreateUrlResponse, UrlStatsResponse } from "../types/index.js";
import { NotFoundError, ExpiredUrlError } from "../utils/errors.js";

const SHORT_CODE_LENGTH = 7;
const MAX_ANALYTICS_EVENTS = 100;
const DEFAULT_TTL = 86400 * 30; // 30 days default

export class UrlService {
  async createShortUrl(originalUrl: string, ttl?: number): Promise<CreateUrlResponse> {
    const shortCode = nanoid(SHORT_CODE_LENGTH);
    const createdAt = Date.now();
    const ttlSeconds = ttl ?? DEFAULT_TTL;
    const expiresAt = ttlSeconds > 0 ? createdAt + ttlSeconds * 1000 : null;

    const urlData: UrlData = {
      shortCode,
      originalUrl,
      createdAt,
      expiresAt,
      clickCount: 0,
    };

    const key = KEYS.url(shortCode);

    if (expiresAt) {
      const ttlMs = Math.floor((expiresAt - createdAt) / 1000);
      await redis.setex(key, ttlMs, JSON.stringify(urlData));
    } else {
      await redis.set(key, JSON.stringify(urlData));
    }

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    return {
      shortCode,
      shortUrl: `${baseUrl}/${shortCode}`,
      originalUrl,
      expiresAt,
    };
  }

  async getOriginalUrl(shortCode: string): Promise<string> {
    const key = KEYS.url(shortCode);
    const data = await redis.get(key);

    if (!data) {
      throw new NotFoundError("Shortened URL");
    }

    const urlData: UrlData = JSON.parse(data);

    if (urlData.expiresAt && Date.now() > urlData.expiresAt) {
      await redis.del(key);
      throw new ExpiredUrlError();
    }

    return urlData.originalUrl;
  }

  async recordClick(
    shortCode: string,
    ip: string,
    referrer: string | null,
    userAgent: string | null
  ): Promise<void> {
    const key = KEYS.url(shortCode);
    const analyticsKey = KEYS.analytics(shortCode);

    const data = await redis.get(key);
    if (!data) return;

    const urlData: UrlData = JSON.parse(data);
    urlData.clickCount += 1;

    const ttl = urlData.expiresAt
      ? Math.max(1, Math.floor((urlData.expiresAt - Date.now()) / 1000))
      : undefined;

    if (ttl) {
      await redis.setex(key, ttl, JSON.stringify(urlData));
    } else {
      await redis.set(key, JSON.stringify(urlData));
    }

    const clickEvent: ClickAnalytics = {
      timestamp: Date.now(),
      referrer,
      userAgent,
      ip: this.hashIp(ip),
    };

    await redis.lpush(analyticsKey, JSON.stringify(clickEvent));
    await redis.ltrim(analyticsKey, 0, MAX_ANALYTICS_EVENTS - 1);

    if (ttl) {
      await redis.expire(analyticsKey, ttl);
    }
  }

  async getUrlStats(shortCode: string): Promise<UrlStatsResponse> {
    const key = KEYS.url(shortCode);
    const analyticsKey = KEYS.analytics(shortCode);

    const data = await redis.get(key);
    if (!data) {
      throw new NotFoundError("Shortened URL");
    }

    const urlData: UrlData = JSON.parse(data);
    const analyticsData = await redis.lrange(analyticsKey, 0, 49);

    const recentClicks: ClickAnalytics[] = analyticsData.map((item) =>
      JSON.parse(item)
    );

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
    const key = KEYS.url(shortCode);
    const analyticsKey = KEYS.analytics(shortCode);

    const deleted = await redis.del(key);
    await redis.del(analyticsKey);

    return deleted > 0;
  }

  private hashIp(ip: string): string {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    if (ip.includes(":")) {
      const ipv6Parts = ip.split(":");
      return `${ipv6Parts[0]}:${ipv6Parts[1]}:****:****`;
    }
    return "***.***.***.***";
  }
}

export const urlService = new UrlService();
