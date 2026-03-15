/**
 * Google Calendar Service Tests
 * Covers scope §3.2 (soft scheduling) and §4 (Google Calendar integration).
 *
 * Functions under test:
 *   parseVisitStart (_parseVisitStart), isConfigured,
 *   createAppointmentEvent, deleteAppointmentEvent
 *
 * All tests run in mock mode (NODE_ENV=test / USE_MOCKS=true).
 * No real Google API calls are made.
 *
 * Run with: npm test -- tests/unit/googleCalendar.test.js
 */

process.env.NODE_ENV = 'test';
process.env.USE_MOCKS = 'true';

const {
  _parseVisitStart: parseVisitStart,
  isConfigured,
  createAppointmentEvent,
  deleteAppointmentEvent
} = require('../../src/services/googleCalendarService');

const { clearMockStore, getMockEvents } = require('../../mocks/googleCalendar.mock');

beforeEach(() => {
  clearMockStore();
});

// ─── parseVisitStart — §3.2 soft scheduling time resolution ──────────────────

describe('parseVisitStart', () => {
  test('returns a Date equal to the ISO timeframe when it is a valid ISO string', () => {
    const iso = '2026-04-01T10:00:00.000Z';
    const result = parseVisitStart(iso, null);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(iso);
  });

  test('prefers timeframe over timestamp when both are valid ISO strings', () => {
    const timeframe = '2026-04-01T14:00:00.000Z';
    const timestamp = '2026-04-01T08:00:00.000Z';
    const result = parseVisitStart(timeframe, timestamp);
    expect(result.toISOString()).toBe(timeframe);
  });

  test('falls back to timestamp + 1 hour when timeframe is not parseable', () => {
    const timestamp = '2026-04-01T09:00:00.000Z';
    const result = parseVisitStart('tomorrow morning', timestamp);
    const expected = new Date('2026-04-01T09:00:00.000Z');
    expected.setHours(expected.getHours() + 1);
    // Allow a small delta for test execution time
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  test('falls back to timestamp + 1 hour when timeframe is null', () => {
    const timestamp = '2026-04-01T08:00:00.000Z';
    const result = parseVisitStart(null, timestamp);
    const expected = new Date('2026-04-01T08:00:00.000Z');
    expected.setHours(expected.getHours() + 1);
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  test('falls back to now + 1 hour when both timeframe and timestamp are null', () => {
    const before = Date.now();
    const result = parseVisitStart(null, null);
    const after = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + oneHourMs - 2000);
    expect(result.getTime()).toBeLessThanOrEqual(after + oneHourMs + 2000);
  });

  test('returns a Date instance in all cases', () => {
    expect(parseVisitStart('2026-04-01T10:00:00.000Z', null)).toBeInstanceOf(Date);
    expect(parseVisitStart('not a date', '2026-04-01T10:00:00.000Z')).toBeInstanceOf(Date);
    expect(parseVisitStart(null, null)).toBeInstanceOf(Date);
  });
});

// ─── isConfigured — env var guard ────────────────────────────────────────────

describe('isConfigured', () => {
  const saved = {};

  beforeEach(() => {
    saved.GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
    saved.GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    saved.GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  });

  afterEach(() => {
    // Restore
    if (saved.GOOGLE_CALENDAR_ID !== undefined) {
      process.env.GOOGLE_CALENDAR_ID = saved.GOOGLE_CALENDAR_ID;
    } else {
      delete process.env.GOOGLE_CALENDAR_ID;
    }
    if (saved.GOOGLE_SERVICE_ACCOUNT_EMAIL !== undefined) {
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = saved.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    } else {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    }
    if (saved.GOOGLE_PRIVATE_KEY !== undefined) {
      process.env.GOOGLE_PRIVATE_KEY = saved.GOOGLE_PRIVATE_KEY;
    } else {
      delete process.env.GOOGLE_PRIVATE_KEY;
    }
  });

  test('returns true when all three env vars are set', () => {
    process.env.GOOGLE_CALENDAR_ID = 'test@group.calendar.google.com';
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'sa@project.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----';
    expect(isConfigured()).toBe(true);
  });

  test('returns false when GOOGLE_CALENDAR_ID is missing', () => {
    delete process.env.GOOGLE_CALENDAR_ID;
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'sa@project.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----';
    expect(isConfigured()).toBe(false);
  });

  test('returns false when GOOGLE_SERVICE_ACCOUNT_EMAIL is missing', () => {
    process.env.GOOGLE_CALENDAR_ID = 'test@group.calendar.google.com';
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----';
    expect(isConfigured()).toBe(false);
  });

  test('returns false when GOOGLE_PRIVATE_KEY is missing', () => {
    process.env.GOOGLE_CALENDAR_ID = 'test@group.calendar.google.com';
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'sa@project.iam.gserviceaccount.com';
    delete process.env.GOOGLE_PRIVATE_KEY;
    expect(isConfigured()).toBe(false);
  });
});

// ─── createAppointmentEvent — §3.2 / §4 ──────────────────────────────────────

describe('createAppointmentEvent (mock mode)', () => {
  test('returns success=true with an eventId', async () => {
    const callLog = {
      call_id: 'test_call_001',
      caller_id: '+15551234567',
      caller_name: 'Test Patient',
      reason_for_visit: 'sore throat',
      patient_type: 'new',
      intended_visit_timeframe: '2026-04-01T10:00:00.000Z',
      timestamp: '2026-04-01T00:00:00.000Z'
    };

    const result = await createAppointmentEvent(callLog);
    expect(result.success).toBe(true);
    expect(result.eventId).toBeDefined();
    expect(typeof result.eventId).toBe('string');
  });

  test('returns an htmlLink', async () => {
    const result = await createAppointmentEvent({ call_id: 'test_002' });
    expect(result.htmlLink).toBeDefined();
    expect(result.htmlLink).toMatch(/calendar\.google\.com/);
  });

  test('succeeds with only call_id (all other fields optional)', async () => {
    const result = await createAppointmentEvent({ call_id: 'minimal_003' });
    expect(result.success).toBe(true);
  });

  test('stores event in mock data store', async () => {
    await createAppointmentEvent({
      call_id: 'store_test_004',
      caller_name: 'Jane Smith'
    });
    const events = getMockEvents();
    expect(events.length).toBeGreaterThan(0);
  });

  test('event summary includes the caller name', async () => {
    await createAppointmentEvent({
      call_id: 'name_test_005',
      caller_name: 'Arthur Garnett'
    });
    const events = getMockEvents();
    const event = events.find(e => e.callId === 'name_test_005');
    expect(event.summary).toContain('Arthur Garnett');
  });

  test('event summary defaults to "Patient" when no caller name provided', async () => {
    await createAppointmentEvent({ call_id: 'no_name_006' });
    const events = getMockEvents();
    const event = events.find(e => e.callId === 'no_name_006');
    expect(event.summary).toContain('Patient');
  });

  // §5.7 PHI note: patient_dob IS included in Google Calendar events (scope-compliant).
  // DOB is captured in the event description for staff reference.
  // It is scrubbed from all Keragon payloads (tested in phiScrubbing.test.js).
  test('accepts callLog with patient_dob without error (DOB is allowed in Calendar events)', async () => {
    const callLog = {
      call_id: 'dob_test_007',
      caller_name: 'Maria Garcia',
      patient_dob: '01/15/1985',
      reason_for_visit: 'annual checkup',
      patient_type: 'returning'
    };
    const result = await createAppointmentEvent(callLog);
    expect(result.success).toBe(true);
  });

  test('each call creates a distinct event ID', async () => {
    const r1 = await createAppointmentEvent({ call_id: 'unique_008a' });
    const r2 = await createAppointmentEvent({ call_id: 'unique_008b' });
    expect(r1.eventId).not.toBe(r2.eventId);
  });
});

// ─── deleteAppointmentEvent — §3.2 (change/cancel flows) ─────────────────────

describe('deleteAppointmentEvent (mock mode)', () => {
  test('returns success=true for any event ID in mock mode', async () => {
    const result = await deleteAppointmentEvent('some_event_id');
    expect(result.success).toBe(true);
  });

  test('marks deleted=true when the event existed', async () => {
    const created = await createAppointmentEvent({ call_id: 'del_test_001' });
    const result = await deleteAppointmentEvent(created.eventId);
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(true);
  });

  test('marks deleted=false when the event did not exist', async () => {
    const result = await deleteAppointmentEvent('nonexistent_event_id');
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(false);
  });

  test('removes the event from the mock store', async () => {
    const created = await createAppointmentEvent({ call_id: 'del_store_002' });
    expect(getMockEvents()).toHaveLength(1);
    await deleteAppointmentEvent(created.eventId);
    expect(getMockEvents()).toHaveLength(0);
  });
});
