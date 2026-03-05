# System Architecture — AI Voice Receptionist

**Last updated:** 3/5/2026
**Status:** ~82% scope-complete. All services wired. Google Calendar credentials configured. SMS mock mode for Delivery 1 (Notifyre — Delivery 2).

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Voice + Telephony** | RetellAI (agent: Grace) | Voice synthesis, STT, PSTN, multi-call concurrency |
| **SMS** | Notifyre (Delivery 2) | Inbound/outbound SMS — post-call follow-ups, reminders, ratings. Mock mode for Delivery 1. |
| **Automation & Logging** | Keragon (4 live workflows) | Workflow orchestration, call logging, staff alerts |
| **Calendar** | Google Calendar (service account) | 1-hour soft-schedule events visible to clinic staff |
| **Scheduling** | node-cron (in-process) | Appointment SMS reminders + HIPAA PHI auto-deletion |
| **Backend** | Node.js 18 / Express | Webhook handling, business logic |
| **Cache** | Redis (ioredis) | Appointment store, reminder state, rate limiting |

> **Note:** Hathr.ai is stubbed in code (`mocks/hathr.mock.js`) — not active in production. Emergency detection and conversation logic run inside RetellAI directly.
>
> **SMS Note:** The Twilio SDK stub in `src/config/smsProvider.js` is a temporary code placeholder — the named SMS provider is **Notifyre**, integrated at Delivery 2. All SMS runs in mock mode for Delivery 1 (`MOCK_MODE=true`, `SMS_ENABLED=false`).

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CALLER INTERACTION LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────┐                                                             │
│    │  Caller  │                                                             │
│    └────┬─────┘                                                             │
│         │ Phone Call (PSTN)                                                 │
│         ▼                                                                   │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │                RETELL AI (Telephony + Voice AI)                   │    │
│    │  • Inbound call reception + phone number management              │    │
│    │  • Voice synthesis (natural speech, EN + ES)                     │    │
│    │  • Speech-to-text (STT) in real time                             │    │
│    │  • Multi-call concurrency (no dropped sessions)                  │    │
│    │  • Emergency keyword detection (overrides all other flows)       │    │
│    │  • Spam detection signals                                        │    │
│    └────────────────────────┬─────────────────────────────────────────┘    │
│                             │ Webhook events (call_started, call_ended,    │
│                             │ call_analyzed, transcript_update)             │
│                             ▼                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                          APPLICATION LAYER (Node.js / Express)              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │  src/webhooks/retellHandler.js  — Core call event processor      │    │
│    │  src/webhooks/inboundSmsHandler.js  — Rating/opt-out replies     │    │
│    │                                                                    │    │
│    │  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐    │    │
│    │  │ spamDetection│  │   validation.js  │  │ emergencyDetect  │    │    │
│    │  │  (scoring)   │  │  (PHI scrubbing) │  │  (retell.js)    │    │    │
│    │  └──────┬───────┘  └────────┬─────────┘  └───────┬──────────┘    │    │
│    │         │                   │                     │               │    │
│    │         └───────────────────▼─────────────────────┘               │    │
│    │                       SERVICES LAYER                               │    │
│    │  • callLogger.js        — Route events to Keragon workflows       │    │
│    │  • smsService.js        — Post-call SMS via Notifyre (D2/mock D1) │    │
│    │  • schedulerService.js  — Reminder crons + PHI auto-deletion     │    │
│    │  • googleCalendarService.js — Create 1-hr staff reference events  │    │
│    └──────────────────────────┬───────────────────────────────────────┘    │
│                               │                                             │
│            ┌──────────────────┼──────────────────────┐                     │
│            │                  │                       │                     │
│            ▼                  ▼                       ▼                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                      INTEGRATION LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐  ┌───────────────────┐  ┌──────────────────┐   │
│  │  NOTIFYRE SMS (D2)   │  │     KERAGON        │  │ GOOGLE CALENDAR  │   │
│  │  (mock mode — D1)    │  │  4 Live Workflows  │  │ (service acct)   │   │
│  │                      │  │                    │  │                  │   │
│  │  Outbound:           │  │  W1: call_log      │  │  Write-only:     │   │
│  │  • Follow-up SMS     │  │  W2: emergency     │  │  1-hour events   │   │
│  │  • Day-before remind │  │  W3: sms_events    │  │  for staff view  │   │
│  │  • 1-hr reminder     │  │  W4: edge_cases    │  │                  │   │
│  │  • Low-score follow  │  │                    │  │  Auth: service   │   │
│  │  • Staff alerts      │  │  Email alerts via  │  │  account JSON    │   │
│  │                      │  │  SendGrid          │  │                  │   │
│  │  Inbound:            │  │                    │  │                  │   │
│  │  • Rating replies    │  │                    │  │                  │   │
│  │  • CANCEL keyword    │  │                    │  │                  │   │
│  └──────────────────────┘  └───────────────────┘  └──────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flows

