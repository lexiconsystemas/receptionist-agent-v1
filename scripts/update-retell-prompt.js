#!/usr/bin/env node
/**
 * update-retell-prompt.js
 *
 * Patches the existing RetellAI LLM with the latest prompt from
 * config/retell-agent-prompt.md — without recreating the LLM or agent.
 *
 * Usage:
 *   RETELL_API_KEY=<key> RETELL_LLM_ID=<id> node scripts/update-retell-prompt.js
 *
 * Or if these are already in .env:
 *   node scripts/update-retell-prompt.js
 */

const fs   = require('fs');
const path = require('path');
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

const API_KEY = process.env.RETELL_API_KEY || 'key_688ace1d3244dc30d218d6e586d5';
const LLM_ID  = process.env.RETELL_LLM_ID;
const BASE_URL = 'api.retellai.com';

if (!LLM_ID) {
  console.error('❌ RETELL_LLM_ID is required. Set it in .env or as an environment variable.');
  process.exit(1);
}

// Load and interpolate the agent prompt
let prompt = fs.readFileSync(
  path.join(__dirname, '../config/retell-agent-prompt.md'),
  'utf8'
);

// Strip the file header comments (everything before ## IDENTITY)
const identityIndex = prompt.indexOf('## IDENTITY');
if (identityIndex > -1) {
  prompt = prompt.slice(identityIndex);
}

// Replace placeholders with MVP demo values
prompt = prompt
  .replace(/{{CLINIC_NAME}}/g, 'Demo Urgent Care')
  .replace(/{{CLINIC_ADDRESS}}/g, 'TBD - clinic not yet onboarded')
  .replace(/{{CLINIC_PHONE}}/g, '+10000000000')
  .replace(/{{CLINIC_HOURS}}/g, 'Monday through Friday 8am to 8pm, Saturday 9am to 5pm, and Sunday 10am to 4pm')
  .replace(/{{visit_timeframe}}/g, '[visit timeframe]');

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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log(`=== Updating RetellAI LLM prompt ===`);
  console.log(`LLM ID: ${LLM_ID}\n`);

  const res = await retellRequest('PATCH', `/update-retell-llm/${LLM_ID}`, {
    general_prompt: prompt,
    model: 'claude-4.5-sonnet',
    begin_message: '',        // Always clear — greeting is driven by the prompt, not a hardcoded opener
    start_speaker: 'agent',  // AI speaks first — delivers the greeting immediately on call connect
  });

  if (res.status !== 200) {
    console.error('❌ Failed to update LLM:', JSON.stringify(res.body, null, 2));
    process.exit(1);
  }

  console.log('✅ LLM prompt updated successfully.');
  console.log(`   Model: ${res.body.model || 'claude-4.5-sonnet'}`);
  console.log(`   LLM ID: ${res.body.llm_id || LLM_ID}`);
  console.log('\nThe change is live immediately — no agent restart needed.');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
