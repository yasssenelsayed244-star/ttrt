const Redis = require('ioredis');
const config = require('./env');
const logger = require('../utils/logger');

let redisClient = null;
let redisAvailable = false;

const createRedisClient = () => {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    // Stop retrying after the first failure — Redis is optional in dev
    retryStrategy: () => null,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
  });

  const isDev = process.env.NODE_ENV !== 'production';

  client.on('ready',   () => { redisAvailable = true;  logger.info('Redis: Connected & Ready'); });
  client.on('error',   () => { redisAvailable = false; });
  client.on('close',   () => { redisAvailable = false; if (!isDev) logger.warn('Redis: Connection closed'); });
  client.on('end',     () => { redisAvailable = false; });

  return client;
};

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

const connectRedis = async () => {
  const client = getRedisClient();
  try {
    await client.connect();
  } catch {
    // Redis is optional — app continues in degraded mode (no caching)
    logger.warn('Redis unavailable — running without cache');
  }
};

// ─── Cache helpers (all no-op if Redis is down) ────────────────────────────────

const setCache = async (key, value, ttlSeconds = 300) => {
  if (!redisAvailable) return;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    redisAvailable = false;
  }
};

const getCache = async (key) => {
  if (!redisAvailable) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    redisAvailable = false;
    return null;
  }
};

const deleteCache = async (key) => {
  if (!redisAvailable) return;
  try {
    await redisClient.del(key);
  } catch {
    redisAvailable = false;
  }
};

const deleteCacheByPattern = async (pattern) => {
  if (!redisAvailable) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) await redisClient.del(...keys);
  } catch {
    redisAvailable = false;
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  deleteCacheByPattern,
};
