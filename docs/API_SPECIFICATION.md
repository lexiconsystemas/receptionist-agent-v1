# Receptionist Agent V1 - API Specification

## Document Information

| Version | Date | Author | Status |
|---------|------|--------|--------|
| 1.0 | 2026-01-25 | API Team | Production Ready |

---

## Overview

The Receptionist Agent V1 provides a comprehensive RESTful API for managing AI-powered after-hours call handling. This specification details all available endpoints, request/response formats, authentication requirements, and integration guidelines.

## Base URL

```
Production: https://api.yourclinic.com
Development: http://localhost:3000
```

## Authentication

### API Key Authentication

All API endpoints require authentication using API keys passed in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

### Webhook Authentication

Incoming webhooks are authenticated using HMAC-SHA256 signatures:

```
X-Retell-Signature: sha256=SIGNATURE
X-Keragon-Signature: sha256=SIGNATURE
X-Twilio-Signature: SIGNATURE
```

---

## Endpoints

### Health Check Endpoints

#### GET /health

Returns overall system health status including all dependencies.

**Response**
```json
{
  "status": "healthy|degraded|critical|error",
  "timestamp": "2026-01-25T23:45:00.000Z",
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
  "timestamp": "2026-01-25T23:45:00.000Z"
}
```

#### GET /live

Liveness probe for container orchestration.

