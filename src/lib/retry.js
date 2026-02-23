/**
 * Retry Logic with Exponential Backoff
 * Handles transient failures for external API calls
 */

const logger = require('../config/logger');

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1, // Add 10% random jitter
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EPIPE',
    'ENETUNREACH',
    'EAI_AGAIN'
  ],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt, config) {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * Math.random();
  return Math.floor(cappedDelay + jitter);
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error, config) {
  // Check error code
  if (error.code && config.retryableErrors.includes(error.code)) {
    return true;
  }

  // Check HTTP status code
  if (error.response?.status && config.retryableStatusCodes.includes(error.response.status)) {
    return true;
  }

  // Check for specific error messages
  const retryableMessages = [
    'socket hang up',
    'network error',
    'timeout',
    'ECONNRESET'
  ];

  if (error.message && retryableMessages.some(msg =>
    error.message.toLowerCase().includes(msg.toLowerCase())
  )) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 *
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {string} options.operationName - Name for logging
 * @param {Object} options.context - Additional context for logging
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const operationName = options.operationName || 'operation';
  const context = options.context || {};

  let lastError;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      const result = await fn();

      if (attempt > 1) {
        logger.info(`${operationName} succeeded after ${attempt} attempts`, context);
      }

      return result;
    } catch (error) {
      lastError = error;

      const isRetryable = isRetryableError(error, config);
      const hasMoreRetries = attempt <= config.maxRetries;

      logger.warn(`${operationName} failed`, {
        ...context,
        attempt,
        maxRetries: config.maxRetries,
        isRetryable,
        errorCode: error.code,
        errorMessage: error.message,
        statusCode: error.response?.status
      });

      if (!isRetryable || !hasMoreRetries) {
        throw error;
      }

      const delay = calculateDelay(attempt, config);
      logger.info(`${operationName} retrying in ${delay}ms`, { ...context, attempt });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper for a specific service
 *
 * @param {string} serviceName - Name of the service
 * @param {Object} customConfig - Custom retry configuration
 * @returns {Function} Configured retry function
 */
function createRetryWrapper(serviceName, customConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  return async function retryWrapper(fn, operationName, context = {}) {
    return withRetry(fn, {
      ...config,
      operationName: `${serviceName}:${operationName}`,
      context: { service: serviceName, ...context }
    });
  };
}

/**
 * Pre-configured retry wrappers for each external service
 */
const retryWrappers = {
  keragon: createRetryWrapper('Keragon', {
    maxRetries: 3,
    initialDelayMs: 1000
  }),

  retell: createRetryWrapper('RetellAI', {
    maxRetries: 2,
    initialDelayMs: 500 // Lower latency requirement
  }),

  sms: createRetryWrapper('SMS', {
    maxRetries: 3,
    initialDelayMs: 1000
  }),

  hathr: createRetryWrapper('Hathr', {
    maxRetries: 2,
    initialDelayMs: 500
  })
};

module.exports = {
  withRetry,
  createRetryWrapper,
  retryWrappers,
  isRetryableError,
  calculateDelay,
  DEFAULT_CONFIG
};
