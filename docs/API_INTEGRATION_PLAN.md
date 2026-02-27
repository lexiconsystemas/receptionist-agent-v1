# Implementation Status — Receptionist Agent V1

**As of:** 2/25/2026
**Contract signed:** 2/22/2026 | **Deadline:** ~3/8/2026 (14 days)
**Tests:** 143/143 passing

> This document replaces the original API Integration Plan (dated 2026-01-25), which reflected a pre-build state. All major integrations are now implemented. This document tracks current status and remaining items.

---

## Integration Status

### ✅ RetellAI — Live

- Agent is live and answering calls on the provisioned phone number
- Verified working by live test call (2/25/2026)
- Webhook events received: `call_started`, `call_ended`, `call_analyzed`, `transcript_update`
- Emergency detection wired: 20+ keyword categories → immediate 911 redirect
- Spam detection wired: multi-factor scoring, threshold ≥ 3 = spam
- Webhook signature validation: production mode enforces HMAC check
- Multi-call concurrency: handled natively by RetellAI

**Still needed:**
- Spanish language detection in call flow (agent prompt update — not a code change)
- Explicit in-call SMS opt-in question (agent prompt update)

---

### ✅ SignalWire — Wired (needs live creds)

- `@signalwire/compatibility-api` v3.2.0 integrated in `src/config/smsProvider.js`
- Mock guard: `USE_MOCKS=true` → uses `mocks/signalwire.mock.js` instead of real API
- Inbound SMS webhook: `POST /webhook/sms/inbound` — signature validation implemented
- Outbound: `sendRaw()`, `sendFollowUp()`, `sendCallbackConfirmation()`, `sendEmergencyResources()`, `sendHoursReminder()`, `sendDayBeforeReminder()`, `sendHourBeforeReminder()`
- Bilingual (EN + ES): all SMS templates support `locale: 'en' | 'es'`

**Still needed:**
- Arthur provides: `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`, `SIGNALWIRE_SPACE_URL`, `SIGNALWIRE_FROM_NUMBER` → enter in `.env`

---

### ✅ Keragon — 4 Workflows Live and Active

All 4 workflows published and receiving events. `callLogger.js` routes by event type.

| Workflow | Name | Status | Webhook URL |
|----------|------|--------|-------------|
| W1 | `receptionist_call_log` | ✅ Active | `https://webhooks.us-1.keragon.com/v1/workflows/9f74dcab-6aa2-4615-8798-9a2b41290f7d/rBWs2NzSWYKwNDjU4h0Xb/signal` |
| W2 | `receptionist_emergency_alert` | ✅ Active | `https://webhooks.us-1.keragon.com/v1/workflows/9e1230aa-8f16-472b-8f1c-802d630c6870/MAWIR-EoI_dtStyx90d_D/signal` |
| W3 | `receptionist_sms_events` | ✅ Active | `https://webhooks.us-1.keragon.com/v1/workflows/0fa3ed22-7187-470e-a3ee-db67d0ff0ec9/QDUbX18unW6JbTta1HD8U/signal` |
| W4 | `receptionist_edge_cases` | ✅ Active | `https://webhooks.us-1.keragon.com/v1/workflows/2760c73d-8d0f-4a70-a243-0e6cf2195b89/M0QohyDG1wOGlbj3dhDqR/signal` |

W3 is configured with: Branch → `patient_rating` (low score email) + `sms_freetext_reply` (staff email)
W4 is configured with: Branch → `sms_failed` (staff email) + `phi_auto_deletion` (log only) + `call_status_update` (log only)
W1 is configured with: Branch → SMS-failure branch has SendGrid email step

**Still needed:**
- SendGrid API key entered in Keragon W1, W3, W4 email steps (Arthur provides)
- Keragon data retention set to 7 days for PHI fields (Arthur configures in Keragon dashboard — step-by-step guide in `docs/OPERATIONS_MANUAL.md` SOP-006)

---

### ✅ Google Calendar — Implemented (needs live creds)

- `src/services/googleCalendarService.js` — service account auth via `googleapis`
- `isConfigured()` guard: silently skips if env vars missing (non-fatal)
- `createAppointmentEvent(callLog)` — creates 1-hour event for staff reference
- `deleteAppointmentEvent(eventId)` — available for future use
- Mock: `mocks/googleCalendar.mock.js` — auto-used when `USE_MOCKS=true`
- Wired in `retellHandler.js`: fires on `disposition: completed` + timeframe captured

