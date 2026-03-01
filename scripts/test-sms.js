#!/usr/bin/env node
/**
 * test-sms.js — Quick SMS send test
 *
 * Usage:
 *   node scripts/test-sms.js +1YOURNUMBER
 *
 * Sends a real SMS via Twilio using the credentials in .env.
 * The destination number must be in Twilio Verified Caller IDs (trial accounts).
 */

require('dotenv').config();

const toNumber = process.argv[2];

if (!toNumber) {
  console.error('Usage: node scripts/test-sms.js +1YOURNUMBER');
  process.exit(1);
}

const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.SMS_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.error('Missing Twilio credentials in .env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, SMS_FROM_NUMBER)');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

console.log(`Sending test SMS from ${fromNumber} to ${toNumber}...`);

client.messages
  .create({
    from: fromNumber,
    to: toNumber,
    body: '✅ Receptionist Agent test SMS — SMS integration is working! (Demo Urgent Care)'
  })
  .then(msg => {
    console.log(`✅ Success! Message SID: ${msg.sid}`);
    console.log(`   Status: ${msg.status}`);
    console.log(`   From: ${msg.from} → To: ${msg.to}`);
  })
  .catch(err => {
    console.error('❌ Failed to send SMS:');
    console.error(`   Code: ${err.code}`);
    console.error(`   Message: ${err.message}`);
    if (err.code === 21608) {
      console.error('\n👉 Trial account restriction: this number is not a Verified Caller ID.');
      console.error('   Add it at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
    }
  });
