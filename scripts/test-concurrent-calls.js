#!/usr/bin/env node

/**
 * Concurrent Call Stress Test
 *
 * Tests whether the Express webhook server can handle multiple simultaneous
 * incoming calls without crashing, dropping requests, or corrupting state.
 *
 * Usage:
 *   1. Start the server:  NODE_ENV=development npm run dev
 *   2. Run this script:   node scripts/test-concurrent-calls.js
 *
 * Options (env vars):
 *   BASE_URL=http://localhost:3000   Target server URL
 *   CONCURRENCY=5                    Number of simultaneous callers in Test 1
 *   VERBOSE=true                     Print full response bodies
 */

require('dotenv').config();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 5;
const VERBOSE = process.env.VERBOSE === 'true';
const WEBHOOK_PATH = '/webhook/retell';

// ─────────────────────────────────────────────
// Payload Builders
// ─────────────────────────────────────────────

function makeCallStartedPayload(callId) {
  return {
    event_type: 'call_started',
    call_id: callId,
    agent_id: 'agent_40a6d657cddce372dbbae945e8',
    call_status: 'ongoing',
    start_timestamp: Date.now(),
    from_number: '+15550001234',
    to_number: '+15559876543'
  };
}

function makeCallEndedPayload(callId) {
  const start = Date.now() - 75000;
  return {
    event_type: 'call_ended',
    call_id: callId,
    agent_id: 'agent_40a6d657cddce372dbbae945e8',
    call_status: 'ended',
    start_timestamp: start,
    end_timestamp: Date.now(),
    from_number: '+15550001234',
    to_number: '+15559876543',
    transcript: 'User: Hi I have a sore throat\nAgent: Thank you for calling. This is Grace with Demo Urgent Care after-hours line.',
    call_analysis: {
      call_summary: 'Caller has a sore throat and would like to schedule a visit for tomorrow morning.',
      user_sentiment: 'neutral',
      agent_sentiment: 'positive'
    },
    retell_llm_dynamic_variables: {
      callerName: 'Test Patient',
      patientDob: '1990-01-15',
      visitTimeframe: 'tomorrow morning',
      reasonForVisit: 'sore throat',
      smsConsent: 'yes'
    }
  };
}

function makeCallAnalyzedPayload(callId) {
  return {
    event_type: 'call_analyzed',
    call_id: callId,
    agent_id: 'agent_40a6d657cddce372dbbae945e8',
    call_status: 'ended',
    call_analysis: {
      call_summary: 'Caller has a sore throat, intake complete.',
      user_sentiment: 'neutral',
      agent_sentiment: 'positive',
      call_successful: true
    }
  };
}

// ─────────────────────────────────────────────
// HTTP Helper
// ─────────────────────────────────────────────

