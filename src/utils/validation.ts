import { z } from "zod";

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const createUrlSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .refine(isValidUrl, "Invalid URL format. Must be a valid HTTP/HTTPS URL"),
  ttl: z
    .number()
    .int("TTL must be an integer")
    .positive("TTL must be positive")
    .max(31536000, "TTL cannot exceed 1 year (31536000 seconds)")
    .optional(),
});

export const shortCodeSchema = z.object({
  shortCode: z
    .string()
    .min(1, "Short code is required")
    .max(20, "Short code cannot exceed 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Short code can only contain alphanumeric characters, hyphens, and underscores"),
});

export type CreateUrlInput = z.infer<typeof createUrlSchema>;
export type ShortCodeInput = z.infer<typeof shortCodeSchema>;
