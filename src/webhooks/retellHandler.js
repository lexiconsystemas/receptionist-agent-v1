/**
 * RetellAI Webhook Handler
 * Processes call events from RetellAI voice agent
 *
 * Event Types:
 * - call_started: Call initiated
 * - call_ended: Call completed or terminated
 * - call_analyzed: Post-call analysis complete
 * - transcript_update: Real-time transcript update
 */

const logger = require('../config/logger');
const retellConfig = require('../config/retell');
const callLogger = require('../services/callLogger');
const smsService = require('../services/smsService');
const spamDetection = require('../utils/spamDetection');
const validation = require('../utils/validation');
const googleCalendarService = require('../services/googleCalendarService');
const schedulerService = require('../services/schedulerService');

/**
 * Main webhook handler for RetellAI events
 */
async function handleWebhook(req, res) {
  const startTime = Date.now();

  try {
    // Validate webhook signature
    const signature = req.headers['x-retell-signature'];
    const rawBody = JSON.stringify(req.body);

    if (process.env.NODE_ENV === 'production') {
      if (!retellConfig.validateWebhookSignature(rawBody, signature)) {
        logger.warn('Invalid RetellAI webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body;
    const eventType = event.event_type || event.type;

    logger.info('RetellAI webhook received', {
      eventType,
      callId: event.call_id
    });

    // Route to appropriate handler
    switch (eventType) {
      case 'call_started':
        await handleCallStarted(event);
        break;

      case 'call_ended':
        await handleCallEnded(event);
        break;

      case 'call_analyzed':
        await handleCallAnalyzed(event);
        break;

      case 'transcript_update':
        await handleTranscriptUpdate(event);
        break;

      default:
        logger.info('Unhandled RetellAI event type', { eventType });
    }

    const processingTime = Date.now() - startTime;
    logger.info('Webhook processed', { eventType, processingTime });

    res.json({ success: true, processingTime });
  } catch (error) {
    logger.error('Error processing RetellAI webhook', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle call started event
 */
async function handleCallStarted(event) {
  const callData = retellConfig.parseCallEvent(event);

  logger.logCall('STARTED', {
    callId: callData.callId,
    timestamp: callData.timestamp
  });

  // Log call start to Keragon
  await callLogger.logToKeragon({
    event: 'call_started',
    callId: callData.callId,
    timestamp: callData.timestamp,
    agentId: callData.agentId
  });
}

/**
 * Handle call ended event
 */
async function handleCallEnded(event) {
  const callData = retellConfig.parseCallEvent(event);

  // Check for emergency indicators
  const emergencyCheck = retellConfig.detectEmergency(callData);

  // Check for spam
  const spamCheck = spamDetection.analyzeCall(callData);

  // Determine disposition
  let disposition = 'completed';
  if (emergencyCheck.isEmergency) {
    disposition = 'emergency';
  } else if (spamCheck.isSpam) {
    disposition = 'spam';
  } else if (callData.endReason === 'caller_hangup' && callData.duration < 30) {
    disposition = 'dropped';
  } else if (callData.extractedData && callData.extractedData.callbackRequested) {
    disposition = 'callback_requested';
  } else if (callData.extractedData && callData.extractedData.appointmentIntent === 'cancel') {
    disposition = 'appointment_cancel';
  } else if (callData.extractedData && callData.extractedData.appointmentIntent === 'change') {
    disposition = 'appointment_change';
  }

  // Extract and validate caller information
  const callerInfo = validation.validateCallerInfo(callData.extractedData);

  // Prepare structured call log for Keragon
  const callLog = {
    call_id: callData.callId,
    timestamp: callData.timestamp,
    caller_id: callerInfo.phoneNumber || event.caller_number,
    call_duration_seconds: callData.duration,
    caller_name: callerInfo.callerName,
    patient_type: callerInfo.patientType,
    reason_for_visit: callerInfo.reasonForVisit,
    intended_visit_timeframe: callerInfo.visitTimeframe,
    existing_appointment_id: callerInfo.existingAppointmentId || null,
    appointment_type: callerInfo.appointmentType || null,
    callback_requested: callerInfo.callbackRequested || false,
    sms_consent_explicit: callerInfo.smsConsent,
    disposition,
    emergency_trigger: emergencyCheck.isEmergency,
    spam_flag: spamCheck.isSpam,
    spam_reasons: spamCheck.reasons,
    sms_sent: false,
    sms_delivery_status: null,
    ai_decision_path: callData.metadata.decisionPath || [],
    error_notes: null,
    end_reason: callData.endReason
  };

  logger.logCall('ENDED', {
    callId: callData.callId,
    disposition,
    duration: callData.duration,
    isEmergency: emergencyCheck.isEmergency,
    isSpam: spamCheck.isSpam
  });

  // Log to Keragon
  await callLogger.logToKeragon({
    event: 'call_ended',
    ...callLog
  });

  // ── Google Calendar: create event for new soft-scheduled appointments ──────
  // Staff-reference only — creates a 1-hour block so clinic staff can see
  // overnight walk-in intent. Failure is non-fatal; call flow continues.
  if (
    !callLog.spam_flag &&
    !callLog.emergency_trigger &&
    callLog.disposition === 'completed' &&
    callLog.intended_visit_timeframe &&
    googleCalendarService.isConfigured()
  ) {
    try {
      const gcalResult = await googleCalendarService.createAppointmentEvent(callLog);
      if (gcalResult.success) {
        callLog.gcal_event_id = gcalResult.eventId;
        logger.info('Google Calendar event created', {
          callId: callData.callId,
          eventId: gcalResult.eventId
        });
      } else {
        logger.warn('Google Calendar event not created', {
          callId: callData.callId,
          reason: gcalResult.error
        });
      }
    } catch (err) {
      logger.error('Google Calendar create threw unexpectedly', {
        callId: callData.callId,
        error: err.message
      });
    }
  }

  // ── Appointment change / cancel flow ──────────────────────────────────────
  // 1. Cancel Redis reminder so no stale SMS fires
  // 2. Log edge case to Keragon (routes to W4 edge_cases workflow)
  // 3. SMS alert to staff — they manually handle calendar update
  if (
    callLog.disposition === 'appointment_cancel' ||
    callLog.disposition === 'appointment_change'
  ) {
    // 1. Cancel Redis/cache reminder
    if (callLog.existing_appointment_id) {
      try {
        await schedulerService.cancelScheduledAppointment(callLog.existing_appointment_id);
      } catch (err) {
        logger.warn('Failed to cancel scheduled appointment reminder', {
          callId: callLog.call_id,
          appointmentId: callLog.existing_appointment_id,
          error: err.message
        });
      }
    }

    // 2. Log edge case to Keragon (W4)
    try {
      await callLogger.logEdgeCase(callLog.disposition, {
        callId: callLog.call_id,
        description: `Patient requested ${callLog.disposition.replace('_', ' ')}`,
        context: {
          callerName: callLog.caller_name,
          callerId: callLog.caller_id,
          existingAppointmentId: callLog.existing_appointment_id,
          requestedTimeframe: callLog.intended_visit_timeframe
        }
      });
    } catch (err) {
      logger.warn('Failed to log appointment change/cancel edge case', {
        callId: callLog.call_id,
        error: err.message
      });
    }

    // 3. SMS staff alert (requires STAFF_ALERT_PHONE env var)
    if (process.env.STAFF_ALERT_PHONE && callLog.caller_id) {
      try {
        const verb = callLog.disposition === 'appointment_cancel' ? 'CANCEL' : 'CHANGE';
        await smsService.sendRaw(
          process.env.STAFF_ALERT_PHONE,
          `[Receptionist Alert] Appointment ${verb} requested.\nPatient: ${callLog.caller_name || 'Unknown'} (${callLog.caller_id})\nCall ID: ${callLog.call_id}`
        );
        logger.info('Staff appointment alert SMS sent', {
          callId: callLog.call_id,
          disposition: callLog.disposition
        });
      } catch (err) {
        logger.warn('Staff alert SMS failed', {
          callId: callLog.call_id,
          error: err.message
        });
      }
    }
  }

  // Send callback confirmation SMS if caller requested a callback
  if (callLog.callback_requested && callLog.caller_id) {
    try {
      await smsService.sendCallbackConfirmation(callLog.caller_id, {
        callerName: callerInfo.callerName
      });
    } catch (error) {
      logger.warn('Failed to send callback confirmation SMS', {
        callId: callData.callId,
        error: error.message
      });
    }
  }

  // Send standard SMS follow-up if appropriate
  if (shouldSendSms(callLog)) {
    try {
      const smsResult = await smsService.sendFollowUp(callLog);
      callLog.sms_sent = smsResult.success;
      callLog.sms_delivery_status = smsResult.status;

      // Update Keragon with SMS status
      await callLogger.logToKeragon({
        event: 'sms_sent',
        callId: callData.callId,
        smsResult
      });
    } catch (error) {
      logger.error('Failed to send follow-up SMS', {
        callId: callData.callId,
        error: error.message
      });
      callLog.error_notes = `SMS failed: ${error.message}`;
    }
  }
}

/**
 * Handle call analyzed event (post-call analysis)
 */
async function handleCallAnalyzed(event) {
  const callData = retellConfig.parseCallEvent(event);

  logger.info('Call analysis received', {
    callId: callData.callId,
    hasTranscript: !!callData.transcript
  });

  // Log analysis to Keragon for staff review
  await callLogger.logToKeragon({
    event: 'call_analyzed',
    callId: callData.callId,
    analysis: event.analysis || {},
    sentiment: event.sentiment,
    summary: event.summary
  });
}

/**
 * Handle real-time transcript updates
 * Used for emergency detection during call
 */
async function handleTranscriptUpdate(event) {
  const callData = retellConfig.parseCallEvent(event);

  // Real-time emergency detection
  const emergencyCheck = retellConfig.detectEmergency(callData);

  if (emergencyCheck.isEmergency) {
    logger.warn('EMERGENCY DETECTED during call', {
      callId: callData.callId,
      keywords: emergencyCheck.detectedKeywords,
      isMentalHealth: emergencyCheck.isMentalHealthCrisis
    });

    // Log emergency trigger to Keragon immediately
    await callLogger.logToKeragon({
      event: 'emergency_detected',
      callId: callData.callId,
      timestamp: new Date().toISOString(),
      detectedKeywords: emergencyCheck.detectedKeywords,
      isMentalHealthCrisis: emergencyCheck.isMentalHealthCrisis,
      recommendation: emergencyCheck.recommendation
    });
  }
}

/**
 * Handle call status updates
 */
async function handleCallStatus(req, res) {
  try {
    const status = req.body;

    logger.info('Call status update', {
      callId: status.call_id,
      status: status.status
    });

    await callLogger.logToKeragon({
      event: 'call_status_update',
      callId: status.call_id,
      status: status.status,
      timestamp: new Date().toISOString()
    });

    res.json({ received: true });
  } catch (error) {
    logger.error('Error handling call status', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Determine if SMS follow-up should be sent
 * Based on scope: only with implied (or explicit) consent, not for spam/emergencies
 */
function shouldSendSms(callLog) {
  // Don't send SMS if feature is disabled
  if (process.env.SMS_ENABLED !== 'true') {
    return false;
  }

  // Don't send to spam calls
  if (callLog.spam_flag) {
    return false;
  }

  // Don't send for emergencies (they should be at 911/ER)
  if (callLog.emergency_trigger) {
    return false;
  }

  // Don't send for dropped calls (no implied consent)
  if (callLog.disposition === 'dropped') {
    return false;
  }

  // Callback/change/cancel calls get dedicated SMS flows — skip generic follow-up
  const dedicatedSmsDispositions = ['callback_requested', 'appointment_change', 'appointment_cancel'];
  if (dedicatedSmsDispositions.includes(callLog.disposition)) {
    return false;
  }

  // If caller explicitly declined SMS, honour that
  if (callLog.sms_consent_explicit === false) {
    return false;
  }

  // Only send if we have a phone number
  if (!callLog.caller_id) {
    return false;
  }

  // Only send if call was meaningful (>30 seconds) — implied consent threshold
  if (callLog.call_duration_seconds < 30) {
    return false;
  }

  return true;
}

module.exports = {
  handleWebhook,
  handleCallStatus,
  handleCallStarted,
  handleCallEnded,
  handleCallAnalyzed,
  handleTranscriptUpdate
};
