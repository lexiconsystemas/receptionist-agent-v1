# Receptionist Agent V1 — Operations Manual

**Last updated:** 3/5/2026
**Version:** 2.1 — Notifyre replaces SignalWire; SMS mock mode for Delivery 1; DOB capture added; Ambiguous Symptom Protocol

---

## System Overview

### Architecture Components

| Component | Technology | Role |
|-----------|------------|------|
| **Voice + Telephony** | RetellAI (agent: Grace) | STT/TTS, PSTN, multi-call concurrency |
| **SMS** | Notifyre (Delivery 2; mock mode D1) | Inbound/outbound SMS |
| **Automation & Logging** | Keragon (4 live workflows) | Workflow orchestration, staff email alerts |
| **Calendar** | Google Calendar (service account) | Staff-reference scheduling events |
| **Scheduler** | node-cron (in-process) | SMS reminders + PHI auto-deletion |
| **Backend** | Node.js 18 / Express | Webhook handling, business logic |
| **Cache** | Redis (ioredis) | Appointment store, reminder state |

### Service Dependencies

| Service | Criticality | Fallback |
|---------|-------------|----------|
| **RetellAI** | Critical | Mock mode (dev/test only) |
| **Notifyre** | High (Delivery 2) | Mock mode for Delivery 1; SMS_ENABLED=false |
| **Keragon** | High | Errors logged locally; non-fatal |
| **Google Calendar** | Low | Non-fatal; call flow continues without it |
| **Redis** | High | In-memory cache fallback (limited) |

### Keragon Workflows (Live)

| ID | Name | Webhook URL |
|----|------|-------------|
| **W1** | `receptionist_call_log` | `https://webhooks.us-1.keragon.com/v1/workflows/9f74dcab-6aa2-4615-8798-9a2b41290f7d/rBWs2NzSWYKwNDjU4h0Xb/signal` |
| **W2** | `receptionist_emergency_alert` | `https://webhooks.us-1.keragon.com/v1/workflows/9e1230aa-8f16-472b-8f1c-802d630c6870/MAWIR-EoI_dtStyx90d_D/signal` |
| **W3** | `receptionist_sms_events` | `https://webhooks.us-1.keragon.com/v1/workflows/0fa3ed22-7187-470e-a3ee-db67d0ff0ec9/QDUbX18unW6JbTta1HD8U/signal` |
| **W4** | `receptionist_edge_cases` | `https://webhooks.us-1.keragon.com/v1/workflows/2760c73d-8d0f-4a70-a243-0e6cf2195b89/M0QohyDG1wOGlbj3dhDqR/signal` |

---

## Day-to-Day Usage Guide

### What runs automatically (no daily action needed)

Once the server is running and credentials are configured, the following are fully automated:

- **Inbound calls** — RetellAI answers, runs the call flow, fires webhooks to the server
- **Call logging** — Every call logged to Keragon W1 automatically
- **Emergency alerts** — Emergency calls trigger W2 instantly during the call
- **Post-call SMS** — Sent within seconds of call end (consent-gated)
- **Rating SMS** — Fired if patient opts in; low-score follow-up automatic
- **Staff email alerts** — Fired via Keragon W3 (low ratings, freetext replies) and W4 (SMS failures)
- **Appointment reminders** — Day-before and 1-hour-before SMS fire via cron automatically
- **PHI deletion** — Runs at 2:00 AM daily automatically

### What staff need to check each morning

1. **Keragon W1 run history** — Review overnight calls. Look for any `requires_review: true` records.
2. **Keragon W2 run history** — Check for any `emergency_detected` events from overnight.
3. **Keragon W4 run history** — Check for `edge_case` records (appointment changes/cancels, SMS failures).
4. **Google Calendar** — Check for overnight walk-in intent events (1-hour blocks added by the system).
5. **Staff alert SMS** — If `STAFF_ALERT_PHONE` received any appointment cancel/change alerts, action those.
6. **SendGrid email inbox** — Low rating alerts and SMS delivery failure emails from Keragon workflows.

### How to review call logs in Keragon

