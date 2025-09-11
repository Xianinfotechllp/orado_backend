const Redis = require("ioredis");

let redisClient;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis({
      host: "curious-molly-59824.upstash.io", // your host
      port: 6379,                             // Upstash usually uses 6379
      username: "default",                     // Upstash username (usually default)
      password: "AemwAAIjcDE4NGFmOTAyMzFmMjA0NDU4OTEzMGE0ODQ1NjA0N2JkOHAxMA", // your token
      tls: {}                                  // enable TLS
    });

    redisClient.on("connect", () => {
      console.log("🔗 Connected to Upstash Redis");
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis connection error:", err);
    });
  }

  return redisClient;
}

module.exports = getRedisClient;
