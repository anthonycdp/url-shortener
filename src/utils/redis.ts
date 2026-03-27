import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

export const disconnectRedis = async (): Promise<void> => {
  await redis.quit();
};

// Key prefixes for namespacing
export const KEYS = {
  url: (shortCode: string) => `url:${shortCode}`,
  analytics: (shortCode: string) => `analytics:${shortCode}`,
  rateLimit: (ip: string) => `ratelimit:${ip}`,
} as const;
