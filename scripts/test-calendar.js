#!/usr/bin/env node
/**
 * test-calendar.js
 * Quick smoke-test: creates a real Google Calendar event using the
 * same service path that handleCallAnalyzed uses.
 *
 * Usage:
 *   node scripts/test-calendar.js
 */

require('dotenv').config();

// Force real mode (not mock)
process.env.USE_MOCKS = 'false';
process.env.NODE_ENV  = 'development';

const googleCalendarService = require('../src/services/googleCalendarService');

const testCallLog = {
  call_id:                  'test-call-' + Date.now(),
  caller_name:              'Test Patient',
  caller_id:                '+14041234567',
  reason_for_visit:         'Routine check-up — test event',
  intended_visit_timeframe: 'tomorrow morning',
  patient_dob:              '01/15/1985',
  patient_type:             'new',
  disposition:              'completed',
  spam_flag:                false,
  emergency_trigger:        false,
  timestamp:                new Date().toISOString()
};

async function main() {
  console.log('=== Google Calendar Test ===');
  console.log(`Calendar ID: ${process.env.GOOGLE_CALENDAR_ID}`);
  console.log(`Service account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
  console.log(`Call log:\n${JSON.stringify(testCallLog, null, 2)}\n`);

  if (!googleCalendarService.isConfigured()) {
    console.error('❌ Google Calendar env vars not configured. Check .env.');
    process.exit(1);
  }

  const result = await googleCalendarService.createAppointmentEvent(testCallLog);

  if (result.success) {
    console.log('✅ Calendar event created successfully!');
    console.log(`   Event ID:  ${result.eventId}`);
    console.log(`   Event URL: ${result.htmlLink}`);
  } else {
    console.error('❌ Failed to create event:', result.error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
