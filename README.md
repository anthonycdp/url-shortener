# URL Shortener

A production-ready URL shortener service built with Node.js, TypeScript, Express, and Redis. Features include comprehensive analytics, IP-based rate limiting, configurable URL expiration, and a clean REST API.

## Features

- **URL Shortening**: Generate unique, short codes for any HTTP/HTTPS URL
- **Analytics**: Track clicks with referrer, user agent, timestamp, and anonymized IP
- **Rate Limiting**: IP-based request throttling with configurable limits
- **URL Expiration**: Optional TTL (Time To Live) for automatic URL cleanup
- **REST API**: Clean, well-documented API with proper error handling
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Graceful Shutdown**: Proper connection cleanup on termination signals

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client        │────▶│   Express API   │────▶│     Redis       │
│   (HTTP)        │     │   (Node.js)     │     │   (Storage)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Rate Limiter   │
                        │   Middleware    │
                        └─────────────────┘
```

### Data Flow

1. **Create Short URL**: Client sends POST request → Rate limiter checks → Service generates short code → Data stored in Redis with optional TTL

2. **Redirect**: Client requests short code → Service looks up URL → Records analytics → Returns 301 redirect

3. **Analytics**: Each click records timestamp, referrer, user agent, and anonymized IP address

### Key Design Decisions

- **Redis for Storage**: Chosen for its high performance, built-in TTL support, and atomic operations
- **Nanoid for Short Codes**: Generates URL-safe, collision-resistant IDs (7 characters by default)
- **Zod for Validation**: Runtime type checking with detailed error messages
- **Custom Error Classes**: Structured error responses with error codes for easy client handling

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3
- **Framework**: Express 4.18
- **Database**: Redis (via ioredis)
- **Validation**: Zod
- **Testing**: Vitest + Supertest

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Redis server (local or remote)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd 01-url-shortener
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
PORT=3000
REDIS_URL=redis://localhost:6379
BASE_URL=http://localhost:3000
```

5. Start Redis (if not running):
```bash
redis-server
```

6. Run the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## API Documentation

### Base URL

```
http://localhost:3000
```

### Endpoints

#### Create Short URL

Creates a shortened URL with optional expiration time.

```http
POST /api/shorten
Content-Type: application/json
```

**Request Body:**

| Field | Type   | Required | Description                                    |
|-------|--------|----------|------------------------------------------------|
| url   | string | Yes      | The URL to shorten (must be HTTP/HTTPS)        |
| ttl   | number | No       | Time to live in seconds (max: 31,536,000)      |

**Example Request:**
```json
{
  "url": "https://example.com/very-long-url-that-needs-shortening",
  "ttl": 86400
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "shortCode": "V1StGXR8",
    "shortUrl": "http://localhost:3000/V1StGXR8",
    "originalUrl": "https://example.com/very-long-url-that-needs-shortening",
    "expiresAt": 1704067200000
  }
}
```

**Error Responses:**

| Status | Code              | Description                    |
|--------|-------------------|--------------------------------|
| 400    | VALIDATION_ERROR  | Invalid URL or TTL             |
| 429    | RATE_LIMIT_EXCEEDED | Too many requests            |

---

#### Redirect to Original URL

Redirects to the original URL and records analytics.

```http
GET /:shortCode
```

**Success Response (301):**
Redirects to the original URL with `Location` header.

**Error Responses:**

| Status | Code       | Description                    |
|--------|------------|--------------------------------|
| 404    | NOT_FOUND  | Short code doesn't exist       |
| 410    | URL_EXPIRED | URL has expired               |

---

#### Get URL Statistics

Retrieves analytics and metadata for a shortened URL.

```http
GET /api/stats/:shortCode
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "shortCode": "V1StGXR8",
    "originalUrl": "https://example.com/very-long-url",
    "createdAt": 1704067200000,
    "expiresAt": 1704153600000,
    "clickCount": 42,
    "recentClicks": [
      {
        "timestamp": 1704067300000,
        "referrer": "https://google.com",
        "userAgent": "Mozilla/5.0...",
        "ip": "192.168.***.***"
      }
    ]
  }
}
```

