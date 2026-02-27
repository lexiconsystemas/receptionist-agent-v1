/**
 * Inbound SMS Handler
 * Processes replies from patients after a post-call follow-up SMS
 *
 * Per scope requirements:
 * - Parse 1–5 rating replies
 * - Low-score (1–3) trigger: send follow-up acknowledgement SMS
 * - Handle STOP / opt-out replies (TCPA compliance)
 * - Handle free-text replies (log to Keragon for staff review)
 *
 * PHI Retention (§5.4/§5.7):
 * - caller:locale:{phone} keys are set with PHI_RETENTION_DAYS TTL (default 7 days)
 * - sms:freetext:{smsSid} bodies are cached with PHI_RETENTION_DAYS TTL;
 *   only a sentinel reference is sent to Keragon after expiry
 */

const logger = require('../config/logger');
const callLogger = require('../services/callLogger');
const smsService = require('../services/smsService');
const { getCache } = require('../lib/cache');

/** PHI retention window in days — must match schedulerService */
const PHI_RETENTION_DAYS = parseInt(process.env.PHI_RETENTION_DAYS) || 7;
const PHI_RETENTION_TTL  = PHI_RETENTION_DAYS * 24 * 60 * 60; // seconds

/**
 * Main inbound SMS webhook handler
 * SMS provider (Twilio/Vonage — TBD) POSTs here when a patient replies to our SMS
 */
async function handleInboundSms(req, res) {
  // Respond immediately — SMS providers expect a fast 200 acknowledgement
  res.sendStatus(200);

  try {
    const from   = req.body.From;
    const to     = req.body.To;
    const body   = (req.body.Body || '').trim();
    const smsSid = req.body.SmsSid || req.body.MessageSid;

    logger.info('Inbound SMS received', { from, to, smsSid, bodyLength: body.length });

    if (!from || !body) {
      logger.warn('Inbound SMS missing From or Body — ignoring', { smsSid });
      return;
    }

    // Route based on content
    const classification = classifyReply(body);

    switch (classification.type) {
      case 'opt_out':
        await handleOptOut(from, body);
        break;

      case 'opt_in':
        await handleOptIn(from);
        break;

      case 'rating':
        await handleRating(from, classification.score, body);
        break;

      case 'freetext':
        await handleFreeText(from, body, smsSid);
        break;

      default:
        logger.info('Inbound SMS — no action taken', { from, classification });
    }
  } catch (error) {
    logger.error('Error processing inbound SMS', { error: error.message, stack: error.stack });
  }
}

/**
 * Classify an inbound SMS reply
 * @param {string} body - Raw message body
 * @returns {{ type: string, score?: number }}
 */
function classifyReply(body) {
  const normalized = body.toLowerCase().trim();

  // TCPA opt-out keywords (must honour immediately)
  const optOutKeywords = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'];
  if (optOutKeywords.includes(normalized)) {
    return { type: 'opt_out' };
  }

  // TCPA opt-in keywords
  const optInKeywords = ['start', 'yes', 'unstop'];
  if (optInKeywords.includes(normalized)) {
    return { type: 'opt_in' };
  }

  // Rating: single digit 1–5, optionally surrounded by whitespace or punctuation
  const ratingMatch = body.match(/^\s*([1-5])\s*[.!]?\s*$/);
  if (ratingMatch) {
    return { type: 'rating', score: parseInt(ratingMatch[1], 10) };
  }

  // Also catch written ratings like "1/5", "5 stars", etc.
  const ratingPhraseMatch = body.match(/\b([1-5])\s*(?:\/5|star|stars|out of)\b/i);
  if (ratingPhraseMatch) {
    return { type: 'rating', score: parseInt(ratingPhraseMatch[1], 10) };
  }

  // Anything else is free text for staff review
  return { type: 'freetext' };
}

/**
 * Handle STOP / opt-out reply
 * Flag the number in cache so we never SMS them again
 */
async function handleOptOut(phoneNumber, body) {
  logger.info('SMS opt-out received', { phoneNumber });

  try {
    const cache = getCache();
    // Store indefinitely (large TTL = 1 year)
    await cache.set(`sms:optout:${phoneNumber}`, '1', 365 * 24 * 60 * 60);
  } catch (error) {
    logger.error('Failed to store opt-out in cache', { phoneNumber, error: error.message });
  }

  // Log to Keragon for staff record
  await callLogger.logToKeragon({
    event: 'sms_opt_out',
    phone_number: phoneNumber,
    reply_body: body,
    timestamp: new Date().toISOString(),
    action_taken: 'flagged_do_not_sms'
  });

  // Per TCPA: no confirmation SMS is required (and sending one would be a violation)
  logger.info('Opt-out processed — number flagged, no reply sent', { phoneNumber });
}

/**
 * Handle START / opt-in reply
 * Remove any opt-out flag for this number
 */
