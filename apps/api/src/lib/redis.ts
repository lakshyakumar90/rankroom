import IORedis from "ioredis";

const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.info("[Redis] Connected");
});

// For BullMQ (requires separate connection)
export const createRedisConnection = () =>
  new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
