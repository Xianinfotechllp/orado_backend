const Redis = require("ioredis");

let redisClient;

function getRedisClient() {
  if (!redisClient) {

    redisClient = new Redis(process.env.REDIS_URL);

    redisClient.on("connect", () => {
      console.log("🔗 Connected to Redis");
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis connection error:", err);
    });
  }

  return redisClient;
}

module.exports = getRedisClient;