**Error Responses:**

| Status | Code       | Description                    |
|--------|------------|--------------------------------|
| 404    | NOT_FOUND  | Short code doesn't exist       |

---

#### Delete Short URL

Deletes a shortened URL and its analytics.

```http
DELETE /api/:shortCode
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "URL deleted successfully"
}
```

**Error Responses:**

| Status | Code       | Description                    |
|--------|------------|--------------------------------|
| 404    | NOT_FOUND  | Short code doesn't exist       |

---

#### Health Check

Check service health and Redis connectivity.

```http
GET /health
```

**Success Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Rate Limiting

The API implements IP-based rate limiting with the following headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1704067260000
Retry-After: 45  (only when rate limited)
```

Default limits: 10 requests per minute per IP address.

## Project Structure

```
01-url-shortener/
├── src/
│   ├── index.ts              # Application entry point
│   ├── routes/
│   │   └── url.routes.ts     # API route definitions
│   ├── services/
│   │   └── url.service.ts    # Business logic for URL operations
│   ├── middleware/
│   │   ├── rateLimiter.ts    # IP-based rate limiting
│   │   └── errorHandler.ts   # Global error handling
│   ├── utils/
│   │   ├── redis.ts          # Redis connection and key helpers
│   │   ├── validation.ts     # Zod schemas for input validation
│   │   └── errors.ts         # Custom error classes
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── tests/
│   ├── setup.ts              # Mock Redis for testing
│   ├── url.service.test.ts   # Unit tests for URL service
│   ├── validation.test.ts    # Unit tests for validation
│   └── api.test.ts           # Integration tests for API
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Scripts

| Command              | Description                      |
|----------------------|----------------------------------|
| `npm run dev`        | Start development server         |
| `npm run build`      | Compile TypeScript to JavaScript |
| `npm start`          | Run production server            |
| `npm test`           | Run all tests                    |
| `npm run test:watch` | Run tests in watch mode          |
| `npm run test:coverage` | Run tests with coverage       |
| `npm run lint`       | Lint source files                |
| `npm run typecheck`  | Type-check without emitting      |

## Testing

The project includes comprehensive tests:

- **Unit Tests**: Service layer and validation logic
- **Integration Tests**: Full API request/response cycles
- **Coverage Reports**: Available via `npm run test:coverage`

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Environment Variables

| Variable               | Default                    | Description                      |
|------------------------|----------------------------|----------------------------------|
| `PORT`                 | `3000`                     | Server port                      |
| `NODE_ENV`             | `development`              | Environment mode                 |
| `REDIS_URL`            | `redis://localhost:6379`   | Redis connection URL             |
| `BASE_URL`             | `http://localhost:3000`    | Base URL for shortened links     |
| `RATE_LIMIT_WINDOW_MS` | `60000`                    | Rate limit window in milliseconds|
| `RATE_LIMIT_MAX_REQUESTS` | `10`                    | Max requests per window per IP   |

## Security Considerations

- **IP Anonymization**: IP addresses are partially masked before storage
- **Input Validation**: All inputs are validated with Zod schemas
- **Rate Limiting**: Prevents abuse and DoS attacks
- **URL Validation**: Only HTTP/HTTPS URLs are accepted
- **TTL Limits**: Maximum expiration of 1 year enforced

## Error Handling

The API returns consistent error responses:

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": []  // Optional, for validation errors
  }
}
```

### Error Codes

| Code                  | HTTP Status | Description                        |
|-----------------------|-------------|------------------------------------|
| `VALIDATION_ERROR`    | 400         | Invalid request data               |
| `NOT_FOUND`           | 404         | Resource not found                 |
| `URL_EXPIRED`         | 410         | Shortened URL has expired          |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests                  |
| `INTERNAL_ERROR`      | 500         | Server error                       |
| `SERVICE_UNAVAILABLE` | 503         | External service unavailable       |

## License

MIT
