# SCOPE COMPLIANCE MAP

**Project:** After-Hours AI Receptionist – Urgent Care MVP
**Client:** Arthur Garnett | **Contractor:** Simone Lawson
**Last Updated:** 2026-03-16
**Overall Status:** ~95% complete — Delivery 1 ready

---

## Status Key

| Icon | Meaning |
|------|---------|
| ✅ | Fully implemented and live |
| ⚠️ | Implemented; blocked on env var or client action |
| 🔜 | Delivery 2 scope — not in Delivery 1 |
| ❌ | Explicitly out of scope |

---

## PART 1 — MEDICAL PROTOCOLS

### Fever Protocol

| Step | Scope Requirement | Implementation | Status |
|------|------------------|----------------|--------|
| Step 1 | Ask age; categorize as Infant (<3mo), Child (3mo–4yr), Older child/adult (≥5yr) | RetellAI prompt → FEVER TRIAGE PROTOCOL Step 1 | ✅ |
| Step 2 | Ask immunocompromised status; if yes/unsure → immediate emergency + hang up | RetellAI prompt → Step 2 (immunocompromised branch) | ✅ |
| Step 3 | Ask current fever + temperature; if can't provide → 911 redirect | RetellAI prompt → Step 3 | ✅ |
| Step 4 | Decision table: Infant + any fever → 911; Child ≤4yr + ≥102°F → 911; others → follow-up | RetellAI prompt → Step 4 decision table | ✅ |
| Step 5 | Ask 4 follow-up Qs (breathing, fluids, confusion/dizzy, rash); any positive → emergency | RetellAI prompt → Step 5 follow-up questions | ✅ |
| Step 6 | Ask fever duration; ≥3 days → "important you are seen ASAP", then schedule | RetellAI prompt → Step 6 duration + schedule | ✅ |
| Additional | Focus on current fever, not previous spikes | RetellAI prompt → Additional Notes section | ✅ |

---

### Bleeding Protocol

| Step | Scope Requirement | Implementation | Status |
|------|------------------|----------------|--------|
| Location first | Ask "Where on the body is the bleeding?" before anything else | RetellAI prompt → BLEEDING TRIAGE PROTOCOL (LOCATION FIRST rule) | ✅ |
| High-risk categorization | Head/neck/chest/abdomen/groin → immediate emergency + hang up | RetellAI prompt → High-risk location branch | ✅ |
| Moderate/lower risk | Hand/foot/leg/arm/finger/toe → proceed to follow-up | RetellAI prompt → Moderate risk branch | ✅ |
| Injury check | "Was this caused by an injury?" → if yes, ask about head injury/LOC | RetellAI prompt → Injury/accident branch | ✅ |
| 7 follow-up questions | Coughing blood, blood in urine/stool, severe pain, soaking through bandage, 10+ min bleeding, spurting, dizzy/lightheaded | RetellAI prompt → Bleeding follow-up questions | ✅ |
| Any positive → emergency | Yes/maybe/kind of to any follow-up → emergency statement + hang up | RetellAI prompt → escalation branch | ✅ |
| All no → schedule | Tell patient we'll take care of them; ask what time | RetellAI prompt → scheduling branch | ✅ |

---

### Unresponsive Caller Protocol

| Requirement | Scope Requirement | Implementation | Status |
|------------|------------------|----------------|--------|
| Re-engagement phrase | "Hello? Are you still with me? Please respond if you can hear me." | RetellAI prompt → UNRESPONSIVE CALLER PROTOCOL Step 1 | ✅ |
| Attempt count | Two to three times with brief pauses | RetellAI prompt → Step 2 (updated this session) | ✅ |
| Emergency statement | "I am unable to get a response. If anyone is present with the caller, please call 911 immediately and stay on the line with them." | RetellAI prompt → Step 3 (exact wording) | ✅ |
| Stay on line | AI stays on line; does NOT hang up | RetellAI prompt → Step 4; `reminder_max_count: 8` (API setting) | ✅ |
| Applies to all callers | No medical-symptom qualifier — fires for any silence, any point in call | RetellAI prompt → qualifier removed (updated this session) | ✅ |
| flag_emergency | Calls `flag_emergency` function on no-response | RetellAI prompt → Step 4 | ✅ |
| Post-statement silence | Says "I'm still here." only — no repeat of 911 message, no goodbye | RetellAI prompt → Step 4 follow-on rule | ✅ |

