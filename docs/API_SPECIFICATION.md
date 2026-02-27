# Receptionist Agent V1 - API Specification

## Document Information

| Version | Date | Author | Status |
|---------|------|--------|--------|
| 2.0 | 2026-02-25 | Dev Team | Production Ready |

---

## Overview

The Receptionist Agent V1 provides a webhook-based API for managing AI-powered after-hours call handling. This specification details all active endpoints, request/response formats, authentication requirements, and integration guidelines.

## Base URL

```
Production: https://api.yourclinic.com
Development: http://localhost:3000
```

## Authentication

### Webhook Authentication

Incoming webhooks are authenticated using HMAC-SHA256 signatures or provider-specific mechanisms:

```
X-Retell-Signature: sha256=SIGNATURE      ← RetellAI events
X-SignalWire-Signature: SIGNATURE          ← SignalWire voice/SMS (standard SignalWire validation)
```

> **Note:** Keragon sends outbound (agent → Keragon). There is no inbound Keragon signature on the `/webhook/keragon/callback` endpoint in the current implementation.

---

## Endpoints

### Health Check Endpoints

#### GET /health

Returns overall system health status including all dependencies.

**Response**
```json
{
  "status": "healthy|degraded|critical|error",
  "timestamp": "2026-02-25T23:45:00.000Z",
  "checks": {
    "server": {
      "status": "healthy",
      "uptime": 86400,
      "memory": {
        "used": "256MB",
        "total": "512MB"
      }
    },
    "redis": {
      "status": "healthy",
      "latency": 2,
      "connected": true
    },
    "filesystem": {
      "status": "healthy",
      "accessible": true
    }
  },
  "summary": {
    "total": 3,
    "healthy": 3,
    "unhealthy": 0,
    "critical": 0
  }
}
```

#### GET /ready

Readiness probe for container orchestration.

**Response**
```json
{
  "status": "ready|not ready",
  "checks": {
    "server": "healthy",
    "redis": "healthy"
  },
  "timestamp": "2026-02-25T23:45:00.000Z"
}
```

#### GET /live

Liveness probe for container orchestration.

**Response**
```json
{
  "status": "alive",
  "uptime": 86400,
  "timestamp": "2026-02-25T23:45:00.000Z"
}
```

---

## Webhook Endpoints

### POST /webhook/retell

Processes RetellAI webhook events for call lifecycle management.

**Authentication**
- Required: `X-Retell-Signature` header
- Signature validation using HMAC-SHA256

**Request Body**
```json
{
  "call_id": "retell_call_abc123",
  "agent_id": "agent_456",
  "event_type": "call_started|call_ended|call_analyzed|transcript_update",
  "timestamp": "2026-02-25T23:45:00.000Z",
  "call_status": "ongoing|ended|failed",
  "end_reason": "agent_hangup|caller_hangup|error",
  "duration_seconds": 145,
  "transcript": "Caller: Hi, I need to see a doctor\nAI: Hello...",
  "metadata": {
    "caller_number": "+15551234567",
    "decision_path": ["greeting", "intake", "closing"],
    "silence_at_start": 1200
  },
  "extracted_data": {
    "caller_name": "John Smith",
    "patient_type": "new|returning",
    "reason_for_visit": "Sore throat and fever",
    "visit_timeframe": "this evening 6-7pm",
    "appointment_type": "new|change|cancel",
    "existing_appointment_id": "appt_abc123",
    "sms_consent_explicit": true
  }
}
```

**Response**
```json
{
  "success": true,
  "processing_time": 150,
  "call_id": "retell_call_abc123"
}
```

**Event Types**

| Event Type | Description | Processing |
|------------|-------------|-------------|
| `call_started` | Call initiated | Log start, initialize session |
| `call_ended` | Call completed | Process call data, Keragon log, SMS, Google Calendar event |
| `call_analyzed` | Post-call analysis | Store analysis results |
| `transcript_update` | Real-time transcript | Emergency detection; triggers emergency routing if keyword detected |

**`call_ended` Processing Pipeline**

When a `call_ended` event is received, the system:
1. Extracts and sanitizes call data (PHI scrubbing)
2. Detects spam (multi-factor scoring ≥3 = flagged)
3. Logs to Keragon W1 (`receptionist_call_log`)
4. If emergency detected: logs to Keragon W2 (`receptionist_emergency_alert`)
5. If appointment booking: creates Google Calendar event (1-hour window)
6. If appointment change/cancel: cancels Redis reminder + logs to Keragon W4 + sends staff SMS alert
7. If SMS consent given: sends post-call follow-up SMS (bilingual EN/ES)
8. Schedules appointment reminder SMS (day-before + 1hr-before) via cron