### 1. Inbound Call Flow (Normal)

```
1.  Caller dials RetellAI-managed phone number
2.  RetellAI handles telephony + STT/TTS in real time
    Agent name: Grace. After-hours aware (never suggests "today").
3.  RetellAI agent (Grace) captures:
      • Name, phone, date of birth (DOB), reason for visit (non-diagnostic)
      • Patient type (new / returning)
      • Intended visit timeframe (1-hour window)
      • SMS consent (explicit opt-in question during call)
    Note: visit timeframe captured via log_call_information.
          schedule_soft_appointment is deactivated (placeholder URL removed).
4.  RetellAI fires webhook → POST /webhook/retell (call_ended)
5.  retellHandler.js:
      a. Runs spam detection (multi-factor score ≥ 3 = spam)
      b. Runs validation / PHI scrubbing (patientDob scrubbed before Keragon)
      c. Determines disposition (completed, dropped, spam, emergency)
      d. Logs call record → Keragon W1 (call_log) — DOB not included
      e. Creates Google Calendar 1-hr event (if timeframe captured);
         DOB included in event description for staff identity reference
      f. Sends post-call SMS follow-up via Notifyre (Delivery 2; mock mode D1)
6.  SMS follow-up includes confirmation + optional rating opt-in
7.  schedulerService cron fires day-before + 1-hr-before SMS reminders
```

### DOB Capture Pipeline

```
1.  RetellAI captures patientDob in extracted_data during call
2.  validateCallerInfo() in validation.js validates format
3.  patient_dob included in in-memory callData for processing
4.  scrubTranscriptForLogging() strips DOB before any Keragon write
5.  Google Calendar event description includes DOB for staff reference
    (event is write-only, visible to clinic staff with calendar access)
```

### 2. Emergency Detection Flow

```
1.  RetellAI detects emergency keyword in real-time transcript
2.  retellHandler.js receives transcript_update webhook
3.  emergencyCheck.isEmergency = true → logs to Keragon W2 immediately
4.  RetellAI agent (configured in RetellAI dashboard):
      • Immediately interrupts conversation
      • States: "I'm not able to help with emergencies. Based on what
        you've described, this may be a serious medical situation.
        Please hang up and call 911 immediately, or go to the nearest
        emergency room."
      • STOPS scheduling, STOPS asking questions
      • Repeats if caller continues talking
5.  call_ended webhook fires → disposition: emergency
6.  No SMS sent to emergency callers
7.  Keragon W2 logs emergency event for staff review
```

### 3. Appointment Change / Cancel Flow

```
1.  Caller says they want to change or cancel an existing appointment
2.  RetellAI captures appointmentIntent: 'cancel' or 'change'
3.  call_ended webhook → retellHandler.js sets disposition:
      appointment_cancel OR appointment_change
4.  retellHandler.js:
      a. Cancels Redis/cache appointment reminder
         (stops stale day-before / 1-hr SMS from firing)
      b. Logs edge case → Keragon W4 (edge_cases)
      c. Sends SMS alert to STAFF_ALERT_PHONE:
         "[Receptionist Alert] Appointment CANCEL requested.
          Patient: Jane Doe (+15551234567) Call ID: abc123"
5.  Staff manually updates Google Calendar and contacts patient
```

### 4. Rating SMS Flow

```
1.  Post-call SMS sent with rating opt-in offer
2.  Patient replies "YES" → rating request SMS sent:
    "On a scale of 1–5, how easy was it to schedule your
     appointment today? Please do NOT include any medical details"
3.  Patient replies with a number (1–5)
4.  inboundSmsHandler.js receives reply → POST /webhook/sms/inbound
5.  If rating ≤ 3 (low score):
      → Low-score follow-up SMS sent:
        "We're sorry to hear that. Could you tell us what went wrong
         with the scheduling experience? Please do not include any
         medical details."
      → Keragon W3 receives patient_rating event with low_score_alert: true
      → SendGrid email alert fires to staff
6.  If rating ≥ 4: no further SMS sent
7.  Opt-out: patient replies STOP → logged to Keragon W3, no further SMS
```

### 5. PHI Auto-Deletion Flow

```
1.  schedulerService PHI cron runs daily at 2:00 AM (clinic timezone)
2.  Identifies call log and appointment records older than 7 days
3.  Deletes from Redis/cache
4.  Logs deletion event → Keragon W4 (phi_auto_deletion)
5.  Keragon run history provides permanent audit trail of deletions
Note: PHI in Keragon itself must be purged via Keragon's data
      retention settings (configure 7-day auto-delete in Keragon workspace)
```

---

## Keragon Workflows (Live)

