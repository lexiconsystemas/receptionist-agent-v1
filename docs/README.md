# Receptionist Agent V1

After-Hours AI Receptionist for urgent care. Voice agent **Grace** answers calls, triages symptoms, captures patient info, soft-schedules walk-ins, and logs everything to Keragon — all outside of business hours.

**Client:** Arthur Garnett | **Contractor:** Simone Lawson | **Signed:** 2/22/2026

---

## Stack

| Layer | What | Notes |
|-------|------|-------|
| Voice AI | RetellAI (agent: Grace) | Handles calls, STT/TTS, concurrency |
| SMS | Notifyre | Delivery 2 — mock mode for Delivery 1 |
| Workflows / Logging | Keragon (4 live workflows) | W1 call log, W2 emergency, W3 SMS, W4 edge cases |
| Scheduling | Google Calendar | Service account, write-only, staff reference |
| Backend | Node.js 18 / Express | Railway hosted |
| Cache | Redis + in-memory fallback | Appointment reminders, opt-out list, 7-day PHI TTL |

---

## Setup

```bash
npm install
cp .env.example .env   # fill in values below
npm start
```

### Required env vars

```env
# RetellAI
RETELL_API_KEY=
RETELL_AGENT_ID=
RETELL_WEBHOOK_SECRET=

# Keragon (4 webhook URLs)
KERAGON_WEBHOOK_URL=
KERAGON_EMERGENCY_WEBHOOK_URL=
KERAGON_SMS_WEBHOOK_URL=
KERAGON_EDGE_WEBHOOK_URL=

# Google Calendar
GOOGLE_CALENDAR_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=

# Clinic
CLINIC_NAME=
CLINIC_ADDRESS=
CLINIC_TIMEZONE=America/New_York
STAFF_ALERT_PHONE=

# SMS — Delivery 2
SMS_ENABLED=false
```

---

## Scripts

```bash
node scripts/test-calendar.js      # smoke-test Google Calendar event creation
node scripts/test-sms.js           # smoke-test SMS send
node scripts/test-concurrent-calls.js  # multi-call handling
npm test                           # unit tests
```

---

## Docs

| File | What it covers |
|------|---------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System diagram, data flow, component map |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Railway setup, env vars, going live |
| [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md) | How to update Grace, turn system off, troubleshoot |
| [COMPLIANCE_GUIDE.md](./COMPLIANCE_GUIDE.md) | HIPAA-conscious design, PHI handling, data retention |
| [ACCESS_MAP.md](./ACCESS_MAP.md) | All systems, accounts, API keys, permission levels |
| [ARTHUR_SETUP_CHECKLIST.md](./ARTHUR_SETUP_CHECKLIST.md) | What Arthur needs to do before go-live |
| [SCOPE_COMPLIANCE_MAP.md](./SCOPE_COMPLIANCE_MAP.md) | Every scope requirement → implementation status |

---

## Scope → Feature Checklist

> Full detail (file paths, exact payloads, known limitations) → [`SCOPE_COMPLIANCE_MAP.md`](./SCOPE_COMPLIANCE_MAP.md)

### Medical Protocols

- [x] **Fever Protocol** — 6-step triage: age → immune status → temp → decision table → follow-up Qs → duration → schedule
- [x] **Bleeding Protocol** — Location first (head/neck/chest/abdomen/groin = immediate 911) → injury check → 7 follow-up Qs
- [x] **Unresponsive Caller** — "Hello? Are you still with me?" × 2–3 attempts → 911 statement → stay on line
- [x] **Emergency Detection** — 60+ keyword triggers across 10 categories (cardiac, respiratory, neuro, pregnancy, sepsis, trauma, etc.) + soft-language triggers ("I think I'm dying")
- [x] **Emergency Protocol** — Immediately stops scheduling, delivers exact scope-required message, repeats if caller continues

### Call Handling (§3.1)

- [x] Multiple simultaneous calls — RetellAI native concurrency
- [x] New vs returning patient identification
- [x] Professional tone + structured 10-step call flow
- [x] Spam/robocall detection — score-based (keywords, patterns, number origin, silence, no healthcare content)
- [x] Spam flagged in Keragon logs
- [x] Callback/message requests — disposition captured, SMS confirmation sent, logged to Keragon
- [x] Edge cases logged to Keragon W4 (dropped calls, incomplete info, failed SMS, change/cancel)

### Soft Scheduling (§3.2)

- [x] Ask for intended visit timeframe; push for 1-hour window
- [x] Google Calendar event created on `call_analyzed` — 1-hour block, staff-reference only
- [x] Appointment change / cancel — cancels Redis reminder, logs to W4, SMS alert to staff
- [ ] `schedule_soft_appointment` deactivated — timeframe captured via `log_call_information` only *(intentional)*

### Information Capture (§3.3)

