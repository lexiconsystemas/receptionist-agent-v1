# Keragon Workflow Specifications
# After-Hours AI Receptionist — Urgent Care MVP
#
# 4 workflows need to be created in the Keragon dashboard.
# This document defines exactly what each workflow receives (trigger payload)
# and what it must do (actions).
#
# Our server posts to Keragon at the URL stored in KERAGON_WEBHOOK_URL.
# Each payload includes an `event` field — use that to route to the right workflow.
#
# Contract reference: Exhibit A §4 (Keragon), §5.4 (Logging Requirements)
# ─────────────────────────────────────────────────────────────────────────────

---

## WORKFLOW 1 — Call Log (Primary)

**Keragon Workflow Name:** `receptionist_call_log`
**Trigger:** Webhook POST — filter on `event == "call_ended"`

### Trigger Payload

```json
{
  "event": "call_ended",
  "call_id": "retell_call_abc123",
  "timestamp": "2026-03-01T03:22:14.000Z",
  "caller_id": "+12125550100",
  "call_duration_seconds": 187,
  "caller_name": "Maria Garcia",
  "patient_type": "new",
  "reason_for_visit": "Cough and fever since yesterday",
  "intended_visit_timeframe": "tomorrow morning around 9am",
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
  "ai_decision_path": ["greeting", "name_capture", "patient_type", "reason", "scheduling", "sms_consent", "feedback_consent", "closing"],
  "error_notes": null,
  "end_reason": "caller_hangup"
}
```

### Required Actions in Keragon

1. **Create record** in your Keragon data store / connected Google Sheet with all fields above
2. **If `emergency_trigger == true`** → trigger Workflow 2 (Emergency Alert)
3. **If `spam_flag == true`** → tag the record with label `SPAM` and skip all downstream actions
4. **If `callback_requested == true`** → create a task in staff review queue: "Callback needed — [caller_name] — [caller_id]" scheduled for next business day 8:00 AM
5. **If `sms_sent == false` AND `sms_consent_explicit == true`** → create staff alert: "SMS failed for [caller_id] — manual follow-up needed"

### Fields That Must Be Logged (from scope §5.4)

| Field | Source |
|---|---|
| Caller ID / phone number | `caller_id` |
| Timestamp | `timestamp` |
| Call duration | `call_duration_seconds` |
| Booking outcome | `disposition` + `intended_visit_timeframe` |
| Emergency trigger | `emergency_trigger` |
| Reason for visit / AI notes | `reason_for_visit` + `ai_decision_path` |
| Spam flag | `spam_flag` + `spam_reasons` |
| SMS sent + delivery status | `sms_sent` + `sms_delivery_status` |
| Edge case notes | `error_notes` |

### PHI Deletion Rule

**Set a 7-day auto-delete on every record.** On day 7, Keragon must delete:
- `caller_name`
- `reason_for_visit`
- `caller_id` (anonymize to last 4 digits)

Retain: `call_id`, `timestamp`, `disposition`, `duration`, `sms_sent`, `spam_flag` (for audit).

---

## WORKFLOW 2 — Emergency Alert

**Keragon Workflow Name:** `receptionist_emergency_alert`
**Trigger:** Webhook POST — filter on `event == "emergency_detected"`

### Trigger Payload

```json
{
  "event": "emergency_detected",
  "call_id": "retell_call_abc123",
  "timestamp": "2026-03-01T03:18:44.000Z",
  "detected_keywords": ["chest pain", "can't breathe"],
  "is_mental_health_crisis": false,
  "caller_phone": "+12125550100",
  "transcript_excerpt": "I have really bad chest pain and I can't breathe properly",
  "recommendation": "IMMEDIATE: Direct caller to 911 or 988 (mental health)"
}
```

### Required Actions in Keragon

1. **Log the event** with all fields — tag record `EMERGENCY`
2. **Send immediate SMS or email alert to clinic owner/staff** with:
   - Time of call
   - Detected keywords
   - Whether it was a mental health crisis
   - Caller phone number (so staff can proactively call back if needed)
3. **If `is_mental_health_crisis == true`** → include 988 Lifeline in the alert message
4. **Create a priority staff review task** — do not auto-delete this record

### Suggested Alert Message to Staff

```
EMERGENCY DETECTED — After-Hours AI Receptionist
Time: {{timestamp}}
Caller: {{caller_phone}}
Keywords: {{detected_keywords}}
Mental health crisis: {{is_mental_health_crisis}}
The AI redirected this caller to 911{{#if is_mental_health_crisis}} / 988{{/if}}.
Please review and consider a proactive follow-up call.
```

---

## WORKFLOW 3 — SMS Status + Rating Log

**Keragon Workflow Name:** `receptionist_sms_events`
**Trigger:** Webhook POST — filter on `event` in `["sms_sent", "patient_rating", "sms_opt_out", "sms_opt_in", "sms_freetext_reply"]`

### Trigger Payloads