All 4 workflows are published and active. The `callLogger.js` service routes events to the correct webhook URL based on event type.

| Workflow | Name | Trigger Events | Actions |
|----------|------|----------------|---------|
| **W1** | `receptionist_call_log` | `call_started`, `call_ended`, `call_record`, `call_analyzed` | Logs all call data; SendGrid email on SMS-failure branch |
| **W2** | `receptionist_emergency_alert` | `emergency_detected` | Logs emergency; staff notification |
| **W3** | `receptionist_sms_events` | `sms_sent`, `patient_rating`, `sms_opt_out`, `sms_opt_in`, `sms_freetext_reply` | SendGrid email for low ratings + freetext replies |
| **W4** | `receptionist_edge_cases` | `sms_failed`, `phi_auto_deletion`, `call_status_update`, `edge_case` | SendGrid email for SMS failures; audit log for PHI deletion |

### Webhook URLs (Production)

```
W1 — Call Log:
  https://webhooks.us-1.keragon.com/v1/workflows/9f74dcab-6aa2-4615-8798-9a2b41290f7d/rBWs2NzSWYKwNDjU4h0Xb/signal

W2 — Emergency Alert:
  https://webhooks.us-1.keragon.com/v1/workflows/9e1230aa-8f16-472b-8f1c-802d630c6870/MAWIR-EoI_dtStyx90d_D/signal

W3 — SMS Events:
  https://webhooks.us-1.keragon.com/v1/workflows/0fa3ed22-7187-470e-a3ee-db67d0ff0ec9/QDUbX18unW6JbTta1HD8U/signal

W4 — Edge Cases:
  https://webhooks.us-1.keragon.com/v1/workflows/2760c73d-8d0f-4a70-a243-0e6cf2195b89/M0QohyDG1wOGlbj3dhDqR/signal
```

---

## Scheduler / Cron Jobs

Two cron jobs run inside the Node.js process via `schedulerService.js`:

| Job | Schedule | What it does |
|-----|----------|--------------|
| **Appointment reminders** | Every 15 minutes | Checks upcoming appointments; fires day-before SMS (23–25hr window) and 1-hr-before SMS (55–65min window) |
| **PHI auto-deletion** | Daily at 2:00 AM | Deletes call logs and appointment records older than 7 days from Redis cache |

Both jobs respect `CLINIC_TIMEZONE` env var (default: `America/New_York`).
Disable scheduler entirely: set `SCHEDULER_ENABLED=false` in `.env`.

---

## Google Calendar Integration

**Role:** Staff reference only — write-only. The service account creates calendar events so clinic staff can see overnight walk-in intent each morning. No availability checking, no patient-facing features.

**How it works:**
- When a call ends with `disposition: completed` and an `intended_visit_timeframe` is captured, a 1-hour Google Calendar event is created
- Event title: `"Urgent Care Walk-In — [Patient Name]"`
- Event description: reason for visit, phone number, patient type, call ID
- If `intended_visit_timeframe` is not a parseable datetime, event is created 1 hour from call end time as a fallback

**Required env vars:**
```
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----"
```

**Required calendar permission:** Share the target calendar with the service account email and grant "Make changes to events."

---

## Call Record Schema (Keragon)

All call data is logged to Keragon W1 with this structure:

```json
{
  "call_id": "retell_call_abc123",
  "timestamp": "2026-02-25T02:30:00.000Z",
  "caller_id": "+15551234567",
  "call_duration_seconds": 145,
  "caller_name": "Jane Doe",
  "patient_type": "new",
  "reason_for_visit": "Sore throat and mild fever",
  "intended_visit_timeframe": "this evening 6-7pm",
  "existing_appointment_id": null,
  "appointment_type": null,
  "callback_requested": false,
  "sms_consent_explicit": true,
  "disposition": "completed",
  "emergency_trigger": false,
  "spam_flag": false,
  "spam_reasons": [],
  "sms_sent": true,
  "sms_delivery_status": "delivered",
  "gcal_event_id": "abc123xyz_google_event_id",
  "ai_decision_path": ["greeting", "new_patient_intake", "reason_capture", "timeframe_capture", "sms_opt_in", "closing"],
  "error_notes": null,
  "end_reason": "agent_hangup",
  "clinic_id": "urgent_care_001"
}
```

---

## Security & Compliance

### HIPAA-Conscious Design

| Requirement | Implementation |
|-------------|----------------|
| PHI Minimization | Only logged: name, phone, reason (non-diagnostic), timeframe, patient type |
| No Medical History | AI never requests or logs medical history |
| No Insurance Data | Insurance never requested or stored |
| PHI Auto-Deletion | 7-day cron deletes all call/appointment records from cache |
| Data Access Control | Keragon logs restricted to urgent care staff |
| Audit Trail | All calls logged with timestamps; PHI deletion logged in Keragon |
| Field Sanitization | `sanitizeForLogging()` strips prohibited fields before any Keragon write |

