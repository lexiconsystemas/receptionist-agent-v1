# Platform Setup Guide
# After-Hours AI Receptionist — Urgent Care MVP
#
# Follow this guide IN ORDER when you have account access.
# Estimated time: ~2 hours for all platforms.
# All accounts must be created under Arthur Garnett's credentials (scope §6).
#
# Architecture (updated):
#   RetellAI handles ALL telephony (PSTN, phone number, audio, BAA).
#   SMS (outbound/inbound only) goes through a separate provider (TBD — confirm with Arthur).
#
# Files referenced:
#   config/retell-agent-prompt.md         ← paste into RetellAI
#   config/retell-custom-functions.json   ← paste into RetellAI (5 functions)
#   config/keragon-workflow-specs.md      ← build 4 Keragon workflows
# ─────────────────────────────────────────────────────────────────────────────

---

## Before You Start

You need from Arthur:
- [ ] Clinic name (exact, for SMS messages and agent script)
- [ ] Clinic address (for SMS messages and agent script)
- [ ] Clinic phone number (published, for SMS)
- [ ] Clinic business hours (Mon–Sun open/close times)
- [ ] Clinic timezone (e.g. `America/New_York`)
- [ ] Staff alert email (for Keragon emergency + low-score notifications)
- [ ] SMS provider preference (Twilio recommended — confirm with Arthur)

Fill these into `.env` before you start:
```env
CLINIC_NAME="Arthur's Urgent Care"
CLINIC_ADDRESS="123 Main St, City, State ZIP"
CLINIC_PHONE=+1XXXXXXXXXX
CLINIC_HOURS="MON:08:00-20:00,TUE:08:00-20:00,WED:08:00-20:00,THU:08:00-20:00,FRI:08:00-20:00,SAT:09:00-17:00,SUN:10:00-16:00"
CLINIC_TIMEZONE=America/New_York
```

Also update `config/retell-agent-prompt.md` — replace every `{{PLACEHOLDER}}`:
- `{{CLINIC_NAME}}` → actual clinic name
- `{{CLINIC_ADDRESS}}` → actual address
- `{{CLINIC_PHONE}}` → actual phone
- `{{CLINIC_HOURS}}` → actual hours

---

## PHASE 1 — Start Your Local Server + Tunnel (5 min)

Do this first so you have webhook URLs ready for all platform setup steps.

```bash
# Terminal 1
cd /Users/simonelawson/Documents/GitHub/receptionist-agent-v1
npm run dev

# Terminal 2 — expose to internet
npx ngrok http 3000
```

Copy the ngrok HTTPS URL (e.g. `https://abc123.ngrok.io`).
This is `YOUR_SERVER_URL` for everything below.

Verify server is running:
```bash
curl YOUR_SERVER_URL/health
# Expected: { "status": "ok", ... }
```

---

## PHASE 2 — RetellAI Agent (~45 min)

RetellAI now handles both the AI conversation AND the phone number / PSTN.
No separate telephony account needed.

1. Create account at https://retellai.com under Arthur's email
2. Settings → API Keys → Create → copy to `.env`:
   ```env
   RETELL_API_KEY=...
   ```

3. **Buy a Phone Number inside RetellAI:**
   - Phone Numbers → Buy Number
   - Choose the area code matching the clinic's region
   - Note the number — this is what patients will call

4. **Create Agent:**
   - Agents → Create Agent
   - Name: `After-Hours Receptionist — [Clinic Name]`
   - Voice: Pick a natural-sounding voice (recommendation: `Olivia` or `Aria` from ElevenLabs)
   - Language: English (US) — bilingual is handled in the prompt
   - Response Latency: Low
   - Interruption Sensitivity: Medium

5. **Paste System Prompt:**
   - Open `config/retell-agent-prompt.md`
   - Copy everything below the divider line
   - Paste into the agent's "System Prompt" / "Agent Instructions" field
   - Verify all `{{PLACEHOLDER}}` values have been replaced

