# Deployment Guide — Receptionist Agent V1

**Last updated:** 3/5/2026
**Scope:** Delivery 1 — Railway deployment, mock SMS, Google Calendar live, Keragon live
**SMS (Notifyre):** Held for Delivery 2

---

## 1. Live System Info

| Item | Value |
|------|-------|
| **Railway project** | `b26e09c6-481c-4ad5-b619-518f91c45001` |
| **Railway app URL** | *(Arthur fills in once Railway deploy is complete — e.g. `https://receptionist-agent-v1.up.railway.app`)* |
| **RetellAI agent ID** | `agent_40a6d657cddce372dbbae945e8` |
| **RetellAI LLM ID** | `llm_eb106b7398e0387b36ba8626a62a` |
| **Keragon W1 (calls)** | `https://webhooks.us-1.keragon.com/v1/workflows/9f74dcab-6aa2-4615-8798-9a2b41290f7d/rBWs2NzSWYKwNDjU4h0Xb/signal` |
| **Keragon W2 (emergency)** | `https://webhooks.us-1.keragon.com/v1/workflows/9e1230aa-8f16-472b-8f1c-802d630c6870/MAWIR-EoI_dtStyx90d_D/signal` |
| **Keragon W3 (SMS events)** | `https://webhooks.us-1.keragon.com/v1/workflows/0fa3ed22-7187-470e-a3ee-db67d0ff0ec9/QDUbX18unW6JbTta1HD8U/signal` |
| **Keragon W4 (edge cases)** | `https://webhooks.us-1.keragon.com/v1/workflows/2760c73d-8d0f-4a70-a243-0e6cf2195b89/M0QohyDG1wOGlbj3dhDqR/signal` |

---

## 2. Pre-Flight Checklist (Delivery 1)

Work through these before going live. Each row tells you where to get the credential and what env var it maps to.