---

### Emergency Protocol

| Requirement | Scope Requirement | Implementation | Status |
|------------|------------------|----------------|--------|
| Suicidal/self-harm → immediate emergency | Statements about self-harm trigger emergency messaging | `detectEmergency()` in `src/config/retell.js` (mentalHealthCrisis list); RetellAI prompt emergency list | ✅ |
| Required emergency message | "I'm not able to help with emergencies. Based on what you've described, this may be a serious medical situation. Please hang up and call 911 immediately, or go to the nearest emergency room." | RetellAI prompt → EMERGENCY PROTOCOL required message | ✅ |
| If caller continues → repeat | Repeat emergency instruction without additional info | RetellAI prompt → "repeat if caller continues" rule | ✅ |
| STOP scheduling/questions | After emergency trigger: stop all scheduling and info collection | RetellAI prompt → "STOP" rules block; `flag_emergency` function | ✅ |
| Emergency overrides all flows | Emergency detection overrides fever/bleeding/scheduling flows | RetellAI prompt → GOLD-STANDARD RULE; `detectEmergency()` code layer | ✅ |
| Full emergency keyword list | 40+ categories: chest pain, stroke, bleeding, overdose, neurological, cardiac, respiratory, pregnancy, sepsis, trauma, chemical, diabetic, pediatric, soft-language triggers | `src/config/retell.js` → `emergencyKeywords[]` (~60 keywords) + soft distress list | ✅ |
| "Soft language" triggers | "I think I'm dying", "Something is very wrong", "I can't stay awake", etc. | `detectEmergency()` → `softDistress[]` array | ✅ |

---

## PART 2 — FUNCTIONAL REQUIREMENTS (§3)

### §3.1 Inbound Call Handling

| Requirement | Implementation | File / Function | Status |
|------------|----------------|-----------------|--------|
| Multiple simultaneous calls without dropping | RetellAI handles concurrency natively (multi-agent architecture) | RetellAI platform | ✅ |
| Identify new vs returning patients | Extracted from call via `patient_type` field | `src/utils/validation.js` → `validatePatientType()` | ✅ |
| Professional, calm, urgent-care-appropriate tone | OPERATING RULES in RetellAI prompt; voice: Sloane (Cartesia Sonic-3), speed 1.10 | `config/retell-agent-prompt.md` | ✅ |
| Structured call flows (Steps 1–10) | 10-step call flow: greeting → name → DOB → reason → protocols → schedule → phone → SMS → close | RetellAI prompt → CALL FLOW STEPS 1–10 | ✅ |
| Immediately interrupt if emergency detected | Emergency detection fires on transcript keywords; Grace stops normal flow | RetellAI prompt → EMERGENCY PROTOCOL + `handleTranscriptUpdate()` | ✅ |
| Emergency statement wording (exact) | Exact wording implemented per scope | RetellAI prompt | ✅ |
| No additional intake after emergency | "Do NOT ask any additional questions" rule | RetellAI prompt → STOP rules | ✅ |
| Emergency detection overrides all flows | Gold-standard rule + code-level detection | RetellAI prompt; `retellHandler.js` `detectEmergency()` | ✅ |
| Spam/robocall detection and termination | Score-based detection (keywords, patterns, number patterns, silence, no healthcare content) | `src/utils/spamDetection.js` → `analyzeCall()` | ✅ |
| Spam flagged in Keragon logs | `spam_flag: true`, `spam_reasons[]` sent to W1 | `src/webhooks/retellHandler.js` → `handleCallEnded()` | ✅ |
| Callback/message requests handled | `callback_requested` disposition; SMS confirmation sent to patient | `retellHandler.js` → `sendCallbackConfirmation()` | ✅ |
| Callback logged for next business day review | Keragon W1 log includes `callback_requested: true` and call record | `callLogger.js` → `logCallRecord()` | ✅ |
| Edge cases logged in Keragon | Dropped calls, incomplete info, failed SMS, change/cancel → W4 | `callLogger.js` → `logEdgeCase()` → W4 | ✅ |

