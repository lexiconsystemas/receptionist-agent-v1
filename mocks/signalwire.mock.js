/**
 * SignalWire Mock API
 * Simulates SignalWire responses for development/testing
 *
 * REPLACE WITH REAL API WHEN CLIENT PROVIDES:
 * - SIGNALWIRE_PROJECT_ID
 * - SIGNALWIRE_API_TOKEN
 * - SIGNALWIRE_SPACE_URL
 * - SIGNALWIRE_PHONE_NUMBER
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../src/config/logger');

const MOCK_ENABLED = process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'development';

/**
 * In-memory store for mock SMS messages
 */
const mockSmsStore = [];

/**
 * In-memory store for mock calls
 */
const mockCallStore = [];

/**
 * Mock SignalWire phone number
 */
const MOCK_PHONE_NUMBER = '+15551234567';

/**
 * Generate mock SignalWire SID
 * SignalWire uses the same SID format as Twilio for compatibility
 */
function generateMockSid(prefix = 'SM') {
  return `${prefix}${uuidv4().replace(/-/g, '').substring(0, 32)}`;
}

/**
 * Mock send SMS via SignalWire
 */
async function mockSendSms(to, body, options = {}) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real SIGNALWIRE_API_TOKEN');
  }

  const messageSid = generateMockSid('SM');

  const message = {
    sid: messageSid,
    accountSid: 'MOCK_PROJECT_ID',
    from: options.from || MOCK_PHONE_NUMBER,
    to: to,
    body: body,
    status: 'queued',
    dateCreated: new Date().toISOString(),
    dateSent: null,
    dateUpdated: new Date().toISOString(),
    direction: 'outbound-api',
    numSegments: Math.ceil(body.length / 160).toString(),
    price: null,
    priceUnit: 'USD'
  };

  mockSmsStore.push(message);

  logger.info('[MOCK] SignalWire SMS queued', {
    messageSid,
    to,
    bodyLength: body.length
  });

  // Simulate async delivery status update
  setTimeout(() => {
    message.status = 'delivered';
    message.dateSent = new Date().toISOString();
    logger.info('[MOCK] SignalWire SMS delivered', { messageSid });
  }, 1000);

  return {
    sid: messageSid,
    status: 'queued'
  };
}

/**
 * Mock get SMS status
 */
async function mockGetSmsStatus(messageSid) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real SIGNALWIRE_API_TOKEN');
  }

  const message = mockSmsStore.find(m => m.sid === messageSid);

  if (!message) {
    throw new Error(`Message not found: ${messageSid}`);
  }

  return message;
}

/**
 * Mock LaML (TwiML-compatible) generation for RetellAI connection
 */
function mockGenerateRetellTwiml(callData) {
  const agentId = process.env.RETELL_AGENT_ID || 'mock_agent_id';
  const baseUrl = process.env.BASE_URL || 'https://localhost:3000';

  const laml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.retellai.com/audio-websocket/${agentId}">
      <Parameter name="callSid" value="${callData.CallSid || 'mock_call_sid'}" />
      <Parameter name="from" value="${callData.From || '+15550001111'}" />
      <Parameter name="to" value="${callData.To || MOCK_PHONE_NUMBER}" />
    </Stream>
  </Connect>
</Response>`;

  logger.info('[MOCK] Generated SignalWire LaML for RetellAI connection');

  return laml;
}

/**
 * Mock SignalWire call object
 */
async function mockMakeCall(to, options = {}) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real SIGNALWIRE_API_TOKEN');
  }

  const callSid = generateMockSid('CA');

  const call = {
    sid: callSid,
    accountSid: 'MOCK_PROJECT_ID',
    from: options.from || MOCK_PHONE_NUMBER,
    to: to,
    status: 'queued',
    direction: 'outbound-api',
    startTime: null,
    endTime: null,
    duration: null,
    dateCreated: new Date().toISOString(),
    dateUpdated: new Date().toISOString()
  };

  mockCallStore.push(call);

  logger.info('[MOCK] SignalWire call initiated', { callSid, to });

  return call;
}

/**
 * Mock get call details
 */
async function mockGetCallDetails(callSid) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real SIGNALWIRE_API_TOKEN');
  }

  const call = mockCallStore.find(c => c.sid === callSid);

  if (!call) {
    // Return mock data for unknown call SIDs (from webhooks)
    return {
      sid: callSid,
      from: '+15550001111',
      to: MOCK_PHONE_NUMBER,
      status: 'completed',
      duration: 120,
      startTime: new Date(Date.now() - 120000).toISOString(),
      endTime: new Date().toISOString()
    };
  }

  return call;
}

/**
 * Mock validate webhook signature
 * Always returns true in mock mode
 */
function mockValidateWebhookSignature(signature, url, params) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - use real signature validation');
  }

  logger.warn('[MOCK] Skipping SignalWire webhook signature validation');
  return true;
}

/**
 * Generate mock incoming call webhook payload
 * SignalWire uses the same payload format as Twilio for compatibility
 */
function generateMockIncomingCallPayload(options = {}) {
  return {
    AccountSid: 'MOCK_PROJECT_ID',
    ApiVersion: '2010-04-01',
    CallSid: generateMockSid('CA'),
    CallStatus: 'ringing',
    Called: options.to || MOCK_PHONE_NUMBER,
    CalledCity: 'San Francisco',
    CalledCountry: 'US',
    CalledState: 'CA',
    CalledZip: '94102',
    Caller: options.from || '+15559998888',
    CallerCity: 'Los Angeles',
    CallerCountry: 'US',
    CallerState: 'CA',
    CallerZip: '90001',
    Direction: 'inbound',
    From: options.from || '+15559998888',
    To: options.to || MOCK_PHONE_NUMBER
  };
}

/**
 * Generate mock SMS status callback payload
 */
function generateMockSmsStatusPayload(messageSid, status = 'delivered') {
  return {
    AccountSid: 'MOCK_PROJECT_ID',
    ApiVersion: '2010-04-01',
    From: MOCK_PHONE_NUMBER,
    MessageSid: messageSid,
    MessageStatus: status,
    SmsSid: messageSid,
    SmsStatus: status,
    To: '+15559998888'
  };
}

/**
 * Get all mock SMS messages
 */
function getMockSmsMessages() {
  return [...mockSmsStore];
}

/**
 * Get all mock calls
 */
function getMockCalls() {
  return [...mockCallStore];
}

/**
 * Clear mock stores
 */
function clearMockStores() {
  mockSmsStore.length = 0;
  mockCallStore.length = 0;
  logger.info('[MOCK] SignalWire mock stores cleared');
}

module.exports = {
  MOCK_ENABLED,
  MOCK_PHONE_NUMBER,
  mockSendSms,
  mockGetSmsStatus,
  mockGenerateRetellTwiml,
  mockMakeCall,
  mockGetCallDetails,
  mockValidateWebhookSignature,
  generateMockIncomingCallPayload,
  generateMockSmsStatusPayload,
  getMockSmsMessages,
  getMockCalls,
  clearMockStores,
  generateMockSid
};
