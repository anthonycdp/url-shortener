import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import urlRoutes from "./routes/url.routes.js";
import { redis } from "./utils/redis.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await redis.ping();
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "unhealthy", timestamp: new Date().toISOString() });
  }
});

app.get("/", (_req, res) => {
  res.json({
    name: "URL Shortener API",
    version: "1.0.0",
    endpoints: {
      "POST /api/shorten": "Create a shortened URL",
      "GET /:shortCode": "Redirect to original URL",
      "GET /api/stats/:shortCode": "Get URL statistics",
      "DELETE /api/:shortCode": "Delete a shortened URL",
    },
  });
});

app.use("/api", urlRoutes);
app.use("/:shortCode", urlRoutes);

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

const gracefulShutdown = async () => {
  console.log("\nReceived shutdown signal. Closing connections...");
  server.close(async () => {
    console.log("HTTP server closed");
    await redis.quit();
    console.log("Redis connection closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

export { app, server };
// test
