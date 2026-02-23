# System Architecture - AI Voice Receptionist

## Overview

The AI Voice Receptionist is a modular, reusable system designed for urgent care after-hours call handling. Built to be customizable for individual clinics without rewriting core components.

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Voice + Telephony** | RetellAI | Voice synthesis, recognition, telephony, PSTN, multi-call concurrency, HIPAA BAA |
| **LLM Layer** | Hathr.ai | Healthcare-focused conversation AI |
| **SMS** | TBD (Twilio/Vonage) | Outbound/inbound SMS only (post-call follow-up, reminders, ratings) |
| **Automation** | Keragon | Healthcare workflow orchestration, logging |
| **Calendar** | Google Calendar | Clinic hours, soft scheduling reference |
| **Backend** | Node.js/Express | Webhook handling, business logic |

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CALLER INTERACTION LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────┐                                                             │
│    │  Caller  │                                                             │
│    └────┬─────┘                                                             │
│         │ Phone Call                                                        │
│         ▼                                                                   │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │                RETELL AI (Telephony + Voice AI)                   │    │
│    │  • Inbound call reception (PSTN / phone number management)        │    │
│    │  • Voice synthesis (natural speech)                               │    │
│    │  • Speech recognition (STT)                                       │    │
│    │  • Multi-call concurrency handling                                │    │
│    │  • Real-time audio processing                                     │    │
│    │  • HIPAA BAA covers telephony layer                               │    │
│    └────────────────────────────┬─────────────────────────────────────┘    │
│                                 │ LLM API Calls                             │
│                                 ▼                                           │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │                        HATHR.AI                                   │    │
│    │  • Healthcare-focused LLM                                         │    │
│    │  • Conversation logic                                             │    │
│    │  • Soft scheduling decisions                                      │    │
│    │  • Emergency detection                                            │    │
│    │  • Non-diagnostic intent capture                                  │    │
│    └──────────────────────────────────────────────────────────────────┘    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                          APPLICATION LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │                   NODE.JS / EXPRESS SERVER                        │    │
│    │                                                                    │    │
│    │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │    │
│    │  │ Webhook Handler │  │ Spam Detection  │  │   Validation    │   │    │
│    │  │ (retellHandler) │  │ (spamDetection) │  │  (validation)   │   │    │
│    │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘   │    │
│    │           │                    │                    │            │    │
│    │           ▼                    ▼                    ▼            │    │
│    │  ┌─────────────────────────────────────────────────────────────┐ │    │
│    │  │                    SERVICES LAYER                           │ │    │
│    │  │  • callLogger.js  - Log to Keragon                          │ │    │
│    │  │  • smsService.js  - SMS follow-ups via SMS provider (TBD)   │ │    │
│    │  └─────────────────────────────────────────────────────────────┘ │    │
│    └──────────────────────────────────────────────────────────────────┘    │
│                                 │                                           │
│                                 │ Webhooks / API Calls                      │
│                                 ▼                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                         AUTOMATION LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │                         KERAGON                                   │    │
│    │  Healthcare-compliant workflow automation                         │    │
│    │                                                                    │    │
│    │  Workflows:                                                        │    │
│    │  • Call logging and structured data storage                       │    │
│    │  • SMS trigger automation                                         │    │
│    │  • Emergency alert routing                                        │    │
│    │  • Staff notification workflows                                   │    │
│    │  • Error/edge case handling                                       │    │
│    └────────────────────────────┬─────────────────────────────────────┘    │
│                                 │                                           │
│                                 ▼                                           │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │                    GOOGLE CALENDAR                                │    │
│    │  • Clinic hours reference                                         │    │
│    │  • Soft scheduling availability                                   │    │
│    └──────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Inbound Call Flow

```
1. Caller dials RetellAI-managed phone number
2. RetellAI handles telephony + voice ↔ text conversion directly
4. Hathr.ai processes conversation:
   - Identifies caller intent
   - Captures information (name, reason, timeframe)
   - Detects emergencies
   - Determines patient type (new/returning)
5. Express server receives webhook events
6. Spam detection runs on call data
7. Validation sanitizes captured info
8. Call record logged to Keragon
9. SMS follow-up sent if appropriate
```

