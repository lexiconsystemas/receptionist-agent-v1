/**
 * SMS Provider Configuration
 * Provider-agnostic wrapper for outbound SMS.
 *
 * RetellAI now handles all telephony (inbound calls, PSTN, BAA).
 * This module handles SMS-only messaging for:
 *   - Post-call follow-up
 *   - Appointment reminders (day-before + 1-hour-before)
 *   - Rating requests and acknowledgements
 *   - Emergency resource messages
 *   - Callback confirmations
 *
 * PROVIDER STATUS: TBD — Twilio or Vonage pending client confirmation.
 * When USE_MOCKS=true the mock SMS store is used instead of a real API call.
 *
 * To wire a real provider:
 *   1. Confirm provider with client
 *   2. Install provider SDK (e.g. `npm install twilio`)
 *   3. Replace the stub block below with real SDK call
 *   4. Set env vars (see .env.example SMS section)
 */

const logger = require('./logger');

// From-number used for all outbound SMS
const FROM_NUMBER = process.env.SMS_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || '+15550000000';

// Status callback URL for delivery receipts
const STATUS_CALLBACK = process.env.APP_BASE_URL
  ? `${process.env.APP_BASE_URL}/webhook/sms/status`
  : null;

/**
 * Send an SMS message
 * @param {string} to - E.164 destination number
 * @param {string} body - Message text
 * @param {Object} [opts] - Additional options
 * @returns {Promise<{ success: boolean, messageSid?: string, status?: string }>}
 */
async function sendSms(to, body, opts = {}) {
  if (!to || !body) {
    throw new Error('sendSms: to and body are required');
  }

  // ── MOCK MODE ─────────────────────────────────────────────────────────────
  if (process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'test') {
    const { v4: uuidv4 } = require('uuid');
    const messageSid = 'SM' + uuidv4().replace(/-/g, '').slice(0, 32);
    logger.info('[MOCK] SMS sent', { to, messageSid, bodyLength: body.length });
    return { success: true, messageSid, status: 'queued' };
  }

  // ── REAL PROVIDER (stub — wire when provider confirmed) ───────────────────
  // TODO: Replace this block with the real provider SDK call.
  // Example for Twilio:
  //
  //   const twilio = require('twilio');
  //   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  //   const msg = await client.messages.create({
  //     body,
  //     from: FROM_NUMBER,
  //     to,
  //     ...(STATUS_CALLBACK && { statusCallback: STATUS_CALLBACK })
  //   });
  //   return { success: true, messageSid: msg.sid, status: msg.status };

  logger.warn('SMS provider not yet configured — message not sent', { to, bodyLength: body.length });
  return { success: false, error: 'SMS provider not configured' };
}

module.exports = { sendSms, FROM_NUMBER };
