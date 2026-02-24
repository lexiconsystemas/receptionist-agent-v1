/**
 * SMS Provider — Stub (Retell SMS pending)
 *
 * RetellAI handles telephony AND outbound SMS natively.
 * The integration approach (Retell API call vs. agent-triggered) is TBD.
 *
 * This module is the single injection point for all SMS sends in:
 *   - smsService.js (post-call follow-up, callback confirmation, emergency resources)
 *   - schedulerService.js (appointment reminders)
 *   - inboundSmsHandler.js (rating follow-up, opt-in/out ack)
 *
 * When USE_MOCKS=true or NODE_ENV=test the mock store is used (no real API call).
 *
 * TODO: Once Retell SMS integration approach is confirmed, replace the real-provider
 * stub below with the appropriate Retell API call (or remove if Retell fires SMS
 * automatically from agent config with no server-side trigger needed).
 */

const logger = require('./logger');

// From-number used for all outbound SMS (may not be needed if Retell owns the number)
const FROM_NUMBER = process.env.SMS_FROM_NUMBER || process.env.SIGNALWIRE_PHONE_NUMBER || '+15550000000';

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
  if (process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'test') {
    const { v4: uuidv4 } = require('uuid');
    const messageSid = 'SM' + uuidv4().replace(/-/g, '').slice(0, 32);
    logger.info('[MOCK] SMS sent', { to, messageSid, bodyLength: body.length });
    return { success: true, messageSid, status: 'queued' };
  }

  // ── REAL PROVIDER — pending Retell SMS integration confirmation ───────────
  // TODO: Replace this block with the Retell SMS approach once confirmed.
  // Two likely patterns:
  //   A) Retell fires SMS automatically from agent config — no code needed here,
  //      remove this sendSms call chain from smsService.js/schedulerService.js.
  //   B) We call a Retell API endpoint to trigger SMS:
  //      const retell = require('./retell');
  //      const msg = await retell.client.sendSms({ to, body, from: FROM_NUMBER });
  //      return { success: true, messageSid: msg.id, status: msg.status };

  logger.warn('SMS provider not yet configured — message not sent', { to, bodyLength: body.length });
  return { success: false, error: 'SMS provider not configured' };
}

module.exports = { sendSms, FROM_NUMBER };
