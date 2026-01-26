/**
 * Redis Configuration
 * Session management and caching for production scalability
 */

const Redis = require('ioredis');
const logger = require('./logger');

class RedisManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 5;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        }
      });

      // Event listeners
      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
        this.retryAttempts = 0;
      });

      this.redis.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      // Test connection
      await this.redis.connect();
      await this.redis.ping();
      
      logger.info('Redis initialized and ready');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Redis', { error: error.message });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Store call session data
   */
  async setCallSession(callId, sessionData, ttl = 3600) {
    if (!this.isConnected) {
      logger.warn('Redis not connected - skipping session storage');
      return false;
    }

    try {
      const key = `call:${callId}`;
      await this.redis.setex(key, ttl, JSON.stringify(sessionData));
      logger.debug('Call session stored', { callId, ttl });
      return true;
    } catch (error) {
      logger.error('Failed to store call session', { callId, error: error.message });
      return false;
    }
  }

  /**
   * Retrieve call session data
   */
  async getCallSession(callId) {
    if (!this.isConnected) {
      logger.warn('Redis not connected - skipping session retrieval');
      return null;
    }

    try {
      const key = `call:${callId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to retrieve call session', { callId, error: error.message });
      return null;
    }
  }

  /**
   * Delete call session
   */
  async deleteCallSession(callId) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const key = `call:${callId}`;
      await this.redis.del(key);
      logger.debug('Call session deleted', { callId });
      return true;
    } catch (error) {
      logger.error('Failed to delete call session', { callId, error: error.message });
      return false;
    }
  }

  /**
   * Cache API response
   */
  async cacheResponse(key, data, ttl = 300) {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
      logger.debug('Response cached', { key, ttl });
      return true;
    } catch (error) {
      logger.error('Failed to cache response', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get cached response
   */
  async getCachedResponse(key) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to get cached response', { key, error: error.message });
      return null;
    }
  }

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(identifier, window = 60) {
    if (!this.isConnected) {
      return { count: 0, ttl: window };
    }

    try {
      const key = `rate_limit:${identifier}`;
      const pipeline = this.redis.pipeline();
      
      pipeline.incr(key);
      pipeline.expire(key, window);
      
      const results = await pipeline.exec();
      const count = results[0][1];
      const ttl = await this.redis.ttl(key);
      
      return { count, ttl };
    } catch (error) {
      logger.error('Failed to increment rate limit', { identifier, error: error.message });
      return { count: 0, ttl: window };
    }
  }

  /**
   * Health check for Redis
   */
  async healthCheck() {
    if (!this.redis) {
      return { status: 'unhealthy', message: 'Redis not initialized' };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        connected: this.isConnected,
        memory: await this.redis.info('memory')
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        connected: this.isConnected
      };
    }
  }

  /**
   * Get Redis statistics
   */
  async getStats() {
    if (!this.isConnected) {
      return null;
    }

    try {
      const info = await this.redis.info();
      const keyspace = await this.redis.info('keyspace');
      
      return {
        connected: this.isConnected,
        uptime: this.redis.status === 'ready' ? 'connected' : 'disconnected',
        info: info,
        keyspace: keyspace
      };
    } catch (error) {
      logger.error('Failed to get Redis stats', { error: error.message });
      return null;
    }
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis disconnected gracefully');
    }
  }
}

// Singleton instance
const redisManager = new RedisManager();

module.exports = redisManager;
