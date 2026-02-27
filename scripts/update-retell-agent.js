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

    // HIPAA: Disable transcript/recording storage on RetellAI's platform.
    // 'basic_attributes_only' stores only call metadata; no transcripts, recordings, or logs.
    data_storage_setting: 'basic_attributes_only',

    // Auto-delete even basic call metadata from RetellAI after 7 days.
    data_storage_retention_days: 7,
  });

  if (res.status !== 200) {
    console.error('❌ Failed to update agent:', JSON.stringify(res.body, null, 2));
    process.exit(1);
  }

  console.log('✅ Agent updated successfully.');
  console.log(`   begin_message cleared — LLM prompt now controls the greeting.`);
  console.log(`   ambient_sound: null`);
  console.log(`   data_storage_setting: basic_attributes_only (no transcripts/recordings stored)`);
  console.log(`   data_storage_retention_days: 7`);
  console.log('\nChanges are live immediately.');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