### Emergency Detection Flow

```
1. Hathr.ai detects emergency keywords in conversation
2. Immediate interrupt triggered
3. AI states: "If this is a medical emergency, please hang up and dial 911 immediately."
4. Emergency logged to Keragon with emergency_trigger: true
5. Call ends (no further intake questions)
6. Mental health crises → 988 resource provided
```

### SMS Follow-up Flow

```
1. Call ends with disposition: completed/high_intent
2. Check: Not spam, not emergency, not dropped
3. Check: Duration > 30 seconds (implied consent)
4. Generate contextual message with clinic info
5. Send via SMS provider (TBD) with status callback
6. Log SMS status to Keragon
```

## Keragon Data Schema

All call data is logged to Keragon for staff review and audit.

```json
{
  "call_id": "retell_call_abc123",
  "timestamp": "2026-01-25T14:30:00.000Z",
  "caller_id": "+15551234567",
  "call_duration_seconds": 145,
  "caller_name": "John Smith",
  "patient_type": "new",
  "reason_for_visit": "Sore throat and mild fever",
  "intended_visit_timeframe": "this evening 6-7pm",
  "disposition": "high_intent",
  "emergency_trigger": false,
  "spam_flag": false,
  "spam_reasons": [],
  "sms_sent": true,
  "sms_delivery_status": "delivered",
  "ai_decision_path": ["greeting", "new_patient_intake", "reason_capture", "timeframe_capture", "closing"],
  "error_notes": null,
  "end_reason": "agent_hangup",
  "clinic_id": "urgent_care_001"
}
```

## Security & Compliance

### HIPAA-Conscious Design

| Requirement | Implementation |
|-------------|----------------|
| PHI Minimization | Only capture: name, phone, reason (non-diagnostic), timeframe, patient type |
| No Medical History | AI never asks for or logs medical history |
| No Insurance Data | Insurance information never requested or stored |
| Data Access Control | Keragon logs restricted to urgent care staff + client |
| Audit Trail | All calls logged with timestamps for compliance review |

### Data NOT Stored
- Medical history
- Insurance information
- SSN or government IDs
- Diagnostic information
- Treatment recommendations

## Modularity & Reusability

The system is designed as a **base model** that can be customized per clinic:

### Configurable Per Clinic
- Clinic name, address, phone
- Business hours
- SMS message templates
- Spam detection thresholds
- Keragon workflow IDs

### Core Components (Unchanged)
- Express server structure
- RetellAI integration
- Spam detection logic
- Validation rules
- Logging architecture

### Future Extensibility
- Add clinic-specific routing rules
- Custom greeting scripts
- Multi-location support
- Language preferences

## Endpoint Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Service info |
| `/health` | GET | Health check |
| `/webhook/retell` | POST | RetellAI call events |
| `/webhook/retell/status` | POST | Call status updates |
| `/webhook/sms/inbound` | POST | Inbound SMS replies (ratings, opt-outs) |
| `/webhook/sms/status` | POST | SMS delivery status callbacks |
| `/webhook/keragon/callback` | POST | Automation callbacks |

## Error Handling

### Edge Cases Logged to Keragon

| Edge Case | Action |
|-----------|--------|
| Dropped call (<30s) | Log with `disposition: dropped` |
| Incomplete info | Log with `disposition: incomplete` |
| Failed SMS | Log to `edge_case` event, notify staff |
| Multi-call conflicts | Keragon handles stateless (concurrent safe) |
| Emergency detected | Immediate log, override all other flows |

### Failsafe Behavior

When AI is uncertain or encounters errors:
1. Provide emergency statement: "If this is a medical emergency, please call 911."
2. End call gracefully
3. Log error to Keragon for staff review

## Testing Checklist

Per scope requirements (§7):

- [ ] End-to-end call flow testing
- [ ] Emergency detection accuracy
- [ ] Spam detection effectiveness
- [ ] Multi-call concurrency (simultaneous calls)
- [ ] SMS delivery verification
- [ ] Keragon logging completeness
- [ ] Edge case handling (dropped, incomplete, errors)
