/**
 * Scheduler Service
 * Manages appointment reminder SMS and HIPAA-mandated PHI auto-deletion
 *
 * Per scope requirements:
 * - Day-before appointment reminder SMS
 * - 1-hour-before appointment reminder SMS
 * - 7-day PHI auto-deletion (HIPAA minimum necessary / data minimisation)
 *
 * Uses node-cron for scheduling. Appointment records are stored in the
 * shared cache (Redis-backed in production).
 *
 * Cache key conventions:
 *   appt:{appointmentId}                  — appointment record (JSON)
 *   appt:index:{YYYY-MM-DD}               — Set of appointmentIds for a date
 *   call:log:{callId}                     — Call log record (managed by callLogger)
 *   call:index:{YYYY-MM-DD}               — Set of callIds logged on a date
 */

const cron = require('node-cron');
const logger = require('../config/logger');
const callLogger = require('./callLogger');
const smsService = require('./smsService');
const { getCache } = require('../lib/cache');

// ─── Constants ───────────────────────────────────────────────────────────────

/** PHI retention window in days (HIPAA minimum necessary for operational use) */
const PHI_RETENTION_DAYS = parseInt(process.env.PHI_RETENTION_DAYS) || 7;

/** Appointment TTL in cache: 30 days (enough for reminders + audit) */
const APPT_TTL_SECONDS = 30 * 24 * 60 * 60;

// ─── Appointment Store ────────────────────────────────────────────────────────

/**
 * Save an appointment into the cache so reminders can be fired later
 * @param {Object} appt
 * @param {string} appt.id              - Unique appointment ID
 * @param {string} appt.phoneNumber     - Patient E.164 phone number
 * @param {string} appt.callerName      - Patient name (may be null)
 * @param {string} appt.appointmentISO  - ISO 8601 datetime of appointment
 * @param {string} [appt.locale='en']   - 'en' | 'es'
 * @returns {Promise<boolean>}
 */
async function scheduleAppointment(appt) {
  const { id, phoneNumber, callerName, appointmentISO, locale = 'en' } = appt;

  if (!id || !phoneNumber || !appointmentISO) {
    logger.warn('scheduleAppointment: missing required fields', { appt });
    return false;
  }

  const apptDate = new Date(appointmentISO);
  if (isNaN(apptDate.getTime())) {
    logger.warn('scheduleAppointment: invalid appointmentISO', { appointmentISO });
    return false;
  }

  const cache = getCache();
  const record = {
    id,
    phoneNumber,
    callerName: callerName || null,
    appointmentISO,
    locale,
    reminderDaySent: false,
    reminderHourSent: false,
    scheduledAt: new Date().toISOString()
  };

  const dateKey = appointmentISO.slice(0, 10); // YYYY-MM-DD

  try {
    await cache.set(`appt:${id}`, JSON.stringify(record), APPT_TTL_SECONDS);

    // Maintain a date-indexed set (stored as JSON array for MemoryCache compat)
    const existingIdx = await cache.get(`appt:index:${dateKey}`);
    const idx = existingIdx ? JSON.parse(existingIdx) : [];
    if (!idx.includes(id)) {
      idx.push(id);
      await cache.set(`appt:index:${dateKey}`, JSON.stringify(idx), APPT_TTL_SECONDS);
    }

    logger.info('Appointment scheduled for reminders', { id, phoneNumber, appointmentISO, locale });
    return true;
  } catch (error) {
    logger.error('Failed to schedule appointment', { id, error: error.message });
    return false;
  }
}

/**
 * Cancel a previously scheduled appointment (removes from cache index)
 * @param {string} appointmentId
 */
async function cancelScheduledAppointment(appointmentId) {
  const cache = getCache();
  try {
    const raw = await cache.get(`appt:${appointmentId}`);
    if (raw) {
      const record = JSON.parse(raw);
      const dateKey = record.appointmentISO.slice(0, 10);

      // Remove from date index
      const existingIdx = await cache.get(`appt:index:${dateKey}`);
      if (existingIdx) {
        const idx = JSON.parse(existingIdx).filter(id => id !== appointmentId);
        await cache.set(`appt:index:${dateKey}`, JSON.stringify(idx), APPT_TTL_SECONDS);
      }

      await cache.delete(`appt:${appointmentId}`);
      logger.info('Scheduled appointment removed from cache', { appointmentId });
    }
  } catch (error) {
    logger.error('Failed to cancel scheduled appointment', { appointmentId, error: error.message });
  }
}

// ─── Reminder Jobs ────────────────────────────────────────────────────────────