---

### POST /webhook/retell/status

Handles call status updates from RetellAI.

**Request Body**
```json
{
  "call_id": "retell_call_abc123",
  "status": "ongoing|ended|failed",
  "timestamp": "2026-02-25T23:45:00.000Z",
  "metadata": {}
}
```

**Response**
```json
{
  "received": true,
  "call_id": "retell_call_abc123"
}
```

---

### POST /webhook/signalwire/voice

Processes incoming SignalWire voice calls and routes to RetellAI.

**Authentication**
- Required: `X-SignalWire-Signature` header (standard SignalWire request validation)

**Request Body** (Form data — standard SignalWire format)
```
From: +15551234567
To: +15559876543
CallSid: CA1234567890abcdef
Direction: inbound
```

**Response** (LaML — compatible with SignalWire/TwiML)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.retellai.com/call/websocket" />
  </Connect>
</Response>
```

---

### POST /webhook/signalwire/sms-status

Handles SMS delivery status callbacks from SignalWire.

**Authentication**
- Required: `X-SignalWire-Signature` header

**Request Body** (Form data — standard SignalWire format)
```
MessageSid: SM1234567890abcdef
MessageStatus: queued|sent|delivered|undelivered|failed
To: +15551234567
ErrorCode: 21614
ErrorMessage: Message blocked
```

**Response**
```
HTTP 200 OK
```

**Behavior:** On `failed` or `undelivered`, the failure is logged to Keragon W3 (`receptionist_sms_events`) with `sms_delivery_status: "failed"`. If a SendGrid API key is configured, a staff email alert is triggered.

---

### POST /webhook/sms/inbound

Processes inbound SMS replies from patients. Called by SignalWire when a patient responds to a post-call follow-up SMS.

**Authentication**
- Required: `X-SignalWire-Signature` header (validated in `src/index.js` middleware)

**Request Body** (Form data — standard SignalWire format)
```
From: +15551234567
To: +15559876543
Body: 4
SmsSid: SM1234567890abcdef
MessageSid: SM1234567890abcdef
```

**Response**
```
HTTP 200 OK
```
_(Response is sent immediately before processing to satisfy SignalWire's fast-acknowledgement requirement.)_

**Reply Classification**

Inbound messages are classified into four types:

| Type | Examples | Action |
|------|----------|--------|
| `opt_out` | STOP, CANCEL, END, QUIT, UNSUBSCRIBE | Flag number in Redis (`sms:optout:{phone}` = 1 year TTL); log to Keragon W3; **no reply sent** (TCPA) |
| `opt_in` | START, YES, UNSTOP | Remove opt-out flag from Redis; log to Keragon W3 |
| `rating` | `4`, `5`, `2`, `3/5`, `5 stars` | Log to Keragon W3 with `low_score_alert: true` if ≤2; send bilingual acknowledgement SMS |
| `freetext` | Any other text | Log to Keragon W3 with `requires_review: true` for staff |

**Rating Handling Detail**

| Score | Low Score? | Staff Action |
|-------|-----------|--------------|
| 1–2 | ✅ Yes | Keragon W3 alert with `low_score_alert: true`; bilingual follow-up SMS sent; staff email if SendGrid configured |
| 3–5 | ❌ No | Keragon W3 log; bilingual thank-you SMS sent |

**Keragon Event Logged (Rating)**
```json
{
  "event": "patient_rating",
  "phone_number": "+15551234567",
  "rating": 2,
  "raw_reply": "2",
  "timestamp": "2026-02-25T23:45:00.000Z",
  "low_score_alert": true,
  "requires_review": true
}
```

**Keragon Event Logged (Opt-Out)**
```json
{
  "event": "sms_opt_out",
  "phone_number": "+15551234567",
  "reply_body": "STOP",
  "timestamp": "2026-02-25T23:45:00.000Z",
  "action_taken": "flagged_do_not_sms"
}
```

**SignalWire Configuration for Inbound SMS**
```
Inbound SMS webhook URL: https://api.yourclinic.com/webhook/sms/inbound
Method: POST
```

---

### POST /webhook/keragon/callback

Receives optional callbacks from Keragon workflow automation (not currently used in production workflows — reserved for future Keragon-triggered actions).

**Request Body**
```json
{
  "workflow_id": "workflow_123",
  "status": "completed|failed|running",
  "timestamp": "2026-02-25T23:45:00.000Z",
  "data": {
    "processed": true,
    "records_created": 1,
    "call_id": "retell_call_abc123"
  }
}
```

**Response**
```json
{
  "received": true,
  "workflow_id": "workflow_123"
}
```

---

## Outbound API Calls (Agent → External Services)

The receptionist agent makes outbound calls to the following services. These are not inbound webhook endpoints — they are documented here for integration reference.

### Keragon Workflows

The agent POSTs to four Keragon workflow webhook URLs. These are configured via environment variables.

| Workflow | Env Var | Event Types Sent |
|----------|---------|-----------------|
| W1: `receptionist_call_log` | `KERAGON_WEBHOOK_URL` | `call_log` (all completed calls) |
| W2: `receptionist_emergency_alert` | `KERAGON_EMERGENCY_WEBHOOK_URL` | `emergency_alert` |
| W3: `receptionist_sms_events` | `KERAGON_SMS_WEBHOOK_URL` | `sms_sent`, `sms_opt_out`, `sms_opt_in`, `patient_rating`, `sms_freetext_reply`, `sms_delivery_failure` |
| W4: `receptionist_edge_cases` | `KERAGON_EDGE_WEBHOOK_URL` | `appointment_cancel`, `appointment_change`, `edge_case`, `phi_auto_deletion`, `error` |

**Standard Keragon Payload (W1 — Call Log)**
```json
{
  "event": "call_log",
  "call_id": "retell_call_abc123",
  "timestamp": "2026-02-25T23:45:00.000Z",
  "caller_id": "+15551234567",
  "caller_name": "John Smith",
  "patient_type": "new",
  "reason_for_visit": "Sore throat and fever",
  "intended_visit_timeframe": "this evening 6-7pm",
  "disposition": "completed",
  "emergency_trigger": false,
  "spam_flag": false,
  "sms_sent": true,
  "gcal_event_id": "gcal_abc123xyz",
  "call_duration_seconds": 145
}
```

### SignalWire SMS

Outbound SMS is sent via `@signalwire/compatibility-api` (Twilio-compatible SDK). The sending number is `SIGNALWIRE_FROM_NUMBER`.

**Triggers for outbound SMS:**
- Post-call follow-up (consent-gated, EN/ES)
- Day-before appointment reminder (23–25hr before visit)
- 1-hour-before appointment reminder (55–65min before visit)
- Rating acknowledgement reply
- Staff alert for appointment change/cancel (to `STAFF_ALERT_PHONE`)

### Google Calendar

Outbound event creation via `googleapis` service account. Called after `call_ended` when:
- `disposition === 'completed'`
- `intended_visit_timeframe` is present
- `spam_flag === false`
- `emergency_trigger === false`
- `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` are configured

**Event format:**
```
Title:   "Urgent Care Walk-In — [caller_name]"
Start:   Parsed from intended_visit_timeframe (fallback: call timestamp + 1hr)
End:     Start + 1 hour
Desc:    Reason: [reason_for_visit]
         Phone: [caller_id]
         Patient type: [patient_type]
         Call ID: [call_id]
