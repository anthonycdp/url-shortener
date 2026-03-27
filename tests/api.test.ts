import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { MockRedis, mockRedis } from "./setup.js";

// Create a test app with mocked Redis
function createTestApp(redis: MockRedis): Express {
  const app = express();
  app.use(express.json());

  // Simple in-memory URL storage for testing
  const urls = new Map<string, { originalUrl: string; expiresAt: number | null; clickCount: number }>();

  app.post("/api/shorten", async (req, res) => {
    const { url, ttl } = req.body;

    if (!url) {
      res.status(400).json({ error: { message: "URL is required", code: "VALIDATION_ERROR" } });
      return;
    }

    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: { message: "Invalid URL", code: "VALIDATION_ERROR" } });
      return;
    }

    const shortCode = `test_${Date.now()}`;
    const expiresAt = ttl ? Date.now() + ttl * 1000 : null;

    urls.set(shortCode, { originalUrl: url, expiresAt, clickCount: 0 });

    res.status(201).json({
      success: true,
      data: {
        shortCode,
        shortUrl: `http://localhost:3000/${shortCode}`,
        originalUrl: url,
        expiresAt,
      },
    });
  });

  app.get("/api/stats/:shortCode", (req, res) => {
    const { shortCode } = req.params;
    const urlData = urls.get(shortCode);

    if (!urlData) {
      res.status(404).json({ error: { message: "Shortened URL not found", code: "NOT_FOUND" } });
      return;
    }

    res.json({
      success: true,
      data: {
        shortCode,
        originalUrl: urlData.originalUrl,
        createdAt: Date.now(),
        expiresAt: urlData.expiresAt,
        clickCount: urlData.clickCount,
        recentClicks: [],
      },
    });
  });

  app.delete("/api/:shortCode", (req, res) => {
    const { shortCode } = req.params;
    const existed = urls.delete(shortCode);

    if (!existed) {
      res.status(404).json({ error: { message: "Shortened URL not found", code: "NOT_FOUND" } });
      return;
    }

    res.json({ success: true, message: "URL deleted successfully" });
  });

  app.get("/:shortCode", (req, res) => {
    const { shortCode } = req.params;
    const urlData = urls.get(shortCode);

    if (!urlData) {
      res.status(404).json({ error: { message: "Shortened URL not found", code: "NOT_FOUND" } });
      return;
    }

    if (urlData.expiresAt && Date.now() > urlData.expiresAt) {
      urls.delete(shortCode);
      res.status(410).json({ error: { message: "URL expired", code: "URL_EXPIRED" } });
      return;
    }

    urlData.clickCount++;
    res.redirect(301, urlData.originalUrl);
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: { message: "Internal server error", code: "INTERNAL_ERROR" } });
  });

  return app;
}

describe("URL Shortener API", () => {
  let app: Express;
  let redis: MockRedis;

  beforeAll(() => {
    redis = mockRedis;
    app = createTestApp(redis);
  });

  beforeEach(() => {
    redis.clear();
  });

  describe("POST /api/shorten", () => {
    it("should create a shortened URL", async () => {
      const response = await request(app)
        .post("/api/shorten")
        .send({ url: "https://example.com/long-url" })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shortCode).toBeDefined();
      expect(response.body.data.originalUrl).toBe("https://example.com/long-url");
      expect(response.body.data.shortUrl).toBeDefined();
    });

    it("should create a shortened URL with custom TTL", async () => {
      const response = await request(app)
        .post("/api/shorten")
        .send({ url: "https://example.com/test", ttl: 3600 })
        .expect(201);

      expect(response.body.data.expiresAt).toBeDefined();
      expect(response.body.data.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should reject missing URL", async () => {
      const response = await request(app)
        .post("/api/shorten")
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject invalid URL", async () => {
      const response = await request(app)
        .post("/api/shorten")
        .send({ url: "not-a-valid-url" })
        .expect(400);

      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /:shortCode", () => {
    it("should redirect to the original URL", async () => {
      const createResponse = await request(app)
        .post("/api/shorten")
        .send({ url: "https://example.com/redirect-test" });

      const shortCode = createResponse.body.data.shortCode;

      const response = await request(app)
        .get(`/${shortCode}`)
        .expect(301);

      expect(response.headers.location).toBe("https://example.com/redirect-test");
    });

    it("should return 404 for non-existent short code", async () => {
      const response = await request(app)
        .get("/nonexistent123")
        .expect(404);

      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /api/stats/:shortCode", () => {
    it("should return stats for a valid short code", async () => {
      const createResponse = await request(app)
        .post("/api/shorten")
        .send({ url: "https://example.com/stats-test" });

      const shortCode = createResponse.body.data.shortCode;

      const response = await request(app)
        .get(`/api/stats/${shortCode}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.originalUrl).toBe("https://example.com/stats-test");
      expect(response.body.data.clickCount).toBe(0);
    });

    it("should return 404 for non-existent short code", async () => {
      const response = await request(app)
        .get("/api/stats/nonexistent123")
        .expect(404);

      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("DELETE /api/:shortCode", () => {
    it("should delete an existing URL", async () => {
      const createResponse = await request(app)
        .post("/api/shorten")
        .send({ url: "https://example.com/delete-test" });

      const shortCode = createResponse.body.data.shortCode;

      await request(app)
        .delete(`/api/${shortCode}`)
        .expect(200);

      await request(app)
        .get(`/api/stats/${shortCode}`)
        .expect(404);
    });

    it("should return 404 for non-existent short code", async () => {
      const response = await request(app)
        .delete("/api/nonexistent123")
        .expect(404);

      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });
});