### Fields NEVER logged (to Keragon)
- SSN / social security number
- Date of birth — captured during call, written to Google Calendar event description only; scrubbed before any Keragon write
- Medical history / diagnosis / treatment
- Medications / prescriptions
- Insurance ID / policy number
- Credit card / financial data

---

## How to Disable the System

### Immediate shutdown (emergency)
```bash
# Stop the Node.js server
docker compose down    # if running via Docker
# OR
pm2 stop receptionist  # if running via pm2
# OR
kill $(lsof -t -i:3000)  # kill by port
```

### Disable inbound calls only
- In the RetellAI dashboard: set the agent to inactive or remove the phone number assignment
- The webhook server can remain running for logging purposes

### Disable SMS only
```env
SMS_ENABLED=false
```
Restart the server — no SMS will be sent (calls still handled, logged).

### Disable scheduled reminders only
```env
SCHEDULER_ENABLED=false
```
Restart the server — cron jobs will not start.

### Disable Google Calendar only
- Remove or blank `GOOGLE_CALENDAR_ID` from `.env` and restart
- `isConfigured()` returns false → no calendar events created, no errors thrown

### Disable a Keragon workflow
- Open the workflow in Keragon → click the workflow status toggle → set to Inactive
- The webhook will still receive events but the workflow will not process them

---

## Modularity — Deploying for a New Clinic

The system is designed as a base model. To deploy for a second clinic:

1. **Create new accounts** under the new client's name: RetellAI, Notifyre, Keragon, Google Workspace
2. **Copy `.env.example`** → fill in new clinic credentials (all are env-var driven, no code changes needed)
3. **Update clinic-specific vars:**
   ```
   CLINIC_NAME, CLINIC_ADDRESS, CLINIC_PHONE, CLINIC_TIMEZONE, CLINIC_HOURS
   ```
4. **Create 4 new Keragon workflows** (copy W1–W4 structure, update webhook URLs in `.env`)
5. **Set up new Google Calendar** → share with new service account
6. **Configure RetellAI agent** → update clinic name, hours, greeting in prompt
7. **Configure Notifyre SMS number** → point inbound webhook to new server instance (Delivery 2)

No code changes required for standard clinic deployments.

---

## Endpoint Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Service info |
| `/health` | GET | Full health check |
| `/health/live` | GET | Liveness probe (Kubernetes) |
| `/health/ready` | GET | Readiness probe (Kubernetes) |
| `/health/detailed` | GET | Detailed component status |
| `/webhook/retell` | POST | RetellAI call events |
| `/webhook/retell/status` | POST | Call status updates |
| `/webhook/sms/inbound` | POST | Inbound SMS replies (ratings, opt-outs, CANCEL keyword) |
| `/webhook/sms/status` | POST | SMS delivery status callbacks (Notifyre — Delivery 2) |
| `/webhook/keragon/callback` | POST | Keragon automation callbacks |

---

## Edge Cases & Error Handling

| Edge Case | Action |
|-----------|--------|
| Dropped call (<30s) | `disposition: dropped`, logged to Keragon W1, no SMS |
| Incomplete info captured | Logged to Keragon W1 with available fields |
| Failed SMS delivery | Logged to Keragon W4 (`sms_failed`), SendGrid email to staff |
| Emergency detected | `disposition: emergency`, logged to W2, no SMS sent |
| Spam call | `disposition: spam`, logged to W1 with spam_flag + reasons |
| Appointment cancel/change | Cancel Redis reminder → W4 edge case log → SMS to STAFF_ALERT_PHONE |
| Google Calendar failure | Non-fatal — logged as warning, call flow continues |
| Keragon webhook failure | Non-fatal — logged as error, call flow continues |
| PHI deletion error | Logged to Keragon W4, included in daily deletion audit |

---

## Testing Checklist (§7)

- [ ] End-to-end call flow (normal scheduling)
- [ ] Emergency detection (keyword triggers, exact 911 wording)
- [ ] Spam detection (robocall, short silence, keyword match)
- [ ] Multi-call concurrency (simultaneous inbound calls)
- [ ] Appointment change / cancel flow (Redis cancel + Keragon log + staff SMS)
- [ ] SMS delivery verification (follow-up, day-before, 1-hr reminders)
- [ ] Rating SMS (1–5 parse, low-score follow-up ≤3, opt-out STOP)
- [ ] Keragon logging completeness (all 4 workflows receiving events)
- [ ] Google Calendar event creation (1-hr event visible in calendar)
- [ ] PHI auto-deletion (verify cron deletes records older than 7 days)
- [ ] Edge case handling (dropped calls, incomplete info, failed SMS)
- [ ] System shutoff procedures verified
