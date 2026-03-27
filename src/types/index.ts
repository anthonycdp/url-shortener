export interface UrlData {
  shortCode: string;
  originalUrl: string;
  createdAt: number;
  expiresAt: number | null;
  clickCount: number;
}

export interface ClickAnalytics {
  timestamp: number;
  referrer: string | null;
  userAgent: string | null;
  ip: string;
}

export interface CreateUrlRequest {
  url: string;
  ttl?: number; // Time to live in seconds
}

export interface CreateUrlResponse {
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  expiresAt: number | null;
}

export interface UrlStatsResponse {
  shortCode: string;
  originalUrl: string;
  createdAt: number;
  expiresAt: number | null;
  clickCount: number;
  recentClicks: ClickAnalytics[];
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface AppError {
  statusCode: number;
  message: string;
  code: string;
}