1. Log in to [app.keragon.com](https://app.keragon.com)
2. Navigate to **Workflows** → `receptionist_call_log` (W1)
3. Click **Runs** tab on the left
4. Each run shows the call payload: caller name, phone, reason, timeframe, disposition, spam flags, SMS status
5. Filter by date range for specific days
6. For emergency events: open **W2** (`receptionist_emergency_alert`) → Runs

### How to access appointment change/cancel alerts

- **SMS:** Check `STAFF_ALERT_PHONE` for messages starting with `[Receptionist Alert]`
- **Keragon:** Open **W4** (`receptionist_edge_cases`) → Runs → look for `edge_case_type: appointment_cancel` or `appointment_change`

---

## Standard Operating Procedures

### SOP-001: System Startup

**Delivery 1 note:** SMS is in mock mode for Delivery 1 (`MOCK_MODE=true`, `SMS_ENABLED=false`). No real SMS will be sent until Notifyre is integrated at Delivery 2.

**Pre-startup checks:**
```bash
# Verify environment variables are set
grep -E "(RETELL_API_KEY|KERAGON_WEBHOOK|GOOGLE_CALENDAR|STAFF_ALERT)" .env

# Check Redis connectivity
redis-cli -h localhost -p 6379 ping

# Confirm SSL certificates (production)
openssl x509 -in /path/to/cert.crt -noout -dates
```

**Start the server:**
```bash
# Docker Compose (recommended)
docker compose up -d redis
docker compose up -d app

# Verify startup
curl http://localhost:3000/health
```

**Post-startup validation:**
```bash
# Full health check
curl http://localhost:3000/health/detailed

# Verify RetellAI agent is reachable
curl -H "Authorization: Bearer $RETELL_API_KEY" \
     https://api.retellai.com/v2/agents/$RETELL_AGENT_ID

# Test webhook endpoints accept requests
curl -X POST http://localhost:3000/webhook/retell \
     -H "Content-Type: application/json" \
     -d '{"event_type":"test"}'
```

**Success criteria:**
- `/health` returns `status: healthy`
- All 3 service checks (server, redis, filesystem) are healthy
- No ERROR lines in recent logs
- Scheduler started (look for "Scheduler started" in logs)

---

### SOP-002: Health Monitoring

**Hourly checks:**
- [ ] `GET /health` — overall status
- [ ] `GET /health/detailed` — per-component status
- [ ] Redis connectivity: `redis-cli ping`
- [ ] Error rate below 1%
- [ ] Response time below 2 seconds

**Daily checks:**
- [ ] Review `docker compose logs app | grep ERROR` for overnight errors
- [ ] Check Keragon W4 for `sms_failed` events
- [ ] Verify PHI deletion cron ran at 2:00 AM (check logs or Keragon W4 `phi_auto_deletion` runs)
- [ ] Confirm appointment reminder SMS sent correctly (check Keragon W3 `sms_sent` runs)
- [ ] Review Google Calendar for overnight booking events

**Health endpoint reference:**
```bash
# Quick status
curl http://localhost:3000/health

# Kubernetes probes
curl http://localhost:3000/health/live    # liveness
curl http://localhost:3000/health/ready   # readiness

# Full component detail
curl http://localhost:3000/health/detailed
```

Expected healthy response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-25T10:00:00.000Z",
  "checks": {
    "server": { "status": "healthy", "uptime": 86400 },
    "redis": { "status": "healthy", "latency": 2 },
    "filesystem": { "status": "healthy" }
  }
}
```

**Checking the scheduler is running:**
```bash
# Look for cron job startup confirmation in logs
docker compose logs app | grep "Scheduler started"
# Should show: reminderInterval, phiDeletion, timezone

# Verify PHI deletion ran this morning
docker compose logs app | grep "PHI auto-deletion job complete"
```

**Checking Keragon workflow health:**
- Open [app.keragon.com](https://app.keragon.com) → Workflows
- Each workflow should show status **Active** (green)
- Click any workflow → Runs → verify recent runs are appearing
- If a workflow shows **Inactive**, re-activate it by clicking the status toggle

---

### SOP-003: Incident Response

**Severity levels:**

| Severity | Definition | Response Time |
|----------|------------|---------------|
| **SEV-0** | Complete outage — no calls answered | 15 minutes |
| **SEV-1** | Calls answered but logging/SMS broken | 1 hour |
| **SEV-2** | Degraded performance or partial feature failure | 4 hours |
| **SEV-3** | Non-critical issues (slow reminders, Keragon delay) | 24 hours |

**Triage steps:**
```bash
# 1. Check overall health
curl http://localhost:3000/health/detailed

