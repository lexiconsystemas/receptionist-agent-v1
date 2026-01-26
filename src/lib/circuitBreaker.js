/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures when external services are down
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 */

const logger = require('../config/logger');
const EventEmitter = require('events');

/**
 * Circuit breaker states
 */
const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG = {
  failureThreshold: 5,        // Number of failures before opening
  successThreshold: 2,        // Number of successes in half-open to close
  timeout: 30000,             // Time in ms before moving from open to half-open
  monitorInterval: 10000,     // Health check interval
  volumeThreshold: 5          // Minimum requests before evaluating failure rate
};

/**
 * Circuit Breaker class
 */
class CircuitBreaker extends EventEmitter {
  constructor(name, config = {}) {
    super();
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.requestCount = 0;
    this.stats = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      rejectedRequests: 0
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute(fn) {
    this.requestCount++;
    this.stats.totalRequests++;

    // Check if circuit is open
    if (this.state === STATES.OPEN) {
      if (this._shouldAttemptReset()) {
        this._transitionTo(STATES.HALF_OPEN);
      } else {
        this.stats.rejectedRequests++;
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.code = 'CIRCUIT_OPEN';
        throw error;
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  _onSuccess() {
    this.stats.totalSuccesses++;

    if (this.state === STATES.HALF_OPEN) {
      this.successes++;

      if (this.successes >= this.config.successThreshold) {
        this._transitionTo(STATES.CLOSED);
      }
    } else if (this.state === STATES.CLOSED) {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  _onFailure(error) {
    this.stats.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();

    logger.warn(`Circuit breaker ${this.name} recorded failure`, {
      state: this.state,
      failures: this.failures,
      threshold: this.config.failureThreshold,
      error: error.message
    });

    if (this.state === STATES.HALF_OPEN) {
      // Any failure in half-open immediately opens the circuit
      this._transitionTo(STATES.OPEN);
    } else if (this.state === STATES.CLOSED) {
      if (this.failures >= this.config.failureThreshold &&
          this.requestCount >= this.config.volumeThreshold) {
        this._transitionTo(STATES.OPEN);
      }
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  _shouldAttemptReset() {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.config.timeout;
  }

  /**
   * Transition to a new state
   */
  _transitionTo(newState) {
    const previousState = this.state;
    this.state = newState;

    if (newState === STATES.CLOSED) {
      this.failures = 0;
      this.successes = 0;
      this.requestCount = 0;
    } else if (newState === STATES.HALF_OPEN) {
      this.successes = 0;
    }

    logger.info(`Circuit breaker ${this.name} state change`, {
      from: previousState,
      to: newState
    });

    this.emit('stateChange', { name: this.name, from: previousState, to: newState });
  }

  /**
   * Force circuit to open (for testing or manual intervention)
   */
  forceOpen() {
    this._transitionTo(STATES.OPEN);
    this.lastFailureTime = Date.now();
  }

  /**
   * Force circuit to close (for testing or manual intervention)
   */
  forceClose() {
    this._transitionTo(STATES.CLOSED);
  }

  /**
   * Get current state and statistics
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      config: this.config,
      stats: { ...this.stats },
      failureRate: this.stats.totalRequests > 0
        ? (this.stats.totalFailures / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Check if circuit is allowing requests
   */
  isAvailable() {
    if (this.state === STATES.CLOSED) return true;
    if (this.state === STATES.HALF_OPEN) return true;
    if (this.state === STATES.OPEN && this._shouldAttemptReset()) return true;
    return false;
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker
   */
  get(name, config = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name);
  }

  /**
   * Get status of all circuit breakers
   */
  getAllStatus() {
    const status = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getStatus();
    }
    return status;
  }

  /**
   * Check if all circuits are healthy
   */
  isHealthy() {
    for (const breaker of this.breakers.values()) {
      if (breaker.state === STATES.OPEN) {
        return false;
      }
    }
    return true;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.forceClose();
    }
  }
}

// Singleton registry
const registry = new CircuitBreakerRegistry();

/**
 * Pre-configured circuit breakers for each external service
 */
const circuitBreakers = {
  keragon: registry.get('keragon', {
    failureThreshold: 5,
    timeout: 30000
  }),

  retell: registry.get('retell', {
    failureThreshold: 3,
    timeout: 15000 // Shorter timeout for voice service
  }),

  twilio: registry.get('twilio', {
    failureThreshold: 5,
    timeout: 30000
  }),

  hathr: registry.get('hathr', {
    failureThreshold: 3,
    timeout: 15000
  })
};

module.exports = {
  CircuitBreaker,
  CircuitBreakerRegistry,
  registry,
  circuitBreakers,
  STATES
};
