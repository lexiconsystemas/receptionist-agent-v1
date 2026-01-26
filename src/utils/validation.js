/**
 * Input Validation Utility
 * Validates and sanitizes caller information extracted from calls
 *
 * HIPAA-Conscious: This utility ensures only approved fields are processed
 * and formats data consistently for logging to Keragon
 */

const logger = require('../config/logger');

/**
 * Valid patient types
 */
const PATIENT_TYPES = ['new', 'returning', 'unknown'];

/**
 * Valid call dispositions
 */
const DISPOSITIONS = [
  'completed',      // Normal completed call
  'high_intent',    // Caller expressed strong intent to visit
  'emergency',      // Emergency detected, redirected to 911
  'spam',           // Spam/robocall detected
  'dropped',        // Call dropped/disconnected early
  'incomplete'      // Call ended with incomplete information
];

/**
 * Validate and sanitize caller information
 * @param {Object} data - Raw extracted data from call
 * @returns {Object} Validated and sanitized caller info
 */
function validateCallerInfo(data) {
  if (!data || typeof data !== 'object') {
    return {
      callerName: null,
      phoneNumber: null,
      patientType: 'unknown',
      reasonForVisit: null,
      visitTimeframe: null,
      isValid: false,
      validationErrors: ['No data provided']
    };
  }

  const errors = [];
  const result = {};

  // Validate caller name
  result.callerName = validateName(data.callerName || data.caller_name || data.name);

  // Validate phone number
  result.phoneNumber = validatePhoneNumber(
    data.phoneNumber || data.phone_number || data.phone || data.caller_id
  );
  if (data.phoneNumber && !result.phoneNumber) {
    errors.push('Invalid phone number format');
  }

  // Validate patient type
  result.patientType = validatePatientType(
    data.patientType || data.patient_type || data.type
  );

  // Validate reason for visit (non-diagnostic, sanitized)
  result.reasonForVisit = sanitizeReasonForVisit(
    data.reasonForVisit || data.reason_for_visit || data.reason
  );

  // Validate visit timeframe
  result.visitTimeframe = validateTimeframe(
    data.visitTimeframe || data.visit_timeframe || data.intended_timeframe
  );

  result.isValid = errors.length === 0;
  result.validationErrors = errors;

  return result;
}

/**
 * Validate and sanitize a name
 * @param {string} name - Raw name input
 * @returns {string|null} Sanitized name or null
 */
function validateName(name) {
  if (!name || typeof name !== 'string') return null;

  // Remove any non-alphabetic characters except spaces, hyphens, apostrophes
  let sanitized = name.trim()
    .replace(/[^a-zA-Z\s\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Reasonable length check
  if (sanitized.length < 2 || sanitized.length > 100) {
    return null;
  }

  // Title case
  sanitized = sanitized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return sanitized;
}

/**
 * Validate and normalize phone number
 * @param {string} phone - Raw phone input
 * @returns {string|null} E.164 formatted phone or null
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return null;

  // Remove all non-digit characters except leading +
  let digits = phone.replace(/[^\d+]/g, '');

  // If starts with +, keep it; otherwise assume US
  if (!digits.startsWith('+')) {
    // Remove leading 1 if present (US country code)
    if (digits.startsWith('1') && digits.length === 11) {
      digits = digits;
    } else if (digits.length === 10) {
      digits = '1' + digits;
    }
    digits = '+' + digits;
  }

  // Validate E.164 format (+ followed by 10-15 digits)
  const e164Regex = /^\+[1-9]\d{9,14}$/;
  if (!e164Regex.test(digits)) {
    return null;
  }

  return digits;
}

/**
 * Validate patient type
 * @param {string} type - Raw patient type
 * @returns {string} Validated patient type
 */
function validatePatientType(type) {
  if (!type || typeof type !== 'string') return 'unknown';

  const normalized = type.toLowerCase().trim();

  // Map common variations
  if (['new', 'first time', 'first-time', 'new patient'].includes(normalized)) {
    return 'new';
  }
  if (['returning', 'existing', 'been before', 'return'].includes(normalized)) {
    return 'returning';
  }

  return 'unknown';
}

/**
 * Sanitize reason for visit
 * Removes any potentially diagnostic or PHI content
 * @param {string} reason - Raw reason for visit
 * @returns {string|null} Sanitized reason
 */
function sanitizeReasonForVisit(reason) {
  if (!reason || typeof reason !== 'string') return null;

  let sanitized = reason.trim();

  // Limit length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500) + '...';
  }

  // Remove potential PHI patterns (SSN, dates that look like DOB, etc.)
  sanitized = sanitized
    .replace(/\d{3}-\d{2}-\d{4}/g, '[REDACTED]') // SSN
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '[DATE]')   // Dates
    .replace(/\b\d{9}\b/g, '[REDACTED]');         // 9-digit numbers

  // Don't store if it's mostly redacted
  if ((sanitized.match(/\[REDACTED\]/g) || []).length > 2) {
    logger.warn('Reason for visit contained multiple PHI patterns');
    return 'See call transcript for details';
  }

  return sanitized;
}