# 2. Review recent errors
docker compose logs app --tail=200 | grep -E "(ERROR|WARN)"

# 3. Check if RetellAI is reachable
curl -I https://api.retellai.com

# 4. Check if Keragon webhooks are reachable
curl -X POST $KERAGON_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"event":"ping","test":true}'

# 5. Check SMS provider status (Delivery 2 — Notifyre)
# SMS is in mock mode for Delivery 1; skip this check until Notifyre is configured
```

**Common fixes:**
```bash
# Restart the application
docker compose restart app

# Restart Redis
docker compose restart redis

# Full restart
docker compose down && docker compose up -d

# Roll back to previous version (Kubernetes)
kubectl rollout undo deployment/receptionist-agent -n receptionist-agent
```

**Post-incident:**
- Document what failed and when
- Check Keragon W4 for any `edge_case` records that fired during the outage
- Verify no calls were dropped without logging
- Check if any PHI deletion cron was skipped (if outage was at 2 AM)

---

### SOP-004: Backup & Recovery

**What to back up:**

| Data | Location | Frequency | Why |
|------|----------|-----------|-----|
| Redis data | Docker volume / RDB file | Every 6 hours | Appointment reminders + cache |
| `.env` file | Secure vault (NOT Git) | On every change | All credentials |
| Keragon run history | Keragon cloud | Auto-retained by Keragon | Call logs, audit trail |
| Server logs | Log aggregator | Daily | Debugging, audit |

**Redis backup:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/redis"
mkdir -p $BACKUP_DIR

# Trigger Redis save
docker exec receptionist-redis redis-cli BGSAVE
sleep 10

# Copy dump
docker cp receptionist-redis:/data/dump.rdb $BACKUP_DIR/dump_$DATE.rdb
gzip $BACKUP_DIR/dump_$DATE.rdb

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/dump_$DATE.rdb.gz s3://your-bucket/redis/

echo "Backup complete: dump_$DATE.rdb.gz"
```

**Redis recovery:**
```bash
BACKUP_FILE=$1   # e.g. dump_20260225_020000.rdb.gz

# Stop Redis, restore, restart
docker stop receptionist-redis
gunzip -c $BACKUP_FILE > /tmp/dump.rdb
docker cp /tmp/dump.rdb receptionist-redis:/data/dump.rdb
docker start receptionist-redis
sleep 5
docker exec receptionist-redis redis-cli ping  # should return PONG
```

**Note on call logs:** Keragon stores the primary call log record. Redis only stores appointment reminder state and temporary call cache (deleted after 7 days anyway). Losing Redis does NOT lose call history — Keragon is the system of record.

---

### SOP-005: How to Disable / Shut Down the System

#### Full system shutdown
```bash
docker compose down
```
This stops all call handling, SMS, and cron jobs immediately.

#### Disable inbound calls only (keep server running)
- **RetellAI dashboard** → Your agent → set status to **Inactive** or **remove phone number assignment**
- Callers will hear a "not in service" message or call will not connect
- Webhook server keeps running; existing Keragon/SMS automation unaffected

#### Disable all SMS
```env
# In .env
SMS_ENABLED=false
```
Restart server. No SMS will be sent (calls still handled and logged).

#### Disable appointment reminders + PHI deletion cron
```env
# In .env
SCHEDULER_ENABLED=false
```
Restart server. Cron jobs will not start.

#### Disable Google Calendar only
```env
# In .env — blank out or remove this line
GOOGLE_CALENDAR_ID=
```
Restart server. `isConfigured()` returns false; no calendar events created, no errors.