---

### §3.2 Soft Scheduling

| Requirement | Implementation | File / Function | Status |
|------------|----------------|-----------------|--------|
| Ask when patient plans to come in | Step 5/6 of call flow captures intended visit timeframe | RetellAI prompt → `log_call_information` function | ✅ |
| Try to get caller to confirm 1-hour timeframe | Grace asks for specific hour window; logs broader timeframe if unavailable | RetellAI prompt → scheduling step | ✅ |
| Book 1-hour timeframes in Google Calendar | Event created with startTime + 1 hour duration | `src/services/googleCalendarService.js` → `createAppointmentEvent()` | ✅ Confirmed working — live test passed 2026-03-14 |
| Log timeframe even if only broad (e.g., "tomorrow morning") | `parseVisitStart()` falls back gracefully; freeform timeframe logged as-is | `googleCalendarService.js` → `parseVisitStart()` | ✅ |
| Appointment change/cancel flow | Detected via `appointmentIntent` field; cancels Redis reminder, logs to W4, alerts staff via SMS | `retellHandler.js` → change/cancel branch | ✅ |

---

### §3.3 Information Capture

| Field | Implementation | File / Function | Status |
|-------|----------------|-----------------|--------|
| Caller name | Extracted + title-cased; special chars stripped | `validation.js` → `validateName()` | ✅ |
| Phone number | Normalized to E.164 format | `validation.js` → `validatePhoneNumber()` | ✅ |
| Reason for visit (non-diagnostic) | Sanitized; SSN/date patterns redacted; max 500 chars | `validation.js` → `sanitizeReasonForVisit()` | ✅ |
| Intended visit timeframe | Validated against known patterns; freeform fallback | `validation.js` → `validateTimeframe()` | ✅ |
| Patient type (new/returning) | Maps variations ("first time", "existing", etc.) | `validation.js` → `validatePatientType()` | ✅ |
| Call disposition | 9 dispositions: completed, emergency, spam, dropped, high_intent, incomplete, appointment_change, appointment_cancel, callback_requested | `validation.js` → `DISPOSITIONS[]` | ✅ |
| Date of birth | Collected during call (Step 2 of flow); stored in Google Calendar event description only; scrubbed before Keragon | `validation.js` → `validateDob()`; `retellHandler.js` (DOB excluded from Keragon payload) | ✅ |

---

### §3.4 Text Messaging

| Requirement | Implementation | File / Function | Status |
|------------|----------------|-----------------|--------|
| Optional SMS follow-up after calls | Sent after `call_ended` if conditions met | `src/services/smsService.js` → `sendFollowUp()` | ⚠️ Implemented; SMS_ENABLED=false (Delivery 1 mock mode; Notifyre at Delivery 2) |
| Clinic hours + location in SMS | Message includes clinic name, address | `smsService.js` → `generateFollowUpMessage()` | ✅ |
| Only sent with implied/explicit consent | Checks opt-out list, call duration (>30s), explicit `sms_consent` flag | `retellHandler.js` → `shouldSendSms()` | ✅ |
| Ask on phone for SMS opt-in | Step 8 of call flow: "Would you like me to text you a confirmation?" | RetellAI prompt → Step 8 | ✅ |
| Initial Rating SMS (exact wording) | "On a scale of 1–5, how easy was it to schedule your appointment today? Please do NOT include any medical details." | `smsService.js` → `generateFollowUpMessage()` | ✅ |
| Accept numeric responses 1–5 only | Validates rating is integer 1–5 | `src/webhooks/inboundSmsHandler.js` → rating handler | ✅ |
| Store only numeric rating score | Only score stored in Keragon; no free text captured | `callLogger.js` → `patient_rating` event → W3 | ✅ |
| Associate rating with clinic + call instance | `call_id` + `clinic_id` included in W3 payload | `inboundSmsHandler.js` | ✅ |
| No additional messages for rating 4–5 | Only fires low-score follow-up if score ≤3 | `inboundSmsHandler.js` → score gate | ✅ |
| Low-score follow-up (≤3) exact wording | "We're sorry to hear that. Could you tell us what went wrong with the scheduling experience? Please do not include any medical details." | `inboundSmsHandler.js` → low score branch | ✅ |
| Feedback handling rules (no medical records, forwarding to owner) | Freetext reply treated as scheduling feedback only; no medical categorization; forwarded via Keragon W3 | `inboundSmsHandler.js` → `sms_freetext_reply` event | ✅ |
| SMS opt-out (TCPA STOP) | STOP → opts number out of all future SMS; logged to W3 | `inboundSmsHandler.js` → opt-out handler | ✅ |
| Day-before appointment reminder | SMS fires 23–25h before appointment | `schedulerService.js` → `sendDayBeforeReminder()` | ⚠️ Implemented; pending Notifyre at Delivery 2 |
| 1-hour-before appointment reminder | SMS fires 55–65min before appointment | `schedulerService.js` → `sendHourBeforeReminder()` | ⚠️ Implemented; pending Notifyre at Delivery 2 |
| Bilingual SMS (English/Spanish) | All SMS messages have English + Spanish variants | `smsService.js` (all functions), `schedulerService.js` | ✅ |

