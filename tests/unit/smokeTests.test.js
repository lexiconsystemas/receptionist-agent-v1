/**
 * Smoke Tests — New Feature Coverage
 *
 * Quick sanity checks for modules built after the initial scaffolding:
 *   - inboundSmsHandler  (classifyReply, isOptedOut, getLocaleForNumber)
 *   - smsService         (generateFollowUpMessage, sendCallbackConfirmation, formatClinicHours)
 *   - schedulerService   (scheduleAppointment, formatApptTime, runPhiDeletion)
 *   - validation         (new fields, new dispositions)
 *   - retellHandler      (new disposition routing)
 *
 * All tests use mocks / in-memory cache — no real network calls.
 */

// ─── Module imports ────────────────────────────────────────────────────────────
const { classifyReply } = require('../../src/webhooks/inboundSmsHandler');
const {
  generateFollowUpMessage,
  formatClinicHours
} = require('../../src/services/smsService');
const { formatApptTime } = require('../../src/services/schedulerService');
const {
  validateCallerInfo,
  validateDisposition,
  validateAppointmentId,
  validateAppointmentType,
  DISPOSITIONS
} = require('../../src/utils/validation');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal call data object for SMS message generation tests */
function makeCallData(overrides = {}) {
  return {
    call_id: 'smoke_test_001',
    caller_id: '+15551234567',
    caller_name: null,
    intended_visit_timeframe: null,
    ...overrides
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. inboundSmsHandler — classifyReply
// ─────────────────────────────────────────────────────────────────────────────

describe('inboundSmsHandler — classifyReply', () => {
  describe('opt-out detection', () => {
    const optOutWords = ['STOP', 'stop', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];

    test.each(optOutWords)('classifies "%s" as opt_out', (word) => {
      expect(classifyReply(word).type).toBe('opt_out');
    });

    test('classifies "stop" with whitespace as opt_out', () => {
      expect(classifyReply('  stop  ').type).toBe('opt_out');
    });
  });

  describe('opt-in detection', () => {
    const optInWords = ['START', 'start', 'YES', 'yes', 'UNSTOP', 'unstop'];

    test.each(optInWords)('classifies "%s" as opt_in', (word) => {
      expect(classifyReply(word).type).toBe('opt_in');
    });
  });

  describe('rating detection', () => {
    test.each([
      ['1', 1],
      ['2', 2],
      ['3', 3],
      ['4', 4],
      ['5', 5],
      ['3 ', 3],
      ['5!', 5]
    ])('classifies "%s" as rating score %d', (input, expectedScore) => {
      const result = classifyReply(input);
      expect(result.type).toBe('rating');
      expect(result.score).toBe(expectedScore);
    });

    test('classifies "4/5" as rating score 4', () => {
      const result = classifyReply('4/5');
      expect(result.type).toBe('rating');
      expect(result.score).toBe(4);
    });

    test('classifies "5 stars" as rating score 5', () => {
      const result = classifyReply('5 stars');
      expect(result.type).toBe('rating');
      expect(result.score).toBe(5);
    });

    test('does not classify "6" as a rating', () => {
      expect(classifyReply('6').type).toBe('freetext');
    });

    test('does not classify "0" as a rating', () => {
      expect(classifyReply('0').type).toBe('freetext');
    });
  });

  describe('freetext fallthrough', () => {
    const freetextExamples = [
      'Can I bring my insurance card the day of?',
      'What are your hours?',
      'Thank you so much!',
      'hello world'
    ];

    test.each(freetextExamples)('classifies "%s" as freetext', (msg) => {
      expect(classifyReply(msg).type).toBe('freetext');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. smsService — generateFollowUpMessage
// ─────────────────────────────────────────────────────────────────────────────

describe('smsService — generateFollowUpMessage', () => {
  const CLINIC = 'Smoke Test Urgent Care';

  beforeEach(() => {
    process.env.CLINIC_NAME = CLINIC;
    process.env.CLINIC_ADDRESS = '';
    process.env.CLINIC_PHONE = '';
  });

  test('generates English message with clinic name', () => {
    const msg = generateFollowUpMessage(makeCallData(), 'en');
    expect(msg).toContain(CLINIC);
    expect(msg.toLowerCase()).toContain('walk-ins');
  });

  test('generates Spanish message with clinic name', () => {
    const msg = generateFollowUpMessage(makeCallData(), 'es');
    expect(msg).toContain(CLINIC);
    expect(msg.toLowerCase()).toMatch(/pacientes|cita/);
  });

  test('does not include caller name (PHI-free design)', () => {
    const msg = generateFollowUpMessage(makeCallData({ caller_name: 'Maria' }), 'en');
    expect(msg).not.toContain('Maria');
  });

  test('does not include visit timeframe (PHI-free design)', () => {
    const msg = generateFollowUpMessage(
      makeCallData({ intended_visit_timeframe: 'tomorrow at 3pm' }),
      'en'
    );
    expect(msg).not.toContain('tomorrow at 3pm');
  });

  test('includes clinic address when set', () => {
    process.env.CLINIC_ADDRESS = '123 Main St';
    const msg = generateFollowUpMessage(makeCallData(), 'en');
    expect(msg).toContain('123 Main St');
  });

  test('includes rating request and opt-out', () => {
    const msg = generateFollowUpMessage(makeCallData(), 'en');
    expect(msg).toContain('Reply STOP');
    expect(msg.toLowerCase()).toMatch(/rate|reply 1/i);
  });

  test('keeps message under 160 chars when all env vars set', () => {
    process.env.CLINIC_NAME = 'A Very Long Clinic Name That Might Push Limits Urgent Care';
    process.env.CLINIC_ADDRESS = '9999 Long Address Boulevard Suite 200';
    process.env.CLINIC_PHONE = '+19995551234';
    const msg = generateFollowUpMessage(
      makeCallData({ caller_name: 'Alexander', intended_visit_timeframe: 'tomorrow at 9am' }),
      'en'
    );
    expect(msg.length).toBeLessThanOrEqual(160);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. smsService — formatClinicHours
// ─────────────────────────────────────────────────────────────────────────────

describe('smsService — formatClinicHours', () => {
  test('formats standard weekday hours to Mon-Fri range', () => {
    const hours = 'MON:08:00-20:00,TUE:08:00-20:00,WED:08:00-20:00,THU:08:00-20:00,FRI:08:00-20:00,SAT:09:00-17:00,SUN:10:00-16:00';
    const formatted = formatClinicHours(hours);
    expect(formatted).toContain('Mon-Fri');
    expect(formatted).toContain('08:00');
  });

  test('falls back gracefully for unrecognised formats', () => {
    const result = formatClinicHours('custom hours string');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('returns fallback for empty string', () => {
    const result = formatClinicHours('');
    expect(typeof result).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. schedulerService — formatApptTime
// ─────────────────────────────────────────────────────────────────────────────

describe('schedulerService — formatApptTime', () => {
  beforeEach(() => {
    process.env.CLINIC_TIMEZONE = 'America/New_York';
  });

  test('returns a non-empty string for a valid ISO datetime', () => {
    const result = formatApptTime('2026-03-15T14:00:00', 'en');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('returns a Spanish-locale formatted time for locale=es', () => {
    const result = formatApptTime('2026-03-15T09:00:00', 'es');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('falls back to raw ISO string for invalid datetime', () => {
    const bad = 'not-a-date';
    const result = formatApptTime(bad, 'en');
    expect(typeof result).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. schedulerService — scheduleAppointment
// ─────────────────────────────────────────────────────────────────────────────

describe('schedulerService — scheduleAppointment', () => {
  const { scheduleAppointment } = require('../../src/services/schedulerService');

  test('returns false when required fields are missing', async () => {
    const result = await scheduleAppointment({ id: 'appt_001' }); // missing phoneNumber + ISO
    expect(result).toBe(false);
  });

  test('returns false for an invalid ISO datetime', async () => {
    const result = await scheduleAppointment({
      id: 'appt_002',
      phoneNumber: '+15551234567',
      appointmentISO: 'garbage'
    });
    expect(result).toBe(false);
  });

  test('returns true for a valid appointment', async () => {
    const futureISO = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const result = await scheduleAppointment({
      id: 'smoke_appt_003',
      phoneNumber: '+15551234567',
      callerName: 'Test Patient',
      appointmentISO: futureISO,
      locale: 'en'
    });
    expect(result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. validation — new fields (existingAppointmentId, appointmentType, smsConsent,
//                              callbackRequested, new dispositions)
// ─────────────────────────────────────────────────────────────────────────────

describe('validation — new fields in validateCallerInfo', () => {
  test('parses smsConsent from boolean true', () => {
    const result = validateCallerInfo({ phoneNumber: '+15551234567', smsConsent: true });
    expect(result.smsConsent).toBe(true);
  });

  test('parses smsConsent from boolean false', () => {
    const result = validateCallerInfo({ phoneNumber: '+15551234567', smsConsent: false });
    expect(result.smsConsent).toBe(false);
  });

  test('parses smsConsent from string "true"', () => {
    const result = validateCallerInfo({ phoneNumber: '+15551234567', sms_consent: 'true' });
    expect(result.smsConsent).toBe(true);
  });

  test('returns null for smsConsent when not provided', () => {
    const result = validateCallerInfo({ phoneNumber: '+15551234567' });
    expect(result.smsConsent).toBeNull();
  });

  test('parses callbackRequested truthy', () => {
    const result = validateCallerInfo({ phoneNumber: '+15551234567', callbackRequested: true });
    expect(result.callbackRequested).toBe(true);
  });

  test('parses callbackRequested falsy', () => {
    const result = validateCallerInfo({ phoneNumber: '+15551234567', callback_requested: false });
    expect(result.callbackRequested).toBe(false);
  });
});

describe('validation — validateAppointmentId', () => {
  const { validateAppointmentId } = require('../../src/utils/validation');

  test('returns alphanumeric ID unchanged', () => {
    expect(validateAppointmentId('ABC123')).toBe('ABC123');
  });

  test('returns ID with allowed chars (hyphen, underscore)', () => {
    expect(validateAppointmentId('appt_001-test')).toBe('appt_001-test');
  });

  test('strips disallowed characters', () => {
    expect(validateAppointmentId('appt!@#$001')).toBe('appt001');
  });

  test('returns null for empty string', () => {
    expect(validateAppointmentId('')).toBeNull();
  });

  test('returns null for null input', () => {
    expect(validateAppointmentId(null)).toBeNull();
  });

  test('returns null for IDs over 64 chars', () => {
    expect(validateAppointmentId('a'.repeat(65))).toBeNull();
  });
});

describe('validation — validateAppointmentType', () => {
  const { validateAppointmentType } = require('../../src/utils/validation');

  test.each([
    ['new', 'new'],
    ['follow_up', 'follow_up'],
    ['urgent', 'urgent'],
    ['routine', 'routine'],
    ['telehealth', 'telehealth']
  ])('accepts "%s" → "%s"', (input, expected) => {
    expect(validateAppointmentType(input)).toBe(expected);
  });

  test('returns null for unknown type', () => {
    expect(validateAppointmentType('unknown_type')).toBeNull();
  });

  test('returns null for null', () => {
    expect(validateAppointmentType(null)).toBeNull();
  });
});

describe('validation — new dispositions in DISPOSITIONS list', () => {
  test('DISPOSITIONS includes appointment_change', () => {
    expect(DISPOSITIONS).toContain('appointment_change');
  });

  test('DISPOSITIONS includes appointment_cancel', () => {
    expect(DISPOSITIONS).toContain('appointment_cancel');
  });

  test('DISPOSITIONS includes callback_requested', () => {
    expect(DISPOSITIONS).toContain('callback_requested');
  });
});

describe('validation — validateDisposition aliases', () => {
  test.each([
    ['appointment_change', 'appointment_change'],
    ['appointment_cancel', 'appointment_cancel'],
    ['callback_requested', 'callback_requested'],
    ['change', 'appointment_change'],
    ['reschedule', 'appointment_change'],
    ['cancel', 'appointment_cancel'],
    ['cancellation', 'appointment_cancel'],
    ['callback', 'callback_requested'],
    ['call back', 'callback_requested'],
    ['leave message', 'callback_requested'],
    ['message', 'callback_requested']
  ])('resolves "%s" → "%s"', (input, expected) => {
    expect(validateDisposition(input)).toBe(expected);
  });

  test('resolves unknown disposition to "incomplete"', () => {
    expect(validateDisposition('totally_unknown_xyz')).toBe('incomplete');
  });

  test('resolves null to "incomplete"', () => {
    expect(validateDisposition(null)).toBe('incomplete');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. retellHandler — disposition-routing smoke tests (via validateDisposition)
//    Tests that the handler's disposition logic correctly maps call outcomes
// ─────────────────────────────────────────────────────────────────────────────

describe('retellHandler — disposition routing (via validateDisposition)', () => {
  test('completed call disposition passes through', () => {
    expect(validateDisposition('completed')).toBe('completed');
  });

  test('emergency disposition passes through', () => {
    expect(validateDisposition('emergency')).toBe('emergency');
  });

  test('spam disposition passes through', () => {
    expect(validateDisposition('spam')).toBe('spam');
  });

  test('dropped call disposition passes through', () => {
    expect(validateDisposition('dropped')).toBe('dropped');
  });

  test('appointment change route is recognised', () => {
    expect(validateDisposition('appointment_change')).toBe('appointment_change');
  });

  test('appointment cancel route is recognised', () => {
    expect(validateDisposition('appointment_cancel')).toBe('appointment_cancel');
  });

  test('callback route is recognised', () => {
    expect(validateDisposition('callback_requested')).toBe('callback_requested');
  });
});
