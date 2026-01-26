/**
 * Twilio Client Configuration
 * Handles voice calls and SMS for the Receptionist Agent
 */

const twilio = require('twilio');
const logger = require('./logger');

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let client = null;

// Only initialize if credentials are provided
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
  logger.info('Twilio client initialized');
} else {
  logger.warn('Twilio credentials not configured - SMS and voice features disabled');
}

/**
 * Generate TwiML to connect incoming call to RetellAI
 * @param {Object} callData - Incoming call data from Twilio
 * @returns {string} TwiML response
 */
function generateRetellTwiml(callData) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const retellAgentId = process.env.RETELL_AGENT_ID;

  if (!retellAgentId) {
    logger.error('RETELL_AGENT_ID not configured');
    response.say('We are experiencing technical difficulties. Please call back later.');
    return response.toString();
  }

  // Connect to RetellAI via WebSocket
  // RetellAI will handle the conversation using Hathr.ai as the LLM
  const connect = response.connect();
  connect.stream({
    url: `wss://api.retellai.com/audio-websocket/${retellAgentId}`,
    statusCallback: `${process.env.BASE_URL || 'https://your-domain.com'}/webhook/retell/status`,
    statusCallbackMethod: 'POST'
  });

  logger.info('Generated RetellAI connection TwiML', {
    callSid: callData.CallSid,
    from: callData.From,
    agentId: retellAgentId
  });

  return response.toString();
}

/**
 * Send SMS message
 * @param {string} to - Recipient phone number
 * @param {string} body - Message body
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Twilio message response
 */
async function sendSms(to, body, options = {}) {
  if (!client) {
    throw new Error('Twilio client not initialized');
  }

  if (!process.env.SMS_ENABLED || process.env.SMS_ENABLED !== 'true') {
    logger.info('SMS disabled, skipping send', { to });
    return { status: 'skipped', reason: 'SMS disabled' };
  }

  try {
    const message = await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to,
      statusCallback: `${process.env.BASE_URL || 'https://your-domain.com'}/webhook/twilio/sms-status`,
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
 * Validate Twilio webhook signature
 * @param {string} signature - X-Twilio-Signature header
 * @param {string} url - Full webhook URL
 * @param {Object} params - Request body params
 * @returns {boolean} Whether signature is valid
 */
function validateWebhookSignature(signature, url, params) {
  if (!authToken) {
    logger.warn('Cannot validate Twilio signature - auth token not configured');
    return false;
  }

  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Get call details from Twilio
 * @param {string} callSid - Twilio Call SID
 * @returns {Promise<Object>} Call details
 */
async function getCallDetails(callSid) {
  if (!client) {
    throw new Error('Twilio client not initialized');
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
