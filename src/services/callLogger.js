/**
 * Call Logger Service
 * Logs call data to Keragon for automation and staff review
 *
 * Keragon replaces Make.com as the automation orchestration layer
 * All call data is sent to Keragon webhooks for:
 * - Structured logging
 * - Staff review workflows
 * - Google Calendar integration
 * - SMS automation triggers
 *
 * HIPAA-Conscious: Only logs approved fields, no detailed medical history
 */

const axios = require('axios');
const logger = require('../config/logger');

const KERAGON_API_KEY = process.env.KERAGON_API_KEY;
const USE_MOCKS = process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'test';

// Webhook URLs for each Keragon workflow (routing by event type)
// Workflow 1: call_ended, call_record, call_analyzed, call_started
const KERAGON_WEBHOOK_URL = process.env.KERAGON_WEBHOOK_URL;
// Workflow 2: emergency_detected
const KERAGON_EMERGENCY_WEBHOOK_URL = process.env.KERAGON_EMERGENCY_WEBHOOK_URL;
// Workflow 3: sms_sent, patient_rating, sms_opt_out, sms_opt_in, sms_freetext_reply
const KERAGON_SMS_WEBHOOK_URL = process.env.KERAGON_SMS_WEBHOOK_URL;
// Workflow 4: sms_failed, phi_auto_deletion, call_status_update, edge_case
const KERAGON_EDGE_WEBHOOK_URL = process.env.KERAGON_EDGE_WEBHOOK_URL;

// Event → webhook URL routing map
const SMS_EVENTS = new Set([
  'sms_sent', 'sms_status_update', 'patient_rating',
  'sms_opt_out', 'sms_opt_in', 'sms_freetext_reply'
]);
const EDGE_EVENTS = new Set([
  'sms_failed', 'phi_auto_deletion', 'call_status_update', 'edge_case'
]);
const EMERGENCY_EVENTS = new Set(['emergency_detected']);

/**
 * Select the correct Keragon webhook URL based on the event type
 * @param {string} event - Event name
 * @returns {string|null} Webhook URL
 */
function getWebhookUrlForEvent(event) {
  if (EMERGENCY_EVENTS.has(event)) return KERAGON_EMERGENCY_WEBHOOK_URL || KERAGON_WEBHOOK_URL;
  if (SMS_EVENTS.has(event)) return KERAGON_SMS_WEBHOOK_URL || KERAGON_WEBHOOK_URL;
  if (EDGE_EVENTS.has(event)) return KERAGON_EDGE_WEBHOOK_URL || KERAGON_WEBHOOK_URL;
  return KERAGON_WEBHOOK_URL; // call_ended, call_record, etc.
}

