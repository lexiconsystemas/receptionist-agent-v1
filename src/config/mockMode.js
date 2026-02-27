/**
 * Mock Mode Configuration
 * Controls whether to use mock services or real APIs
 */

const logger = require('./logger');

// Check if mock mode is enabled
const MOCK_MODE = process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'development';

// Mock mode status
logger.info('Mock mode configuration', {
  mockMode: MOCK_MODE,
  nodeEnv: process.env.NODE_ENV,
  mockModeEnv: process.env.MOCK_MODE
});

/**
 * Service factory that returns either mock or real services
 */
class ServiceFactory {
  static getRetellService() {
    if (MOCK_MODE) {
      logger.info('Using RetellAI mock service');
      return require('../mocks/retellMock');
    } else {
      logger.info('Using RetellAI real service');
      return require('./retell');
    }
  }

  static getKeragonService() {
    if (MOCK_MODE) {
      logger.info('Using Keragon mock service');
      return require('../mocks/keragonMock');
    } else {
      logger.info('Using Keragon real service');
      return require('../services/callLogger');
    }
  }

  static getHathrService() {
    if (MOCK_MODE) {
      logger.info('Using Hathr.ai mock service');
      return require('../mocks/hathrMock');
    } else {
      logger.info('Using Hathr.ai real service');
      // Hathr.ai integration would go here
      throw new Error('Hathr.ai integration not yet implemented');
    }
  }

  static getSmsProvider() {
    // smsProvider.js handles mock/real branching internally via USE_MOCKS / NODE_ENV,
    // so we always return the same module; no separate mock file needed.
    return require('./smsProvider');
  }

  static getGoogleCalendarService() {
    // googleCalendarService.js handles mock/real branching internally via USE_MOCKS / NODE_ENV,
    // so we always return the same module; no separate require needed for consumers.
    // This factory method exists for consistency and discoverability.
    return require('../services/googleCalendarService');
  }

  static isMockMode() {
    return MOCK_MODE;
  }
}

module.exports = ServiceFactory;