```

---

## Data Models

### Call Record

Complete call record logged to Keragon W1 and cached in Redis.

```json
{
  "call_id": "retell_call_abc123",
  "timestamp": "2026-02-25T23:45:00.000Z",
  "caller_id": "+15551234567",
  "caller_name": "John Smith",
  "patient_type": "new|returning|unknown",
  "reason_for_visit": "Sore throat and mild fever",
  "intended_visit_timeframe": "this evening 6-7pm",
  "appointment_type": "new|change|cancel|null",
  "existing_appointment_id": "appt_abc123",
  "sms_consent_explicit": true,
  "call_duration_seconds": 145,
  "disposition": "completed|high_intent|emergency|spam|dropped|incomplete|appointment_cancel|appointment_change",
  "emergency_trigger": false,
  "spam_flag": false,
  "spam_reasons": [],
  "sms_sent": true,
  "sms_delivery_status": "delivered|failed|pending",
  "gcal_event_id": "gcal_abc123xyz",
  "ai_decision_path": ["greeting", "new_patient_intake", "reason_capture"],
  "error_notes": null,
  "end_reason": "agent_hangup",
  "clinic_id": "urgent_care_001"
}
```

**New fields (v2.0):**

| Field | Type | Description |
|-------|------|-------------|
| `appointment_type` | string\|null | `"new"`, `"change"`, or `"cancel"` from RetellAI extracted data |
| `existing_appointment_id` | string\|null | ID of existing Redis-scheduled appointment (for change/cancel) |
| `sms_consent_explicit` | boolean | True only if patient explicitly gave consent during the call |
| `gcal_event_id` | string\|null | Google Calendar event ID (set after successful calendar write) |

**Disposition Values**

| Value | Meaning |
|-------|---------|
| `completed` | Normal call, patient info captured |
| `high_intent` | Strong booking intent but timeframe unclear |
| `emergency` | Emergency keywords detected; directed to 911/988 |
| `spam` | Multi-factor spam score ≥ 3; terminated early |
| `dropped` | Call ended without completing intake |
| `incomplete` | Partial intake captured |
| `appointment_cancel` | Patient requested appointment cancellation |
| `appointment_change` | Patient requested appointment time change |

---

### Emergency Detection Result

```json
{
  "isEmergency": true,
  "isMentalHealthCrisis": false,
  "detectedKeywords": ["chest pain", "difficulty breathing"],
  "recommendation": "IMMEDIATE: Direct caller to 911 or 988 (mental health)",
  "confidence": 0.95
}
```

---

### Spam Analysis Result

```json
{
  "isSpam": true,
  "spamScore": 8,
  "reasons": [
    "Extended silence at call start",
    "Spam keywords detected: warranty, car warranty",
    "Robocall speech patterns detected"
  ],
  "confidence": 0.85,
  "recommendation": "FLAG_AND_TERMINATE"
}
```

---

### SMS Message Record

```json
{
  "message_sid": "SM1234567890abcdef",
  "to": "+15551234567",
  "from": "+15559876543",
  "body": "Hi John, thank you for calling Your Urgent Care...",
  "status": "delivered",
  "sent_at": "2026-02-25T23:45:00.000Z",
  "delivered_at": "2026-02-25T23:45:05.000Z"
}
```

---

### Scheduled Appointment Record (Redis)

Stored in Redis under key `appointment:{callId}` for reminder scheduling.

```json
{
  "callId": "retell_call_abc123",
  "patientPhone": "+15551234567",
  "patientName": "John Smith",
  "visitTimeframe": "2026-02-26T18:00:00.000Z",
  "clinicName": "Your Urgent Care",
  "locale": "en",
  "scheduledAt": "2026-02-25T23:45:00.000Z"
}
```

---

### Inbound SMS Classification

```json
{
  "type": "opt_out|opt_in|rating|freetext",
  "score": 4
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "call_id",
      "issue": "Required field missing"
    },
    "timestamp": "2026-02-25T23:45:00.000Z",
    "request_id": "req_1234567890"
  }
}
```

### HTTP Status Codes

| Status | Code | Description |
|--------|------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication failed |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 502 | Bad Gateway | External service error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Authentication failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `SERVICE_UNAVAILABLE` | External service down |
| `WEBHOOK_INVALID` | Invalid webhook signature |
| `CALL_NOT_FOUND` | Call record not found |
| `SMS_SEND_FAILED` | SMS delivery failed |
| `EMERGENCY_DETECTED` | Emergency call detected |
| `SPAM_DETECTED` | Spam call detected |

---

## Rate Limiting

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643145600
```

