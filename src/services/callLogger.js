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

/** PHI retention window in days — must match schedulerService / inboundSmsHandler */
const PHI_RETENTION_DAYS = parseInt(process.env.PHI_RETENTION_DAYS) || 7;

/**
 * Per-workflow fields that must be anonymized or scrubbed in Keragon payloads.
 * Keragon has no native retention API, so we enforce these rules at send time.
 *
 * W1 (call_log):   anonymize caller_id to last-4 digits; mark caller_name /
 *                  reason_for_visit with a retention_scrub_at timestamp
 * W2 (emergency):  no scrubbing — emergency records are permanently retained
 * W3 (sms):        freetext_reply payloads handled by inboundSmsHandler (sentinel body)
 * W4 (edge_cases): no scrubbing — phi_auto_deletion records are permanently retained
 */
const WORKFLOW_SCRUB_RULES = {
  W1: { anonymizeCallerId: true, stampScrubAt: true },
  W2: { anonymizeCallerId: false, stampScrubAt: false },
  W3: { anonymizeCallerId: false, stampScrubAt: true },
  W4: { anonymizeCallerId: false, stampScrubAt: false }
};

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
  'sms_failed', 'phi_auto_deletion', 'phi_retention_scrub', 'call_status_update', 'edge_case'
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

    // Determine workflow and apply per-workflow PHI retention rules
    const workflowKey = getWorkflowKey(data.event);
    const retentionSanitized = sanitizeKeragonPayload(sanitizedData, workflowKey);

    // Add metadata
    const payload = {
      ...retentionSanitized,
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
 * Determine which workflow a Keragon event belongs to
 * @param {string} event - Event name
 * @returns {'W1'|'W2'|'W3'|'W4'}
 */
function getWorkflowKey(event) {
  if (EMERGENCY_EVENTS.has(event)) return 'W2';
  if (SMS_EVENTS.has(event))       return 'W3';
  if (EDGE_EVENTS.has(event))      return 'W4';
  return 'W1';
}

/**
 * Apply per-workflow PHI retention rules to an outbound Keragon payload.
 *
 * Since Keragon has no retention API, we enforce field-level scrubbing at
 * send time and stamp every applicable payload with a `retention_scrub_at`
 * ISO timestamp. This makes each run in the Keragon Runs tab self-documenting:
 * Arthur can filter runs older than 7 days and manually purge them.
 *
 * Rules applied:
 *  - W1: caller_id anonymized to last-4 digits; retention_scrub_at stamped
 *  - W3: retention_scrub_at stamped (freetext body sentinel handled by inboundSmsHandler)
 *  - W2/W4: no scrubbing (permanent retention records)
 *
 * @param {Object} payload  - Outbound Keragon payload (already through sanitizeForLogging)
 * @param {string} workflowKey - 'W1'|'W2'|'W3'|'W4'
 * @returns {Object} Payload with retention fields applied
 */
function sanitizeKeragonPayload(payload, workflowKey) {
  const rules = WORKFLOW_SCRUB_RULES[workflowKey] || WORKFLOW_SCRUB_RULES.W1;
  const result = { ...payload };

  // Anonymize caller_id to last-4 digits for W1 (HIPAA de-identification)
  if (rules.anonymizeCallerId && result.caller_id) {
    const raw = String(result.caller_id);
    result.caller_id = raw.length > 4 ? `***${raw.slice(-4)}` : raw;
  }

  // Stamp retention_scrub_at so Arthur knows when to purge this run from Keragon
  if (rules.stampScrubAt) {
    const scrubAt = new Date(Date.now() + PHI_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    result.retention_scrub_at = scrubAt.toISOString();
    result.retention_days = PHI_RETENTION_DAYS;
  }

  return result;
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
    'pin',
    'transcript',
    'call_transcript',
    'summary'        // RetellAI call_analyzed summary may contain PHI narrative
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
  sanitizeForLogging,
  sanitizeKeragonPayload,
  getWorkflowKey
};