async function handleOptIn(phoneNumber) {
  logger.info('SMS opt-in received', { phoneNumber });

  try {
    const cache = getCache();
    await cache.delete(`sms:optout:${phoneNumber}`);
  } catch (error) {
    logger.error('Failed to remove opt-out flag', { phoneNumber, error: error.message });
  }

  await callLogger.logToKeragon({
    event: 'sms_opt_in',
    phone_number: phoneNumber,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle a 1–5 rating reply
 * Low scores (1–3) trigger a follow-up acknowledgement SMS and Keragon alert
 */
async function handleRating(phoneNumber, score, rawBody) {
  logger.info('Rating received', { phoneNumber, score });

  const isLowScore = score <= 3;

  // Log to Keragon
  await callLogger.logToKeragon({
    event: 'patient_rating',
    phone_number: phoneNumber,
    rating: score,
    raw_reply: rawBody,
    timestamp: new Date().toISOString(),
    low_score_alert: isLowScore,
    requires_review: isLowScore
  });

  // Send acknowledgement — personalise message based on score
  const locale = await getLocaleForNumber(phoneNumber);

  let replyMessage;
  if (isLowScore) {
    replyMessage = locale === 'es'
      ? `Gracias por su opinión. Lamentamos que su experiencia no haya sido buena. Un miembro de nuestro equipo se pondrá en contacto con usted. — ${process.env.CLINIC_NAME || 'Nuestra clínica'}`
      : `Thank you for your feedback. We're sorry your experience wasn't great — a team member will follow up with you. — ${process.env.CLINIC_NAME || 'Our clinic'}`;
  } else {
    replyMessage = locale === 'es'
      ? `¡Gracias por su calificación! Nos alegra que haya tenido una buena experiencia. — ${process.env.CLINIC_NAME || 'Nuestra clínica'}`
      : `Thanks for rating us! We're glad you had a good experience. — ${process.env.CLINIC_NAME || 'Our clinic'}`;
  }

  try {
    await smsService.sendRaw(phoneNumber, replyMessage);
    logger.info('Rating acknowledgement sent', { phoneNumber, score, isLowScore });
  } catch (error) {
    logger.error('Failed to send rating acknowledgement', { phoneNumber, error: error.message });
  }
}

/**
 * Handle free-text reply — log for staff review
 *
 * PHI retention: the raw message body is stored in Redis with a 7-day TTL
 * (sms:freetext:{smsSid}). Only a sentinel reference is sent to Keragon
 * so free-text PHI auto-expires from our system within the retention window.
 */
async function handleFreeText(phoneNumber, body, smsSid) {
  logger.info('Free-text SMS reply received — routing to staff', { phoneNumber });

  const now = new Date();
  const scrubAt = new Date(now.getTime() + PHI_RETENTION_TTL * 1000).toISOString();
  const freetextKey = `sms:freetext:${smsSid || `${phoneNumber}:${now.getTime()}`}`;

  // Cache the raw body with a 7-day TTL — auto-expires from our system
  try {
    const cache = getCache();
    await cache.set(freetextKey, body, PHI_RETENTION_TTL);
    logger.debug('Free-text body cached with retention TTL', { freetextKey, ttlDays: PHI_RETENTION_DAYS });
  } catch (error) {
    logger.error('Failed to cache free-text body for retention', { freetextKey, error: error.message });
  }

  // Send only a sentinel reference to Keragon — no raw PHI in the run payload
  await callLogger.logToKeragon({
    event: 'sms_freetext_reply',
    phone_number: phoneNumber,
    message_body: `[PHI — expires ${scrubAt} — see Redis key: ${freetextKey}]`,
    freetext_cache_key: freetextKey,
    retention_scrub_at: scrubAt,
    timestamp: now.toISOString(),
    requires_review: true,
    note: 'Patient replied with free text — needs staff review. Raw body stored in Redis with 7-day TTL.'
  });
}

/**
 * Check if a phone number is opted out of SMS
 * Used by smsService before sending any outbound SMS
 * @param {string} phoneNumber - E.164 phone number
 * @returns {Promise<boolean>}
 */
async function isOptedOut(phoneNumber) {
  try {
    const cache = getCache();
    const val = await cache.get(`sms:optout:${phoneNumber}`);
    return val === '1';
  } catch {
    // If cache is unavailable, default to NOT opted out (fail open)
    return false;
  }
}

/**
 * Get the preferred locale for a phone number
 * Falls back to 'en' — will be expanded once Retell sends language metadata
 * @param {string} phoneNumber - E.164 phone number
 * @returns {Promise<string>} locale code ('en' | 'es')
 */
async function getLocaleForNumber(phoneNumber) {
  try {
    const cache = getCache();
    const locale = await cache.get(`caller:locale:${phoneNumber}`);
    return locale || 'en';
  } catch {
    return 'en';
  }
}

/**
 * Set the preferred locale for a phone number
 * Stored with PHI_RETENTION_DAYS TTL so phone-number-keyed PII auto-expires
 * @param {string} phoneNumber - E.164 phone number
 * @param {string} locale - 'en' | 'es'
 * @returns {Promise<void>}
 */
async function setLocaleForNumber(phoneNumber, locale) {
  try {
    const cache = getCache();
    // Use PHI retention TTL — phone numbers are PII and must not persist indefinitely
    await cache.set(`caller:locale:${phoneNumber}`, locale, PHI_RETENTION_TTL);
    logger.debug('Caller locale set with retention TTL', { phoneNumber, locale, ttlDays: PHI_RETENTION_DAYS });
  } catch (error) {
    logger.error('Failed to set caller locale', { phoneNumber, error: error.message });
  }
}

module.exports = {
  handleInboundSms,
  classifyReply,
  isOptedOut,
  getLocaleForNumber,
  setLocaleForNumber,
  handleFreeText
};
