import { Router } from "express";
import { urlService } from "../services/url.service.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createUrlSchema, shortCodeSchema } from "../utils/validation.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";

const router = Router();

router.post(
  "/shorten",
  rateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = createUrlSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { url, ttl } = parsed.data;
    const result = await urlService.createShortUrl(url, ttl);

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

router.get(
  "/:shortCode",
  asyncHandler(async (req, res) => {
    const parsed = shortCodeSchema.safeParse({ shortCode: req.params.shortCode });

    if (!parsed.success) {
      throw new ValidationError("Invalid short code format");
    }

    const { shortCode } = parsed.data;
    const originalUrl = await urlService.getOriginalUrl(shortCode);

    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const referrerHeader = req.headers.referer || req.headers.referrer;
    const referrer = Array.isArray(referrerHeader) ? referrerHeader[0] : referrerHeader || null;
    const userAgent = req.headers["user-agent"] || null;

    await urlService.recordClick(shortCode, ip, referrer, userAgent);

    res.redirect(301, originalUrl);
  })
);

router.get(
  "/stats/:shortCode",
  asyncHandler(async (req, res) => {
    const parsed = shortCodeSchema.safeParse({ shortCode: req.params.shortCode });

    if (!parsed.success) {
      throw new ValidationError("Invalid short code format");
    }

    const { shortCode } = parsed.data;
    const stats = await urlService.getUrlStats(shortCode);

    res.json({
      success: true,
      data: stats,
    });
  })
);

router.delete(
  "/:shortCode",
  asyncHandler(async (req, res) => {
    const parsed = shortCodeSchema.safeParse({ shortCode: req.params.shortCode });

    if (!parsed.success) {
      throw new ValidationError("Invalid short code format");
    }

    const { shortCode } = parsed.data;
    const deleted = await urlService.deleteUrl(shortCode);

    if (!deleted) {
      throw new NotFoundError("Shortened URL");
    }

    res.json({
      success: true,
      message: "URL deleted successfully",
    });
  })
);

export default router;