/**
 * Validate visit timeframe
 * Per scope: 1-hour timeframes preferred
 * @param {string} timeframe - Raw timeframe input
 * @returns {string|null} Validated timeframe
 */
function validateTimeframe(timeframe) {
  if (!timeframe || typeof timeframe !== 'string') return null;

  const normalized = timeframe.toLowerCase().trim();

  // Common timeframe patterns
  const validPatterns = [
    // Today
    /^today$/i,
    /^this (morning|afternoon|evening)$/i,
    /^in (\d+) (hour|hours|minute|minutes)$/i,
    /^within (the )?(hour|next hour)$/i,
    /^asap$/i,
    /^as soon as possible$/i,

    // Time ranges
    /^\d{1,2}(:\d{2})?\s*(am|pm)?\s*(-|to)\s*\d{1,2}(:\d{2})?\s*(am|pm)?$/i,

    // Tomorrow/Later
    /^tomorrow$/i,
    /^tomorrow (morning|afternoon|evening)$/i,
    /^later today$/i,
    /^this week$/i,

    // General
    /^(morning|afternoon|evening)$/i
  ];

  const isValid = validPatterns.some(pattern => pattern.test(normalized));

  if (!isValid) {
    // Try to extract useful info
    if (normalized.includes('hour') || normalized.includes('minute')) {
      return timeframe.trim();
    }
    if (/\d{1,2}/.test(normalized)) {
      return timeframe.trim();
    }
    return null;
  }

  return timeframe.trim();
}

/**
 * Validate call disposition
 * @param {string} disposition - Raw disposition
 * @returns {string} Valid disposition
 */
function validateDisposition(disposition) {
  if (!disposition || typeof disposition !== 'string') return 'incomplete';

  const normalized = disposition.toLowerCase().trim();

  if (DISPOSITIONS.includes(normalized)) {
    return normalized;
  }

  // Map common variations
  const mappings = {
    'complete': 'completed',
    'done': 'completed',
    'finished': 'completed',
    'hang up': 'dropped',
    'hangup': 'dropped',
    'disconnected': 'dropped',
    'high intent': 'high_intent',
    'intent': 'high_intent',
    'junk': 'spam',
    'robocall': 'spam',
    '911': 'emergency',
    'er': 'emergency'
  };

  return mappings[normalized] || 'incomplete';
}

/**
 * Validate entire call record before logging
 * @param {Object} callRecord - Complete call record
 * @returns {Object} Validation result
 */
function validateCallRecord(callRecord) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!callRecord.call_id) {
    errors.push('Missing call_id');
  }
  if (!callRecord.timestamp) {
    errors.push('Missing timestamp');
  }

  // Validate nested data
  const callerInfo = validateCallerInfo(callRecord);
  if (!callerInfo.isValid) {
    warnings.push(...callerInfo.validationErrors);
  }

  // Validate disposition
  const disposition = validateDisposition(callRecord.disposition);
  if (disposition !== callRecord.disposition) {
    warnings.push(`Disposition normalized: ${callRecord.disposition} → ${disposition}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedRecord: {
      ...callRecord,
      ...callerInfo,
      disposition
    }
  };
}

module.exports = {
  validateCallerInfo,
  validateName,
  validatePhoneNumber,
  validatePatientType,
  sanitizeReasonForVisit,
  validateTimeframe,
  validateDisposition,
  validateCallRecord,
  PATIENT_TYPES,
  DISPOSITIONS
};
