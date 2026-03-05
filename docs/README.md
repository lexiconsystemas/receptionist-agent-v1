# Receptionist Agent V1 - Documentation

## 📋 Overview

Welcome to the official documentation for the Receptionist Agent V1, an enterprise-grade AI-powered after-hours receptionist system designed specifically for urgent care facilities.

## 🏗️ System Architecture

The Receptionist Agent V1 is built with a modular, scalable architecture that integrates multiple AI and telephony services to provide seamless after-hours call handling.

> **Delivery 1 scope:** RetellAI, Keragon, and Google Calendar are live and configured. SMS (Notifyre) is held for Delivery 2 — SMS runs in mock mode for Delivery 1. Notifyre integration will be completed at that milestone.

### Core Components

- **Voice Agent**: RetellAI — inbound PSTN calls, STT/TTS, conversation logic (agent name: Grace)
- **AI Intelligence**: Hathr.ai (healthcare LLM — stubbed, not active; conversation logic runs in RetellAI)
- **SMS**: Notifyre — post-call follow-up, reminders, ratings (Delivery 2; mock mode for Delivery 1)
- **Automation**: Keragon for healthcare workflow orchestration (4 live workflows)
- **Backend**: Node.js/Express with enterprise-grade security and scalability
- **Caching**: Redis for session management and performance optimization

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Voice Interface | Patient interaction |
| **Voice AI** | RetellAI (agent: Grace) | PSTN, speech processing, call flow |
| **LLM** | Hathr.ai (stubbed) | Not active — logic runs in RetellAI |
| **SMS** | Notifyre (Delivery 2) | Post-call SMS, reminders, ratings |
| **Automation** | Keragon | Workflows |
| **Backend** | Node.js/Express | API & Logic |
| **Cache** | Redis | Sessions |
| **Database** | Keragon | Logging |

---

## 📚 Documentation Structure

### 🚀 [Deployment Guide](./DEPLOYMENT_GUIDE.md)
Complete deployment instructions for production environments including Docker, Kubernetes, and monitoring setup.

**Key Sections:**
- System requirements and prerequisites
- Environment configuration
- Docker and Kubernetes deployment
- Monitoring and observability
- Security configuration
- Troubleshooting procedures

### 🔧 [Operations Manual](./OPERATIONS_MANUAL.md)
Comprehensive operational procedures for system administration, monitoring, and maintenance.

**Key Sections:**
- Standard Operating Procedures (SOPs)
- Health monitoring and alerting
- Incident response procedures
- Backup and recovery
- Performance optimization
- Security procedures

### 📡 [API Specification](./API_SPECIFICATION.md)
Complete RESTful API documentation including all endpoints, data models, and integration guidelines.

**Key Sections:**
- Authentication and security
- Webhook endpoints and events
- Data models and schemas
- Error handling and status codes
- Rate limiting and throttling
- SDKs and client libraries

### 🛡️ [Compliance Guide](./COMPLIANCE_GUIDE.md)
HIPAA-conscious design and compliance framework for healthcare data protection.

**Key Sections:**
- HIPAA compliance measures
- Data classification and handling
- Privacy by design principles
- Security controls and monitoring
- Vendor management
- Training and awareness

### 🏛️ [System Architecture](./ARCHITECTURE.md)
Detailed technical architecture documentation including system design and data flow.

**Key Sections:**
- Component interactions
- Data flow diagrams
- Technology stack details
- Integration patterns
- Scalability considerations

### 📋 [Implementation Status](./API_INTEGRATION_PLAN.md)
Current build status for all integrations, remaining items before acceptance, and the access map required before final payment (§6).

**Key Sections:**
- Per-integration status (RetellAI, Notifyre/SMS, Keragon, Google Calendar, Scheduler)
- What still needs client credentials
- Remaining items before walkthrough and acceptance
- Access map (§6 — required before final payment)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 18.0+
- **Docker**: 20.10+ (for containerized deployment)
- **Redis**: 7.0+ (included in Docker Compose)
- **API Credentials**: RetellAI, Keragon, Google Calendar (Notifyre for SMS — Delivery 2)

### Installation

```bash
# Clone repository
git clone https://github.com/yourclinic/receptionist-agent-v1.git
cd receptionist-agent-v1

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API credentials

# Start with mocks (for testing)
npm run docker:dev

# Start production services
npm run docker:run
```

### Verification

```bash
# Health check
curl http://localhost:3000/health

# Run tests
npm run test:unit
npm run test:integration
npm run test:mock

# View logs
docker-compose logs -f app
```

---

## 🔧 Configuration

### Environment Variables