6. **Add Custom Functions** (do these one at a time):
   - Open `config/retell-custom-functions.json`
   - For each of the 5 objects in the array, go to Agent → Functions → Add Function
   - Paste the function name, description, and parameters schema
   - Functions to add:
     - `log_call_information`
     - `flag_emergency`
     - `flag_spam`
     - `schedule_soft_appointment`
     - `request_callback`
   - For each function, set the **Webhook URL** to: `YOUR_SERVER_URL/webhook/retell`

7. **Connect Phone Number to Agent:**
   - Agent Settings → Phone Numbers → Assign the number purchased in step 3

8. **Set Post-Call Webhook:**
   - Agent Settings → Post-Call Webhook
   - URL: `YOUR_SERVER_URL/webhook/retell`
   - Method: POST

9. **Copy Agent ID:**
   - From the agent page URL or agent settings
   - Add to `.env`:
     ```env
     RETELL_AGENT_ID=agent_...
     ```

10. **Copy Webhook Secret:**
    - Settings → Webhook → Signing Secret
    - Add to `.env`:
      ```env
      RETELL_WEBHOOK_SECRET=...
      ```

**Test it:**
- Use RetellAI's built-in "Test Call" feature in the dashboard
- Have a full conversation — introduce yourself, give a visit reason and time
- Check your server logs: `npm run dev` should show incoming webhook events

---

## PHASE 3 — SMS Provider (~20 min)

RetellAI does NOT send SMS — you need a separate SMS-only provider.
Twilio is recommended (HIPAA BAA available, Arthur may already have an account).

**Twilio setup:**
1. Create account at https://twilio.com under Arthur's email (or use existing)
2. Console → Account Info → copy to `.env`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   ```
3. Buy a phone number with SMS capability:
   - Phone Numbers → Buy a Number → SMS
   - Copy to `.env`:
     ```env
     SMS_FROM_NUMBER=+1XXXXXXXXXX
     ```
4. Configure inbound SMS webhook on that number:
   - Messaging → Active Numbers → your number
   - A MESSAGE COMES IN → Webhook: `POST YOUR_SERVER_URL/webhook/sms/inbound`
   - Status callback URL: `YOUR_SERVER_URL/webhook/sms/status`

5. Wire Twilio into `src/config/smsProvider.js`:
   - Install SDK: `npm install twilio`
   - Uncomment the Twilio block in `smsProvider.js`

**Test it:**
```bash
curl -X POST YOUR_SERVER_URL/webhook/sms/status \
  -H "Content-Type: application/json" \
  -d '{"MessageSid":"SMtest123","MessageStatus":"delivered","To":"+15551234567"}'