**Response**
```json
{
  "status": "alive",
  "uptime": 86400,
  "timestamp": "2026-01-25T23:45:00.000Z"
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
  "timestamp": "2026-01-25T23:45:00.000Z",
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
    "visit_timeframe": "this evening 6-7pm"
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
| `call_ended` | Call completed | Process call data, send SMS |
| `call_analyzed` | Post-call analysis | Store analysis results |
| `transcript_update` | Real-time transcript | Emergency detection |

### POST /webhook/retell/status

Handles call status updates from RetellAI.

**Request Body**
```json
{
  "call_id": "retell_call_abc123",
  "status": "ongoing|ended|failed",
  "timestamp": "2026-01-25T23:45:00.000Z",
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

### POST /webhook/twilio/voice

Processes incoming Twilio voice calls and routes to RetellAI.

**Authentication**
- Required: `X-Twilio-Signature` header

**Request Body** (Form data)
```
From: +15551234567
To: +15559876543
CallSid: CA1234567890abcdef
Direction: inbound
```

**Response** (TwiML)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.retellai.com/call/websocket" />
  </Connect>
</Response>
```

### POST /webhook/twilio/sms-status

Handles SMS delivery status updates from Twilio.

**Request Body**
```json
{
  "MessageSid": "SM1234567890abcdef",
  "MessageStatus": "queued|sent|delivered|undelivered|failed",
  "To": "+15551234567",
  "ErrorCode": "21614",
  "ErrorMessage": "Message blocked"
}
```

**Response**
```
HTTP 200 OK
```

### POST /webhook/keragon/callback

Receives callbacks from Keragon workflow automation.

**Authentication**
- Required: `X-Keragon-Signature` header

**Request Body**
```json
{
  "workflow_id": "workflow_123",
  "status": "completed|failed|running",
  "timestamp": "2026-01-25T23:45:00.000Z",
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

## Data Models

### Call Record

```json
{
  "call_id": "retell_call_abc123",
  "timestamp": "2026-01-25T23:45:00.000Z",
  "caller_id": "+15551234567",
  "caller_name": "John Smith",
  "patient_type": "new|returning|unknown",
  "reason_for_visit": "Sore throat and mild fever",
  "intended_visit_timeframe": "this evening 6-7pm",
  "call_duration_seconds": 145,
  "disposition": "completed|high_intent|emergency|spam|dropped|incomplete",
  "emergency_trigger": false,
  "spam_flag": false,
  "spam_reasons": [],
  "sms_sent": true,
  "sms_delivery_status": "delivered|failed|pending",
  "ai_decision_path": ["greeting", "new_patient_intake", "reason_capture"],
  "error_notes": null,
  "end_reason": "agent_hangup",
  "clinic_id": "urgent_care_001"
}
```

### Emergency Detection

```json
{
  "isEmergency": true,
  "isMentalHealthCrisis": false,
  "detectedKeywords": ["chest pain", "difficulty breathing"],
  "recommendation": "IMMEDIATE: Direct caller to 911 or 988 (mental health)",
  "confidence": 0.95
}
```

### Spam Analysis

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

### SMS Message

```json
{
  "message_sid": "SM1234567890abcdef",
  "to": "+15551234567",
  "from": "+15559876543",
  "body": "Hi John, thank you for calling Your Urgent Care...",
  "status": "delivered",
  "sent_at": "2026-01-25T23:45:00.000Z",
  "delivered_at": "2026-01-25T23:45:05.000Z"
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
    "timestamp": "2026-01-25T23:45:00.000Z",
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

### Setting Up Webhooks

#### RetellAI Webhook Configuration

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

#### Twilio Webhook Configuration

1. **Voice Webhook**
   ```
   URL: https://api.yourclinic.com/webhook/twilio/voice
   Method: POST
   ```

2. **SMS Status Callback**
   ```
   URL: https://api.yourclinic.com/webhook/twilio/sms-status
   Method: POST
   ```

#### Keragon Webhook Configuration

1. **Callback URL**
   ```
   https://api.yourclinic.com/webhook/keragon/callback
   ```

2. **Authentication**
   ```
   Header: X-Keragon-Signature
   Secret: KERAGON_WEBHOOK_SECRET
   ```

### Webhook Signature Validation

#### Node.js Example

```javascript
const crypto = require('crypto');

function validateWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Usage
const payload = JSON.stringify(req.body);
const signature = req.headers['x-retell-signature'];
const isValid = validateWebhookSignature(payload, signature, process.env.RETELL_WEBHOOK_SECRET);
```

#### Python Example

```python
import hmac
import hashlib

def validate_webhook_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

# Usage
payload = json.dumps(request.json)
signature = request.headers.get('X-Retell-Signature')
is_valid = validate_webhook_signature(payload, signature, os.environ.get('RETELL_WEBHOOK_SECRET'))
```

---

## Testing

### Test Environment

**Base URL**: `http://localhost:3000`
**Mock Mode**: Set `MOCK_MODE=true` to use mock services

### Test Webhook Payload

```bash
curl -X POST http://localhost:3000/webhook/retell \
  -H "Content-Type: application/json" \
  -H "X-Retell-Signature: test" \
  -d '{
    "call_id": "test_call_123",
    "event_type": "call_ended",
    "transcript": "Test transcript",
    "extracted_data": {
      "caller_name": "Test User",
      "patient_type": "new"
    }
  }'
```

### Health Check Test

```bash
curl http://localhost:3000/health
```

**Expected Response**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T23:45:00.000Z",
  "checks": {...}
}
```

---

## SDKs and Libraries

### Node.js SDK

```javascript
const ReceptionistAPI = require('@receptionist/api');

const client = new ReceptionistAPI({
  baseURL: 'https://api.yourclinic.com',
  apiKey: 'your_api_key'
});

// Health check
const health = await client.health.check();

// Send webhook
const result = await client.webhooks.sendRetellEvent({
  call_id: 'call_123',
  event_type: 'call_ended',
  transcript: '...'
});
```

### Python SDK

```python
from receptionist_api import ReceptionistClient

client = ReceptionistClient(
    base_url='https://api.yourclinic.com',
    api_key='your_api_key'
)

# Health check
health = client.health.check()

# Send webhook
result = client.webhooks.send_retell_event(
    call_id='call_123',
    event_type='call_ended',
    transcript='...'
)
```

---

## Changelog

### v1.0 (2026-01-25)
- Initial production release
- Complete webhook API
- Health check endpoints
- Error handling and validation
- Rate limiting implementation

---

## Support

### API Support
- **Documentation**: https://docs.yourclinic.com/api
- **Support Email**: api-support@yourclinic.com
- **Status Page**: https://status.yourclinic.com

### Developer Resources
- **SDKs**: https://github.com/yourclinic/receptionist-sdks
- **Examples**: https://github.com/yourclinic/receptionist-examples
- **Community**: https://community.yourclinic.com

---

**API Version**: 1.0  
**Base URL**: https://api.yourclinic.com  
**Documentation Version**: 1.0  
**Last Updated**: 2026-01-25
