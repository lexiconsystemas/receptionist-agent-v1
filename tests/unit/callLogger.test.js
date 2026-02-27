/**
 * Call Logger Unit Tests
 * Tests sanitizeKeragonPayload, getWorkflowKey, and retention stamping
 *
 * Run with: npm test -- tests/unit/callLogger.test.js
 */

process.env.NODE_ENV = 'test';
process.env.USE_MOCKS = 'true';
process.env.PHI_RETENTION_DAYS = '7';

const {
  sanitizeForLogging,
  sanitizeKeragonPayload,
  getWorkflowKey
} = require('../../src/services/callLogger');

// ═══════════════════════════════════════════════════════════════════════
// getWorkflowKey — event → workflow routing
// ═══════════════════════════════════════════════════════════════════════

describe('getWorkflowKey', () => {
  it('maps emergency_detected → W2', () => {
    expect(getWorkflowKey('emergency_detected')).toBe('W2');
  });

  it('maps SMS events → W3', () => {
    const smsEvents = [
      'sms_sent', 'sms_status_update', 'patient_rating',
      'sms_opt_out', 'sms_opt_in', 'sms_freetext_reply'
    ];
    smsEvents.forEach(event => {
      expect(getWorkflowKey(event)).toBe('W3');
    });
  });

  it('maps edge/audit events → W4', () => {
    const edgeEvents = [
      'sms_failed', 'phi_auto_deletion', 'phi_retention_scrub',
      'call_status_update', 'edge_case'
    ];
    edgeEvents.forEach(event => {
      expect(getWorkflowKey(event)).toBe('W4');
    });
  });

  it('maps call events → W1 (default)', () => {
    const callEvents = ['call_started', 'call_ended', 'call_record', 'call_analyzed'];
    callEvents.forEach(event => {
      expect(getWorkflowKey(event)).toBe('W1');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// sanitizeKeragonPayload — per-workflow retention rules
// ═══════════════════════════════════════════════════════════════════════

describe('sanitizeKeragonPayload', () => {
  describe('W1 (call_log)', () => {
    it('anonymizes caller_id to last-4 digits', () => {
      const payload = { caller_id: '+15551234567', caller_name: 'Alice' };
      const result  = sanitizeKeragonPayload(payload, 'W1');
      expect(result.caller_id).toBe('***4567');
    });

    it('handles short caller_id without truncation error', () => {
      const payload = { caller_id: '1234' };
      const result  = sanitizeKeragonPayload(payload, 'W1');
      expect(result.caller_id).toBe('1234'); // too short to anonymize beyond itself
    });

    it('adds retention_scrub_at ~7 days in the future', () => {
      const payload = { caller_id: '+15551234567' };
      const before  = Date.now();
      const result  = sanitizeKeragonPayload(payload, 'W1');
      const after   = Date.now();

      expect(result.retention_scrub_at).toBeDefined();
      const scrubAt = new Date(result.retention_scrub_at).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(scrubAt).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
      expect(scrubAt).toBeLessThanOrEqual(after  + sevenDaysMs + 1000);
    });

    it('adds retention_days field', () => {
      const result = sanitizeKeragonPayload({ caller_id: '+15551234' }, 'W1');
      expect(result.retention_days).toBe(7);
    });

    it('does not modify caller_name or reason_for_visit (stamped only)', () => {
      const payload = {
        caller_id: '+15551234567',
        caller_name: 'Bob Smith',
        reason_for_visit: 'Sore throat'
      };
      const result = sanitizeKeragonPayload(payload, 'W1');
      expect(result.caller_name).toBe('Bob Smith');
      expect(result.reason_for_visit).toBe('Sore throat');
    });
  });

  describe('W2 (emergency_alert)', () => {
    it('does NOT anonymize caller_id', () => {
      const payload = { caller_id: '+15551234567', event: 'emergency_detected' };
      const result  = sanitizeKeragonPayload(payload, 'W2');
      expect(result.caller_id).toBe('+15551234567');
    });

    it('does NOT add retention_scrub_at (permanent retention)', () => {
      const result = sanitizeKeragonPayload({ caller_id: '+15551234567' }, 'W2');
      expect(result.retention_scrub_at).toBeUndefined();
    });
  });

  describe('W3 (sms_events)', () => {
    it('adds retention_scrub_at but does NOT anonymize caller_id', () => {
      const payload = { phone_number: '+15551234567', event: 'patient_rating' };
      const result  = sanitizeKeragonPayload(payload, 'W3');
      expect(result.retention_scrub_at).toBeDefined();
      // W3 has no caller_id to anonymize — phone_number is untouched
      expect(result.phone_number).toBe('+15551234567');
    });
  });

  describe('W4 (edge_cases)', () => {
    it('does NOT add retention_scrub_at (audit records are permanent)', () => {
      const result = sanitizeKeragonPayload({ event: 'phi_auto_deletion' }, 'W4');
      expect(result.retention_scrub_at).toBeUndefined();
    });
  });

  it('does not mutate the original payload object', () => {
    const original = { caller_id: '+15551234567', caller_name: 'Carol' };
    const copy     = { ...original };
    sanitizeKeragonPayload(original, 'W1');
    expect(original).toEqual(copy);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// sanitizeForLogging — existing function, regression coverage
// ═══════════════════════════════════════════════════════════════════════

describe('sanitizeForLogging', () => {
  it('strips prohibited PHI fields', () => {
    const data = {
      event: 'call_record',
      caller_id: '+15551234567',
      ssn: '123-45-6789',
      diagnosis: 'hypertension',
      medication: 'lisinopril',
      credit_card: '4111111111111111'
    };
    const result = sanitizeForLogging(data);
    expect(result.ssn).toBeUndefined();
    expect(result.diagnosis).toBeUndefined();
    expect(result.medication).toBeUndefined();
    expect(result.credit_card).toBeUndefined();
    // Approved fields preserved
    expect(result.caller_id).toBe('+15551234567');
    expect(result.event).toBe('call_record');
  });

  it('handles null/undefined gracefully', () => {
    expect(sanitizeForLogging(null)).toBeNull();
    expect(sanitizeForLogging(undefined)).toBeUndefined();
  });

  it('strips transcript and summary fields from payloads', () => {
    const data = {
      event: 'call_ended',
      callId: 'call_001',
      transcript: 'Hi, I have chest pain...',
      call_transcript: 'Hi, I have chest pain...',
      summary: 'Patient called about chest pain.'
    };
    const result = sanitizeForLogging(data);
    expect(result.transcript).toBeUndefined();
    expect(result.call_transcript).toBeUndefined();
    expect(result.summary).toBeUndefined();
    expect(result.callId).toBe('call_001'); // approved field preserved
  });

  it('recursively sanitizes nested objects', () => {
    const data = {
      event: 'call_record',
      nested: { ssn: '999-99-9999', name: 'Alice' }
    };
    const result = sanitizeForLogging(data);
    expect(result.nested.ssn).toBeUndefined();
    expect(result.nested.name).toBe('Alice');
  });
});
