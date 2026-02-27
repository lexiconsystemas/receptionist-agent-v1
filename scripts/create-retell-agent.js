#!/usr/bin/env node
/**
 * create-retell-agent.js
 *
 * Creates the after-hours receptionist LLM + Agent in RetellAI via API.
 * Run once: node scripts/create-retell-agent.js
 *
 * Outputs the agent_id and llm_id — add these to .env
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.RETELL_API_KEY || 'key_688ace1d3244dc30d218d6e586d5';
const BASE_URL = 'api.retellai.com';

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
  .replace(/{{CLINIC_HOURS}}/g, 'Mon-Fri 8am-8pm, Sat 9am-5pm, Sun 10am-4pm')
  .replace(/{{visit_timeframe}}/g, '[visit timeframe]');

// Load custom functions
const customFunctions = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../config/retell-custom-functions.json'),
    'utf8'
  )
);

// Build custom tools in Retell format
const customTools = customFunctions.map(fn => ({
  type: 'custom',
  name: fn.name,
  description: fn.description,
  parameters: fn.parameters,
  speak_during_execution: false,
  speak_after_execution: false,
  url: `https://placeholder.example.com/retell/function/${fn.name}`, // update after deploy
  execution_message_description: `Executing ${fn.name}...`
}));

// Also add built-in end_call tool
const allTools = [
  {
    type: 'end_call',
    name: 'end_call',
    description: 'End the call after the closing statement has been delivered and the caller has confirmed they have no further questions.'
  },
  ...customTools
];

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
  console.log('=== RetellAI Agent Setup ===\n');

  // Step 1: Create LLM with Claude model
  console.log('Step 1: Creating Retell LLM with Claude Sonnet 4.5...');
  const llmPayload = {
    model: 'claude-4.5-sonnet',
    general_prompt: prompt,
    general_tools: allTools,
    begin_message: '',   // Greeting is driven by the prompt steps, not a fixed begin_message
    start_speaker: 'agent',
  };

  const llmRes = await retellRequest('POST', '/create-retell-llm', llmPayload);

  if (llmRes.status !== 201 && llmRes.status !== 200) {
    console.error('❌ Failed to create LLM:', JSON.stringify(llmRes.body, null, 2));
    process.exit(1);
  }

  const llmId = llmRes.body.llm_id;
  console.log(`✅ LLM created (Claude Sonnet 4.5): ${llmId}\n`);

  // Step 2: Create the Agent
  console.log('Step 2: Creating Retell Agent...');
  const agentPayload = {
    agent_name: 'After-Hours Receptionist — MVP',
    response_engine: {
      type: 'retell-llm',
      llm_id: llmId
    },
    voice_id: 'openai-Nova', // OpenAI Nova — professional American female, clean for healthcare
    language: 'en-US',
    ambient_sound: null,         // No background noise — cleaner, more appropriate for medical context
    ambient_sound_volume: 0,
    responsiveness: 1.0,
    interruption_sensitivity: 1.0,
    enable_backchannel: true,
    backchannel_frequency: 0.7,
    reminder_trigger_ms: 10000,
    reminder_max_count: 2,
    normalize_for_speech: true,
    end_call_after_silence_ms: 15000,
    max_call_duration_ms: 1800000, // 30 min max
    enable_voicemail_detection: true,
    voicemail_message: "Hi, you've reached Demo Urgent Care's after-hours AI receptionist. Please call back when you're available, or visit us during business hours. No appointment needed — walk-ins always welcome.",
    post_call_analysis_data: [],

    // HIPAA: Do not store transcripts or recordings on RetellAI's platform.
    // 'basic_attributes_only' = only call metadata (id, duration, timestamps, status) retained.
    // Replaces the deprecated opt_out_sensitive_data_storage boolean (removed Feb 2025).
    data_storage_setting: 'basic_attributes_only',

    // Auto-delete even basic call metadata from RetellAI after 7 days (matches PHI_RETENTION_DAYS).
    data_storage_retention_days: 7,

    // webhook_url omitted — will be set after deploy via update-retell-webhook.js
  };

  const agentRes = await retellRequest('POST', '/create-agent', agentPayload);

  if (agentRes.status !== 201 && agentRes.status !== 200) {
    console.error('❌ Failed to create Agent:', JSON.stringify(agentRes.body, null, 2));
    console.log('\nLLM was created successfully. LLM ID:', llmId);
    console.log('Create agent manually in dashboard using this LLM ID.');
    process.exit(1);
  }

  const agentId = agentRes.body.agent_id;
  console.log(`✅ Agent created: ${agentId}\n`);

  // Step 3: Print results
  console.log('=== ADD THESE TO YOUR .env ===');
  console.log(`RETELL_LLM_ID=${llmId}`);
  console.log(`RETELL_AGENT_ID=${agentId}`);
  console.log('==============================\n');

  console.log('Next steps:');
  console.log('1. Add the values above to your .env file');
  console.log('2. Deploy your webhook server and get a public URL');
  console.log('3. Run: node scripts/update-retell-webhook.js <your-webhook-url>');
  console.log('4. Buy a phone number in RetellAI and assign it to this agent');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