**Still needed:**
- Arthur provides: `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` → enter in `.env`
- Grant "Make changes to events" permission on calendar to service account email

---

### ✅ Appointment Scheduler — Live (in-process cron)

- `src/services/schedulerService.js` — `node-cron` based
- Day-before SMS reminder: fires 23–25 hours before appointment ISO time
- 1-hour-before SMS reminder: fires 55–65 minutes before appointment ISO time
- PHI auto-deletion: runs daily at 2:00 AM clinic timezone — deletes call/appointment records older than 7 days from Redis
- Bilingual: `locale: 'en' | 'es'` support throughout
- Enable/disable: `SCHEDULER_ENABLED=true|false` env var
- `cancelScheduledAppointment(id)` — called on appointment_cancel and appointment_change dispositions

---

### ✅ Rating SMS — Live

- `src/webhooks/inboundSmsHandler.js` — parses inbound SMS replies on `POST /webhook/sms/inbound`
- Rating request SMS: fires if patient opts in during post-call follow-up
- Parses numeric responses 1–5; rejects non-numeric
- Rating ≤ 3 → sends exact low-score follow-up message + logs to Keragon W3 with `low_score_alert: true`
- Rating ≥ 4 → no further SMS
- Opt-out (STOP keyword) → logs to Keragon W3 as `sms_opt_out`
- Free-text replies → logs to Keragon W3 as `sms_freetext_reply` → SendGrid staff email

---

### ✅ Appointment Change / Cancel Flow — Live

- `retellHandler.js` detects `appointmentIntent: cancel | change` from RetellAI extracted data
- On cancel/change disposition:
  1. `cancelScheduledAppointment()` — removes appointment from Redis (no stale reminder SMS)
  2. `logEdgeCase()` — logs to Keragon W4 with full context
  3. `sendRaw(STAFF_ALERT_PHONE, ...)` — SMS alert to clinic staff

**Still needed:**
- `STAFF_ALERT_PHONE` entered in `.env` (Arthur provides clinic ops phone number)

---

### ✅ PHI Auto-Deletion — Live

- Daily at 2:00 AM (clinic timezone): deletes call logs + appointment records older than 7 days from Redis
- Logs deletion event to Keragon W4 (`phi_auto_deletion`) for permanent audit trail
- `sanitizeForLogging()` in `callLogger.js` strips prohibited fields before any Keragon write
- Configure retention window: `PHI_RETENTION_DAYS=7` (default)

---

### ⚠ Hathr.ai — Stubbed (not active)

Emergency detection and conversation logic run inside RetellAI directly. Hathr.ai is stubbed in `mocks/hathr.mock.js`. No real Hathr.ai API calls are made. Not required for MVP.

---

## Remaining Items Before Acceptance (§10)

| Item | Owner | Blocker |
|------|-------|---------|
| SignalWire credentials → `.env` | Arthur | — |
| SendGrid API key → Keragon W1, W3, W4 | Arthur | — |
| Google Calendar creds → `.env` | Arthur | — |
| `STAFF_ALERT_PHONE` → `.env` | Arthur | — |
| Keragon 7-day data retention configured | Arthur | Guide: see `docs/OPERATIONS_MANUAL.md` SOP-006 |
| RetellAI agent prompt: Spanish detection | ✅ Simone | Done |
| RetellAI agent prompt: explicit in-call SMS opt-in | ✅ Simone | Done |
| Documentation package delivered | ✅ Simone | Done |
| End-to-end live testing | Simone | Needs Arthur's creds |
| Mandatory walkthrough with Arthur | Both | Needs live testing first |
| Access map (§6) | Simone | Complete before final payment |

---

## Access Map (§6 — required before final payment)

| System | Account Owner | Simone's Access Level | Revocable? |
|--------|--------------|----------------------|------------|
| RetellAI | Arthur Garnett | API key + dashboard access (temporary) | Yes — remove from workspace |
| SignalWire | Arthur Garnett | API token (temporary) | Yes — rotate/revoke token |
| Keragon | Arthur Garnett | Workflow editor access (temporary) | Yes — remove from workspace |
| Google Workspace / Calendar | Arthur Garnett | Service account (temporary) | Yes — delete service account |
| Server / hosting | Arthur Garnett | Deploy access (temporary) | Yes — remove SSH key / access |

**Contractor (Simone Lawson) must not retain any credentials, API keys, or system access after project completion per §6 of the contract.**