- [x] Caller name (validated, title-cased)
- [x] Phone number (normalized to E.164)
- [x] Reason for visit (sanitized, PHI patterns redacted)
- [x] Intended visit timeframe
- [x] Patient type — new / returning
- [x] Call disposition — 9 types: completed, emergency, spam, dropped, incomplete, callback_requested, appointment_change, appointment_cancel, high_intent
- [x] Date of birth — captured in call, written to Google Calendar event only, **never sent to Keragon**

### Text Messaging (§3.4)

- [x] SMS opt-in asked during call (Step 8 of call flow)
- [x] Post-call SMS with clinic info + rating ask (exact scope wording)
- [x] Rating SMS: accept 1–5 numeric only, store score, no additional message for 4–5
- [x] Low-score follow-up (≤3): exact scope-required wording
- [x] Feedback handling: scheduling feedback only, forwarded via Keragon W3
- [x] TCPA opt-out (STOP → suppressed from all future sends)
- [x] Day-before appointment reminder SMS (cron, 23–25h before)
- [x] 1-hour-before appointment reminder SMS (cron, 55–65min before)
- [x] Bilingual — English and Spanish
- [ ] Notifyre live integration — **Delivery 2** (mock mode for Delivery 1)

### Spam Filtering (§3.5)

- [x] Keyword detection (40+ spam/sales/scam terms)
- [x] Robocall pattern matching (regex)
- [x] Suspicious number prefix check (toll-free, international)
- [x] Score threshold: ≥3 = spam flag
- [x] Spam rules exported via `getSpamRules()` for documentation

### Keragon Logging (§4 / §5.4)

- [x] W1 — every call: caller ID (last-4 anonymized), duration, disposition, emergency flag, spam flag, reason for visit, timeframe, SMS status, 7-day retention stamp
- [x] W2 — emergency alert: detected keywords, mental health flag, recommendation
- [x] W3 — all SMS activity: sends, status updates, ratings, opt-in/out, freetext replies
- [x] W4 — edge cases: failed SMS, dropped calls, appointment change/cancel, PHI deletion audit, retention scrub audit
- [x] PHI auto-deletion cron — daily 2AM, 7-day window, logs audit event to W4
- [x] `patient_dob` and `transcript` scrubbed before any Keragon payload is sent

### Google Calendar (§3.2 / §4)

- [x] Service account auth (no OAuth, no patient-facing access)
- [x] 1-hour event created per completed call with visit timeframe
- [x] Event description: name, DOB, phone, reason for visit, call ID
- [x] Failure is non-fatal (call flow continues if Calendar is down)
- [ ] Pending Arthur: share calendar with service account + provide env vars

### Data Protection (§5.7)

- [x] PHI scrubbing — 15 prohibited fields blocked at `sanitizeForLogging()` (incl. `patient_dob`, `transcript`, SSN, medications, insurance)
- [x] No external database — all persistent data in Keragon only
- [x] Redis data is ephemeral — 7-day TTL on all PHI-adjacent keys
- [x] Webhook signatures verified (HMAC-SHA256, 5-min timestamp window)
- [x] HIPAA-conscious by design (not formally certified — BAA required for full compliance)

### Documentation (§5.1–5.3)

- [x] Architecture diagram + data flow — `ARCHITECTURE.md`
- [x] Deployment guide — `DEPLOYMENT_GUIDE.md`
- [x] Operations manual — `OPERATIONS_MANUAL.md`
- [x] Compliance guide — `COMPLIANCE_GUIDE.md`
- [x] Access map (§6 requirement) — `ACCESS_MAP.md`
- [x] Client setup checklist — `ARTHUR_SETUP_CHECKLIST.md`
- [x] Scope compliance map — `SCOPE_COMPLIANCE_MAP.md`

---

## Known Limitations (Accepted)

| # | Issue | Notes |
|---|-------|-------|
| 1 | Ambiguous bleeding ("my arm is bleeding a lot") may skip location question | Soft-trigger keyword list can override BLEEDING LOCATION EXCEPTION |
| 2 | Unresponsive mid-triage may not re-engage in simulation | Simulation limitation; live call behavior expected correct |
| 3 | Caller volunteers name+reason upfront → Grace may skip SMS opt-in | Rare edge; implied consent still applies |

---

## Remaining Before Delivery 1 Go-Live

**Arthur:**
- [ ] Fill Railway env vars (`RETELL_API_KEY`, `CLINIC_NAME`, `STAFF_ALERT_PHONE`, etc.)
- [ ] Share Google Calendar with `GOOGLE_SERVICE_ACCOUNT_EMAIL` → "Make changes to events"
- [ ] Add `GOOGLE_CALENDAR_ID` / `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` to Railway
- [ ] Add SendGrid API key into Keragon W1/W3/W4 email steps

**Simone or Arthur:**
- [ ] Set `{{CLINIC_NAME}}` and `{{CLINIC_HOURS}}` variables in RetellAI prompt
- [ ] Pause Before Speaking → 1.0s in RetellAI dashboard (Speech Settings → Welcome Message)

**Simone:**
- [ ] End-to-end live test call after all env vars deployed
- [ ] Walkthrough session

---

*Last updated: 2026-03-14*