#### Disable a single Keragon workflow
1. Open [app.keragon.com](https://app.keragon.com) → Workflows
2. Click the workflow to open it
3. Click the **Active** toggle → set to **Inactive**
4. Webhook calls will still arrive but the workflow will not run

#### Emergency credential rotation
If API credentials are compromised:
1. Rotate key in the provider dashboard (RetellAI / Notifyre / Keragon)
2. Update `.env` with new key
3. `docker compose restart app`
4. Verify health endpoint returns healthy

---

### SOP-006: Keragon 7-Day Data Retention

**When:** Monthly check (ongoing). One-time Keragon Runs manual purge at go-live.
**Who:** Arthur Garnett (Keragon workspace owner)
**Why:** Required by scope §5.4/§5.7 — PHI must be purged after 7 days.

> **What the code already handles automatically (no action needed):**
> - Redis call logs (`call:log:*`) and appointment records (`appt:*`) — deleted nightly at 2:00 AM by `runPhiDeletion()`
> - Free-text SMS bodies (`sms:freetext:*`) — stored with a 7-day TTL in Redis; auto-expire without any cron action. Also swept by `runRetentionScrub()` at 2:00 AM as a safety net.
> - Caller locale preferences (`caller:locale:*`) — written with a 7-day TTL; auto-expire.
> - Every Keragon payload is stamped with a `retention_scrub_at` field (ISO timestamp, 7 days from send) so each run in the Keragon Runs tab is self-documenting.
> - W1 payloads: `caller_id` is automatically anonymized to last-4 digits before reaching Keragon (e.g. `***4567`).
> - Audit trail: `phi_auto_deletion` and `phi_retention_scrub` events are logged to Keragon W4 permanently after each nightly run.

#### Arthur's Only Manual Task — Monthly Keragon Runs Purge

Keragon does not have a native auto-delete API, so run records must be manually purged:

1. Log into [app.keragon.com](https://app.keragon.com) as Arthur Garnett.
2. Go to **Runs** in the left sidebar.
3. Filter runs where `Created At` is older than 7 days.
4. Select all filtered runs and delete them.
5. Repeat for all 4 workflows if the Runs view is per-workflow.

> **Do NOT delete** runs from `receptionist_emergency_alert` (W2) — emergency records are permanently retained by design.

#### What Each Workflow's Runs Contain (Keragon Runs Tab)

| Workflow | PHI in runs | Keragon field | Code action | Manual purge after |
|---|---|---|---|---|
| W1 `receptionist_call_log` | `caller_id` (anonymized), `caller_name`, `reason_for_visit` | `retention_scrub_at` stamped | `caller_id` → `***XXXX` | 7 days |
| W2 `receptionist_emergency_alert` | Full emergency record | None | No scrubbing | **Never** |
| W3 `receptionist_sms_events` | `phone_number`, rating, freetext sentinel | `retention_scrub_at` stamped | Raw freetext body stored only in Redis (7-day TTL) | 7 days |
| W4 `receptionist_edge_cases` | Audit events only | None | Permanent | **Never** |

#### TCPA Permanent Records (never purge from W3)
- Runs where `event == "sms_opt_out"` — permanent (legal requirement)
- Runs where `event == "sms_opt_in"` — permanent

---

### SOP-007: RetellAI Data Storage Verification

**When:** At go-live, and after any `scripts/update-retell-agent.js` run.
**Who:** Simone Lawson (developer) or Arthur Garnett (system owner).
**Why:** Confirm `data_storage_setting: basic_attributes_only` is active on the live agent. This setting prevents RetellAI from storing call transcripts or recordings on their platform — a key HIPAA control.

#### Verification Command
```bash
curl -s -H "Authorization: Bearer $RETELL_API_KEY" \
  https://api.retellai.com/get-agent/$RETELL_AGENT_ID \
  | node -e "const p=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
    console.log('storage:', p.data_storage_setting, '| days:', p.data_storage_retention_days)"
```

**Expected output:**
```
storage: basic_attributes_only | days: 7
```

If output shows `everything` or `undefined`, re-run:
```bash
node scripts/update-retell-agent.js
```
with valid `RETELL_API_KEY` and `RETELL_AGENT_ID` in `.env`.

#### Arthur's Dashboard Confirmation
Log into [app.retellai.com](https://app.retellai.com) → Agent settings → Privacy → confirm data storage shows **"Basic Attributes Only"** and retention shows **7 days**. This is the visual confirmation of the API setting.

#### Arthur's BAA Action Item
A Business Associate Agreement with RetellAI **must be signed before production go-live**. Even with `basic_attributes_only`, RetellAI processes audio in real-time and is a Business Associate under HIPAA.
- Contact RetellAI: [retellai.com](https://www.retellai.com) or [email protected]
- BAA is available to enterprise/healthcare customers — no annual contract required

---

## Troubleshooting Guide

### Behavior note: Bleeding / Fever follow-up before emergency

Grace now asks ONE follow-up question before escalating ambiguous symptoms to emergency mode:
- **Bleeding:** If caller says "I'm bleeding" or "bleeding a lot" without severity context → Grace asks: "Is it severe or uncontrolled — like it won't stop on its own?" Only escalates if confirmed.
- **Fever:** If caller says "I have a fever" without high-severity indicators → Grace asks: "How high is the fever, and is the person alert and responsive?" Only escalates for very high fever (>104°F), seizure, confusion, or unresponsive person.
- **Mild fever, nausea, vomiting, general pain, dizziness alone** → treated as urgent care visit reasons, NOT emergency. Grace proceeds with normal intake.

This is expected behavior. If Grace is escalating too aggressively or not escalating when it should, review the Ambiguous Symptom Protocol section in the RetellAI LLM prompt.

---

### Issue: Calls not being logged in Keragon

**Check:**
```bash
# Are Keragon URLs set?
grep "KERAGON.*WEBHOOK" .env

# Is the server reachable from the internet?
curl -I https://your-domain.com/webhook/retell

# Test the Keragon W1 webhook directly
curl -X POST "https://webhooks.us-1.keragon.com/v1/workflows/9f74dcab-6aa2-4615-8798-9a2b41290f7d/rBWs2NzSWYKwNDjU4h0Xb/signal" \
     -H "Content-Type: application/json" \
     -d '{"event":"call_ended","call_id":"test-001","timestamp":"2026-02-25T10:00:00Z"}'
```

**Expected:** Keragon W1 shows a new run entry within 5 seconds.

**Fix:** If webhook call returns non-200, check Keragon workspace is active and URLs in `.env` match live workflow URLs.

---

### Issue: SMS not being sent

**Delivery 1:** SMS runs in mock mode by design (`MOCK_MODE=true`, `SMS_ENABLED=false`). SMS will be active after Notifyre integration at Delivery 2. Check logs for `[MOCK] SMS sent` entries to confirm mock is working.

**Check (Delivery 2 onwards):**
```bash
# Is SMS enabled?
grep "SMS_ENABLED" .env    # should be 'true' for D2

# Are Notifyre credentials set?
grep -E "(NOTIFYRE|SMS_FROM_NUMBER)" .env

# Check logs for SMS errors
docker compose logs app | grep -E "(SMS|sms|MOCK)"
```

**Common causes (Delivery 2):**
- `SMS_ENABLED=false` — set to `true` and restart
- Notifyre credentials not set in `.env`
- `SMS_FROM_NUMBER` not configured
- Call duration < 30 seconds (implied consent threshold — no SMS sent for very short calls)
- Caller explicitly declined SMS (`sms_consent_explicit: false`)

---

### Issue: Appointment reminder SMS not firing

**Check:**
```bash
# Is scheduler running?
docker compose logs app | grep -E "(Scheduler|reminder|PHI)"

# Is the appointment in the cache?
docker exec receptionist-redis redis-cli KEYS "appt:*"
```

**Common causes:**
- `SCHEDULER_ENABLED=false` in `.env`
- Appointment `appointmentISO` field not a valid ISO datetime (can't parse → cron skips it)
- Redis is down (no cache = no appointments to remind)
- Server restarted between appointment creation and reminder window (cron restarts, re-reads cache)

---

### Issue: Google Calendar events not appearing

**Check:**
```bash
# Are all 3 Google Calendar vars set?
grep -E "(GOOGLE_CALENDAR|GOOGLE_SERVICE|GOOGLE_PRIVATE)" .env

# Check logs for calendar errors
docker compose logs app | grep -i "calendar"
```

**Common causes:**
- Missing env vars (any of the 3 will cause `isConfigured()` to return false — silently skipped)
- Service account not granted "Make changes to events" permission on the target calendar
- `GOOGLE_PRIVATE_KEY` has formatting issue — must have `\n` in the value (not real newlines when stored as env var)
- `intended_visit_timeframe` field is empty — no timeframe captured = no calendar event

---

### Issue: Staff alert SMS for cancel/change not arriving

**Check:**
```bash
# Is STAFF_ALERT_PHONE set?
grep "STAFF_ALERT_PHONE" .env   # must be E.164 format: +12125550100

# Check logs
docker compose logs app | grep "Staff appointment alert"
```

**Common causes:**
- `STAFF_ALERT_PHONE` not set in `.env`
- Phone number not in E.164 format
- SMS not configured (Notifyre — Delivery 2; SMS_ENABLED=false for D1)
- RetellAI agent not extracting `appointmentIntent: cancel/change` from call (agent prompt issue)

---

### Issue: Low-score rating alerts not sending staff emails

**Check:**
- Open Keragon W3 → Runs → find `patient_rating` runs
- Expand a run → check the `low_score_alert` field in the payload
- If `low_score_alert: false` → rating was 4 or 5 (correct, no email)
- If `low_score_alert: true` but no email → SendGrid step needs API key entered in Keragon W3

**Fix:** In Keragon W3, open the SendGrid step → enter Arthur's SendGrid API key and verified sender email.

---

### Issue: Redis connection failing

```bash
# Test Redis directly
redis-cli -h localhost -p 6379 ping
# Expected: PONG

# Restart Redis
docker compose restart redis

# Check memory
redis-cli info memory | grep "used_memory_human"

# If memory full — clear appointment cache (WARNING: clears all reminders)
redis-cli FLUSHDB
```

---

## Maintenance Calendar

### Daily (automated — verify ran correctly)
- [ ] PHI auto-deletion at 2:00 AM — check Keragon W4 for `phi_auto_deletion` event
- [ ] Appointment reminders fired — check Keragon W3 `sms_sent` events
- [ ] No `ERROR` spikes in logs
- [ ] Keragon W4 — no `sms_failed` events (if present, contact patient manually)

### Weekly
- [ ] Review all 4 Keragon workflow run histories for anomalies
- [ ] Check Google Calendar — confirm 1-hr events are appearing for scheduled calls
- [ ] Verify SMS provider status (Notifyre — applicable from Delivery 2)
- [ ] Confirm Redis memory usage is healthy (`redis-cli info memory`)
- [ ] Review staff alert SMS history for appointment changes — follow up any unresolved ones

### Monthly
- [ ] Full Redis backup test (backup + restore to staging)
- [ ] Rotate API keys if any have been shared or are older than 90 days
- [ ] Review Keragon data retention settings — ensure 7-day PHI deletion is configured
- [ ] Check RetellAI agent performance (latency, fallback rates in RetellAI dashboard)
- [ ] Verify compliance posture (see COMPLIANCE_GUIDE.md)

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| **Client (Arthur Garnett)** | Clinic operations email/phone |
| **Contractor (Simone Lawson)** | Primary support contact |
| **RetellAI Support** | https://docs.retellai.com / support@retellai.com |
| **Notifyre Support** | https://notifyre.com.au/support (Delivery 2) |
| **Keragon Support** | https://app.keragon.com (in-app chat) |

---

## Appendix: Quick Command Reference

```bash
# Start system
docker compose up -d

# Stop system
docker compose down

# View live logs
docker compose logs -f app

# View only errors
docker compose logs app | grep ERROR

# Health check
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/detailed

# Check Redis
redis-cli ping
redis-cli info keyspace

# List all cached appointments
docker exec receptionist-redis redis-cli KEYS "appt:*"

# Check if scheduler started
docker compose logs app | grep "Scheduler started"

# Manual PHI deletion test (dev only)
# POST to /webhook/keragon/callback with phi_auto_deletion event
```
