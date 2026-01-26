/**
 * SMS Service
 * Handles SMS follow-up messages after calls
 *
 * Per scope requirements:
 * - Optional SMS follow-up after calls
 * - Reminder of clinic hours, location, or visit tips
 * - Only sent when implied consent is present
 * - Tracks delivery status in Keragon
 */

const twilioConfig = require('../config/twilio');
const callLogger = require('./callLogger');
const logger = require('../config/logger');

// SMS delay before sending follow-up (in milliseconds)
const SMS_DELAY_MS = (parseInt(process.env.SMS_FOLLOWUP_DELAY_MINUTES) || 5) * 60 * 1000;

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

  // Generate appropriate message based on call context
  const message = generateFollowUpMessage(callData);

  try {
    // Optional delay before sending
    if (SMS_DELAY_MS > 0 && process.env.NODE_ENV === 'production') {
      await delay(SMS_DELAY_MS);
    }

    const result = await twilioConfig.sendSms(phoneNumber, message);

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
 * @param {Object} callData - Call data
 * @returns {string} SMS message
 */
function generateFollowUpMessage(callData) {
  const clinicName = process.env.CLINIC_NAME || 'our urgent care';
  const clinicAddress = process.env.CLINIC_ADDRESS || '';
  const clinicPhone = process.env.CLINIC_PHONE || '';

  // Personalize if we have the caller's name
  const greeting = callData.caller_name
    ? `Hi ${callData.caller_name}, `
    : 'Hi, ';

  // Base message
  let message = `${greeting}thank you for calling ${clinicName}. `;

  // Add visit timeframe reminder if captured
  if (callData.intended_visit_timeframe) {
    message += `We noted you plan to visit ${callData.intended_visit_timeframe}. `;
  }

  // Add clinic info
  message += `Walk-ins welcome!`;

  if (clinicAddress) {
    message += ` Location: ${clinicAddress}.`;
  }

  if (clinicPhone) {
    message += ` Questions? Call ${clinicPhone}.`;
  }

  // Keep message under SMS limit (160 chars for single segment)
  if (message.length > 160) {
    // Shorter version
    message = `${greeting}thanks for calling ${clinicName}. Walk-ins welcome!`;
    if (clinicPhone) {
      message += ` Questions: ${clinicPhone}`;
    }
  }

  return message;
}

/**
 * Send emergency resources SMS
 * For calls that triggered emergency detection but caller didn't hang up
 * @param {string} phoneNumber - Caller's phone number
 * @param {Object} emergencyInfo - Emergency detection info
 */
async function sendEmergencyResources(phoneNumber, emergencyInfo) {
  let message = 'If this is a medical emergency, please call 911 immediately.';

  // Mental health crisis specific message
  if (emergencyInfo.isMentalHealthCrisis) {
    message = 'If you are in crisis, please call 988 (Suicide & Crisis Lifeline) or 911 for immediate help. You are not alone.';
  }

  try {
    const result = await twilioConfig.sendSms(phoneNumber, message);

    logger.info('Emergency resources SMS sent', {
      to: phoneNumber,
      isMentalHealth: emergencyInfo.isMentalHealthCrisis
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
 */
async function sendHoursReminder(phoneNumber) {
  const clinicName = process.env.CLINIC_NAME || 'Our urgent care';
  const clinicHours = process.env.CLINIC_HOURS || 'Check our website for hours';

  const message = `${clinicName} hours: ${formatClinicHours(clinicHours)}. Walk-ins always welcome!`;

  try {
    const result = await twilioConfig.sendSms(phoneNumber, message);
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
  sendFollowUp,
  sendEmergencyResources,
  sendHoursReminder,
  generateFollowUpMessage,
  formatClinicHours
};