**SMS sent confirmation:**
```json
{
  "event": "sms_sent",
  "callId": "retell_call_abc123",
  "smsResult": {
    "success": true,
    "messageSid": "SM1234567890abcdef",
    "status": "queued"
  }
}
```

**Patient rating received:**
```json
{
  "event": "patient_rating",
  "phone_number": "+12125550100",
  "rating": 2,
  "raw_reply": "2",
  "timestamp": "2026-03-01T09:44:00.000Z",
  "low_score_alert": true,
  "requires_review": true
}
```

**Opt-out received:**
```json
{
  "event": "sms_opt_out",
  "phone_number": "+12125550100",
  "reply_body": "STOP",
  "timestamp": "2026-03-01T10:00:00.000Z",
  "action_taken": "flagged_do_not_sms"
}
```

**Free text reply:**
```json
{
  "event": "sms_freetext_reply",
  "phone_number": "+12125550100",
  "message_body": "Can I bring my insurance card the day of?",
  "timestamp": "2026-03-01T10:15:00.000Z",
  "requires_review": true,
  "note": "Patient replied with free text — needs staff review"
}
```

### Required Actions in Keragon

1. **For `patient_rating`:**
   - Log rating score, phone, and timestamp
   - **If `low_score_alert == true` (rating ≤ 3):** create a staff alert task — "Low rating received ({{rating}}/5) from {{phone_number}} — follow-up needed"
   - Do NOT store any free-text feedback in the same record as the rating score
   - Do NOT store medical detail — if free text contains medical terms, log only: "Medical content detected — not stored"

2. **For `sms_freetext_reply`:**
   - Create staff review task with the message body
   - Tag as `PATIENT_MESSAGE`
   - Apply 7-day auto-delete

3. **For `sms_opt_out`:**
   - Log permanently — this record must NOT be auto-deleted (compliance)
   - Tag `TCPA_OPTOUT`

4. **For `sms_sent`:** Log delivery status update against the matching `call_id`

---

## WORKFLOW 4 — Edge Case + Error Log

**Keragon Workflow Name:** `receptionist_edge_cases`
**Trigger:** Webhook POST — filter on `event` in `["sms_failed", "phi_auto_deletion", "call_status_update"]`

### Trigger Payloads

**SMS failure:**
```json
{
  "event": "sms_failed",
  "type": "sms_failed",
  "callId": "retell_call_abc123",
  "description": "SMS failed: Network timeout",
  "context": {
    "phoneNumber": "+12125550100",
    "errorCode": "30008"
  }
}
```

**PHI deletion audit record:**
```json
{
  "event": "phi_auto_deletion",
  "timestamp": "2026-03-08T02:00:00.000Z",
  "retention_days": 7,
  "records_deleted": 23,
  "errors": 0
}
```

**Call status update:**
```json
{
  "event": "call_status_update",
  "callId": "retell_call_abc123",
  "status": "in_progress",
  "timestamp": "2026-03-01T03:15:00.000Z"
}
```

### Required Actions in Keragon

1. **For `sms_failed`:**
   - Log the failure
   - Create staff task: "Manual SMS follow-up needed for call [callId]"

2. **For `phi_auto_deletion`:**
   - Log the audit record permanently — **this record must never be auto-deleted**
   - This is your compliance trail showing PHI was deleted on schedule

3. **For `call_status_update`:**
   - Update the status field on the matching call record

---

## Keragon Setup Checklist

- [ ] Create Keragon account (under Arthur Garnett's login)
- [ ] Create a new Workspace named `receptionist-agent-v1`
- [ ] Create Workflow 1: `receptionist_call_log`
- [ ] Create Workflow 2: `receptionist_emergency_alert`
- [ ] Create Workflow 3: `receptionist_sms_events`
- [ ] Create Workflow 4: `receptionist_edge_cases`
- [ ] Copy each workflow's webhook trigger URL
- [ ] Paste all 4 URLs into `.env` as:
  ```
  KERAGON_WEBHOOK_URL=https://api.keragon.com/webhook/WORKFLOW_1_ID
  KERAGON_EMERGENCY_WEBHOOK_URL=https://api.keragon.com/webhook/WORKFLOW_2_ID
  KERAGON_SMS_WEBHOOK_URL=https://api.keragon.com/webhook/WORKFLOW_3_ID
  KERAGON_EDGE_WEBHOOK_URL=https://api.keragon.com/webhook/WORKFLOW_4_ID
  ```
- [ ] Test each workflow by POSTing the sample payload above
- [ ] Verify 7-day auto-delete is configured on Workflows 1, 3
- [ ] Verify Workflow 2 emergency alert reaches the right email/phone
- [ ] Confirm access is restricted to Arthur Garnett + designated staff only

---

## Data Protection Notes (Scope §5.4, §5.7)

- **NO data stored outside Keragon** (no Google Sheets, no spreadsheets, no other services)
- PHI auto-deletion at 7 days applies to: caller name, phone, reason for visit
- TCPA opt-out records are permanent — never delete
- PHI deletion audit records are permanent — never delete
- Emergency records are permanent — never delete
- All other records: 7-day TTL