async function post(payload) {
  const t0 = Date.now();
  try {
    const res = await axios.post(`${BASE_URL}${WEBHOOK_PATH}`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    return { ok: true, status: res.status, ms: Date.now() - t0, callId: payload.call_id, event: payload.event_type };
  } catch (err) {
    const status = err.response?.status || 0;
    const msg = err.response?.data || err.message;
    return { ok: false, status, ms: Date.now() - t0, callId: payload.call_id, event: payload.event_type, error: msg };
  }
}

function summarise(results, label) {
  const passed = results.filter(r => r.ok && r.status === 200).length;
  const failed = results.filter(r => !r.ok || r.status !== 200);
  const times = results.map(r => r.ms);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const max = Math.max(...times);

  const icon = passed === results.length ? '✅' : '❌';
  console.log(`\n${icon}  ${label}`);
  console.log(`   ${passed}/${results.length} returned HTTP 200 OK`);
  console.log(`   ⏱  Avg ${avg}ms | Max ${max}ms`);

  if (failed.length > 0) {
    console.log('   Failures:');
    failed.forEach(r => console.log(`     call_id=${r.callId} status=${r.status} error=${JSON.stringify(r.error)}`));
  }

  if (VERBOSE) {
    results.forEach(r => console.log('  ', JSON.stringify(r)));
  }

  return passed === results.length;
}

// ─────────────────────────────────────────────
// Test 1 — N simultaneous calls from different patients
// ─────────────────────────────────────────────

async function test1_concurrentCallers() {
  const callIds = Array.from({ length: CONCURRENCY }, () => `test_concurrent_${uuidv4()}`);
  const requests = callIds.map(id => post(makeCallEndedPayload(id)));

  console.log(`\n--- Test 1: ${CONCURRENCY} simultaneous callers (different call_ids) ---`);
  console.log(`   Simulates ${CONCURRENCY} patients calling at exactly the same time.`);
  console.log('   Firing all requests simultaneously...');

  const results = await Promise.all(requests);
  const ok = summarise(results, `${CONCURRENCY} concurrent callers`);

  console.log(`   ℹ️  Check server logs: should see ${CONCURRENCY} separate call records with no cross-contamination.`);
  return ok;
}

// ─────────────────────────────────────────────
// Test 2 — Duplicate webhooks for same call_id (race condition)
// ─────────────────────────────────────────────

async function test2_duplicateWebhooks() {
  const sharedCallId = `test_race_${uuidv4()}`;
  const requests = Array.from({ length: 3 }, () => post(makeCallEndedPayload(sharedCallId)));

  console.log('\n--- Test 2: 3 duplicate call_ended events for the same call_id ---');
  console.log(`   call_id: ${sharedCallId}`);
  console.log('   Simulates RetellAI resending a webhook (network retry / brief outage).');
  console.log('   Firing 3 identical payloads simultaneously...');

  const results = await Promise.all(requests);
  const ok = summarise(results, '3 duplicate call_ended webhooks');

  console.log(`   ⚠️  Known gap: search server logs for "${sharedCallId}" — likely 3 Keragon posts for 1 call.`);
  console.log('   Idempotency keys are not yet implemented. This is a Delivery 2 hardening item.');
  return ok;
}

// ─────────────────────────────────────────────
// Test 3 — Mixed event types for same call (realistic sequence race)
// ─────────────────────────────────────────────

async function test3_mixedEventRace() {
  const sharedCallId = `test_mixed_${uuidv4()}`;
  const requests = [
    post(makeCallStartedPayload(sharedCallId)),
    post(makeCallEndedPayload(sharedCallId)),
    post(makeCallAnalyzedPayload(sharedCallId))
  ];

  console.log('\n--- Test 3: call_started + call_ended + call_analyzed fired simultaneously ---');
  console.log(`   call_id: ${sharedCallId}`);
  console.log('   Simulates event overlap when RetellAI fires webhooks in rapid succession.');
  console.log('   Firing all 3 event types at once...');

  const results = await Promise.all(requests);
  const ok = summarise(results, 'call_started + call_ended + call_analyzed race');

  console.log('   ℹ️  Check server logs: all 3 events should be processed independently.');
  return ok;
}

// ─────────────────────────────────────────────
// Test 4 — High-concurrency burst (stress mode)
// ─────────────────────────────────────────────

async function test4_highConcurrencyBurst() {
  const n = Math.max(CONCURRENCY * 2, 10);
  const callIds = Array.from({ length: n }, () => `test_burst_${uuidv4()}`);
  const requests = callIds.map(id => post(makeCallEndedPayload(id)));

  console.log(`\n--- Test 4: High-concurrency burst (${n} simultaneous calls) ---`);
  console.log(`   Stress test: ${n} concurrent callers all hitting the server at once.`);
  console.log('   Firing all requests simultaneously...');

  const results = await Promise.all(requests);
  const ok = summarise(results, `${n}-caller burst`);

  const rateLimited = results.filter(r => r.status === 429);
  if (rateLimited.length > 0) {
    console.log(`   ℹ️  ${rateLimited.length} requests were rate-limited (HTTP 429) — expected above 100 req/min from same IP.`);
  }
  return ok;
}

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────

async function checkServerReachable() {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║      Concurrent Call Stress Test             ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\nServer: ${BASE_URL}`);
  console.log(`Concurrency level: ${CONCURRENCY}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

  // Pre-flight: confirm server is up
  const reachable = await checkServerReachable();
  if (!reachable) {
    console.error(`\n❌  Cannot reach ${BASE_URL}/health`);
    console.error('    Make sure the server is running:');
    console.error('      NODE_ENV=development node src/index.js');
    console.error('    Or with nodemon:');
    console.error('      NODE_ENV=development npm run dev');
    process.exit(1);
  }
  console.log(`\n✅  Server is reachable at ${BASE_URL}`);

  const results = {
    t1: await test1_concurrentCallers(),
    t2: await test2_duplicateWebhooks(),
    t3: await test3_mixedEventRace(),
    t4: await test4_highConcurrencyBurst()
  };

  // Summary
  const passing = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  console.log('\n══════════════════════════════════════════════');
  console.log(`RESULT: ${passing}/${total} tests passed`);
  console.log('══════════════════════════════════════════════');

  if (passing === total) {
    console.log('✅  Server handles concurrent calls without crashing.');
    console.log('⚠️  Keragon deduplication gap confirmed (Test 2) — known Delivery 2 item.');
  } else {
    console.log('❌  Some tests failed — see details above.');
    console.log('    Common causes: server not in development mode, rate limiter too strict,');
    console.log('    or unhandled exception in webhook handler.');
  }

  console.log('\nNext steps:');
  console.log('  • Search server logs for duplicate call_ids from Test 2');
  console.log('  • CONCURRENCY=10 node scripts/test-concurrent-calls.js  (increase load)');
  console.log('  • For Delivery 2: add idempotency keys to callLogger.js + smsService.js');

  process.exit(passing === total ? 0 : 1);
}

main().catch(err => {
  console.error('Unhandled error:', err.message);
  process.exit(1);
});
