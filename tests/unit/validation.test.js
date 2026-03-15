/**
 * Validation Utility Tests
 * Covers scope §3.1 (caller info capture), §3.3 (PHI-conscious sanitization),
 * §3.2 (timeframe), and §5.7 (data validation) requirements.
 *
 * Functions under test:
 *   validateName, validatePhoneNumber, validatePatientType,
 *   sanitizeReasonForVisit, validateTimeframe, validateDob,
 *   validateCallRecord, PATIENT_TYPES, DISPOSITIONS
 *
 * Run with: npm test -- tests/unit/validation.test.js
 */

const {
  validateName,
  validatePhoneNumber,
  validatePatientType,
  sanitizeReasonForVisit,
  validateTimeframe,
  validateDob,
  validateCallRecord,
  PATIENT_TYPES,
  DISPOSITIONS
} = require('../../src/utils/validation');

// ─── validateName ─────────────────────────────────────────────────────────────

describe('validateName', () => {
  test('returns null for null input', () => {
    expect(validateName(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(validateName('')).toBeNull();
  });

  test('returns null for single character (too short)', () => {
    expect(validateName('A')).toBeNull();
  });

  test('title-cases a lowercase name', () => {
    expect(validateName('john')).toBe('John');
  });

  test('title-cases a two-word name', () => {
    expect(validateName('jane doe')).toBe('Jane Doe');
  });

  test('strips numeric characters', () => {
    expect(validateName('John123')).toBe('John');
  });

  test('strips special characters except hyphen and apostrophe', () => {
    const result = validateName('John@Smith!');
    // @ and ! are stripped; no space was in the original, so result has no space
    expect(result).not.toBeNull();
    expect(result).not.toContain('@');
    expect(result).not.toContain('!');
  });

  test('preserves hyphens in hyphenated names', () => {
    const result = validateName('mary-jane');
    expect(result).not.toBeNull();
    expect(result).toContain('-');
  });

  test("preserves apostrophes in names like O'Brien", () => {
    const result = validateName("o'brien");
    expect(result).not.toBeNull();
    expect(result).toContain("'");
  });

  test('collapses extra whitespace', () => {
    expect(validateName('  John   Doe  ')).toBe('John Doe');
  });

  test('returns null for string over 100 characters', () => {
    expect(validateName('a'.repeat(101))).toBeNull();
  });

  test('returns non-null for exactly 2 characters', () => {
    expect(validateName('Al')).toBe('Al');
  });

  test('handles ALL CAPS input by converting to title case', () => {
    expect(validateName('MARIA GARCIA')).toBe('Maria Garcia');
  });
});

// ─── validatePhoneNumber ──────────────────────────────────────────────────────

describe('validatePhoneNumber', () => {
  test('returns null for null input', () => {
    expect(validatePhoneNumber(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(validatePhoneNumber('')).toBeNull();
  });

  test('normalizes 10-digit US number to E.164', () => {
    expect(validatePhoneNumber('5551234567')).toBe('+15551234567');
  });

  test('preserves already-E.164 number', () => {
    expect(validatePhoneNumber('+15551234567')).toBe('+15551234567');
  });

  test('strips parentheses and dashes', () => {
    expect(validatePhoneNumber('(555) 123-4567')).toBe('+15551234567');
  });

  test('strips dots from formatted number', () => {
    expect(validatePhoneNumber('555.123.4567')).toBe('+15551234567');
  });

  test('returns null for too-short number', () => {
    expect(validatePhoneNumber('123')).toBeNull();
  });

  test('returns null for non-numeric string', () => {
    expect(validatePhoneNumber('not-a-phone')).toBeNull();
  });

  test('handles international number with + prefix', () => {
    expect(validatePhoneNumber('+441234567890')).toBe('+441234567890');
  });

  test('returns null for number with too many digits (>15)', () => {
    expect(validatePhoneNumber('+1' + '9'.repeat(15))).toBeNull();
  });
});

// ─── validatePatientType ──────────────────────────────────────────────────────

describe('validatePatientType', () => {
  test('returns "new" for "new"', () => {
    expect(validatePatientType('new')).toBe('new');
  });

  test('returns "new" for "new patient"', () => {
    expect(validatePatientType('new patient')).toBe('new');
  });

  test('returns "new" for "first time"', () => {
    expect(validatePatientType('first time')).toBe('new');
  });

  test('returns "new" for "first-time"', () => {
    expect(validatePatientType('first-time')).toBe('new');
  });

  test('returns "returning" for "returning"', () => {
    expect(validatePatientType('returning')).toBe('returning');
  });

  test('returns "returning" for "existing"', () => {
    expect(validatePatientType('existing')).toBe('returning');
  });

  test('returns "returning" for "been before"', () => {
    expect(validatePatientType('been before')).toBe('returning');
  });

  test('returns "returning" for "return"', () => {
    expect(validatePatientType('return')).toBe('returning');
  });

  test('returns "unknown" for unrecognized type', () => {
    expect(validatePatientType('maybe')).toBe('unknown');
  });

  test('returns "unknown" for null', () => {
    expect(validatePatientType(null)).toBe('unknown');
  });

  test('is case-insensitive', () => {
    expect(validatePatientType('NEW')).toBe('new');
    expect(validatePatientType('RETURNING')).toBe('returning');
  });
});

// ─── sanitizeReasonForVisit ───────────────────────────────────────────────────

describe('sanitizeReasonForVisit — §3.3 / §5.7 PHI protection', () => {
  test('returns null for null input', () => {
    expect(sanitizeReasonForVisit(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(sanitizeReasonForVisit('')).toBeNull();
  });

  test('passes through clean reason unchanged', () => {
    const reason = 'sore throat and fever';
    expect(sanitizeReasonForVisit(reason)).toBe(reason);
  });

  test('redacts SSN pattern (XXX-XX-XXXX)', () => {
    const result = sanitizeReasonForVisit('my SSN is 123-45-6789');
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('123-45-6789');
  });

  test('redacts date pattern (MM/DD/YYYY)', () => {
    const result = sanitizeReasonForVisit('born on 01/15/1990');
    expect(result).toContain('[DATE]');
    expect(result).not.toContain('01/15/1990');
  });

  test('redacts 9-digit number', () => {
    const result = sanitizeReasonForVisit('account number 123456789');
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('123456789');
  });

  test('truncates reason over 500 characters', () => {
    const long = 'a '.repeat(300); // 600 chars
    const result = sanitizeReasonForVisit(long);
    expect(result).toBeDefined();
    expect(result.length).toBeLessThanOrEqual(504); // 500 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  test('returns fallback string when more than 2 PHI patterns found', () => {
    // Three SSNs = 3 [REDACTED] markers → fallback
    const input = '123-45-6789, 987-65-4321, 111-22-3333 are my details';
    const result = sanitizeReasonForVisit(input);
    expect(result).toBe('See call transcript for details');
  });

  test('preserves non-PHI numbers (e.g. street address)', () => {
    const result = sanitizeReasonForVisit('I live at 123 Main Street');
    // 3-digit number — not 9 digits, not SSN, not date → should not be redacted
    expect(result).toContain('123');
  });
});

// ─── validateTimeframe — §3.2 soft scheduling ─────────────────────────────────

describe('validateTimeframe', () => {
  test('returns null for null input', () => {
    expect(validateTimeframe(null)).toBeNull();
  });

  test('accepts "today"', () => {
    expect(validateTimeframe('today')).toBe('today');
  });

  test('accepts "tomorrow"', () => {
    expect(validateTimeframe('tomorrow')).toBe('tomorrow');
  });

  test('accepts "tomorrow morning"', () => {
    expect(validateTimeframe('tomorrow morning')).toBe('tomorrow morning');
  });

  test('accepts "tomorrow afternoon"', () => {
    expect(validateTimeframe('tomorrow afternoon')).toBe('tomorrow afternoon');
  });

  test('accepts "asap"', () => {
    expect(validateTimeframe('asap')).toBe('asap');
  });

  test('accepts "as soon as possible"', () => {
    expect(validateTimeframe('as soon as possible')).toBe('as soon as possible');
  });

  test('accepts "this morning"', () => {
    expect(validateTimeframe('this morning')).toBe('this morning');
  });

  test('accepts "in 2 hours"', () => {
    expect(validateTimeframe('in 2 hours')).toBe('in 2 hours');
  });

  test('accepts "in 30 minutes"', () => {
    expect(validateTimeframe('in 30 minutes')).toBe('in 30 minutes');
  });

  test('accepts time range "9am to 10am"', () => {
    expect(validateTimeframe('9am to 10am')).not.toBeNull();
  });

  test('accepts "morning"', () => {
    expect(validateTimeframe('morning')).not.toBeNull();
  });

  test('accepts "this week"', () => {
    expect(validateTimeframe('this week')).not.toBeNull();
  });

  test('returns string (not null) when "hour" appears in unmatched text', () => {
    const result = validateTimeframe('within the next couple of hours');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('returns string when a digit appears in freeform text', () => {
    const result = validateTimeframe('sometime around 3');
    expect(typeof result).toBe('string');
  });

  test('returns null for meaningless text with no time info', () => {
    expect(validateTimeframe('whenever is fine')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(validateTimeframe('')).toBeNull();
  });
});

// ─── validateDob — DOB captured in call, Calendar-only (never Keragon) ────────

describe('validateDob — §3.3 (DOB Calendar-only, not logged to Keragon)', () => {
  test('returns null for null input', () => {
    expect(validateDob(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(validateDob('')).toBeNull();
  });

  test('accepts MM/DD/YYYY and returns as-is (normalized)', () => {
    expect(validateDob('01/15/1985')).toBe('01/15/1985');
  });

  test('accepts YYYY-MM-DD and converts to MM/DD/YYYY', () => {
    expect(validateDob('1985-01-15')).toBe('01/15/1985');
  });

  test('accepts MM-DD-YYYY and converts to MM/DD/YYYY', () => {
    expect(validateDob('01-15-1985')).toBe('01/15/1985');
  });

  test('pads single-digit month and day', () => {
    expect(validateDob('1/5/1990')).toBe('01/05/1990');
  });

  test('returns null for month > 12', () => {
    expect(validateDob('13/01/1990')).toBeNull();
  });

  test('returns null for day > 31', () => {
    expect(validateDob('01/32/1990')).toBeNull();
  });

  test('returns null for year < 1900', () => {
    expect(validateDob('01/01/1800')).toBeNull();
  });

  test('returns null for year > 2100', () => {
    expect(validateDob('01/01/2200')).toBeNull();
  });

  test('returns null for non-date string', () => {
    expect(validateDob('not-a-date')).toBeNull();
  });

  test('returns null for partial date', () => {
    expect(validateDob('01/1985')).toBeNull();
  });
});

// ─── validateCallRecord ───────────────────────────────────────────────────────

describe('validateCallRecord — §5.7 full-record validation', () => {
  test('returns isValid=false when call_id is missing', () => {
    const result = validateCallRecord({ timestamp: new Date().toISOString() });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing call_id');
  });

  test('returns isValid=false when timestamp is missing', () => {
    const result = validateCallRecord({ call_id: 'call_001' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing timestamp');
  });

  test('returns isValid=false when both required fields are missing', () => {
    const result = validateCallRecord({});
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  test('returns isValid=true for minimal valid record', () => {
    const result = validateCallRecord({
      call_id: 'call_001',
      timestamp: new Date().toISOString()
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('normalizes disposition alias in sanitizedRecord', () => {
    const result = validateCallRecord({
      call_id: 'call_001',
      timestamp: new Date().toISOString(),
      disposition: 'complete'
    });
    expect(result.sanitizedRecord.disposition).toBe('completed');
  });

  test('adds warning when disposition is normalized', () => {
    const result = validateCallRecord({
      call_id: 'call_001',
      timestamp: new Date().toISOString(),
      disposition: 'reschedule'
    });
    expect(result.warnings.some(w => w.includes('normalized'))).toBe(true);
  });

  test('does not add disposition warning when disposition is already valid', () => {
    const result = validateCallRecord({
      call_id: 'call_001',
      timestamp: new Date().toISOString(),
      disposition: 'completed'
    });
    expect(result.warnings.filter(w => w.includes('normalized'))).toHaveLength(0);
  });

  test('returns a sanitizedRecord object', () => {
    const result = validateCallRecord({
      call_id: 'call_001',
      timestamp: new Date().toISOString()
    });
    expect(result.sanitizedRecord).toBeDefined();
    expect(result.sanitizedRecord.call_id).toBe('call_001');
  });
});

// ─── Exported constants ───────────────────────────────────────────────────────

describe('PATIENT_TYPES constant', () => {
  test('includes new, returning, unknown', () => {
    expect(PATIENT_TYPES).toContain('new');
    expect(PATIENT_TYPES).toContain('returning');
    expect(PATIENT_TYPES).toContain('unknown');
  });
});

describe('DISPOSITIONS constant — all 9 scope-required outcomes', () => {
  const required = [
    'completed',
    'high_intent',
    'emergency',
    'spam',
    'dropped',
    'incomplete',
    'appointment_change',
    'appointment_cancel',
    'callback_requested'
  ];

  test.each(required)('includes "%s"', (disposition) => {
    expect(DISPOSITIONS).toContain(disposition);
  });
});