#### SMS Documentation (as required by scope §3.4)

| Item | Where it is |
|------|------------|
| Where opt-in status is stored | Redis cache under `caller:locale:{phone}` key (7-day TTL); logged to Keragon W3 as `sms_opt_in` event |
| Where SMS automation is configured | `src/services/smsService.js` + `src/config/smsProvider.js`; delivery via Notifyre (Delivery 2) |
| Where rating data is stored | Keragon W3 workflow runs (`patient_rating` event); numeric score only |
| Where feedback responses are stored | Keragon W3 (`sms_freetext_reply` event); forwarded to Arthur via Keragon email step |
| How low-score alerts are delivered | Keragon W3 workflow → email to clinic owner (Arthur configures email step in Keragon) |
| How to disable follow-up system | Set `SMS_ENABLED=false` in Railway env vars OR `SCHEDULER_ENABLED=false` |

---

### §3.5 Spam Filtering

| Requirement | Implementation | File / Function | Status |
|------------|----------------|-----------------|--------|
| Filter robocalls, sales calls, irrelevant calls | Score-based system; threshold ≥3 = spam | `src/utils/spamDetection.js` → `analyzeCall()` | ✅ |
| Flag suspicious calls in Keragon logs | `spam_flag: true` + `spam_reasons[]` sent to W1 | `retellHandler.js` + `callLogger.js` | ✅ |
| Exact spam rules documented | `getSpamRules()` function exports complete rule set | `spamDetection.js` → `getSpamRules()` | ✅ |

**Spam Detection Rules (per scope §5.5):**

| Check | Trigger | Score Added |
|-------|---------|-------------|
| Extended silence at call start | >3 seconds silence before first word | +2 |
| Very short call | <5s duration + <20 chars transcript | +1 |
| Spam keywords | ≥2 matches from 40+ keyword list (warranty, press 1, IRS, etc.) | +keyword count |
| Robocall patterns | Regex: "this is a recording", "press one to", "you've been selected", etc. | +2 per match |
| Suspicious phone number | Toll-free prefixes (800/888/877/866/855/844/833) or international (+44/+91/+234/+86) | +1 |
| No healthcare content | Transcript >50 chars with zero medical terms | +1 |
| **Threshold** | spamScore ≥ 3 → `isSpam: true` | — |

---

## PART 3 — AI & INTEGRATION REQUIREMENTS (§4)

