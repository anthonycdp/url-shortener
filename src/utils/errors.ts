export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(404, `${resource} not found`, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, "VALIDATION_ERROR");
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(
      429,
      `Too many requests. Please try again in ${Math.ceil(retryAfter / 1000)} seconds`,
      "RATE_LIMIT_EXCEEDED"
    );
  }
}

export class ExpiredUrlError extends AppError {
  constructor() {
    super(410, "This shortened URL has expired", "URL_EXPIRED");
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string = "Service") {
    super(503, `${service} is temporarily unavailable`, "SERVICE_UNAVAILABLE");
  }
}
