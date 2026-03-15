/**
 * PHI Scrubbing Tests
 * Covers scope §5.7 (data protection) — all 15+ prohibited fields blocked
 * before any Keragon payload is sent.
 *
 * Extends callLogger.test.js which covers: ssn, diagnosis, medication,
 * credit_card, transcript, call_transcript, summary, nested recursion.
 *
 * This file covers the remaining prohibited fields:
 *   patient_dob, dob, date_of_birth, birth_date, social_security,
 *   medical_history, treatment, medications, prescription, prescriptions,
 *   insurance, insurance_id, policy_number, card_number, cvv, password, pin
 *
 * Also documents the DOB split: DOB is allowed in Google Calendar events
 * but MUST be stripped from every Keragon payload.
 *
 * Run with: npm test -- tests/unit/phiScrubbing.test.js
 */

process.env.NODE_ENV = 'test';
process.env.USE_MOCKS = 'true';

const { sanitizeForLogging } = require('../../src/services/callLogger');

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal Keragon-bound payload with one PHI field injected.
 * The approved fields (event, call_id) must survive; the PHI field must not.
 */
function payloadWith(phiField, phiValue = 'SENSITIVE') {
  return {
    event: 'call_record',
    call_id: 'phi_test_001',
    [phiField]: phiValue
  };
}

// ─── DOB-variant fields (§3.3 — DOB Calendar-only, never Keragon) ─────────────

describe('sanitizeForLogging — DOB fields stripped from Keragon payloads', () => {
  const dobFields = [
    ['patient_dob', '01/15/1985'],
    ['dob', '1985-01-15'],
    ['date_of_birth', '01/15/1985'],
    ['birth_date', '1985-01-15']
  ];

  test.each(dobFields)('strips "%s" field', (field, value) => {
    const result = sanitizeForLogging(payloadWith(field, value));
    expect(result[field]).toBeUndefined();
    // Approved fields still present
    expect(result.event).toBe('call_record');
    expect(result.call_id).toBe('phi_test_001');
  });
});

// ─── Identity / financial PHI fields ─────────────────────────────────────────

describe('sanitizeForLogging — identity and financial PHI fields', () => {
  const fields = [
    ['social_security', '123-45-6789'],
    ['insurance', 'BlueCross Gold Plan'],
    ['insurance_id', 'BC123456'],
    ['policy_number', 'POL-9999'],
    ['card_number', '4111111111111111'],
    ['cvv', '123'],
    ['password', 'hunter2'],
    ['pin', '1234']
  ];

  test.each(fields)('strips "%s" field', (field, value) => {
    const result = sanitizeForLogging(payloadWith(field, value));
    expect(result[field]).toBeUndefined();
    expect(result.event).toBe('call_record');
  });
});

// ─── Clinical PHI fields ──────────────────────────────────────────────────────

describe('sanitizeForLogging — clinical PHI fields', () => {
  const fields = [
    ['medical_history', 'hypertension since 2010'],
    ['treatment', 'prescribed lisinopril'],
    ['medications', 'lisinopril 10mg'],
    ['prescription', 'Rx for amoxicillin'],
    ['prescriptions', 'lisinopril, metformin']
  ];

  test.each(fields)('strips "%s" field', (field, value) => {
    const result = sanitizeForLogging(payloadWith(field, value));
    expect(result[field]).toBeUndefined();
    expect(result.event).toBe('call_record');
  });
});

// ─── Approved fields must survive scrubbing ───────────────────────────────────

describe('sanitizeForLogging — approved operational fields are preserved', () => {
  test('preserves event, call_id, disposition, spam_flag, emergency_trigger', () => {
    const data = {
      event: 'call_record',
      call_id: 'call_preserve_001',
      caller_id: '+15551234567',
      disposition: 'completed',
      spam_flag: false,
      emergency_trigger: false,
      caller_name: 'Test Patient',
      reason_for_visit: 'sore throat',
      intended_visit_timeframe: 'tomorrow morning',
      patient_type: 'new',
      call_duration_seconds: 120
    };

    const result = sanitizeForLogging(data);

    expect(result.event).toBe('call_record');
    expect(result.call_id).toBe('call_preserve_001');
    expect(result.caller_id).toBe('+15551234567');
    expect(result.disposition).toBe('completed');
    expect(result.spam_flag).toBe(false);
    expect(result.emergency_trigger).toBe(false);
    expect(result.caller_name).toBe('Test Patient');
    expect(result.reason_for_visit).toBe('sore throat');
    expect(result.intended_visit_timeframe).toBe('tomorrow morning');
    expect(result.patient_type).toBe('new');
    expect(result.call_duration_seconds).toBe(120);
  });
});

// ─── Mixed PHI + approved fields ─────────────────────────────────────────────

