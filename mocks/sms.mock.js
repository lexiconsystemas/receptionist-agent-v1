/**
 * SMS Provider Mock
 * Provider-agnostic stub for outbound/inbound SMS during development & testing.
 *
 * Replaces the old signalwire.mock.js SMS functionality.
 * When the real SMS provider (Twilio/Vonage) is confirmed, this mock will be
 * updated to mirror that provider's SDK response shapes exactly.
 */

const { v4: uuidv4 } = require('uuid');

// In-memory message store
const mockMessageStore = [];

/**
 * Generate a mock message SID in Twilio-compatible format (most likely provider)
 * @param {string} [prefix='SM'] - SID prefix
 */
function generateMockSid(prefix = 'SM') {
  return prefix + uuidv4().replace(/-/g, '').slice(0, 32);
}

/**
 * Simulate sending an SMS
 * @param {string} to - E.164 destination number
 * @param {string} body - Message body
 * @param {Object} [opts] - Optional overrides
 * @returns {Object} Mock provider response
 */
function mockSendSms(to, body, opts = {}) {
  const messageSid = generateMockSid('SM');
  const from = opts.from || process.env.SMS_FROM_NUMBER || '+15550000000';

  const record = {
    messageSid,
    from,
    to,
    body,
    status: 'queued',
    createdAt: new Date().toISOString()
  };

  mockMessageStore.push(record);

  // Simulate async delivery update
  setTimeout(() => {
    record.status = 'delivered';
  }, 100);

  return {
    success: true,
    messageSid,
    status: 'queued'
  };
}

/**
 * Generate a mock inbound SMS payload (provider-agnostic field names)
 * @param {Object} opts
 */
function generateMockInboundPayload(opts = {}) {
  return {
    From: opts.from || '+15551234567',
    To: opts.to || process.env.SMS_FROM_NUMBER || '+15550000000',
    Body: opts.body || 'Test message',
    MessageSid: generateMockSid('SM'),
    SmsSid: generateMockSid('SM')
  };
}

/**
 * Generate a mock SMS status callback payload
 * @param {string} messageSid
 * @param {string} [status='delivered']
 */
function generateMockStatusPayload(messageSid, status = 'delivered') {
  return {
    MessageSid: messageSid,
    MessageStatus: status,
    To: '+15551234567',
    From: process.env.SMS_FROM_NUMBER || '+15550000000'
  };
}

/**
 * Get all mock messages
 */
function getMockMessages() {
  return [...mockMessageStore];
}

/**
 * Clear mock message store (call between tests)
 */
function clearMockStore() {
  mockMessageStore.length = 0;
}

module.exports = {
  mockSendSms,
  generateMockInboundPayload,
  generateMockStatusPayload,
  getMockMessages,
  clearMockStore,
  generateMockSid
};