#### Required Configuration
```env
# Core System
NODE_ENV=production
PORT=3000
MOCK_MODE=true          # Keep true for Delivery 1; set false when Notifyre is live

# RetellAI (voice + call flow)
RETELL_API_KEY=your_retell_api_key
RETELL_AGENT_ID=your_agent_id
RETELL_WEBHOOK_SECRET=your_webhook_secret

# SMS — Notifyre (Delivery 2)
# Full Notifyre integration held for Delivery 2. SMS_ENABLED=false for Delivery 1.
SMS_ENABLED=false

# Keragon — 4 live workflow webhooks
KERAGON_WEBHOOK_URL=https://webhooks.us-1.keragon.com/v1/workflows/9f74dcab-.../signal
KERAGON_EMERGENCY_WEBHOOK_URL=https://webhooks.us-1.keragon.com/v1/workflows/9e1230aa-.../signal
KERAGON_SMS_WEBHOOK_URL=https://webhooks.us-1.keragon.com/v1/workflows/0fa3ed22-.../signal
KERAGON_EDGE_WEBHOOK_URL=https://webhooks.us-1.keragon.com/v1/workflows/2760c73d-.../signal

# Google Calendar (service account — write-only)
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----"

# Clinic Information
CLINIC_NAME="Your Urgent Care"
CLINIC_ADDRESS="123 Main St, City, State"
CLINIC_PHONE=           # Optional — add at clinic onboarding. Omit for demo MVP.
CLINIC_TIMEZONE=America/New_York
```

#### Optional Configuration
```env
# Redis
REDIS_URL=redis://localhost:6379

# Security
WEBHOOK_SIGNATURE_SECRET=your_webhook_secret
RATE_LIMIT_MAX_REQUESTS=100

# Features
SMS_ENABLED=true
SCHEDULER_ENABLED=true
PHI_RETENTION_DAYS=7
SMS_FOLLOWUP_DELAY_MINUTES=5

# Staff alert for appointment change/cancel
STAFF_ALERT_PHONE=+1xxxxxxxxxx
```

---

## 🧪 Testing

### Test Suites

```bash
# Unit tests (business logic)
npm run test:unit

# Integration tests (API endpoints)
npm run test:integration

# Mock integration tests (full flow)
npm run test:mock

# Coverage report
npm run test:coverage
```

### Test Results Summary

- **Total**: 143/143 passing ✅ (as of 2/25/2026)
- **Coverage**: 95%+ for critical business logic ✅

---

## 📊 Monitoring

### Health Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /health` | System health | Detailed status |
| `GET /ready` | Readiness probe | Ready/Not ready |
| `GET /live` | Liveness probe | Alive status |

### Key Metrics

- **Response Time**: <2 seconds average
- **Error Rate**: <1% of total requests
- **Uptime**: 99.9% availability target
- **Concurrent Calls**: 100+ supported

---

## 🛡️ Security

### Security Features

- **Authentication**: HMAC-SHA256 webhook signatures
- **Encryption**: TLS 1.3 for all communications
- **Input Validation**: Comprehensive sanitization
- **Rate Limiting**: Configurable per client
- **Access Control**: Role-based permissions
- **Audit Logging**: Complete audit trail

### HIPAA-Conscious Design

- **Data Minimization**: Only collect necessary information
- **PHI Protection**: Automatic redaction of sensitive data
- **Audit Trails**: Complete logging of data access
- **Secure Storage**: Encrypted data at rest and in transit

---

## 🔄 Integration

### Webhook Configuration

#### RetellAI
```
URL: https://api.yourclinic.com/webhook/retell
Events: call.started, call.ended, call.analyzed
Secret: RETELL_WEBHOOK_SECRET
```

#### SMS — Notifyre (Delivery 2)
```
Inbound SMS URL: https://api.yourclinic.com/webhook/sms/inbound
Status callback:  https://api.yourclinic.com/webhook/sms/status
(Configure in Notifyre dashboard at Delivery 2 integration)
```

#### Keragon
```
Callback URL: https://api.yourclinic.com/webhook/keragon/callback
Secret: KERAGON_WEBHOOK_SECRET
```

### API Integration

```javascript
// Example: Send call data to system
const response = await fetch('https://api.yourclinic.com/webhook/retell', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Retell-Signature': generateSignature(payload, secret)
  },
  body: JSON.stringify({
    call_id: 'call_123',
    event_type: 'call_ended',
    extracted_data: {
      caller_name: 'John Smith',
      patient_type: 'new',
      reason_for_visit: 'Sore throat'
    }
  })
});
```

---

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs app

# Verify configuration
docker-compose config

# Test environment
curl http://localhost:3000/health
```

#### API Integration Issues
```bash
# Test API connectivity
curl -H "Authorization: Bearer $RETELL_API_KEY" \
     https://api.retellai.com/agents

