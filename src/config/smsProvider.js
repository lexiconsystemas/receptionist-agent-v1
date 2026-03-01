/**
 * SMS Provider — Twilio
 *
 * Single injection point for all SMS sends in:
 *   - smsService.js (post-call follow-up, callback confirmation, emergency resources)
 *   - schedulerService.js (appointment reminders)
 *   - inboundSmsHandler.js (rating follow-up, opt-in/out ack)
 *
 * When USE_MOCKS=true or NODE_ENV=test the mock store is used (no real API call).
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
 * @param {string} to       - E.164 destination number
 * @param {string} body     - Message text
 * @param {Object} [opts]   - Additional options (provider-specific)
 * @returns {Promise<{ success: boolean, messageSid?: string, status?: string }>}
 */
async function sendSms(to, body, opts = {}) {
  if (!to || !body) {
    throw new Error('sendSms: to and body are required');
  }

  if (!process.env.SMS_ENABLED || process.env.SMS_ENABLED !== 'true') {
    logger.info('SMS disabled — skipping send', { to });
    return { success: false, reason: 'SMS_ENABLED is not true' };
  }

  // ── MOCK MODE ─────────────────────────────────────────────────────────────
  if (process.env.USE_MOCKS === 'true' || process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'test') {
    const { v4: uuidv4 } = require('uuid');
    const messageSid = 'SM' + uuidv4().replace(/-/g, '').slice(0, 32);
    logger.info('[MOCK] SMS sent', { to, messageSid, bodyLength: body.length });
    return { success: true, messageSid, status: 'queued' };
  }

  // ── REAL PROVIDER — Twilio ────────────────────────────────────────────────
  const twilio = require('twilio');

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    logger.warn('Twilio credentials not configured — SMS not sent', { to, bodyLength: body.length });
    return { success: false, error: 'Twilio credentials missing' };
  }

  const client = twilio(accountSid, authToken);

  const msg = await client.messages.create({
    from: FROM_NUMBER,
    to,
    body,
    ...(STATUS_CALLBACK ? { statusCallback: STATUS_CALLBACK } : {})
  });

  logger.info('SMS sent via Twilio', { to, messageSid: msg.sid, status: msg.status });
  return { success: true, messageSid: msg.sid, status: msg.status };
}

module.exports = { sendSms, FROM_NUMBER };