# Expected: 200 OK
```

---

## PHASE 4 — Keragon Workflows (~45 min)

> Full details: `config/keragon-workflow-specs.md`

1. Create account at https://keragon.com under Arthur's email
2. Create Workspace: `receptionist-agent-v1`

3. **Create 4 workflows:**

   **Workflow 1 — Call Log:**
   - Trigger: Webhook (POST)
   - Filter: `event == "call_ended"`
   - Actions: Create record, route on spam/emergency/callback flags
   - Enable 7-day PHI auto-delete on records

   **Workflow 2 — Emergency Alert:**
   - Trigger: Webhook (POST)
   - Filter: `event == "emergency_detected"`
   - Actions: Create record tagged EMERGENCY, send email/SMS alert to staff
   - PHI auto-delete: OFF (emergency records are permanent)

   **Workflow 3 — SMS Events:**
   - Trigger: Webhook (POST)
   - Filter: `event` in `["sms_sent", "patient_rating", "sms_opt_out", "sms_opt_in", "sms_freetext_reply"]`
   - Actions: Route by event type, create staff tasks for low scores + free text
   - TCPA opt-out records: permanent (never delete)

   **Workflow 4 — Edge Cases:**
   - Trigger: Webhook (POST)
   - Filter: `event` in `["sms_failed", "phi_auto_deletion", "call_status_update"]`
   - Actions: Log + create staff tasks for failures; PHI deletion audit = permanent

4. **Copy each workflow's webhook URL:**
   ```env
   KERAGON_WEBHOOK_URL=https://api.keragon.com/webhook/WORKFLOW_1_ID
   KERAGON_EMERGENCY_WEBHOOK_URL=https://api.keragon.com/webhook/WORKFLOW_2_ID
   KERAGON_SMS_WEBHOOK_URL=https://api.keragon.com/webhook/WORKFLOW_3_ID
   KERAGON_EDGE_WEBHOOK_URL=https://api.keragon.com/webhook/WORKFLOW_4_ID
   ```

5. **Test each workflow** by POSTing the sample payloads from `keragon-workflow-specs.md`:
   ```bash
   curl -X POST KERAGON_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"event":"call_ended","call_id":"test_001","timestamp":"2026-03-01T03:00:00Z","caller_id":"+12125550100","call_duration_seconds":90,"disposition":"completed","emergency_trigger":false,"spam_flag":false,"sms_sent":true}'
   ```

---

## PHASE 5 — End-to-End Test (~30 min)

With all platforms connected and server running:

**Test 1 — Normal call:**
1. Call the RetellAI number from your personal phone
2. Complete a full conversation: give name, reason, visit time, say yes to SMS
3. Hang up
4. Check: server logs show `call_ended` event
5. Check: Keragon Workflow 1 shows a new record
6. Check: you received an SMS confirmation on your phone

**Test 2 — Emergency detection:**
1. Call the number
2. Say "I have chest pain and I can't breathe"
3. Verify AI immediately delivers the 911 script and stops asking questions
4. Check: Keragon Workflow 2 shows an emergency record
5. Check: staff alert email/SMS was sent

**Test 3 — Rating flow:**
1. After Test 1 SMS arrives, reply `2`
2. Check: you receive the low-score follow-up message
3. Check: Keragon Workflow 3 shows a `patient_rating` event with `low_score_alert: true`

**Test 4 — Spam:**
1. Call and immediately say "I'm calling about your Google Business listing"
2. Verify AI terminates professionally
3. Check: Keragon shows record with `spam_flag: true`

**Test 5 — Spanish:**
1. Call and speak in Spanish from the start
2. Verify AI switches to Spanish
3. Verify SMS confirmation arrives in Spanish

---

## PHASE 6 — Switch to Production URL

When you're ready to move off ngrok:

1. Deploy to Railway (see `docs/DEPLOYMENT_GUIDE.md`)
2. Get your Railway URL
3. Update ALL webhook URLs in:
   - RetellAI agent post-call webhook + function webhooks
   - Twilio inbound SMS + status callback webhook
4. Re-run end-to-end tests
5. Verify health check: `curl https://your-app.up.railway.app/health`

---

## Final `.env` Checklist

```env
# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
MOCK_MODE=false

# SMS Provider (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
SMS_FROM_NUMBER=

# RetellAI (telephony + voice AI)
RETELL_API_KEY=
RETELL_AGENT_ID=
RETELL_WEBHOOK_SECRET=

# Keragon
KERAGON_WEBHOOK_URL=
KERAGON_EMERGENCY_WEBHOOK_URL=
KERAGON_SMS_WEBHOOK_URL=
KERAGON_EDGE_WEBHOOK_URL=

# Clinic
CLINIC_NAME=
CLINIC_ADDRESS=
CLINIC_PHONE=
CLINIC_HOURS=
CLINIC_TIMEZONE=

# SMS Settings
SMS_ENABLED=true
SMS_FOLLOWUP_DELAY_MINUTES=5
SCHEDULER_ENABLED=true
PHI_RETENTION_DAYS=7

# Security
WEBHOOK_SIGNATURE_SECRET=
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```
