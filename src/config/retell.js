/**
 * RetellAI Client Configuration
 * Voice agent platform configuration for the Receptionist Agent
 *
 * RetellAI handles:
 * - Voice synthesis and recognition
 * - Multi-call concurrency
 * - WebSocket audio streaming
 *
 * LLM Layer: Hathr.ai (configured in RetellAI dashboard)
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('./logger');

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;
const RETELL_WEBHOOK_SECRET = process.env.RETELL_WEBHOOK_SECRET;
const RETELL_BASE_URL = 'https://api.retellai.com';

// Create axios instance for RetellAI API calls
const retellClient = axios.create({
  baseURL: RETELL_BASE_URL,
  headers: {
    'Authorization': `Bearer ${RETELL_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

/**
 * Validate RetellAI webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - X-Retell-Signature header
 * @returns {boolean} Whether signature is valid
 */
function validateWebhookSignature(payload, signature) {
  if (!RETELL_WEBHOOK_SECRET) {
    logger.warn('RETELL_WEBHOOK_SECRET not configured - skipping signature validation');
    return true; // Skip validation if secret not configured (dev mode)
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', RETELL_WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Error validating RetellAI webhook signature', { error: error.message });
    return false;
  }
}

/**
 * Get agent configuration from RetellAI
 * @returns {Promise<Object>} Agent configuration
 */
async function getAgentConfig() {
  if (!RETELL_API_KEY || !RETELL_AGENT_ID) {
    throw new Error('RetellAI credentials not configured');
  }

  try {
    const response = await retellClient.get(`/agents/${RETELL_AGENT_ID}`);
    logger.info('Fetched RetellAI agent config', { agentId: RETELL_AGENT_ID });
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch RetellAI agent config', {
      error: error.message,
      agentId: RETELL_AGENT_ID
    });
    throw error;
  }
}

/**
 * Get call transcript from RetellAI
 * @param {string} callId - RetellAI call ID
 * @returns {Promise<Object>} Call transcript and metadata
 */
async function getCallTranscript(callId) {
  if (!RETELL_API_KEY) {
    throw new Error('RetellAI API key not configured');
  }

  try {
    const response = await retellClient.get(`/calls/${callId}`);
    logger.info('Fetched call transcript', { callId });
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch call transcript', {
      error: error.message,
      callId
    });
    throw error;
  }
}

/**
 * List recent calls from RetellAI
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of calls
 */
async function listCalls(options = {}) {
  if (!RETELL_API_KEY) {
    throw new Error('RetellAI API key not configured');
  }

  try {
    const response = await retellClient.get('/calls', { params: options });
    return response.data;
  } catch (error) {
    logger.error('Failed to list calls', { error: error.message });
    throw error;
  }
}

/**
 * Parse call event from RetellAI webhook
 * @param {Object} event - Webhook event payload
 * @returns {Object} Parsed call data
 */
function parseCallEvent(event) {
  return {
    callId: event.call_id,
    agentId: event.agent_id,
    eventType: event.event_type,
    timestamp: event.timestamp || new Date().toISOString(),
    callStatus: event.call_status,
    endReason: event.end_reason,
    duration: event.duration_seconds,
    transcript: event.transcript,
    metadata: event.metadata || {},
    // Extract structured data from the conversation
    extractedData: event.extracted_data || {}
  };
}

/**
 * Determine if a call contains emergency indicators
 * Based on scope requirements for emergency detection
 * @param {Object} callData - Parsed call data
 * @returns {Object} Emergency detection result
 */
function detectEmergency(callData) {
  const emergencyKeywords = [
    'chest pain', 'chest pressure',
    'can\'t breathe', 'difficulty breathing', 'shortness of breath',
    'stroke', 'facial drooping', 'slurred speech', 'arm weakness',
    'bleeding', 'severe bleeding', 'uncontrolled bleeding',
    'unconscious', 'passed out', 'fainted', 'loss of consciousness',
    'seizure', 'convulsion',
    'head injury', 'hit my head',
    'allergic reaction', 'throat swelling', 'anaphylaxis',
    'blue lips', 'not breathing',
    'car accident', 'vehicle accident', 'crash',
    'burn', 'burned', 'on fire',
    'overdose', 'poisoning', 'swallowed',
    'suicide', 'kill myself', 'self-harm', 'hurt myself', 'end my life'
  ];

  const transcript = (callData.transcript || '').toLowerCase();
  const reasonForVisit = (callData.extractedData?.reasonForVisit || '').toLowerCase();
  const combinedText = `${transcript} ${reasonForVisit}`;

  const detectedKeywords = emergencyKeywords.filter(keyword =>
    combinedText.includes(keyword)
  );

  // Check specifically for mental health crisis
  const mentalHealthCrisis = [
    'suicide', 'kill myself', 'self-harm', 'hurt myself', 'end my life',
    'thinking about hurting', 'want to hurt', 'thinking of hurting',
    'thinking about hurting myself', 'want to hurt myself', 'thinking of hurting myself'
  ].some(keyword => combinedText.includes(keyword));

  const isEmergency = detectedKeywords.length > 0 || mentalHealthCrisis;

  return {
    isEmergency,
    isMentalHealthCrisis: mentalHealthCrisis,
    detectedKeywords,
    recommendation: isEmergency
      ? 'IMMEDIATE: Direct caller to 911 or 988 (mental health)'
      : null
  };
}

module.exports = {
  retellClient,
  validateWebhookSignature,
  getAgentConfig,
  getCallTranscript,
  listCalls,
  parseCallEvent,
  detectEmergency,
  RETELL_AGENT_ID
};