/**
 * Check all upcoming appointments and fire reminders as needed
 * Called every 15 minutes by the cron job
 */
async function processReminders() {
  const cache = getCache();
  const now = new Date();

  // We check appointments for today and the next 2 days
  const datesToCheck = [0, 1, 2].map(offset => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  });

  for (const dateKey of datesToCheck) {
    let ids;
    try {
      const raw = await cache.get(`appt:index:${dateKey}`);
      ids = raw ? JSON.parse(raw) : [];
    } catch {
      ids = [];
    }

    for (const id of ids) {
      await checkAndFireReminder(id, now, cache);
    }
  }
}

/**
 * Check one appointment and send any due reminders
 * @param {string} id
 * @param {Date} now
 * @param {Object} cache
 */
async function checkAndFireReminder(id, now, cache) {
  let record;
  try {
    const raw = await cache.get(`appt:${id}`);
    if (!raw) return;
    record = JSON.parse(raw);
  } catch {
    return;
  }

  const apptTime = new Date(record.appointmentISO);
  if (isNaN(apptTime.getTime())) return;

  const msUntilAppt = apptTime - now;
  const hoursUntilAppt = msUntilAppt / (1000 * 60 * 60);

  // Day-before reminder: between 24h and 25h before appointment
  if (!record.reminderDaySent && hoursUntilAppt >= 23 && hoursUntilAppt <= 25) {
    const sent = await sendDayBeforeReminder(record);
    if (sent) {
      record.reminderDaySent = true;
      await cache.set(`appt:${id}`, JSON.stringify(record), APPT_TTL_SECONDS);
    }
  }

  // 1-hour reminder: between 55min and 65min before appointment
  if (!record.reminderHourSent && hoursUntilAppt >= 0.9 && hoursUntilAppt <= 1.1) {
    const sent = await sendHourBeforeReminder(record);
    if (sent) {
      record.reminderHourSent = true;
      await cache.set(`appt:${id}`, JSON.stringify(record), APPT_TTL_SECONDS);
    }
  }
}

/**
 * Send the day-before reminder SMS
 * @param {Object} record - Appointment record
 * @returns {boolean} true if sent successfully
 */
async function sendDayBeforeReminder(record) {
  const { phoneNumber, callerName, appointmentISO, locale = 'en' } = record;
  const clinicName = process.env.CLINIC_NAME || 'our urgent care';
  const clinicAddress = process.env.CLINIC_ADDRESS || '';
  const es = locale === 'es';

  const time = formatApptTime(appointmentISO, locale);
  const nameFragment = callerName ? (es ? `, ${callerName}` : `, ${callerName}`) : '';
  let message;

  if (es) {
    message = `Hola${nameFragment}! Le recordamos su cita en ${clinicName} mañana a las ${time}.`;
    if (clinicAddress) message += ` Dirección: ${clinicAddress}.`;
    message += ' Responda CANCELAR si necesita cancelar.';
  } else {
    message = `Hi${nameFragment}! Reminder: you have an appointment at ${clinicName} tomorrow at ${time}.`;
    if (clinicAddress) message += ` Address: ${clinicAddress}.`;
    message += ' Reply CANCEL to cancel.';
  }

  try {
    await smsService.sendRaw(phoneNumber, message);
    logger.info('Day-before reminder sent', { appointmentId: record.id, phoneNumber });
    return true;
  } catch (error) {
    logger.error('Failed to send day-before reminder', { appointmentId: record.id, error: error.message });
    return false;
  }
}

/**
 * Send the 1-hour-before reminder SMS
 * @param {Object} record - Appointment record
 * @returns {boolean} true if sent successfully
 */
async function sendHourBeforeReminder(record) {
  const { phoneNumber, callerName, appointmentISO, locale = 'en' } = record;
  const clinicName = process.env.CLINIC_NAME || 'our urgent care';
  const es = locale === 'es';

  const time = formatApptTime(appointmentISO, locale);
  const nameFragment = callerName ? `, ${callerName}` : '';
  let message;

  if (es) {
    message = `Recordatorio${nameFragment}: su cita en ${clinicName} es en 1 hora, a las ${time}. ¡Lo esperamos!`;
  } else {
    message = `Reminder${nameFragment}: your appointment at ${clinicName} is in 1 hour at ${time}. See you soon!`;
  }

  try {
    await smsService.sendRaw(phoneNumber, message);
    logger.info('1-hour reminder sent', { appointmentId: record.id, phoneNumber });
    return true;
  } catch (error) {
    logger.error('Failed to send 1-hour reminder', { appointmentId: record.id, error: error.message });
    return false;
  }
}

