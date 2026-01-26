/**
 * Health Check System
 * Comprehensive health monitoring for all system components
 */

const logger = require('./logger');
const redisManager = require('./redis');

class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.lastResults = new Map();
    this.checkInterval = null;
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      interval: options.interval || 30000
    });
    
    logger.info('Health check registered', { name, options });
  }

  /**
   * Run a single health check
   */
  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }

    const startTime = Date.now();
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), check.timeout);
      });

      const result = await Promise.race([
        check.fn(),
        timeoutPromise
      ]);

      const duration = Date.now() - startTime;
      
      const healthResult = {
        name,
        status: 'healthy',
        duration,
        timestamp: new Date().toISOString(),
        details: result
      };

      this.lastResults.set(name, healthResult);
      return healthResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      const healthResult = {
        name,
        status: 'unhealthy',
        duration,
        timestamp: new Date().toISOString(),
        error: error.message,
        critical: check.critical
      };

      this.lastResults.set(name, healthResult);
      
      if (check.critical) {
        logger.error('Critical health check failed', { name, error: error.message });
      } else {
        logger.warn('Health check failed', { name, error: error.message });
      }

      return healthResult;
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const results = {};
    const promises = [];

    for (const name of this.checks.keys()) {
      promises.push(
        this.runCheck(name)
          .then(result => { results[name] = result; })
          .catch(error => { 
            results[name] = {
              name,
              status: 'error',
              error: error.message,
              timestamp: new Date().toISOString()
            };
          })
      );
    }

    await Promise.all(promises);

    // Calculate overall status
    const overallStatus = this.calculateOverallStatus(results);
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
      summary: this.generateSummary(results)
    };
  }

  /**
   * Calculate overall system health status
   */
  calculateOverallStatus(results) {
    const statuses = Object.values(results).map(r => r.status);
    
    if (statuses.some(s => s === 'error')) {
      return 'error';
    }
    
    const criticalFailures = Object.values(results)
      .filter(r => r.critical && r.status === 'unhealthy');
    
    if (criticalFailures.length > 0) {
      return 'critical';
    }
    
    if (statuses.some(s => s === 'unhealthy')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Generate health summary
   */
  generateSummary(results) {
    const summary = {
      total: Object.keys(results).length,
      healthy: 0,
      unhealthy: 0,
      critical: 0,
      error: 0
    };

    for (const result of Object.values(results)) {
      summary[result.status]++;
      if (result.critical && result.status === 'unhealthy') {
        summary.critical++;
      }
    }

    return summary;
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(interval = 30000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.runAllChecks();
      } catch (error) {
        logger.error('Periodic health check failed', { error: error.message });
      }
    }, interval);

    logger.info('Periodic health checks started', { interval });
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Periodic health checks stopped');
    }
  }

  /**
   * Get last health check results
   */
  getLastResults() {
    return Object.fromEntries(this.lastResults);
  }

  /**
   * Get specific check result
   */
  getLastResult(name) {
    return this.lastResults.get(name);
  }
}

// Create global health checker instance
const healthChecker = new HealthChecker();

// Register default health checks
healthChecker.registerCheck('server', async () => {
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env.NODE_ENV
  };
}, { critical: true, timeout: 1000 });

healthChecker.registerCheck('redis', async () => {
  return await redisManager.healthCheck();
}, { critical: true, timeout: 3000 });

healthChecker.registerCheck('filesystem', async () => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    await fs.access(path.join(__dirname, '../../logs'), fs.constants.W_OK);
    return { accessible: true };
  } catch (error) {
    throw new Error('Logs directory not writable');
  }
}, { critical: true, timeout: 2000 });

// Express middleware for health endpoint
function healthMiddleware(req, res) {
  const check = req.query.check;
  
  if (check) {
    // Run specific check
    healthChecker.runCheck(check)
      .then(result => {
        const statusCode = result.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(result);
      })
      .catch(error => {
        res.status(500).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });
  } else {
    // Run all checks
    healthChecker.runAllChecks()
      .then(results => {
        const statusCode = results.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(results);
      })
      .catch(error => {
        res.status(500).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });
  }
}

// Readiness probe (for Kubernetes/container orchestration)
function readinessMiddleware(req, res) {
  // Check critical components only
  const criticalChecks = ['server', 'redis'];
  const promises = criticalChecks.map(name => 
    healthChecker.runCheck(name)
      .then(result => ({ name, status: result.status }))
      .catch(() => ({ name, status: 'error' }))
  );

  Promise.all(promises)
    .then(results => {
      const allHealthy = results.every(r => r.status === 'healthy');
      const statusCode = allHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        status: allHealthy ? 'ready' : 'not ready',
        checks: results,
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
}

// Liveness probe (for Kubernetes/container orchestration)
function livenessMiddleware(req, res) {
  // Simple check if process is responsive
  res.status(200).json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  healthChecker,
  healthMiddleware,
  readinessMiddleware,
  livenessMiddleware
};
