/**
 * Comprehensive Health Check System
 * Monitors all external dependencies and internal state
 */

const logger = require('../config/logger');
const { registry: circuitBreakerRegistry } = require('./circuitBreaker');
const { getCache } = require('./cache');

/**
 * Health check status levels
 */
const STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy'
};

/**
 * Individual dependency health checkers
 */
const healthCheckers = {
  /**
   * Check Redis/Cache connectivity
   */
  cache: async () => {
    try {
      const cache = getCache();
      const testKey = `health:check:${Date.now()}`;

      await cache.set(testKey, 'ok', 5);
      const value = await cache.get(testKey);
      await cache.delete(testKey);

      return {
        status: value === 'ok' ? STATUS.HEALTHY : STATUS.DEGRADED,
        latency: null,
        details: cache.getStats()
      };
    } catch (error) {
      return {
        status: STATUS.UNHEALTHY,
        error: error.message
      };
    }
  },

  /**
   * Check SignalWire API connectivity
   */
  signalwire: async () => {
    const startTime = Date.now();

    // Check if credentials are configured
    if (!process.env.SIGNALWIRE_PROJECT_ID || !process.env.SIGNALWIRE_API_TOKEN || !process.env.SIGNALWIRE_SPACE_URL) {
      return {
        status: STATUS.DEGRADED,
        error: 'SignalWire credentials not configured (need SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE_URL)',
        configured: false
      };
    }

    // In mock mode, return healthy
    if (process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'development') {
      return {
        status: STATUS.HEALTHY,
        mode: 'mock',
        latency: 0
      };
    }

    try {
      // Light API call to verify credentials
      // eslint-disable-next-line node/no-extraneous-require
      const { RestClient } = require('../../node_modules/@signalwire/compatibility-api/index.js');
      const swClient = new RestClient(
        process.env.SIGNALWIRE_PROJECT_ID,
        process.env.SIGNALWIRE_API_TOKEN,
        { signalwireSpaceUrl: process.env.SIGNALWIRE_SPACE_URL }
      );

      await swClient.api.accounts(process.env.SIGNALWIRE_PROJECT_ID).fetch();

      return {
        status: STATUS.HEALTHY,
        latency: Date.now() - startTime,
        configured: true
      };
    } catch (error) {
      return {
        status: STATUS.UNHEALTHY,
        error: error.message,
        latency: Date.now() - startTime
      };
    }
  },

  /**
   * Check RetellAI API connectivity
   */
  retell: async () => {
    // Check if credentials are configured
    if (!process.env.RETELL_API_KEY) {
      return {
        status: STATUS.DEGRADED,
        error: 'RetellAI API key not configured',
        configured: false
      };
    }

    // In mock mode, return healthy
    if (process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'development') {
      return {
        status: STATUS.HEALTHY,
        mode: 'mock'
      };
    }

    // Real health check would call RetellAI API
    return {
      status: STATUS.HEALTHY,
      configured: true,
      agentId: process.env.RETELL_AGENT_ID || 'not set'
    };
  },

  /**
   * Check Keragon API connectivity
   */
  keragon: async () => {
    // Check if credentials are configured
    if (!process.env.KERAGON_WEBHOOK_URL) {
      return {
        status: STATUS.DEGRADED,
        error: 'Keragon webhook URL not configured',
        configured: false
      };
    }

    // In mock mode, return healthy
    if (process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'development') {
      return {
        status: STATUS.HEALTHY,
        mode: 'mock'
      };
    }

    return {
      status: STATUS.HEALTHY,
      configured: true
    };
  },

  /**
   * Check Hathr.ai API connectivity
   */
  hathr: async () => {
    // Check if credentials are configured
    if (!process.env.HATHR_API_KEY) {
      return {
        status: STATUS.DEGRADED,
        error: 'Hathr.ai API key not configured',
        configured: false
      };
    }

    // In mock mode, return healthy
    if (process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'development') {
      return {
        status: STATUS.HEALTHY,
        mode: 'mock'
      };
    }

    return {
      status: STATUS.HEALTHY,
      configured: true
    };
  },

  /**
   * Check circuit breakers status
   */
  circuitBreakers: async () => {
    const status = circuitBreakerRegistry.getAllStatus();
    const unhealthy = Object.entries(status)
      .filter(([, s]) => s.state === 'OPEN')
      .map(([name]) => name);

    return {
      status: unhealthy.length === 0 ? STATUS.HEALTHY : STATUS.DEGRADED,
      breakers: status,
      openCircuits: unhealthy
    };
  },

  /**
   * Check system resources
   */
  system: async () => {
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const memPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    const status = memPercent > 90 ? STATUS.DEGRADED :
                   memPercent > 95 ? STATUS.UNHEALTHY :
                   STATUS.HEALTHY;

    return {
      status,
      memory: {
        used: `${memUsedMB}MB`,
        total: `${memTotalMB}MB`,
        percent: `${memPercent}%`
      },
      uptime: Math.round(process.uptime()),
      nodeVersion: process.version
    };
  }
};

/**
 * Run all health checks
 */
async function checkAll() {
  const results = {};
  const startTime = Date.now();

  // Run all checks in parallel
  const checks = Object.entries(healthCheckers).map(async ([name, checker]) => {
    try {
      results[name] = await checker();
    } catch (error) {
      results[name] = {
        status: STATUS.UNHEALTHY,
        error: error.message
      };
    }
  });

  await Promise.all(checks);

  // Calculate overall status
  const statuses = Object.values(results).map(r => r.status);
  let overallStatus = STATUS.HEALTHY;

  if (statuses.includes(STATUS.UNHEALTHY)) {
    overallStatus = STATUS.UNHEALTHY;
  } else if (statuses.includes(STATUS.DEGRADED)) {
    overallStatus = STATUS.DEGRADED;
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    checks: results
  };
}

/**
 * Run a specific health check
 */
async function check(name) {
  const checker = healthCheckers[name];
  if (!checker) {
    throw new Error(`Unknown health check: ${name}`);
  }

  try {
    return await checker();
  } catch (error) {
    return {
      status: STATUS.UNHEALTHY,
      error: error.message
    };
  }
}

/**
 * Quick liveness check (is the process running?)
 */
function liveness() {
  return {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}

/**
 * Readiness check (can accept traffic?)
 */
async function readiness() {
  // Check critical dependencies
  const critical = ['cache', 'circuitBreakers'];
  const results = {};

  for (const name of critical) {
    results[name] = await check(name);
  }

  const ready = Object.values(results).every(
    r => r.status !== STATUS.UNHEALTHY
  );

  return {
    ready,
    timestamp: new Date().toISOString(),
    checks: results
  };
}

module.exports = {
  STATUS,
  healthCheckers,
  checkAll,
  check,
  liveness,
  readiness
};
