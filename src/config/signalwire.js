/**
 * DEPRECATED — SignalWire has been replaced by RetellAI for telephony.
 * This file is no longer imported anywhere.
 * SMS is now handled by src/config/smsProvider.js (provider TBD — Twilio/Vonage).
 * Kept for historical reference; safe to delete once SMS provider is confirmed.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * SignalWire Client Configuration (ARCHIVED)
 * Handles voice calls and SMS for the Receptionist Agent
 *
 * SignalWire is the specified telephony provider per scope §4.
 * Uses @signalwire/compatibility-api which mirrors the Twilio Node SDK interface.
 *
 * Required environment variables:
 *   SIGNALWIRE_PROJECT_ID  — SignalWire Project ID (equivalent of Twilio Account SID)
 *   SIGNALWIRE_API_TOKEN   — SignalWire API Token (equivalent of Twilio Auth Token)
 *   SIGNALWIRE_SPACE_URL   — Your SignalWire space URL (e.g. yourspace.signalwire.com)
 *   SIGNALWIRE_PHONE_NUMBER — Provisioned SignalWire phone number in E.164 format
 */

// The @signalwire/compatibility-api package has two entry points with complementary exports:
//   - dist bundle (main): exports a working RestClient but does NOT expose .twiml namespace
//   - lib/index.js:        exports .twiml.VoiceResponse and validateRequest, but its RestClient is
//                          the obsolete Twilio-origin stub that throws on construction.
// We therefore split the imports: RestClient from dist, twiml/validateRequest from lib.
const { RestClient } = require('@signalwire/compatibility-api');
// Relative path required because the package `exports` map has no subpath export for index.js.
const _swLib = require('../../node_modules/@signalwire/compatibility-api/index.js');
const logger = require('./logger');

// SignalWire credentials
const projectId = process.env.SIGNALWIRE_PROJECT_ID;
const apiToken = process.env.SIGNALWIRE_API_TOKEN;
const spaceUrl = process.env.SIGNALWIRE_SPACE_URL;
const signalwirePhoneNumber = process.env.SIGNALWIRE_PHONE_NUMBER;

let client = null;

// Only initialize if credentials are provided
if (projectId && apiToken && spaceUrl) {
  client = new RestClient(projectId, apiToken, { signalwireSpaceUrl: spaceUrl });
  logger.info('SignalWire client initialized');
} else {
  logger.warn('SignalWire credentials not configured - SMS and voice features disabled');
}

/**
 * Generate SignalWire LaML (compatible with TwiML) to connect incoming call to RetellAI
 * @param {Object} callData - Incoming call data from SignalWire
 * @returns {string} LaML/TwiML response string
 */
function generateRetellTwiml(callData) {
  const VoiceResponse = _swLib.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const retellAgentId = process.env.RETELL_AGENT_ID;

  if (!retellAgentId) {
    logger.error('RETELL_AGENT_ID not configured');
    response.say('We are experiencing technical difficulties. Please call back later.');
    return response.toString();
  }

  // Connect to RetellAI via WebSocket
  // RetellAI handles the conversation using Hathr.ai as the LLM
  const connect = response.connect();
  connect.stream({
    url: `wss://api.retellai.com/audio-websocket/${retellAgentId}`,
    statusCallback: `${process.env.BASE_URL || 'https://your-domain.com'}/webhook/retell/status`,
    statusCallbackMethod: 'POST'
  });

  logger.info('Generated RetellAI connection LaML', {
    callSid: callData.CallSid,
    from: callData.From,
    agentId: retellAgentId
  });

  return response.toString();
}

/**
 * Send SMS message via SignalWire
 * @param {string} to - Recipient phone number (E.164)
 * @param {string} body - Message body
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} SignalWire message response
 */
async function sendSms(to, body, options = {}) {
  if (!client) {
    throw new Error('SignalWire client not initialized');
  }

  if (!process.env.SMS_ENABLED || process.env.SMS_ENABLED !== 'true') {
    logger.info('SMS disabled, skipping send', { to });
    return { status: 'skipped', reason: 'SMS disabled' };
  }

  try {
    const message = await client.messages.create({
      body,
      from: signalwirePhoneNumber,
      to,
      statusCallback: `${process.env.BASE_URL || 'https://your-domain.com'}/webhook/signalwire/sms-status`,
      ...options
    });

    logger.info('SMS sent successfully', {
      messageSid: message.sid,
      to,
      status: message.status
    });

    return {
      success: true,
      messageSid: message.sid,
      status: message.status
    };
  } catch (error) {
    logger.error('Failed to send SMS', {
      error: error.message,
      to,
      code: error.code
    });
    throw error;
  }
}

/**
 * Validate SignalWire webhook signature
 * Uses the same HMAC validation interface as the compatibility API
 * @param {string} signature - X-SignalWire-Signature header value
 * @param {string} url - Full webhook URL
 * @param {Object} params - Request body params
 * @returns {boolean} Whether signature is valid
 */
function validateWebhookSignature(signature, url, params) {
  if (!apiToken) {
    logger.warn('Cannot validate SignalWire signature - API token not configured');
    return false;
  }

  return _swLib.validateRequest(apiToken, signature, url, params);
}

/**
 * Get call details from SignalWire
 * @param {string} callSid - SignalWire Call SID
 * @returns {Promise<Object>} Call details
 */
async function getCallDetails(callSid) {
  if (!client) {
    throw new Error('SignalWire client not initialized');
  }

  try {
    const call = await client.calls(callSid).fetch();
    return {
      sid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime
    };
  } catch (error) {
    logger.error('Failed to fetch call details', {
      error: error.message,
      callSid
    });
    throw error;
  }
}

module.exports = {
  client,
  generateRetellTwiml,
  sendSms,
  validateWebhookSignature,
  getCallDetails
};
