#!/usr/bin/env node
/**
 * update-retell-agent.js
 *
 * Patches the existing RetellAI Agent — clears the begin_message so the
 * LLM prompt controls the opening, and applies any other agent-level settings.
 *
 * Usage:
 *   node scripts/update-retell-agent.js
 *
 * Requires RETELL_API_KEY and RETELL_AGENT_ID in .env
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

// Load .env if present
try {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8')
      .split('\n')
      .forEach(line => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length && !process.env[key.trim()]) {
          process.env[key.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
        }
      });
  }
} catch (_) {}

const API_KEY  = process.env.RETELL_API_KEY;
const AGENT_ID = process.env.RETELL_AGENT_ID;
const BASE_URL = 'api.retellai.com';

if (!API_KEY)  { console.error('❌ RETELL_API_KEY missing from .env'); process.exit(1); }
if (!AGENT_ID) { console.error('❌ RETELL_AGENT_ID missing from .env'); process.exit(1); }

function retellRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: BASE_URL,
      path: endpoint,
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log(`=== Updating RetellAI Agent ===`);
  console.log(`Agent ID: ${AGENT_ID}\n`);

  const res = await retellRequest('PATCH', `/update-agent/${AGENT_ID}`, {
    begin_message: '',   // Clear hardcoded opener — let the LLM prompt drive the greeting
    ambient_sound: null,
    ambient_sound_volume: 0,

    // HIPAA note: 'everything_except_pii' retains the transcript for post-call analysis
    // while RetellAI redacts PII from what it stores on their side.
    // Our own schedulerService.js enforces 7-day PHI auto-deletion on our side.
    // RetellAI's own retention is capped at 7 days via data_storage_retention_days below.
    data_storage_setting: 'everything_except_pii',

    // Auto-delete call data from RetellAI after 7 days.
    data_storage_retention_days: 7,

    // Voice: Cartesia Sloane — American female, warm and natural (replaces OpenAI Grace which is flat/monotone)
    voice_id: 'cartesia-Sloane',

    // Voice quality: reduce from default 1.0 to smooth out choppy sentence starts
    // and reduce false interruptions during natural speech pauses.
    responsiveness: 0.9,
    interruption_sensitivity: 0.8,

    // ── Post-Call Analysis ──────────────────────────────────────────────────────
    // Tells RetellAI to extract structured fields from the conversation transcript
    // after each call. Results are returned in `extracted_data` on the call_ended
    // webhook event, and read by retellHandler.js → validation.js → callerInfo.
    post_call_analysis_schema: {
      type: 'object',
      properties: {
        visitTimeframe: {
          type: 'string',
          description: 'When the caller intends to visit or come in. E.g. "today", "tomorrow morning", "within the hour", "this afternoon". Null if no visit was mentioned.'
        },
        appointmentIntent: {
          type: 'string',
          enum: ['new', 'change', 'cancel'],
          description: 'Did the caller want to schedule a new visit, change an existing appointment, or cancel one? Null if not mentioned.'
        },
        callerName: {
          type: 'string',
          description: 'Full name provided by the caller during the conversation.'
        },
        reasonForVisit: {
          type: 'string',
          description: 'Brief, non-diagnostic reason for the visit. Keep general — 2 to 4 words max. E.g. "sore throat", "cut on hand", "fever", "follow-up visit".'
        },
        smsConsent: {
          type: 'boolean',
          description: 'Did the caller explicitly agree to receive a follow-up text message? True only if they said yes to the SMS question.'
        },
        callbackRequested: {
          type: 'boolean',
          description: 'Did the caller ask to leave a message for staff or be called back? True if they agreed to the callback/message flow.'
        }
      }
    }
  });

  if (res.status !== 200) {
    console.error('❌ Failed to update agent:', JSON.stringify(res.body, null, 2));
    process.exit(1);
  }

  console.log('✅ Agent updated successfully.');
  console.log(`   begin_message cleared — LLM prompt now controls the greeting.`);
  console.log(`   ambient_sound: null`);
  console.log(`   data_storage_setting: everything_except_pii (enables post-call analysis; RetellAI redacts PII from stored transcript)`);
  console.log(`   data_storage_retention_days: 7`);
  console.log(`   voice_id: cartesia-Sloane (switched from openai-Grace for warmer, more natural tone)`);
  console.log(`   responsiveness: 0.9 (reduced from 1.0 to fix sentence-start glitch)`);
  console.log(`   interruption_sensitivity: 0.8 (reduced from 1.0 to reduce false interruptions)`);
  console.log(`   post_call_analysis_schema: 6 fields (visitTimeframe, appointmentIntent, callerName, reasonForVisit, smsConsent, callbackRequested)`);
  console.log('\nChanges are live immediately.');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
