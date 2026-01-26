/**
 * Resilience Patterns
 * Retry logic, circuit breakers, and bulkheads for external service calls
 */

const logger = require('../config/logger');

/**
 * Retry configuration
 */
class RetryConfig {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 10000;
    this.backoffFactor = options.backoffFactor || 2;
    this.retryableErrors = options.retryableErrors || [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'EPIPE',
      'EAISERVICE'
    ];
  }

  /**
   * Calculate delay with exponential backoff
   */
  calculateDelay(attempt) {
    const delay = Math.min(
      this.baseDelay * Math.pow(this.backoffFactor, attempt),
      this.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = delay * 0.1 * Math.random();
    return Math.floor(delay + jitter);
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (!error) return false;
    
    // Check HTTP status codes
    if (error.response) {
      const status = error.response.status;
      return status >= 500 || status === 429; // Server errors or rate limit
    }
    
    // Check network errors
    return this.retryableErrors.some(code => error.code === code);
  }
}

/**
 * Circuit Breaker Pattern
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.requestCount = 0;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn, ...args) {
    this.requestCount++;
    
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        logger.info('Circuit breaker moving to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // Need 3 successes to close
        this.state = 'CLOSED';
        logger.info('Circuit breaker moving to CLOSED');
      }
    }
  }

  /**
   * Handle failed request
   */
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker moving to OPEN', {
        failureCount: this.failureCount,
        threshold: this.failureThreshold
      });
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    logger.info('Circuit breaker reset to CLOSED');
  }
}

/**
 * Resilient HTTP Client with retry and circuit breaker
 */
class ResilientHttpClient {
  constructor(options = {}) {
    this.axios = require('axios');
    this.retryConfig = new RetryConfig(options.retry);
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.timeout = options.timeout || 10000;
    this.name = options.name || 'unnamed-client';
  }

  /**
   * Make HTTP request with resilience patterns
   */
  async request(config) {
    const requestConfig = {
      ...config,
      timeout: config.timeout || this.timeout
    };

    return this.circuitBreaker.execute(async () => {
      return this.executeWithRetry(requestConfig);
    });
  }

  /**
   * Execute request with retry logic
   */
  async executeWithRetry(config, attempt = 0) {
    try {
      const response = await this.axios(requestConfig);
      
      if (attempt > 0) {
        logger.info('Request succeeded after retry', {
          client: this.name,
          attempt: attempt + 1,
          url: config.url
        });
      }
      
      return response;
    } catch (error) {
      logger.warn('Request failed', {
        client: this.name,
        attempt: attempt + 1,
        url: config.url,
        error: error.message,
        retryable: this.retryConfig.isRetryableError(error)
      });

      // Check if we should retry
      if (attempt < this.retryConfig.maxRetries && this.retryConfig.isRetryableError(error)) {
        const delay = this.retryConfig.calculateDelay(attempt);
        
        logger.info('Retrying request', {
          client: this.name,
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          delay
        });

        await this.delay(delay);
        return this.executeWithRetry(config, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get client status
   */
  getStatus() {
    return {
      name: this.name,
      circuitBreaker: this.circuitBreaker.getStatus(),
      retryConfig: {
        maxRetries: this.retryConfig.maxRetries,
        baseDelay: this.retryConfig.baseDelay
      }
    };
  }
}

/**
 * Bulkhead Pattern - Limit concurrent requests
 */
class Bulkhead {
  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Execute function with bulkhead protection
   */
  async execute(fn) {
    return new Promise((resolve, reject) => {
      const task = { fn, resolve, reject };
      
      if (this.running < this.maxConcurrent) {
        this.executeTask(task);
      } else {
        this.queue.push(task);
      }
    });
  }

  /**
   * Execute a single task
   */
  async executeTask(task) {
    this.running++;
    
    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.running--;
      
      // Process next task in queue
      if (this.queue.length > 0) {
        const nextTask = this.queue.shift();
        this.executeTask(nextTask);
      }
    }
  }

  /**
   * Get bulkhead status
   */
  getStatus() {
    return {
      running: this.running,
      maxConcurrent: this.maxConcurrent,
      queued: this.queue.length
    };
  }
}

/**
 * Factory function to create resilient clients
 */
function createResilientClient(options = {}) {
  return new ResilientHttpClient(options);
}

module.exports = {
  RetryConfig,
  CircuitBreaker,
  ResilientHttpClient,
  Bulkhead,
  createResilientClient
};