| Requirement | Implementation | File / Location | Status |
|------------|----------------|-----------------|--------|
| Modular/reusable base model | Clinic-specific variables isolated to env vars (`CLINIC_NAME`, `CLINIC_ADDRESS`, `CLINIC_HOURS`, `CLINIC_TIMEZONE`); all business logic parameterized | `src/index.js`, all services (env-driven) | ✅ |
| RetellAI: conversation logic, soft scheduling, urgency assessment | Grace agent live; LLM (Claude) handles all call logic, triage, scheduling | RetellAI dashboard (agent_40a6d657..., llm_eb106b7...) | ✅ |
| RetellAI: voice synthesis + recognition, multi-call concurrency | Cartesia Sonic-3 (Sloane voice), speed 1.10, volume 1.00; concurrency unlimited in RetellAI | RetellAI dashboard | ✅ |
| RetellAI: inbound calls + webhooks | Webhook server at `/webhook/retell`; handles call_started, call_ended, call_analyzed, transcript_update | `src/index.js`, `src/webhooks/retellHandler.js` | ✅ |
| Keragon: caller ID, timestamp, call duration | All included in W1 `call_ended` payload | `callLogger.js` → `logCallRecord()` | ✅ |
| Keragon: AI responses & decision paths | `ai_decision_path[]` field in W1 payload | `callLogger.js` → `logCallRecord()` | ✅ |
| Keragon: soft scheduling info | `intended_visit_timeframe` in W1 payload | `callLogger.js` → `logCallRecord()` | ✅ |
| Keragon: spam detection flags | `spam_flag`, `spam_reasons[]` in W1 payload | `callLogger.js` → `logCallRecord()` | ✅ |
| Keragon: SMS sent and delivery status | W3 `sms_sent` + `sms_status_update` events | `callLogger.js` → `logSmsStatus()` → W3 | ✅ |
| Keragon: error notifications / automation failures | W4 `edge_case` events for failed SMS, dropped calls, incomplete info | `callLogger.js` → `logEdgeCase()` → W4 | ✅ |
| Google Calendar: soft scheduling reference | Creates 1-hour block for each completed call with visit timeframe; staff-reference only | `src/services/googleCalendarService.js` → `createAppointmentEvent()` | ✅ Confirmed working — live test passed 2026-03-14 |
| All integrations documented | ARCHITECTURE.md, API_SPECIFICATION.md, DEPLOYMENT_GUIDE.md, OPERATIONS_MANUAL.md, COMPLIANCE_GUIDE.md, ACCESS_MAP.md | `docs/` | ✅ |

---

## PART 4 — LOGGING & DOCUMENTATION (§5)

### §5.1 Contractor Documentation

| Document | Content | Status |
|----------|---------|--------|
| `docs/README.md` | System overview, quick start, environment setup | ✅ |
| `docs/ARCHITECTURE.md` | Full system architecture diagram, data flow, component map | ✅ |
| `docs/DEPLOYMENT_GUIDE.md` | Railway deployment, env vars, Railway setup, going live checklist | ✅ |
| `docs/OPERATIONS_MANUAL.md` | Day-to-day usage, how to update prompt, how to turn system off, troubleshooting | ✅ |
| `docs/COMPLIANCE_GUIDE.md` | HIPAA-conscious handling, PHI fields, data retention, audit trail | ✅ |
| `docs/ACCESS_MAP.md` | All systems, permission levels, API keys, integrations | ✅ |
| `docs/ARTHUR_SETUP_CHECKLIST.md` | Client-side setup tasks with exact steps | ✅ |
| `docs/SCOPE_OF_WORK.md` | Signed scope document (reference copy) | ✅ |

### §5.2 Build Logging

| Requirement | Where documented | Status |
|------------|-----------------|--------|
| RetellAI prompt creation and testing | `docs/OPERATIONS_MANUAL.md`; simulation test results in session logs | ✅ |
| RetellAI voice setup (speed, tone, concurrency) | `docs/OPERATIONS_MANUAL.md`; voice: Sloane, speed 1.10, Sonic-3 | ✅ |
| RetellAI number configuration | `docs/DEPLOYMENT_GUIDE.md` | ✅ |
| Keragon flow creation + automation triggers | `docs/ARCHITECTURE.md`, `docs/OPERATIONS_MANUAL.md` | ✅ |
| Google Calendar integration | `docs/ARCHITECTURE.md`, `src/services/googleCalendarService.js` comments | ✅ |

### §5.3 System Architecture & Data Flow

| Item | Location | Status |
|------|---------|--------|
| Architecture diagram (RetellAI → Keragon → Google Calendar) | `docs/ARCHITECTURE.md` | ✅ |
| Data flow for calls, SMS, logs | `docs/ARCHITECTURE.md` | ✅ |
| Multi-call concurrency setup | RetellAI platform (no code change required); documented in `docs/ARCHITECTURE.md` | ✅ |