### Rate Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/webhook/*` | 1000 requests | 1 minute |
| `/health` | 60 requests | 1 minute |
| All other | 100 requests | 1 minute |

---

## Webhook Integration Guide

### SignalWire Configuration

#### Voice Webhook
```
URL: https://api.yourclinic.com/webhook/signalwire/voice
Method: POST (form data)
```

Configure in the SignalWire dashboard under Phone Numbers → [your number] → Voice & Fax → "A call comes in" → Webhook.

#### SMS Status Callback
```
URL: https://api.yourclinic.com/webhook/signalwire/sms-status
Method: POST (form data)
```

Configure in the SignalWire dashboard under Messaging → Campaigns → Status Callback URL.

#### Inbound SMS Webhook
```
URL: https://api.yourclinic.com/webhook/sms/inbound
Method: POST (form data)
```

Configure in the SignalWire dashboard under Phone Numbers → [your number] → Messaging → "A message comes in" → Webhook.

---

### RetellAI Webhook Configuration

1. **Configure Webhook URL**
   ```
   https://api.yourclinic.com/webhook/retell
   ```

2. **Set Webhook Secret**
   ```
   Environment: RETELL_WEBHOOK_SECRET
   Value: your_random_secret_string
   ```

3. **Event Subscription**
   - `call.started`
   - `call.ended`
   - `call.analyzed`
   - `call.transcript_update`