# Verify webhook delivery
curl -X POST http://localhost:3000/webhook/retell \
     -H "Content-Type: application/json" \
     -d '{"event_type":"test"}'
```

#### Performance Issues
```bash
# Check system resources
docker stats

# Monitor Redis
redis-cli --latency-history

# Analyze logs
grep "ERROR" logs/app.log | tail -20
```

### Debug Mode

```env
# Enable debug logging
LOG_LEVEL=debug
DEBUG=receptionist:*

# Use mock services
MOCK_MODE=true
USE_MOCKS=true
```

---

## 📞 Support

### Getting Help

| Resource | Contact | Response Time |
|-----------|---------|---------------|
| **Documentation** | This guide | Immediate |
| **API Support** | api-support@yourclinic.com | 24 hours |
| **Security Issues** | security@yourclinic.com | 4 hours |
| **Critical Issues** | oncall@yourclinic.com | 15 minutes |

### Community

- **GitHub Issues**: https://github.com/yourclinic/receptionist-agent-v1/issues
- **Documentation**: https://docs.yourclinic.com/receptionist-agent
- **Status Page**: https://status.yourclinic.com

---

## 📈 Roadmap

### Current Version: v1.1 (3/5/2026)

**Features — Delivery 1 (Live):**
- ✅ After-hours call handling (RetellAI — agent name: Grace, live and tested)
- ✅ Emergency detection and 911 routing (20+ keyword categories; Ambiguous Symptom Protocol for borderline cases)
- ✅ Spam call filtering (multi-factor scoring)
- ✅ Soft scheduling — 1-hour windows logged to Google Calendar
- ✅ Patient date of birth (DOB) captured and logged to Google Calendar event description
- ✅ Appointment change / cancel flow (cancel reminder + SMS staff alert)
- ✅ SMS follow-up messaging (consent-gated, bilingual EN/ES) — **mock mode for Delivery 1**
- ✅ Day-before + 1-hour-before appointment SMS reminders (cron-based) — **mock mode for Delivery 1**
- ✅ Rating SMS (1–5 scale, low-score follow-up ≤3) — **mock mode for Delivery 1**
- ✅ Keragon logging — 4 live workflows (call logs, emergencies, SMS events, edge cases)
- ✅ Staff email alerts via SendGrid (low ratings, SMS failures, freetext replies)
- ✅ PHI auto-deletion — 7-day cron, HIPAA-conscious
- ✅ HIPAA-conscious design with field sanitization
- ⏳ `schedule_soft_appointment` deactivated — visit timeframes captured via `log_call_information` (placeholder URL removed)
- ⏳ SMS/Notifyre full integration — Delivery 2

### Planned Enhancements

**v1.1 (Q2 2026)**
- Multi-language support
- Advanced analytics dashboard
- Custom clinic workflows
- Enhanced AI capabilities

**v2.0 (Q4 2026)**
- Video call support
- Integration with EMR systems
- Predictive analytics
- Mobile app for staff

---

## 📄 Licensing

This software is licensed under the **UNLICENSED** proprietary license agreement. Use is restricted to licensed healthcare facilities and authorized partners.

### Usage Rights

- ✅ Licensed healthcare facilities
- ✅ Authorized implementation partners
- ✅ Development and testing environments
- ❌ Redistribution or resale
- ❌ Competitive use

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| **1.1** | 2026-03-05 | DOB capture pipeline; `schedule_soft_appointment` deactivated; Ambiguous Symptom Protocol (bleeding/fever); after-hours awareness rule; Grace persona; SMS provider → Notifyre (D2); speech tuning |
| **1.0** | 2026-02-25 | Scheduler, rating SMS, PHI deletion, Keragon 4-workflow routing, SignalWire migration, inboundSmsHandler |
| **0.5** | 2026-01-25 | Initial production release |

---

## 📚 Additional Resources

### Technical Documentation
- [System Architecture Details](./ARCHITECTURE.md)
- [API Reference](./API_SPECIFICATION.md)
- [Deployment Procedures](./DEPLOYMENT_GUIDE.md)

### Operational Resources
- [Operations Manual](./OPERATIONS_MANUAL.md)
- [Compliance Guide](./COMPLIANCE_GUIDE.md)
- [Integration Plan](./API_INTEGRATION_PLAN.md)

### Developer Resources
- [SDK Documentation](https://docs.yourclinic.com/sdk)
- [Example Code](https://github.com/yourclinic/receptionist-examples)
- [Community Forums](https://community.yourclinic.com)

---

**Last Updated**: March 5, 2026
**Document Version**: 2.1

---

*This documentation is maintained by the Receptionist Agent development team. For questions or contributions, please contact dev-team@yourclinic.com.*