// Create axios instance for Keragon API calls
const keragonClient = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${KERAGON_API_KEY}`
  }
});

/**
 * Log data to Keragon webhook
 * @param {Object} data - Data to log
 * @returns {Promise<Object>} Keragon response
 */
async function logToKeragon(data) {
  // Use mock in test/development mode
  if (USE_MOCKS) {
    const keragonMock = require('../../mocks/keragon.mock');
    return keragonMock.mockLogToKeragon(data);
  }

  const webhookUrl = getWebhookUrlForEvent(data.event);

  if (!webhookUrl) {
    logger.warn('No Keragon webhook URL configured for event - skipping log', { event: data.event });
    return { success: false, reason: 'Keragon not configured' };
  }

  try {
    // Sanitize data before sending (no PHI beyond approved fields)
    const sanitizedData = sanitizeForLogging(data);

    // Add metadata
    const payload = {
      ...sanitizedData,
      source: 'receptionist-agent-v1',
      environment: process.env.NODE_ENV || 'development',
      logged_at: new Date().toISOString()
    };

    const response = await keragonClient.post(webhookUrl, payload);

    logger.info('Data logged to Keragon', {
      event: data.event,
      callId: data.callId || data.call_id,
      status: response.status
    });

    return {
      success: true,
      status: response.status,
      keragonId: response.data?.id
    };
  } catch (error) {
    logger.error('Failed to log to Keragon', {
      error: error.message,
      event: data.event,
      callId: data.callId || data.call_id
    });

    // Don't throw - logging failure shouldn't break call flow
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Log a complete call record to Keragon
 * Structured for staff review and audit
 * @param {Object} callRecord - Complete call record
 */
async function logCallRecord(callRecord) {
  const structuredRecord = {
    event: 'call_record',
    // Core identifiers
    call_id: callRecord.callId,
    timestamp: callRecord.timestamp,

    // Caller information (HIPAA-conscious - minimal PHI)
    caller_id: callRecord.callerId,
    caller_name: callRecord.callerName,
    patient_type: callRecord.patientType, // new/returning

    // Visit information (non-diagnostic)
    reason_for_visit: callRecord.reasonForVisit,
    intended_visit_timeframe: callRecord.visitTimeframe,

    // Call metrics
    call_duration_seconds: callRecord.duration,
    disposition: callRecord.disposition,

    // Flags
    emergency_trigger: callRecord.isEmergency || false,
    spam_flag: callRecord.isSpam || false,
    spam_reasons: callRecord.spamReasons || [],

    // SMS tracking
    sms_sent: callRecord.smsSent || false,
    sms_delivery_status: callRecord.smsStatus,

    // AI metadata
    ai_decision_path: callRecord.decisionPath || [],

    // Error tracking
    error_notes: callRecord.errorNotes,

    // Additional context
    end_reason: callRecord.endReason,
    clinic_id: process.env.CLINIC_ID || 'default'
  };

  return logToKeragon(structuredRecord);
}

/**
 * Log an edge case or error to Keragon
 * @param {string} type - Edge case type
 * @param {Object} details - Edge case details
 */
async function logEdgeCase(type, details) {
  const edgeCaseRecord = {
    event: 'edge_case',
    edge_case_type: type,
    call_id: details.callId,
    timestamp: new Date().toISOString(),
    description: details.description,
    context: details.context,
    requires_review: true
  };

  logger.warn('Edge case logged', { type, callId: details.callId });

  return logToKeragon(edgeCaseRecord);
}

/**
 * Log SMS delivery status update
 * @param {string} callId - Associated call ID
 * @param {Object} smsData - SMS status data
 */
async function logSmsStatus(callId, smsData) {
  return logToKeragon({
    event: 'sms_status_update',
    call_id: callId,
    message_sid: smsData.messageSid,
    status: smsData.status,
    error_code: smsData.errorCode,
    timestamp: new Date().toISOString()
  });
}

/**
 * Sanitize data for logging - remove any unexpected PHI
 * @param {Object} data - Raw data
 * @returns {Object} Sanitized data
 */
function sanitizeForLogging(data) {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };

  // Fields that should NEVER be logged (per HIPAA-conscious requirements)
  const prohibitedFields = [
    'ssn',
    'social_security',
    'date_of_birth',
    'dob',
    'birth_date',
    'medical_history',
    'diagnosis',
    'treatment',
    'medication',
    'medications',
    'prescription',
    'prescriptions',
    'insurance',
    'insurance_id',
    'policy_number',
    'credit_card',
    'card_number',
    'cvv',
    'password',
    'pin'
  ];

  for (const field of prohibitedFields) {
    if (sanitized[field] !== undefined) {
      delete sanitized[field];
      logger.warn('Removed prohibited field from log', { field });
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Query Keragon for call history (if API supports it)
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Call records
 */
async function queryCallHistory(filters = {}) {
  if (!KERAGON_API_KEY) {
    logger.warn('KERAGON_API_KEY not configured - cannot query history');
    return [];
  }

  try {
    // This endpoint would be configured in Keragon
    const response = await keragonClient.get(
      `${process.env.KERAGON_API_URL || 'https://api.keragon.com'}/records`,
      { params: filters }
    );
    return response.data;
  } catch (error) {
    logger.error('Failed to query Keragon', { error: error.message });
    return [];
  }
}

module.exports = {
  logToKeragon,
  logCallRecord,
  logEdgeCase,
  logSmsStatus,
  queryCallHistory,
  sanitizeForLogging
};