---

### Webhook Signature Validation

#### RetellAI Signature (Node.js)

```javascript
const crypto = require('crypto');

function validateRetellSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Usage in middleware
const payload = JSON.stringify(req.body);
const signature = req.headers['x-retell-signature'];
const isValid = validateRetellSignature(payload, signature, process.env.RETELL_WEBHOOK_SECRET);
```

#### SignalWire Signature (Node.js)

SignalWire uses the standard Twilio-compatible request validation. Use the `@signalwire/compatibility-api` or `twilio` validator:

```javascript
const { validateRequest } = require('@signalwire/compatibility-api');

const isValid = validateRequest(
  process.env.SIGNALWIRE_AUTH_TOKEN,
  req.headers['x-signalwire-signature'],
  `https://api.yourclinic.com${req.originalUrl}`,
  req.body
);
```

---

## Testing

### Test Environment

**Base URL**: `http://localhost:3000`
**Mock Mode**: Set `MOCK_MODE=true` and `USE_MOCKS=true` to use all mock services

### Test a Call Ended Event (with appointment booking)

```bash
curl -X POST http://localhost:3000/webhook/retell \
  -H "Content-Type: application/json" \
  -H "X-Retell-Signature: test" \
  -d '{
    "call_id": "test_call_123",
    "event_type": "call_ended",
    "duration_seconds": 145,
    "transcript": "Test transcript",
    "metadata": { "caller_number": "+15551234567" },
    "extracted_data": {
      "caller_name": "Test User",
      "patient_type": "new",
      "reason_for_visit": "Sore throat",
      "visit_timeframe": "2026-02-26T18:00:00Z",
      "sms_consent_explicit": true
    }
  }'
```

### Test an Inbound SMS Rating

```bash
curl -X POST http://localhost:3000/webhook/sms/inbound \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B15551234567&To=%2B15559876543&Body=4&SmsSid=SM123test"
```

### Test an Appointment Cancel Event

```bash
curl -X POST http://localhost:3000/webhook/retell \
  -H "Content-Type: application/json" \
  -H "X-Retell-Signature: test" \
  -d '{
    "call_id": "test_cancel_456",
    "event_type": "call_ended",
    "duration_seconds": 90,
    "metadata": { "caller_number": "+15551234567" },
    "extracted_data": {
      "caller_name": "Jane Doe",
      "appointment_type": "cancel",
      "existing_appointment_id": "appt_abc123"
    }
  }'
```

### Health Check

```bash
curl http://localhost:3000/health
```

**Expected Response**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-25T23:45:00.000Z",
  "checks": { "server": {...}, "redis": {...} }
}
```

---

## Changelog

### v2.0 (2026-02-25)
- Added `POST /webhook/sms/inbound` endpoint with full rating/opt-out/freetext documentation
- Added `appointment_type`, `existing_appointment_id`, `sms_consent_explicit`, `gcal_event_id` to Call Record model
- Added `appointment_cancel` and `appointment_change` disposition values
- Added Outbound API Calls section (Keragon, SignalWire SMS, Google Calendar)
- Added Keragon workflow routing table (W1–W4 event types)
- Added Scheduled Appointment Record and Inbound SMS Classification data models
- Added `call_ended` processing pipeline steps
- Updated SignalWire webhook configuration to include inbound SMS URL
- Fixed date (was 2026-01-25, now 2026-02-25)

### v1.0 (2026-01-25)
- Initial production release
- RetellAI and SignalWire webhook endpoints
- Health check endpoints
- Error handling and validation
- Rate limiting implementation

---

## Support

### API Support
- **Documentation**: https://docs.yourclinic.com/api
- **Support Email**: api-support@yourclinic.com
- **Status Page**: https://status.yourclinic.com

---

**API Version**: 2.0
**Base URL**: https://api.yourclinic.com
**Documentation Version**: 2.0
**Last Updated**: 2026-02-25