/**
 * Format an ISO datetime for display in SMS
 * @param {string} iso - ISO 8601 datetime string
 * @param {string} locale - 'en' | 'es'
 * @returns {string}
 */
function formatApptTime(iso, locale = 'en') {
  try {
    const d = new Date(iso);
    const timeZone = process.env.CLINIC_TIMEZONE || 'America/New_York';
    const lang = locale === 'es' ? 'es-US' : 'en-US';
    return d.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short' });
  } catch {
    return iso;
  }
}

// ─── PHI Auto-Deletion Job ────────────────────────────────────────────────────

/**
 * Delete call log records older than PHI_RETENTION_DAYS from the cache
 * Runs daily at 2 AM. Records in external systems (Keragon) must be
 * purged separately per the Keragon data retention workflow.
 */
async function runPhiDeletion() {
  logger.info('PHI auto-deletion job started', { retentionDays: PHI_RETENTION_DAYS });

  const cache = getCache();
  let deleted = 0;
  let errors = 0;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - PHI_RETENTION_DAYS);

  // Walk back through date keys to find stale records
  for (let i = PHI_RETENTION_DAYS; i <= PHI_RETENTION_DAYS + 30; i++) {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - i);
    const dateKey = staleDate.toISOString().slice(0, 10);

    // Delete stale call logs
    try {
      const callIdx = await cache.get(`call:index:${dateKey}`);
      if (callIdx) {
        const callIds = JSON.parse(callIdx);
        for (const callId of callIds) {
          await cache.delete(`call:log:${callId}`);
          deleted++;
        }
        await cache.delete(`call:index:${dateKey}`);
      }
    } catch (error) {
      logger.error('PHI deletion error for call records', { dateKey, error: error.message });
      errors++;
    }

    // Delete stale appointment records (past appointments > retention window)
    try {
      const apptIdx = await cache.get(`appt:index:${dateKey}`);
      if (apptIdx) {
        const apptIds = JSON.parse(apptIdx);
        for (const apptId of apptIds) {
          await cache.delete(`appt:${apptId}`);
          deleted++;
        }
        await cache.delete(`appt:index:${dateKey}`);
      }
    } catch (error) {
      logger.error('PHI deletion error for appointment records', { dateKey, error: error.message });
      errors++;
    }
  }

  logger.info('PHI auto-deletion job complete', { deleted, errors });

  // Log to Keragon for audit trail
  await callLogger.logToKeragon({
    event: 'phi_auto_deletion',
    timestamp: new Date().toISOString(),
    retention_days: PHI_RETENTION_DAYS,
    records_deleted: deleted,
    errors
  });
}

// ─── Cron Job Registration ────────────────────────────────────────────────────

let reminderJob = null;
let phiDeletionJob = null;

/**
 * Start all scheduled jobs
 * Call this once at server startup (after environment is loaded)
 */
function startScheduler() {
  if (process.env.SCHEDULER_ENABLED === 'false') {
    logger.info('Scheduler disabled via SCHEDULER_ENABLED=false');
    return;
  }

  // Appointment reminder check — every 15 minutes
  reminderJob = cron.schedule('*/15 * * * *', async () => {
    try {
      await processReminders();
    } catch (error) {
      logger.error('Reminder cron job failed', { error: error.message });
    }
  }, { timezone: process.env.CLINIC_TIMEZONE || 'America/New_York' });

  // PHI auto-deletion — daily at 2:00 AM clinic timezone
  phiDeletionJob = cron.schedule('0 2 * * *', async () => {
    try {
      await runPhiDeletion();
    } catch (error) {
      logger.error('PHI deletion cron job failed', { error: error.message });
    }
  }, { timezone: process.env.CLINIC_TIMEZONE || 'America/New_York' });

  logger.info('Scheduler started', {
    reminderInterval: '*/15 * * * *',
    phiDeletion: '0 2 * * *',
    timezone: process.env.CLINIC_TIMEZONE || 'America/New_York'
  });
}

/**
 * Stop all scheduled jobs (for graceful shutdown)
 */
function stopScheduler() {
  if (reminderJob) {
    reminderJob.stop();
    reminderJob = null;
  }
  if (phiDeletionJob) {
    phiDeletionJob.stop();
    phiDeletionJob = null;
  }
  logger.info('Scheduler stopped');
}

module.exports = {
  startScheduler,
  stopScheduler,
  scheduleAppointment,
  cancelScheduledAppointment,
  processReminders,
  runPhiDeletion,
  formatApptTime
};