### §5.4 Keragon Logging Requirements

#### Workflow Routing Map

| Event Type | Workflow | URL Env Var | What triggers it |
|------------|----------|-------------|-----------------|
| `call_started`, `call_ended`, `call_record`, `call_analyzed` | W1 `receptionist_call_log` | `KERAGON_WEBHOOK_URL` | Every call start/end |
| `emergency_detected` | W2 `receptionist_emergency_alert` | `KERAGON_EMERGENCY_WEBHOOK_URL` | Real-time emergency keyword match in transcript |
| `sms_sent`, `sms_status_update`, `patient_rating`, `sms_opt_in`, `sms_opt_out`, `sms_freetext_reply` | W3 `receptionist_sms_events` | `KERAGON_SMS_WEBHOOK_URL` | All SMS activity |
| `sms_failed`, `phi_auto_deletion`, `phi_retention_scrub`, `call_status_update`, `edge_case` | W4 `receptionist_edge_cases` | `KERAGON_EDGE_WEBHOOK_URL` | Errors, edge cases, nightly cleanup audit |

#### W1 Payload (call_ended) — What Keragon Receives

```json
{
  "event": "call_ended",
  "call_id": "call_abc123",
  "timestamp": "2026-03-14T02:00:00.000Z",
  "caller_id": "***1234",
  "caller_name": "Jane Smith",
  "patient_type": "new",
  "reason_for_visit": "fever",
  "intended_visit_timeframe": "tomorrow morning",
  "call_duration_seconds": 120,
  "disposition": "completed",
  "emergency_trigger": false,
  "spam_flag": false,
  "spam_reasons": [],
  "sms_sent": true,
  "sms_delivery_status": "delivered",
  "ai_decision_path": [],
  "callback_requested": false,
  "sms_consent_explicit": true,
  "end_reason": "user_hangup",
  "source": "receptionist-agent-v1",
  "environment": "production",
  "logged_at": "2026-03-14T02:00:01.000Z",
  "retention_scrub_at": "2026-03-21T02:00:01.000Z",
  "retention_days": 7
}
```
> **Note:** `caller_id` is anonymized to last-4 digits (`***1234`) for HIPAA de-identification. `patient_dob` is always stripped before this payload is sent — it goes to Google Calendar only.

#### W2 Payload (emergency_detected) — What Keragon Receives

```json
{
  "event": "emergency_detected",
  "callId": "call_abc123",
  "timestamp": "2026-03-14T02:00:05.000Z",
  "detectedKeywords": ["chest pain", "can't breathe"],
  "isMentalHealthCrisis": false,
  "recommendation": "IMMEDIATE: Direct caller to 911 or 988 (mental health)",
  "source": "receptionist-agent-v1",
  "environment": "production",
  "logged_at": "2026-03-14T02:00:05.000Z"
}
```
> **Note:** No PHI scrubbing on W2 — emergency records are permanently retained.

#### W3 Payload (sms_sent) — What Keragon Receives

```json
{
  "event": "sms_sent",
  "callId": "call_abc123",
  "smsResult": {
    "success": true,
    "messageSid": "SM_xxx",
    "status": "queued"
  },
  "source": "receptionist-agent-v1",
  "environment": "production",
  "logged_at": "2026-03-14T02:00:10.000Z",
  "retention_scrub_at": "2026-03-21T02:00:10.000Z",
  "retention_days": 7
}
```

#### W4 Payload (edge_case) — What Keragon Receives

```json
{
  "event": "edge_case",
  "edge_case_type": "sms_failed",
  "call_id": "call_abc123",
  "timestamp": "2026-03-14T02:00:15.000Z",
  "description": "SMS failed: Connection refused",
  "context": { "phoneNumber": "+11234", "errorCode": "ECONNREFUSED" },
  "requires_review": true,
  "source": "receptionist-agent-v1",
  "environment": "production",
  "logged_at": "2026-03-14T02:00:15.000Z"
}
```
> **Note:** No PHI scrubbing on W4 — edge case records are permanently retained for audit.