| # | Credential | Where to get it | Env var(s) | Status |
|---|-----------|----------------|------------|--------|
| 1 | RetellAI API key | [app.retellai.com](https://app.retellai.com) → Settings → API Keys | `RETELL_API_KEY` | ☐ |
| 2 | RetellAI webhook secret | RetellAI dashboard → Agent → Webhook → Signing Secret | `RETELL_WEBHOOK_SECRET` | ☐ |
| 3 | RetellAI agent ID | Already set: `agent_40a6d657cddce372dbbae945e8` | `RETELL_AGENT_ID` | ✅ |
| 4 | Google service account JSON | GCP Console → IAM → Service Accounts → [account] → Keys → Add Key → JSON | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | ✅ |
| 5 | Google Calendar ID | Google Calendar → Settings → [calendar] → Calendar ID | `GOOGLE_CALENDAR_ID` | ✅ |
| 6 | Calendar permission | Share calendar with service account email → "Make changes to events" | — | ☐ |
| 7 | Staff alert phone | Arthur provides clinic ops number (E.164 format: +12125550100) | `STAFF_ALERT_PHONE` | ☐ |
| 8 | Clinic info | Arthur provides | `CLINIC_NAME`, `CLINIC_ADDRESS`, `CLINIC_HOURS`, `CLINIC_TIMEZONE` | ☐ |
| 9 | Keragon URLs | Already configured in `.env.example` | `KERAGON_WEBHOOK_URL` + 3 others | ✅ |
| 10 | SendGrid API key | Arthur provides → enter in Keragon W1, W3, W4 email steps | *(Keragon dashboard only)* | ☐ |
| 11 | **SMS (Notifyre)** | **Held — Delivery 2** | `SMS_ENABLED=false` for D1 | ⏳ |

> **RetellAI prompt:** The prompt still has `[CLINIC_NAME]` and `[CLINIC_HOURS]` placeholders. Replace these with real values in the RetellAI dashboard (Agent → Prompt) before going live.

---

## 3. Step-by-Step Go-Live (Delivery 1)

### Step 1 — Google Calendar

1. Create a Google Cloud project (or use existing) → enable the Google Calendar API
2. Create a service account → download the JSON key file
3. From the JSON, extract:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (the full `-----BEGIN PRIVATE KEY-----...` block)
4. In Google Calendar: open the clinic's calendar → Settings → Share → add the service account email → permission: "Make changes to events"
5. Copy the Calendar ID from Settings → Calendar ID

### Step 2 — Clinic Environment Variables

Prepare these values (Arthur provides):
```
CLINIC_NAME="[Real clinic name]"
CLINIC_ADDRESS="[Real clinic address]"
CLINIC_HOURS="MON:08:00-20:00,TUE:08:00-20:00,WED:08:00-20:00,THU:08:00-20:00,FRI:08:00-20:00,SAT:09:00-17:00,SUN:10:00-16:00"
CLINIC_TIMEZONE=America/New_York
STAFF_ALERT_PHONE=+1XXXXXXXXXX
```

### Step 3 — Set All Env Vars on Railway

1. Open Railway dashboard → project `b26e09c6-481c-4ad5-b619-518f91c45001`
2. Click the service → **Variables** tab
3. Add each variable from the list below. Use the exact names — no spaces.

**Required for Delivery 1:**
```
NODE_ENV=production
PORT=3000
MOCK_MODE=true
SMS_ENABLED=false
SCHEDULER_ENABLED=true
PHI_RETENTION_DAYS=7
LOG_LEVEL=info

RETELL_API_KEY=...
RETELL_AGENT_ID=agent_40a6d657cddce372dbbae945e8
RETELL_WEBHOOK_SECRET=...

GOOGLE_CALENDAR_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

KERAGON_WEBHOOK_URL=https://webhooks.us-1.keragon.com/v1/workflows/9f74dcab-6aa2-4615-8798-9a2b41290f7d/rBWs2NzSWYKwNDjU4h0Xb/signal
KERAGON_EMERGENCY_WEBHOOK_URL=https://webhooks.us-1.keragon.com/v1/workflows/9e1230aa-8f16-472b-8f1c-802d630c6870/MAWIR-EoI_dtStyx90d_D/signal
KERAGON_SMS_WEBHOOK_URL=https://webhooks.us-1.keragon.com/v1/workflows/0fa3ed22-7187-470e-a3ee-db67d0ff0ec9/QDUbX18unW6JbTta1HD8U/signal
KERAGON_EDGE_WEBHOOK_URL=https://webhooks.us-1.keragon.com/v1/workflows/2760c73d-8d0f-4a70-a243-0e6cf2195b89/M0QohyDG1wOGlbj3dhDqR/signal

CLINIC_NAME="Your Urgent Care"
CLINIC_ADDRESS="123 Main St, City, State ZIP"
CLINIC_HOURS="MON:08:00-20:00,TUE:08:00-20:00,..."
CLINIC_TIMEZONE=America/New_York
STAFF_ALERT_PHONE=+1XXXXXXXXXX

SPAM_SILENCE_THRESHOLD_MS=3000
SPAM_KEYWORD_MATCH_THRESHOLD=2
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

> **GOOGLE_PRIVATE_KEY formatting:** Railway requires the value on one line. Use literal `\n` (backslash-n) for newlines — do NOT paste actual line breaks. The key should start with `-----BEGIN PRIVATE KEY-----\n` and end with `\n-----END PRIVATE KEY-----`.

### Step 4 — Deploy on Railway

Railway auto-deploys from the connected git branch. To trigger a manual deploy:
1. Railway dashboard → service → **Deploy** tab → click **Deploy Now**
2. Watch the build log — look for `Server running on port 3000` and `Scheduler started`

### Step 5 — Get the Railway App URL

Once deployed, Railway will assign a URL (e.g. `https://receptionist-agent-v1.up.railway.app`).
Copy this URL — you'll need it for Step 6.

Also set it as an env var and redeploy:
```
APP_BASE_URL=https://[your-railway-url].up.railway.app
```

### Step 6 — Update RetellAI Webhook URL

In RetellAI dashboard → Agent → Webhook:
```
URL: https://[your-railway-url].up.railway.app/webhook/retell
```

Save. RetellAI will now POST call events to your live server.

### Step 7 — Update RetellAI Prompt Placeholders

In RetellAI dashboard → Agent → [your agent] → Prompt:
1. Replace all instances of `[CLINIC_NAME]` with the real clinic name
2. Replace `[CLINIC_HOURS]` with the real hours (e.g. "Monday through Friday, 8 AM to 8 PM; Saturday 9 AM to 5 PM; Sunday 10 AM to 4 PM")
3. Save the prompt

### Step 8 — Fix Pause Before Speaking

In RetellAI dashboard → Agent → Speech Settings → Welcome Message:
- **Pause Before Speaking:** change from `0s` to `1.0s`

This fixes the glitchy/cut-off first sentence on pickup.

### Step 9 — Set SendGrid API Key in Keragon

For staff email alerts (low ratings, SMS failures):
1. Open [app.keragon.com](https://app.keragon.com) → each workflow (W1, W3, W4)
2. Find the SendGrid email step → enter Arthur's SendGrid API key and verified sender email
3. Save each workflow

### Step 10 — Run Verification Tests

See Section 4 below. Make a real test call from Arthur's personal phone.

---

## 4. Verification Tests

Run these after deployment to confirm everything is wired correctly.

### Health check
```bash
curl https://[your-railway-url].up.railway.app/health
# Expected: {"status":"healthy",...}

curl https://[your-railway-url].up.railway.app/health/detailed
# Expected: all checks healthy
```

### RetellAI agent reachable
```bash
curl -s -H "Authorization: Bearer $RETELL_API_KEY" \
  "https://api.retellai.com/get-agent/agent_40a6d657cddce372dbbae945e8" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('Agent:', d.get('agent_name'), '| OK')"
# Expected: Agent: [name] | OK
```

### Keragon W1 pingable
```bash
curl -s -X POST \
  "https://webhooks.us-1.keragon.com/v1/workflows/9f74dcab-6aa2-4615-8798-9a2b41290f7d/rBWs2NzSWYKwNDjU4h0Xb/signal" \
  -H "Content-Type: application/json" \
  -d '{"event":"test_ping","source":"deployment_check"}'
# Expected: HTTP 200. Check Keragon W1 → Runs for new entry.
```

### Google Calendar
1. Make a test call through the RetellAI web test tool → provide a visit timeframe and DOB
2. Check the clinic's Google Calendar — a 1-hour event should appear within 30 seconds
3. Event description should include DOB and reason for visit

### Webhook signature validation
```bash
# Send test webhook with invalid signature — should be rejected
curl -s -X POST https://[your-railway-url].up.railway.app/webhook/retell \
  -H "Content-Type: application/json" \
  -H "X-Retell-Signature: invalid" \
  -d '{"event_type":"test"}' \
  -o /dev/null -w "%{http_code}"
# Expected: 401 or 403
```

### Full end-to-end test call
1. Call the RetellAI phone number from Arthur's personal mobile
2. Complete the intake: name, date of birth, reason, visit timeframe, SMS consent
3. After the call ends, verify:
   - Keragon W1 → Runs → new entry with call data
   - Google Calendar → new 1-hour event with name, DOB, reason
   - Railway logs → no ERROR lines (`railway logs --tail`)

---

## 5. Switching to Live SMS (Delivery 2 — Notifyre)

When Notifyre is configured and tested:

1. Replace Twilio stub in `src/config/smsProvider.js` with Notifyre SDK/API calls
2. Add Notifyre credentials to Railway env vars
3. Configure Notifyre inbound SMS webhook → `POST https://[app-url]/webhook/sms/inbound`
4. Update env vars:
```env
MOCK_MODE=false
SMS_ENABLED=true
SMS_FROM_NUMBER=+[notifyre-number]
```
5. Redeploy on Railway
6. Make a test SMS send + receive to confirm delivery

---

## 6. How to Disable / Roll Back

### Full shutdown (emergency)

Railway CLI:
```bash
railway down
```
Or in Railway dashboard → service → **Settings** → remove/stop service.

### Disable inbound calls only (keep server running)

In RetellAI dashboard → Agent → set status to **Inactive** or remove the phone number assignment.
Webhook server stays running — Keragon and Calendar automation unaffected.

### Disable SMS only
```env
SMS_ENABLED=false
```
Redeploy. Calls still handled and logged.

### Disable scheduler / reminders
```env
SCHEDULER_ENABLED=false
```
Redeploy. No reminder SMS or PHI deletion cron.

### Disable Google Calendar only
```env
GOOGLE_CALENDAR_ID=
```
Redeploy. Calendar events silently skipped — call flow unaffected.

### Roll back to previous deploy

Railway dashboard → service → **Deployments** tab → click any previous deployment → **Rollback**.

### Emergency credential rotation

1. Rotate key in the provider dashboard (RetellAI / Notifyre / Keragon)
2. Update the env var in Railway → Variables tab (Railway auto-redeploys on save)
3. Verify health endpoint returns healthy after redeploy

---

## 7. Railway-Specific Notes

### Logs
```bash
# Via Railway CLI
railway logs --tail

# Or in Railway dashboard → service → Logs tab
```

### Redis on Railway

Redis is required for appointment scheduling and caching. Add a Redis service in Railway:
1. Railway dashboard → New → Database → Redis
2. Railway auto-sets `REDIS_URL` in your service environment when both services are in the same project

Verify Redis is connected:
```bash
curl https://[your-railway-url].up.railway.app/health/detailed
# Look for "redis": {"status": "healthy"}
```

### Custom domain

Railway dashboard → service → Settings → Custom Domain → add your domain → update DNS CNAME to Railway's provided value.

### Health probes

Railway monitors `/health` automatically. If it returns non-200, Railway restarts the service. The `/health/live` and `/health/ready` endpoints are available for additional probe configuration.

### Environment variable tips

- Variables are set per-service in Railway dashboard → Variables tab
- Railway auto-redeploys the service when variables are changed
- Use Railway CLI locally: `railway run npm start` to run with Railway env vars

---

## 8. Appendix — Local Development

### Local setup

```bash
# Clone and install
git clone https://github.com/yourclinic/receptionist-agent-v1.git
cd receptionist-agent-v1
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start with mock services (no real API calls)
MOCK_MODE=true npm start

# Or with Docker Compose (includes Redis)
docker compose up -d redis
docker compose up -d app

# Health check
curl http://localhost:3000/health
```

### Running tests

```bash
npm run test:unit         # Unit tests (business logic)
npm run test:integration  # API endpoint tests
npm run test:mock         # Full flow with mocks

# All tests (143/143 expected passing)
npm test
```

### Minimal local .env for development

```env
NODE_ENV=development
MOCK_MODE=true
USE_MOCKS=true
SMS_ENABLED=false
LOG_LEVEL=debug
PORT=3000
REDIS_URL=redis://localhost:6379

RETELL_API_KEY=test_key
RETELL_AGENT_ID=agent_40a6d657cddce372dbbae945e8
RETELL_WEBHOOK_SECRET=test_secret
CLINIC_NAME="Test Clinic"
CLINIC_TIMEZONE=America/New_York
```
