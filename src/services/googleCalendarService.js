/**
 * Google Calendar Service
 * Writes soft-scheduled appointment events to Google Calendar
 * as a staff reference for overnight bookings.
 *
 * Design: Staff reference only (write-only)
 * - Service account auth (no OAuth, no patient-facing features)
 * - Creates 1-hour events at call end when appointment intent is captured
 * - Staff use the calendar to see what overnight walk-ins to expect
 *
 * HIPAA-Conscious:
 * - Event description contains caller name, phone, non-diagnostic reason for visit
 * - No medical history, diagnosis, insurance, or detailed clinical notes
 *
 * Required env vars:
 *   GOOGLE_CALENDAR_ID            — target calendar ID
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — service account email
 *   GOOGLE_PRIVATE_KEY            — service account private key (with literal \n)
 */

const logger = require('../config/logger');

const USE_MOCKS = process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'test';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Check whether all required Google Calendar env vars are present
 * Used as a guard before calling createAppointmentEvent in production
 * @returns {boolean}
 */
function isConfigured() {
  return !!(
    process.env.GOOGLE_CALENDAR_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

// ─── Internal: Lazy Calendar Client ──────────────────────────────────────────

let _calendar = null;

/**
 * Get (or lazily initialise) the authenticated Google Calendar client
 * @returns {import('googleapis').calendar_v3.Calendar}
 */
function getCalendarClient() {
  if (_calendar) return _calendar;

  const { google } = require('googleapis');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // env vars store literal \n — convert to real newlines
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/calendar']
  });

  _calendar = google.calendar({ version: 'v3', auth });
  return _calendar;
}

// ─── Internal: Time helpers ───────────────────────────────────────────────────

/**
 * Parse the intended visit timeframe to a Date.
 * The field may be a full ISO string, a partial string, or freeform text.
 * Falls back to timestamp + 1 hour if not parseable.
 *
 * @param {string|null} timeframe  - callLog.intended_visit_timeframe
 * @param {string|null} timestamp  - callLog.timestamp (call end time)
 * @returns {Date} Best-effort start time
 */
function parseVisitStart(timeframe, timestamp) {
  if (timeframe) {
    const d = new Date(timeframe);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }
  // Fallback: call timestamp + 1 hour
  const base = timestamp ? new Date(timestamp) : new Date();
  base.setHours(base.getHours() + 1);
  return base;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a 1-hour Google Calendar event for a soft-scheduled appointment
 *
 * @param {Object} callLog - Call log object from retellHandler (call_ended event)
 * @param {string} callLog.call_id
 * @param {string} callLog.caller_id          - Patient phone number
 * @param {string} [callLog.caller_name]
 * @param {string} [callLog.reason_for_visit]
 * @param {string} [callLog.patient_type]     - 'new' | 'returning'
 * @param {string} [callLog.intended_visit_timeframe]
 * @param {string} [callLog.timestamp]        - Call end timestamp (ISO)
 * @returns {Promise<{success: boolean, eventId?: string, htmlLink?: string, error?: string}>}
 */
async function createAppointmentEvent(callLog) {
  // Route to mock in non-production environments
  if (USE_MOCKS) {
    const mock = require('../../mocks/googleCalendar.mock');
    return mock.mockCreateAppointmentEvent(callLog);
  }

  if (!isConfigured()) {
    logger.warn('Google Calendar not configured — skipping event creation', {
      callId: callLog.call_id
    });
    return { success: false, error: 'Google Calendar env vars not configured' };
  }

  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const callerName = callLog.caller_name || 'Patient';

    const startTime = parseVisitStart(callLog.intended_visit_timeframe, callLog.timestamp);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // +1 hour

    const descriptionLines = [
      `Name: ${callerName}`,
      `DOB: ${callLog.patient_dob || 'Not provided'}`,
      `Phone: ${callLog.caller_id || 'Unknown'}`,
      `Reason: ${callLog.reason_for_visit || 'Not specified'}`,
      `Visit timeframe: ${callLog.intended_visit_timeframe || 'Not specified'}`,
      `Patient type: ${callLog.patient_type || 'Unknown'}`,
      `Call ID: ${callLog.call_id}`
    ];

    const event = {
      summary: `Urgent Care Walk-In — ${callerName}`,
      description: descriptionLines.join('\n'),
      start: {
        dateTime: startTime.toISOString(),
        timeZone: process.env.CLINIC_TIMEZONE || 'America/New_York'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: process.env.CLINIC_TIMEZONE || 'America/New_York'
      }
    };

    const calendar = getCalendarClient();
    const response = await calendar.events.insert({
      calendarId,
      resource: event
    });

    const eventId = response.data.id;
    const htmlLink = response.data.htmlLink;

    logger.info('Google Calendar event created', {
      callId: callLog.call_id,
      eventId,
      start: startTime.toISOString()
    });

    return { success: true, eventId, htmlLink };

  } catch (error) {
    logger.error('Failed to create Google Calendar event', {
      callId: callLog.call_id,
      error: error.message
    });
    // Never throw — calendar failure must not break call flow
    return { success: false, error: error.message };
  }
}

/**
 * Delete a Google Calendar event by ID
 * Reserved for future use (change/cancel flows that auto-update calendar)
 *
 * @param {string} eventId - Google Calendar event ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteAppointmentEvent(eventId) {
  // Route to mock in non-production environments
  if (USE_MOCKS) {
    const mock = require('../../mocks/googleCalendar.mock');
    return mock.mockDeleteAppointmentEvent(eventId);
  }

  if (!isConfigured()) {
    logger.warn('Google Calendar not configured — skipping event deletion', { eventId });
    return { success: false, error: 'Google Calendar env vars not configured' };
  }

  try {
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const calendar = getCalendarClient();

    await calendar.events.delete({ calendarId, eventId });

    logger.info('Google Calendar event deleted', { eventId });
    return { success: true };

  } catch (error) {
    logger.error('Failed to delete Google Calendar event', {
      eventId,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

module.exports = {
  isConfigured,
  createAppointmentEvent,
  deleteAppointmentEvent,
  // Exported for testing only
  _parseVisitStart: parseVisitStart
};
