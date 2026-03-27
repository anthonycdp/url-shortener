import type { Request, Response, NextFunction } from "express";
import { redis, KEYS } from "../utils/redis.js";
import { RateLimitError } from "../utils/errors.js";
import type { RateLimitConfig } from "../types/index.js";

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute per IP
};

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests } = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = getClientIp(req);
    const key = KEYS.rateLimit(ip);

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }

      const ttl = await redis.pttl(key);
      const remaining = Math.max(0, maxRequests - current);

      res.setHeader("X-RateLimit-Limit", maxRequests.toString());
      res.setHeader("X-RateLimit-Remaining", remaining.toString());
      res.setHeader("X-RateLimit-Reset", (Date.now() + ttl).toString());

      if (current > maxRequests) {
        res.setHeader("Retry-After", Math.ceil(ttl / 1000).toString());
        throw new RateLimitError(ttl);
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        // If Redis is unavailable, allow the request to proceed
        console.error("Rate limiter error:", error);
        next();
      }
    }
  };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export const rateLimiter = createRateLimiter();
