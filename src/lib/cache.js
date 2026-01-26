/**
 * Caching Layer
 * Provides in-memory caching with optional Redis backend
 *
 * In-memory cache is used by default (development/single instance)
 * Redis is used for production multi-instance deployments
 */

const logger = require('../config/logger');

/**
 * Simple in-memory cache implementation
 * Used when Redis is not available
 */
class MemoryCache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key, value, ttlSeconds = 3600) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const expiresAt = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;

    this.store.set(key, { value, expiresAt });

    // Set cleanup timer
    if (ttlSeconds > 0) {
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttlSeconds * 1000);
      this.timers.set(key, timer);
    }

    return true;
  }

  async delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.store.delete(key);
  }

  async exists(key) {
    const item = this.store.get(key);
    if (!item) return false;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  async clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.store.clear();
    return true;
  }

  async keys(pattern = '*') {
    const keys = Array.from(this.store.keys());
    if (pattern === '*') return keys;

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  getStats() {
    return {
      type: 'memory',
      size: this.store.size,
      keys: Array.from(this.store.keys())
    };
  }
}

/**
 * Redis cache wrapper (stub - implement when Redis is added)
 * For production use with multiple server instances
 */
class RedisCache {
  constructor(redisClient) {
    this.client = redisClient;
    this.connected = false;
  }

  async connect() {
    if (!this.client) {
      throw new Error('Redis client not provided');
    }

    try {
      await this.client.connect();
      this.connected = true;
      logger.info('Redis cache connected');
    } catch (error) {
      logger.error('Redis connection failed', { error: error.message });
      throw error;
    }
  }

  async get(key) {
    if (!this.connected) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis get error', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    if (!this.connected) return false;

    try {
      const options = ttlSeconds > 0 ? { EX: ttlSeconds } : {};
      await this.client.set(key, JSON.stringify(value), options);
      return true;
    } catch (error) {
      logger.error('Redis set error', { key, error: error.message });
      return false;
    }
  }

  async delete(key) {
    if (!this.connected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis delete error', { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    if (!this.connected) return false;

    try {
      return await this.client.exists(key) > 0;
    } catch (error) {
      logger.error('Redis exists error', { key, error: error.message });
      return false;
    }
  }

  async clear() {
    if (!this.connected) return false;

    try {
      await this.client.flushDb();
      return true;
    } catch (error) {
      logger.error('Redis clear error', { error: error.message });
      return false;
    }
  }

  getStats() {
    return {
      type: 'redis',
      connected: this.connected
    };
  }
}

/**
 * Cache factory - creates appropriate cache based on configuration
 */
function createCache(options = {}) {
  const useRedis = options.redisClient || process.env.REDIS_URL;

  if (useRedis && options.redisClient) {
    logger.info('Using Redis cache');
    return new RedisCache(options.redisClient);
  }

  logger.info('Using in-memory cache');
  return new MemoryCache();
}

// Singleton cache instance
let cacheInstance = null;

/**
 * Get the cache instance (creates if not exists)
 */
function getCache() {
  if (!cacheInstance) {
    cacheInstance = createCache();
  }
  return cacheInstance;
}

/**
 * Cache key builders for different data types
 */
const cacheKeys = {
  callSession: (callId) => `call:session:${callId}`,
  callerHistory: (phoneNumber) => `caller:history:${phoneNumber}`,
  clinicHours: (clinicId) => `clinic:hours:${clinicId}`,
  agentConfig: (agentId) => `agent:config:${agentId}`,
  rateLimit: (ip) => `ratelimit:${ip}`
};

/**
 * Default TTLs (in seconds)
 */
const TTL = {
  CALL_SESSION: 3600,      // 1 hour
  CALLER_HISTORY: 86400,   // 24 hours
  CLINIC_HOURS: 3600,      // 1 hour
  AGENT_CONFIG: 300,       // 5 minutes
  RATE_LIMIT: 60           // 1 minute
};

module.exports = {
  MemoryCache,
  RedisCache,
  createCache,
  getCache,
  cacheKeys,
  TTL
};
