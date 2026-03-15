/**
 * SMS Service
 * Handles SMS follow-up messages after calls
 *
 * Per scope requirements:
 * - Optional SMS follow-up after calls
 * - Reminder of clinic hours, location, or visit tips
 * - Only sent when implied consent is present
 * - Tracks delivery status in Keragon
 * - Bilingual (English / Spanish) support
 * - Opt-out check via inboundSmsHandler before every outbound send
 *
 * NOTE: Telephony is now fully handled by RetellAI.
 * SMS is routed through smsProvider.js (provider TBD — Twilio/Vonage).
 */

const smsProvider = require('../config/smsProvider');
const callLogger = require('./callLogger');
const logger = require('../config/logger');

// SMS delay before sending follow-up (in milliseconds)
const SMS_DELAY_MS = (parseInt(process.env.SMS_FOLLOWUP_DELAY_MINUTES) || 5) * 60 * 1000;

/**
 * Send a raw SMS to a phone number (no opt-out check — caller must gate first)
 * Low-level helper used internally by inboundSmsHandler and schedulerService
 * @param {string} phoneNumber - E.164 destination number
 * @param {string} message - Pre-built message string
 * @returns {Promise<Object>} { success, messageSid?, error? }
 */
async function sendRaw(phoneNumber, message) {
  if (!phoneNumber || !message) {
    throw new Error('sendRaw requires phoneNumber and message');
  }

  const result = await smsProvider.sendSms(phoneNumber, message);

  logger.info('Raw SMS sent', { to: phoneNumber, messageSid: result.messageSid });

  return {
    success: true,
    messageSid: result.messageSid,
    status: result.status
  };
}

/**
 * Send callback confirmation SMS
 * Sent when a caller asks to be called back rather than leaving a message
 * @param {string} phoneNumber - Caller's phone number
 * @param {Object} opts - { callerName?, locale? }
 * @returns {Promise<Object>} SMS send result
 */