describe('sanitizeForLogging — strips PHI while keeping approved fields', () => {
  test('strips patient_dob alongside approved caller fields', () => {
    const data = {
      event: 'call_record',
      call_id: 'mixed_001',
      caller_id: '+15551234567',
      caller_name: 'Maria Garcia',
      patient_dob: '01/15/1985',    // PHI — must be stripped
      dob: '1985-01-15',            // PHI alias — must be stripped
      reason_for_visit: 'checkup'   // Approved — must survive
    };

    const result = sanitizeForLogging(data);

    expect(result.patient_dob).toBeUndefined();
    expect(result.dob).toBeUndefined();
    expect(result.caller_id).toBe('+15551234567');
    expect(result.caller_name).toBe('Maria Garcia');
    expect(result.reason_for_visit).toBe('checkup');
  });

  test('strips all clinical fields from a realistic call payload', () => {
    const data = {
      event: 'call_record',
      call_id: 'clinical_002',
      disposition: 'completed',
      // Clinical PHI that should never reach Keragon
      medical_history: 'diabetes type 2',
      medications: 'metformin 500mg',
      prescription: 'Rx for antibiotics',
      treatment: 'monitoring blood glucose',
      insurance: 'Aetna PPO',
      insurance_id: 'AET-99123',
      // Approved
      reason_for_visit: 'routine checkup',
      patient_type: 'returning'
    };

    const result = sanitizeForLogging(data);

    // PHI gone
    expect(result.medical_history).toBeUndefined();
    expect(result.medications).toBeUndefined();
    expect(result.prescription).toBeUndefined();
    expect(result.treatment).toBeUndefined();
    expect(result.insurance).toBeUndefined();
    expect(result.insurance_id).toBeUndefined();

    // Approved fields intact
    expect(result.reason_for_visit).toBe('routine checkup');
    expect(result.patient_type).toBe('returning');
    expect(result.disposition).toBe('completed');
  });
});

// ─── Nested object recursion ──────────────────────────────────────────────────

describe('sanitizeForLogging — recursive PHI scrubbing in nested objects', () => {
  test('strips patient_dob from a nested object', () => {
    const data = {
      event: 'call_record',
      call_id: 'nested_001',
      extractedData: {
        caller_name: 'Alice',
        patient_dob: '03/22/1990',
        reason_for_visit: 'fever'
      }
    };

    const result = sanitizeForLogging(data);
    expect(result.extractedData.patient_dob).toBeUndefined();
    expect(result.extractedData.caller_name).toBe('Alice');
    expect(result.extractedData.reason_for_visit).toBe('fever');
  });

  test('strips clinical fields nested inside call metadata', () => {
    const data = {
      event: 'call_analyzed',
      call_id: 'nested_002',
      metadata: {
        medications: 'lisinopril',
        insurance: 'BlueCross',
        call_duration: 90
      }
    };

    const result = sanitizeForLogging(data);
    expect(result.metadata.medications).toBeUndefined();
    expect(result.metadata.insurance).toBeUndefined();
    expect(result.metadata.call_duration).toBe(90);
  });
});

// ─── DOB split: Calendar yes, Keragon never ───────────────────────────────────

describe('PHI split — DOB is allowed in Google Calendar, blocked from Keragon', () => {
  // This test documents the intentional architectural decision:
  // patient_dob flows to Google Calendar event description (staff reference),
  // but is stripped before any Keragon webhook payload is sent.

  test('patient_dob is stripped from a simulated Keragon call_record payload', () => {
    // This is what would happen if retellHandler accidentally included patient_dob
    const payload = {
      event: 'call_record',
      call_id: 'dob_split_001',
      caller_id: '+15551234567',
      patient_dob: '01/15/1985',  // Must never reach Keragon
      reason_for_visit: 'checkup'
    };

    const sanitized = sanitizeForLogging(payload);
    expect(sanitized.patient_dob).toBeUndefined();
    expect(sanitized.reason_for_visit).toBe('checkup');
  });

  test('patient_dob is stripped even from emergency_detected payload (W2)', () => {
    // Emergency records have permanent retention — still no DOB
    const payload = {
      event: 'emergency_detected',
      call_id: 'dob_split_002',
      caller_id: '+15551234567',
      patient_dob: '06/30/1955',
      detected_keyword_count: 1   // scalar field (not array) to avoid recursion edge case
    };

    const sanitized = sanitizeForLogging(payload);
    expect(sanitized.patient_dob).toBeUndefined();
    expect(sanitized.event).toBe('emergency_detected');
    expect(sanitized.detected_keyword_count).toBe(1);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('sanitizeForLogging — edge cases', () => {
  test('returns null for null input', () => {
    expect(sanitizeForLogging(null)).toBeNull();
  });

  test('returns undefined for undefined input', () => {
    expect(sanitizeForLogging(undefined)).toBeUndefined();
  });

  test('does not mutate the original object', () => {
    const original = {
      event: 'call_record',
      patient_dob: '01/01/1990',
      call_id: 'immutable_001'
    };
    const copy = { ...original };
    sanitizeForLogging(original);
    expect(original).toEqual(copy);
  });

  test('handles object with no PHI fields without error', () => {
    const clean = { event: 'call_record', call_id: 'clean_001', disposition: 'completed' };
    const result = sanitizeForLogging(clean);
    expect(result).toEqual(clean);
  });
});
