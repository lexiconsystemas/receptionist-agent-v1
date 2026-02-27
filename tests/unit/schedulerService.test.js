/**
 * Scheduler Service Unit Tests
 * Tests PHI deletion and retention scrub logic in isolation
 *
 * Run with: npm test -- tests/unit/schedulerService.test.js
 */

process.env.NODE_ENV = 'test';
process.env.USE_MOCKS = 'true';

const { MemoryCache } = require('../../src/lib/cache');

// --- Cache singleton override -------------------------------------------
// Replace the shared cache instance before requiring schedulerService so
// all cache operations in the module use our controlled test cache.
const cacheModule = require('../../src/lib/cache');
let testCache;
jest.spyOn(cacheModule, 'getCache').mockImplementation(() => testCache);

const {
  runPhiDeletion,
  runRetentionScrub,
  scheduleAppointment,
  cancelScheduledAppointment
} = require('../../src/services/schedulerService');

const keragonMock = require('../../mocks/keragon.mock');

// -----------------------------------------------------------------------

beforeEach(() => {
  testCache = new MemoryCache();
  keragonMock.clearMockStore();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// runPhiDeletion — existing logic, now with explicit coverage
// ═══════════════════════════════════════════════════════════════════════

describe('runPhiDeletion', () => {
  it('deletes call:log records older than retention window', async () => {
    // Insert a stale call log (8 days ago)
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 8);
    const dateKey = staleDate.toISOString().slice(0, 10);
    const callId  = 'call_stale_001';

    await testCache.set(`call:log:${callId}`, JSON.stringify({ callId, caller_name: 'Jane' }), 999999);
    await testCache.set(`call:index:${dateKey}`, JSON.stringify([callId]), 999999);

    await runPhiDeletion();

    const afterDeletion = await testCache.get(`call:log:${callId}`);
    expect(afterDeletion).toBeNull();
  });

  it('does NOT delete call:log records within retention window', async () => {
    // Insert a fresh call log (today)
    const today   = new Date().toISOString().slice(0, 10);
    const callId  = 'call_fresh_001';

    await testCache.set(`call:log:${callId}`, JSON.stringify({ callId, caller_name: 'John' }), 999999);
    await testCache.set(`call:index:${today}`, JSON.stringify([callId]), 999999);

    await runPhiDeletion();

    // Fresh records should survive the cron
    const afterDeletion = await testCache.get(`call:log:${callId}`);
    // The date-index for today is not touched (only stale dates are swept)
    // The record itself stays because the index was never in the sweep range
    expect(afterDeletion).not.toBeNull();
  });

  it('logs a phi_auto_deletion audit event to Keragon W4', async () => {
    await runPhiDeletion();

    const records = keragonMock.getAllMockRecords();
    const allEvents = [
      ...records.calls,
      ...records.smsLogs,
      ...records.edgeCases,
      ...records.emergencies
    ];
    const auditEvent = allEvents.find(r => r.event === 'phi_auto_deletion');
    expect(auditEvent).toBeDefined();
    expect(auditEvent.retention_days).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// runRetentionScrub — new function
// ═══════════════════════════════════════════════════════════════════════

describe('runRetentionScrub', () => {
  it('returns { scrubbed, errors } object', async () => {
    const result = await runRetentionScrub();
    expect(result).toHaveProperty('scrubbed');
    expect(result).toHaveProperty('errors');
    expect(typeof result.scrubbed).toBe('number');
    expect(typeof result.errors).toBe('number');
  });

  it('deletes sms:freetext:* keys found in MemoryCache', async () => {
    const key = 'sms:freetext:SM_test_001';
    await testCache.set(key, 'Patient said: I need a refill', 999999);

    // Verify key exists before scrub
    const before = await testCache.get(key);
    expect(before).not.toBeNull();

    const result = await runRetentionScrub();

    // Key should be deleted by the scrub
    const after = await testCache.get(key);
    expect(after).toBeNull();
    expect(result.scrubbed).toBeGreaterThanOrEqual(1);
  });

  it('handles multiple sms:freetext:* keys', async () => {
    await testCache.set('sms:freetext:SM001', 'body1', 999999);
    await testCache.set('sms:freetext:SM002', 'body2', 999999);
    await testCache.set('sms:freetext:SM003', 'body3', 999999);
    // Non-freetext keys should NOT be deleted
    await testCache.set('sms:optout:+15551234567', '1', 999999);
    await testCache.set('caller:locale:+15551234567', 'en', 999999);

    const result = await runRetentionScrub();

    expect(result.scrubbed).toBe(3);
    expect(result.errors).toBe(0);

    // Opt-out and locale keys must survive
    const optout = await testCache.get('sms:optout:+15551234567');
    const locale = await testCache.get('caller:locale:+15551234567');
    expect(optout).toBe('1');
    expect(locale).toBe('en');
  });

  it('reports zero scrubbed when no freetext keys present', async () => {
    await testCache.set('sms:optout:+15559999999', '1', 999999);

    const result = await runRetentionScrub();
    expect(result.scrubbed).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('logs a phi_retention_scrub audit event to Keragon W4', async () => {
    await runRetentionScrub();

    const records = keragonMock.getAllMockRecords();
    const allEvents = [
      ...records.calls,
      ...records.smsLogs,
      ...records.edgeCases,
      ...records.emergencies
    ];
    const auditEvent = allEvents.find(r => r.event === 'phi_retention_scrub');
    expect(auditEvent).toBeDefined();
    expect(auditEvent.retention_days).toBeDefined();
    expect(auditEvent).toHaveProperty('freetext_keys_scrubbed');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// scheduleAppointment / cancelScheduledAppointment — regression tests
// ═══════════════════════════════════════════════════════════════════════

describe('scheduleAppointment', () => {
  it('stores appointment in cache with correct key', async () => {
    const appt = {
      id: 'appt_test_001',
      phoneNumber: '+15551234567',
      callerName: 'Maria Garcia',
      appointmentISO: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      locale: 'es'
    };

    const result = await scheduleAppointment(appt);
    expect(result).toBe(true);

    const stored = await testCache.get(`appt:${appt.id}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);
    expect(parsed.phoneNumber).toBe(appt.phoneNumber);
    expect(parsed.locale).toBe('es');
  });

  it('returns false for missing required fields', async () => {
    const result = await scheduleAppointment({ id: 'appt_bad' });
    expect(result).toBe(false);
  });
});

describe('cancelScheduledAppointment', () => {
  it('removes appointment from cache', async () => {
    const appt = {
      id: 'appt_cancel_001',
      phoneNumber: '+15559876543',
      callerName: null,
      appointmentISO: new Date(Date.now() + 86400000).toISOString(),
      locale: 'en'
    };

    await scheduleAppointment(appt);
    await cancelScheduledAppointment(appt.id);

    const stored = await testCache.get(`appt:${appt.id}`);
    expect(stored).toBeNull();
  });
});
