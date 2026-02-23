/**
 * Jest Test Setup
 * Configures test environment
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.USE_MOCKS = 'true';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests
process.env.SCHEDULER_ENABLED = 'false'; // Prevent cron timers from leaking in tests

// Mock environment variables for tests — SMS provider (TBD; Twilio vars used as placeholder)
process.env.TWILIO_ACCOUNT_SID = 'ACtest00000000000000000000000000000';
process.env.TWILIO_AUTH_TOKEN = 'TEST_TWILIO_AUTH_TOKEN';
process.env.SMS_FROM_NUMBER = '+15551234567';
process.env.RETELL_API_KEY = 'TEST_RETELL_KEY';
process.env.RETELL_AGENT_ID = 'TEST_AGENT_ID';
process.env.KERAGON_WEBHOOK_URL = 'https://test.keragon.com/webhook';
process.env.HATHR_API_KEY = 'TEST_HATHR_KEY';
process.env.SMS_ENABLED = 'true';
process.env.CLINIC_NAME = 'Test Urgent Care';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global test cleanup
afterAll(async () => {
  // Allow time for any pending operations
  await new Promise(resolve => setTimeout(resolve, 100));
});