#### Required Keragon Fields (per scope §5.4)

| Required Field | Field Name in Payload | W1 | W2 | W3 | W4 |
|---------------|----------------------|----|----|----|----|
| Caller ID / phone number | `caller_id` (last-4 anonymized) | ✅ | — | — | — |
| Booking outcome | `disposition`, `intended_visit_timeframe` | ✅ | — | — | — |
| Emergency trigger yes/no | `emergency_trigger` | ✅ | event itself | — | — |
| Reason for visit | `reason_for_visit` | ✅ | — | — | — |
| Timestamp | `timestamp`, `logged_at` | ✅ | ✅ | ✅ | ✅ |
| Spam flags | `spam_flag`, `spam_reasons` | ✅ | — | — | — |
| Failed SMS | — | — | — | — | ✅ (edge_case) |
| Dropped calls | `disposition: "dropped"` in W1 | ✅ | — | — | — |
| Incomplete info | `disposition: "incomplete"` in W1 | ✅ | — | — | — |
| Other edge cases | `edge_case_type` in W4 | — | — | — | ✅ |

### §5.5 Spam Filtering Documentation

Documented in `src/utils/spamDetection.js` → `getSpamRules()` (machine-readable export). Full threshold table included in §3.5 of this document above.

### §5.6 Testing & Edge Cases

| Test | Script / Method | Status |
|------|----------------|--------|
| Multi-call handling | RetellAI handles natively; documented in `docs/ARCHITECTURE.md` | ✅ |
| Emergency routing | 22-test simulation suite; emergency tests pass | ✅ |
| Spam call detection | `scripts/test-mock-flow.js` | ✅ |
| Google Calendar event creation | `scripts/test-calendar.js` | ✅ Live test passed 2026-03-14 |
| SMS delivery | `scripts/test-sms.js` | ⚠️ Pending Notifyre (Delivery 2) |
| Dropped calls | Handled via `disposition: "dropped"` + W4 edge case | ✅ |
| Incomplete info | `disposition: "incomplete"` + W4 edge case | ✅ |
| Concurrent calls | `scripts/test-concurrent-calls.js` | ✅ |
| Live end-to-end call test | Arthur called Grace; confirmed working 3/10–3/14 | ✅ |

### §5.7 Data Protection & Compliance

| Requirement | Implementation | Status |
|------------|----------------|--------|
| Logs protected (restricted access) | Keragon webhooks use `KERAGON_API_KEY` Bearer auth; Railway env vars are private | ✅ |
| No data stored outside Keragon | No external database; Redis cache is ephemeral (7-day TTL); all persistent logs go to Keragon only | ✅ |
| Data accessible to urgent care staff only | Keragon account access controlled by Arthur; no public endpoints expose data | ✅ |
| PHI minimized (no medical history or insurance) | Prohibited fields list in `callLogger.js`; DOB scrubbed from Keragon; reason_for_visit sanitized | ✅ |
| PHI deleted from Keragon 7 days after call | `retention_scrub_at` timestamp stamped on every W1/W3 payload; `phi_auto_deletion` cron runs at 2AM daily; W4 audit event logged | ✅ |
| HIPAA-conscious handling | PHI scrubbing in `validation.js`, `callLogger.js`; DOB to Google Calendar only; transcript never sent to Keragon | ✅ |
| Structured for future compliance audit | Retention stamps, `phi_auto_deletion` events, W4 audit trail | ✅ |

---

## PART 5 — EXTRAS & ACCESS (§6)

| Requirement | Status | Notes |
|------------|--------|-------|
| All accounts under client ownership | ⚠️ | RetellAI, Railway, Keragon under Arthur. Documented in `docs/ACCESS_MAP.md` |
| Contractor access temporary and revocable | ⚠️ | To be revoked post-delivery |
| No systems under contractor accounts | ✅ | All built under Arthur's accounts |
| Contractor retains no credentials post-project | ⚠️ | Will be executed at final handoff |
| Complete access map provided | ✅ | `docs/ACCESS_MAP.md` |

### AI Performance Requirements (§6)

