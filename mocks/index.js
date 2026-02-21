/**
 * Mock API Index
 * Central export for all mock implementations
 *
 * Usage:
 *   Set USE_MOCKS=true in .env to enable mock mode
 *   Or run with NODE_ENV=development (mocks enabled by default)
 *
 * In production (NODE_ENV=production), mocks are disabled and
 * real API credentials must be configured.
 */

const retellMock = require('./retell.mock');
const keragonMock = require('./keragon.mock');
const hathrMock = require('./hathr.mock');
const signalwireMock = require('./signalwire.mock');

const MOCK_ENABLED = process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'development';

/**
 * Check if mock mode is enabled
 */
function isMockMode() {
  return MOCK_ENABLED;
}

/**
 * Get mock status for all services
 */
function getMockStatus() {
  return {
    mock_enabled: MOCK_ENABLED,
    environment: process.env.NODE_ENV || 'development',
    services: {
      retell: {
        mocked: MOCK_ENABLED,
        real_credentials_configured: !!process.env.RETELL_API_KEY
      },
      keragon: {
        mocked: MOCK_ENABLED,
        real_credentials_configured: !!process.env.KERAGON_WEBHOOK_URL
      },
      hathr: {
        mocked: MOCK_ENABLED,
        real_credentials_configured: !!process.env.HATHR_API_KEY
      },
      signalwire: {
        mocked: MOCK_ENABLED,
        real_credentials_configured: !!(
          process.env.SIGNALWIRE_PROJECT_ID &&
          process.env.SIGNALWIRE_API_TOKEN &&
          process.env.SIGNALWIRE_SPACE_URL
        )
      }
    }
  };
}

/**
 * Clear all mock data stores
 */
function clearAllMockStores() {
  keragonMock.clearMockStore();
  signalwireMock.clearMockStores();
  console.log('[MOCKS] All mock stores cleared');
}

/**
 * Get statistics from all mock stores
 */
function getAllMockStats() {
  return {
    keragon: keragonMock.getMockStats(),
    signalwire: {
      sms_count: signalwireMock.getMockSmsMessages().length,
      call_count: signalwireMock.getMockCalls().length
    }
  };
}

module.exports = {
  // Status
  MOCK_ENABLED,
  isMockMode,
  getMockStatus,
  clearAllMockStores,
  getAllMockStats,

  // RetellAI mocks
  retell: retellMock,

  // Keragon mocks
  keragon: keragonMock,

  // Hathr.ai mocks
  hathr: hathrMock,

  // SignalWire mocks
  signalwire: signalwireMock
};