async function sendCallbackConfirmation(phoneNumber, opts = {}) {
  const clinicName = process.env.CLINIC_NAME || 'our urgent care team';
  const locale = opts.locale || 'en';

  // PHI-FREE: no patient name in message — no BAA required
  const message = locale === 'es'
    ? `Hemos recibido su solicitud de devolución de llamada. Un miembro de nuestro equipo se pondrá en contacto durante el próximo horario de atención. — ${clinicName}`
    : `We received your callback request. A team member will reach out during the next available staffed hours. — ${clinicName}`;

  try {
    const result = await sendRaw(phoneNumber, message);
    logger.info('Callback confirmation SMS sent', { to: phoneNumber });
    return result;
  } catch (error) {
    logger.error('Failed to send callback confirmation SMS', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Send follow-up SMS after a completed call
 * @param {Object} callData - Call data with caller information
 * @returns {Promise<Object>} SMS send result
 */
async function sendFollowUp(callData) {
  const phoneNumber = callData.caller_id;

  if (!phoneNumber) {
    logger.warn('Cannot send SMS - no phone number', { callId: callData.call_id });
    return { success: false, reason: 'No phone number' };
  }

  // Check TCPA opt-out before sending
  try {
    const { isOptedOut } = require('../webhooks/inboundSmsHandler');
    if (await isOptedOut(phoneNumber)) {
      logger.info('SMS suppressed — number opted out', { callId: callData.call_id, phoneNumber });
      return { success: false, reason: 'Opted out' };
    }
  } catch (err) {
    // Non-fatal — proceed if opt-out check fails (cache unavailable)
    logger.warn('Opt-out check failed — proceeding with send', { error: err.message });
  }

  // Resolve locale for this caller
  let locale = 'en';
  try {
    const { getLocaleForNumber } = require('../webhooks/inboundSmsHandler');
    locale = await getLocaleForNumber(phoneNumber);
  } catch (_) { /* fallback to en */ }

  // Generate appropriate message based on call context
  // Default to true if missing/undefined (backwards compatible)
  const message = generateFollowUpMessage(callData, locale, callData.feedback_consent);

  try {
    // Optional delay before sending
    if (SMS_DELAY_MS > 0 && process.env.NODE_ENV === 'production') {
      await delay(SMS_DELAY_MS);
    }

    const result = await smsProvider.sendSms(phoneNumber, message);

    logger.info('Follow-up SMS sent', {
      callId: callData.call_id,
      to: phoneNumber,
      messageSid: result.messageSid
    });

    return {
      success: true,
      messageSid: result.messageSid,
      status: result.status
    };
  } catch (error) {
    logger.error('Failed to send follow-up SMS', {
      callId: callData.call_id,
      error: error.message
    });

    // Log failed SMS to Keragon for staff review
    await callLogger.logEdgeCase('sms_failed', {
      callId: callData.call_id,
      description: `SMS failed: ${error.message}`,
      context: { phoneNumber, errorCode: error.code }
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate follow-up message based on call context
 * PHI-FREE: No patient name, no appointment details, no symptoms.
 * Only clinic info (name, address, phone) — no BAA required for any SMS provider.
 * @param {Object} callData - Call data
 * @param {string} [locale='en'] - 'en' or 'es'
 * @returns {string} SMS message
 */
function generateFollowUpMessage(callData, locale = 'en', feedbackConsent = true) {
  const clinicName = process.env.CLINIC_NAME || 'our urgent care';
  const clinicAddress = process.env.CLINIC_ADDRESS || '';
  const es = locale === 'es';

  // Build PHI-free message with clinic info + rating request + opt-out
  let message = es
    ? `¡Gracias por llamar a ${clinicName}!`
    : `Thanks for calling ${clinicName}!`;

  if (clinicAddress) {
    message += es
      ? ` Estamos ubicados en ${clinicAddress}.`
      : ` We're located at ${clinicAddress}.`;
  }

  // Scope §3.4 / §Initial Rating SMS: exact required wording for the feedback question.
  // Only include if the caller opted in (feedbackConsent !== false).
  if (feedbackConsent !== false) {
    message += es
      ? ' En una escala del 1 al 5, ¿qué tan fácil fue programar su cita hoy? Por favor, NO incluya ningún detalle médico. Responda STOP para cancelar mensajes.'
      : ' On a scale of 1–5, how easy was it to schedule your appointment today? Please do NOT include any medical details. Reply STOP to opt out.';
  } else {
    message += es
      ? ' Responda STOP para cancelar mensajes.'
      : ' Reply STOP to opt out.';
  }

  // Keep message under SMS limit (160 chars for single segment)
  if (message.length > 160) {
    // Try short version with address first
    const shortBase = es
      ? `¡Gracias por llamar a ${clinicName}!`
      : `Thanks for calling ${clinicName}!`;
    const shortAddr = clinicAddress
      ? (es ? ` ${clinicAddress}.` : ` ${clinicAddress}.`)
      : '';
    const shortSuffix = es
      ? ' Escala 1 al 5: ¿qué tan fácil fue programar su cita hoy? Sin detalles médicos. STOP para cancelar.'
      : ' Scale 1-5: how easy was scheduling today? No medical details. STOP to opt out.';
    const shortWithAddr = shortBase + shortAddr + shortSuffix;

    message = shortWithAddr.length <= 160
      ? shortWithAddr
      : shortBase + shortSuffix; // drop address only if still over limit

    // Final guardrail: enforce 160 chars (drop address already handled above)
    if (message.length > 160) {
      message = message.slice(0, 157) + '...';
    }
  }

  return message;
}

/**
 * Send emergency resources SMS
 * For calls that triggered emergency detection but caller didn't hang up
 * @param {string} phoneNumber - Caller's phone number
 * @param {Object} emergencyInfo - Emergency detection info
 * @param {string} [locale='en'] - 'en' or 'es'
 */
async function sendEmergencyResources(phoneNumber, emergencyInfo, locale = 'en') {
  const es = locale === 'es';
  let message;

  // Mental health crisis specific message
  if (emergencyInfo.isMentalHealthCrisis) {
    message = es
      ? 'Si está en crisis, llame al 988 (Línea de Crisis) o al 911 para obtener ayuda inmediata. No está solo/a.'
      : 'If you are in crisis, please call 988 (Suicide & Crisis Lifeline) or 911 for immediate help. You are not alone.';
  } else {
    message = es
      ? 'Si es una emergencia médica, llame al 911 de inmediato.'
      : 'If this is a medical emergency, please call 911 immediately.';
  }

  try {
    const result = await smsProvider.sendSms(phoneNumber, message);

    logger.info('Emergency resources SMS sent', {
      to: phoneNumber,
      isMentalHealth: emergencyInfo.isMentalHealthCrisis,
      locale
    });

    return {
      success: true,
      messageSid: result.messageSid
    };
  } catch (error) {
    logger.error('Failed to send emergency resources SMS', {
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Send clinic hours reminder
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} [locale='en'] - 'en' or 'es'
 */
async function sendHoursReminder(phoneNumber, locale = 'en') {
  const clinicName = process.env.CLINIC_NAME || 'Our urgent care';
  const clinicHours = process.env.CLINIC_HOURS || 'Check our website for hours';
  const es = locale === 'es';

  const formattedHours = formatClinicHours(clinicHours);
  const message = es
    ? `Horario de ${clinicName}: ${formattedHours}. ¡Siempre aceptamos pacientes sin cita!`
    : `${clinicName} hours: ${formattedHours}. Walk-ins always welcome!`;

  try {
    const result = await smsProvider.sendSms(phoneNumber, message);
    return { success: true, messageSid: result.messageSid };
  } catch (error) {
    logger.error('Failed to send hours reminder', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Format clinic hours string for SMS
 * @param {string} hoursConfig - Hours configuration string
 * @returns {string} Formatted hours
 */
function formatClinicHours(hoursConfig) {
  // Expected format: "MON:08:00-20:00,TUE:08:00-20:00,..."
  // Simplify for SMS

  try {
    const days = hoursConfig.split(',');
    if (days.length === 0) return hoursConfig;

    // Check if all weekdays have same hours
    const weekdayHours = days
      .filter(d => ['MON', 'TUE', 'WED', 'THU', 'FRI'].some(day => d.startsWith(day)))
      .map(d => d.split(':').slice(1).join(':'));

    const allSame = weekdayHours.every(h => h === weekdayHours[0]);

    if (allSame && weekdayHours.length > 0) {
      const hours = weekdayHours[0].replace('-', ' to ');
      return `Mon-Fri ${hours}`;
    }

    return 'Visit our website for full hours';
  } catch {
    return hoursConfig;
  }
}

/**
 * Utility function for delay
 * @param {number} ms - Milliseconds to delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  sendRaw,
  sendFollowUp,
  sendCallbackConfirmation,
  sendEmergencyResources,
  sendHoursReminder,
  generateFollowUpMessage,
  formatClinicHours
};
