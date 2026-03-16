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
 * Convert local date/time components to a UTC Date, accounting for clinic timezone.
 * @param {number} year
 * @param {number} month  - 0-indexed
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @param {string} tz     - IANA timezone string
 * @returns {Date}
 */
function localToUTC(year, month, day, hour, minute, tz) {
  // Build a "fake UTC" date using the local time values
  const fakeUtc = new Date(Date.UTC(year, month, day, hour, minute, 0));
  // Ask what local time that UTC instant corresponds to in the clinic timezone
  const localStr = fakeUtc.toLocaleString('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  // Parse "MM/DD/YYYY, HH:mm:ss" back to a UTC ms value
  const match = localStr.match(/(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+):(\d+)/);
  if (!match) return fakeUtc;
  const [, m, d, y, h, min] = match.map(Number);
  const asUtc = new Date(Date.UTC(y, m - 1, d, h === 24 ? 0 : h, min, 0));
  // The offset tells us how much to shift to get the real UTC equivalent
  return new Date(fakeUtc.getTime() - (asUtc.getTime() - fakeUtc.getTime()));
}

/**
 * Parse the intended visit timeframe to a Date.
 * Handles ISO strings and common natural-language patterns Grace captures:
 *   "tomorrow morning", "tomorrow at 5pm", "Wednesday afternoon", etc.
 * Falls back to timestamp + 1 hour if unparseable.
 *
 * @param {string|null} timeframe  - callLog.intended_visit_timeframe
 * @param {string|null} timestamp  - callLog.timestamp (call end time)
 * @returns {Date} Best-effort start time
 */
function parseVisitStart(timeframe, timestamp) {
  const tz = process.env.CLINIC_TIMEZONE || 'America/New_York';
  const base = timestamp ? new Date(timestamp) : new Date();

  // 1. Try ISO string / standard JS-parseable date
  if (timeframe) {
    const d = new Date(timeframe);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Natural language parsing
  if (timeframe) {
    const lower = timeframe.toLowerCase().trim();

    // Get current date parts in clinic timezone
    const localNow = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
      weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(base);
    const lp = {};
    localNow.forEach(p => { lp[p.type] = p.value; });
    const nowYear  = parseInt(lp.year);
    const nowMonth = parseInt(lp.month) - 1; // 0-indexed
    const nowDay   = parseInt(lp.day);
    const dowMap   = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const nowDow   = dowMap[lp.weekday] ?? 0;

    // Determine day offset from today
    let dayOffset = null;
    if (/\btomorrow\b/.test(lower))               dayOffset = 1;
    else if (/\btonight\b|\btoday\b/.test(lower)) dayOffset = 0;
    else if (/in\s+a\s+couple\s+(of\s+)?days?/.test(lower)) dayOffset = 2;
    else if (/in\s+a\s+few\s+days?/.test(lower))            dayOffset = 3;
    else {
      // "in X days" e.g. "in 3 days"
      const inDaysMatch = lower.match(/in\s+(\d+)\s+days?/);
      if (inDaysMatch) dayOffset = parseInt(inDaysMatch[1]);
    }
    if (dayOffset === null) {
      const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      for (let i = 0; i < days.length; i++) {
        if (lower.includes(days[i])) {
          let diff = i - nowDow;
          if (diff <= 0) diff += 7; // always next occurrence
          dayOffset = diff;
          break;
        }
      }
    }

    if (dayOffset !== null) {
      // Parse explicit time e.g. "5pm", "2:30pm", "14:00"
      let hour = null, minute = 0;
      const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
      if (timeMatch) {
        hour   = parseInt(timeMatch[1]);
        minute = parseInt(timeMatch[2] || '0');
        if (timeMatch[3].toLowerCase() === 'pm' && hour < 12) hour += 12;
        if (timeMatch[3].toLowerCase() === 'am' && hour === 12) hour = 0;
      } else if (/\bnoon\b/.test(lower))                        { hour = 12; minute = 0; }
        else if (/\bmidnight\b/.test(lower))                   { hour = 0;  minute = 0; }
        else if (/\bmorning\b/.test(lower))                    { hour = 9;  minute = 0; }
        else if (/\bafternoon\b/.test(lower))                  { hour = 14; minute = 0; }
        else if (/\bevening\b|\bnight\b|tonight/.test(lower))  { hour = 19; minute = 0; }
        else                                                   { hour = 9;  minute = 0; } // default 9am

      // Build target date accounting for day rollover
      const targetDate = new Date(Date.UTC(nowYear, nowMonth, nowDay + dayOffset));
      return localToUTC(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth(),
        targetDate.getUTCDate(),
        hour, minute, tz
      );
    }
  }

  // 3. Fallback: call timestamp + 1 hour
  const fallback = new Date(base);
  fallback.setHours(fallback.getHours() + 1);
  return fallback;
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