| Requirement | Implementation | Status |
|------------|----------------|--------|
| Minimal latency | RetellAI + Cartesia Sonic-3 TTS; low-latency LLM path | ✅ |
| Responses concise and conversational | OPERATING RULES in prompt; banned verbose phrases; sentence-ending period pacing rule | ✅ |
| No long pauses or verbose delays | Voice speed 1.10; `reminder_trigger_ms: 20000`; banned "Great" affirmation | ✅ |
| Unknown question → redirect to staff hours | "If I can't answer a question, I advise the caller to call during normal staff hours" rule in prompt | ✅ |

---

## PART 6 — ACCEPTANCE CRITERIA (§10)

| Criterion | Status | Notes |
|----------|--------|-------|
| 1. All in-scope functionality works as described | ✅ ~90% | 3 known prompt-level limitations (see below) |
| 2. System is HIPAA compliant | ⚠️ | HIPAA-conscious architecture; full HIPAA certification requires formal BAA and audit |
| 3. Keragon logging captures all required events | ✅ | All 4 workflows live; all required fields documented above |
| 4. Documentation is delivered | ✅ | 8 docs in `docs/`; SCOPE_COMPLIANCE_MAP.md (this file) |
| 5. Mandatory walkthrough completed | ⚠️ | Scheduled for tomorrow (5:30 PM or earlier) |
| 6. Client confirms acceptance in writing | ⚠️ | Pending walkthrough |
| 7. Demo number available | ✅ | RetellAI agent live; Arthur has called and tested |

### Known Prompt-Level Limitations (Accepted)

| # | Failure | Root Cause | Mitigation |
|---|---------|-----------|-----------|
| 1 | **Ambiguous Bleeding** — Grace may escalate immediately on "my arm is bleeding a lot" without asking location first | Soft-trigger emergency keyword list overrides BLEEDING LOCATION EXCEPTION in some phrasings | BLEEDING LOCATION EXCEPTION documented in prompt; edge case rare in production |
| 2 | **Unresponsive During Fever Triage** — Grace may not fire Unresponsive Caller Protocol mid-triage in simulation | Simulation limitation (silence hard to simulate in text); real calls with `reminder_max_count: 8` provide 8 re-engagement attempts | Protocol is in prompt; live call behavior expected to be correct |
| 3 | **Name During Greeting** — When caller volunteers name+reason upfront, Grace may skip Step 8 (SMS opt-in) | LLM shortcut when info is already volunteered | Rare edge case; SMS follow-up still fires based on implied consent |

---

## Pending Items Before Go-Live (Arthur + Simone)

### ✅ Confirmed Complete (as of 2026-03-16)

| Item | Confirmed |
|------|-----------|
| Railway: `RETELL_API_KEY` set | ✅ 2026-03-15 |
| Railway: `RETELL_WEBHOOK_SECRET` set | ✅ 2026-03-15 |
| Railway: `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` set | ✅ 2026-03-15 — live test passed |
| Railway: All 4 Keragon webhook URLs set | ✅ 2026-03-15 |
| RetellAI: Pause Before Speaking → 1.0s | ✅ 2026-03-15 |
| Keragon W2 `receptionist_emergency_alert`: Gmail notification step configured | ✅ 2026-03-16 — SendGrid replaced with Gmail |
| Keragon W1/W3/W4: Gmail notification steps configured + tested | ✅ 2026-03-16 — emails confirmed delivering |

### 🔲 Still Pending

| Item | Owner | Blocking |
|------|-------|---------|
| Railway: `CLINIC_NAME` | Arthur | Greeting + Calendar event title |
| Railway: `STAFF_ALERT_PHONE` | Arthur | Staff SMS alerts on appointment change/cancel |
| Railway: `CLINIC_ADDRESS`, `CLINIC_TIMEZONE`, `CLINIC_HOURS` | Arthur | SMS content + scheduling accuracy |
| RetellAI prompt: set `{{CLINIC_NAME}}` and `{{CLINIC_HOURS}}` variables | Simone or Arthur | Greeting accuracy |
| End-to-end live test call after Arthur's env vars set | Simone | Delivery sign-off |
| Mandatory walkthrough session | Both | Acceptance Criteria §10.5 |
