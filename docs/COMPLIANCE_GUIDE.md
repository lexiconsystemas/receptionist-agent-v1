# Receptionist Agent V1 - Compliance Guide

## Document Control

| Version | Date | Author | Review Status |
|---------|------|--------|---------------|
| 1.0 | 2026-01-25 | Compliance Team | Approved |
| 1.1 | 2026-01-26 | Legal Counsel | Reviewed |
| 1.2 | 2026-02-25 | Dev Team | Updated — PHI auto-deletion, rating SMS, Calendar data note, BAA status |

---

## Executive Summary

This document outlines the compliance framework for the Receptionist Agent V1 system, focusing on HIPAA compliance, data protection, and healthcare industry regulations. The system is designed with privacy and security as foundational principles.

---

## Compliance Framework Overview

### Applicable Regulations

| Regulation | Scope | Compliance Status |
|------------|-------|------------------|
| **HIPAA** | Protected Health Information (PHI) | HIPAA-Conscious Design |
| **HITECH** | Health Information Technology | Implemented |
| **TCPA** | Telephone Consumer Protection | Compliant |
| **ADA** | Americans with Disabilities Act | Compliant |
| **State Privacy Laws** | Varies by state | Compliant |
| **GDPR** | EU Data Protection | Not Applicable (US Only) |

### Compliance Philosophy

**HIPAA-Conscious Design**: While not a full HIPAA-covered entity, the system follows HIPAA principles as best practice for healthcare data handling.

---

## Data Classification and Handling

### Data Categories

| Category | Description | Protection Level |
|----------|-------------|------------------|
| **PHI (Minimal)** | Name, phone, reason for visit | High |
| **Operational Data** | Call logs, timestamps | Medium |
| **System Data** | Configuration, metrics | Low |
| **Public Data** | Clinic hours, location | Public |

### Data Flow Classification

```
Incoming Call → Voice Processing → AI Analysis → Structured Logging → Google Calendar
     ↓               ↓                ↓              ↓                     ↓
   Caller ID      Transcript      Extracted Data    Keragon Logs      Walk-in Event
   (PHI)          (Temporary)      (Filtered PHI)   (Secure Storage)  (Limited PHI)
```

**Google Calendar Data Note:** When a patient books a soft-scheduled appointment, the system writes a 1-hour Google Calendar event containing: patient name, phone number, reason for visit (non-diagnostic), patient type (new/returning), and call ID. This event is visible to all staff with access to the clinic's shared Google Calendar. Data classification: **PHI (Minimal)**. Access should be restricted to clinic staff only. A BAA with Google is required before production use.

### Data Minimization Policy

**Collected Data (Approved)**
- ✅ Caller name (first name only preferred)
- ✅ Phone number (for follow-up)
- ✅ Reason for visit (non-diagnostic)
- ✅ Intended visit timeframe
- ✅ Patient type (new/returning)

**Explicitly NOT Collected**
- ❌ Social Security Number
- ❌ Date of Birth
- ❌ Medical History
- ❌ Insurance Information
- ❌ Detailed Symptoms
- ❌ Medication Information
- ❌ Treatment History

---

## HIPAA Compliance Measures

### Administrative Safeguards

#### Security Officer
- **Designated**: System Administrator
- **Responsibilities**: Policy enforcement, incident response
- **Contact**: security@yourclinic.com

#### Workforce Training
- **Initial Training**: 2 hours HIPAA fundamentals
- **Annual Refresher**: 1 hour update training
- **Documentation**: Training logs and competency assessments

#### Incident Response Plan
1. **Detection**: Automated monitoring and manual review
2. **Assessment**: Impact analysis and scope determination
3. **Containment**: Immediate isolation of affected systems
4. **Notification**: Internal and external notification procedures
5. **Recovery**: System restoration and data recovery
6. **Post-Incident**: Root cause analysis and prevention

### Physical Safeguards

#### Facility Access
- **Data Center**: Access controlled with badge authentication
- **Server Room**: Restricted access, environmental monitoring
- **Workstations**: Screen locks, clean desk policy

#### Device Security
- **Servers**: Encrypted storage, secure boot
- **Mobile Devices**: Device encryption, remote wipe capability
- **Backup Media**: Encrypted, stored in secure off-site location

### Technical Safeguards

#### RetellAI Data Storage Controls

The live RetellAI agent is configured via `scripts/update-retell-agent.js` with:

- **`data_storage_setting: "basic_attributes_only"`** — RetellAI does **not** store call transcripts, recordings, or call logs on their platform. Only basic call metadata (call ID, duration, timestamps, status) is retained. This eliminates the primary third-party PHI storage risk.
- **`data_storage_retention_days: 7`** — Even basic call metadata is auto-deleted from RetellAI after 7 days, matching the system-wide `PHI_RETENTION_DAYS` policy.
- **Transcript/summary stripping** — `transcript`, `call_transcript`, and `summary` fields are in the `prohibitedFields` list in `sanitizeForLogging()` (`src/services/callLogger.js`) and stripped by `scrubTranscriptForLogging()` (`src/config/retell.js`) before any Keragon logging. Emergency detection runs in-memory against the full transcript *before* any Keragon call — sequencing is preserved.

> ⚠️ **Arthur action required:** A BAA with RetellAI must be signed before production go-live. Even with `basic_attributes_only`, RetellAI processes audio in real-time and is a Business Associate under HIPAA. Contact RetellAI at [retellai.com](https://www.retellai.com) to obtain the BAA.
>
> **Optional belt-and-suspenders:** Enable PII redaction in the RetellAI dashboard (Settings → Privacy → PII Redaction) to auto-scrub names, phone numbers, DOBs from any data that does get stored. This guards against any future storage default changes.

To verify the live agent settings at any time:
```bash
curl -s -H "Authorization: Bearer $RETELL_API_KEY" \
  https://api.retellai.com/get-agent/$RETELL_AGENT_ID \
  | node -e "const p=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
    console.log('storage:', p.data_storage_setting, '| days:', p.data_storage_retention_days)"
# Expected: storage: basic_attributes_only | days: 7
```

#### Access Control
```yaml
# Role-Based Access Control (RBAC)
roles:
  - name: "admin"
    permissions: ["read", "write", "delete", "admin"]
  - name: "staff"
    permissions: ["read", "write"]
  - name: "auditor"
    permissions: ["read", "audit"]

# Access Logging
audit_log:
  - user_authentication
  - data_access
  - configuration_changes
  - data_exports
```

#### Audit Controls
```json
{
  "audit_event": {
    "timestamp": "2026-01-25T23:45:00.000Z",
    "user_id": "staff_123",
    "action": "access_call_record",
    "resource": "call_456",
    "ip_address": "192.168.1.100",
    "result": "success",
    "session_id": "sess_789"
  }
}
```

#### Integrity Controls
- **Data Validation**: Input sanitization and validation
- **Checksum Verification**: File integrity monitoring
- **Change Management**: Controlled deployment process
- **Backup Verification**: Regular backup testing

#### Transmission Security
```yaml
# Encryption Requirements
encryption:
  in_transit:
    - protocol: "TLS 1.3"
    - cipher_suites: ["TLS_AES_256_GCM_SHA384"]
    - certificate_validation: true
  
  at_rest:
    - database: "AES-256"
    - files: "AES-256"
    - backups: "AES-256"
```

---

## Data Protection Implementation

### Encryption Standards

#### Data in Transit
- **API Calls**: TLS 1.3 with perfect forward secrecy
- **Webhooks**: HMAC-SHA256 signature validation
- **Database Connections**: Encrypted tunnels
- **File Transfers**: SFTP with key-based authentication

#### Data at Rest
- **Database**: AES-256 encryption
- **File Storage**: Encrypted filesystems
- **Backups**: Encrypted before storage
- **Logs**: Sensitive data redaction

### Data Sanitization

#### Automatic PHI Redaction
```javascript
// PHI Sanitization Rules
const phiPatterns = [
  /\d{3}-\d{2}-\d{4}/g,           // SSN
  /\d{2}\/\d{2}\/\d{4}/g,          // Dates
  /\b\d{9}\b/g,                   // 9-digit numbers
  /\b[A-Z]{2}\d{4}\b/g,           // License numbers
  /insurance|policy|member/gi     // Insurance terms
];

function sanitizePHI(text) {
  let sanitized = text;
  phiPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });
  return sanitized;
}
```

#### Data Retention Policy
| Data Type | Retention Period | Disposal Method |
|-----------|------------------|-----------------|
| **Call PHI (Redis cache)** | **7 days — auto-deleted by cron** | Automatic secure deletion via `phi_deletion` cron (runs daily at 2:00 AM) |
| Call Transcripts (RetellAI) | **0 days — not stored** (`data_storage_setting: basic_attributes_only`) | Not retained by RetellAI; basic call metadata auto-deleted after 7 days via `data_storage_retention_days` |
| Call Logs (Keragon) | Per Keragon data policy | Managed by Keragon per BAA |
| Google Calendar Events | Staff-managed (soft-scheduled appointments) | Manual deletion by clinic staff |
| SMS Opt-Out Flags (Redis) | 1 year (rolling) | Auto-expires; re-set on new opt-out |
| Audit Logs | 7 years | Secure archive |
| System Logs | 90 days | Secure deletion |

**PHI Auto-Deletion (implemented):** A cron job in `src/services/schedulerService.js` runs daily at 2:00 AM and deletes all call records older than `PHI_RETENTION_DAYS` (default: 7) from Redis. Each deletion batch is logged to Keragon W4 as a `phi_auto_deletion` event for audit purposes.

---

## Privacy by Design

### System Architecture Privacy

#### Minimal Data Collection
```yaml
data_collection:
  required:
    - caller_name: "string, max 100 chars"
    - phone_number: "E.164 format"
    - reason_for_visit: "string, max 500 chars"
    - visit_timeframe: "string, max 100 chars"
  
  prohibited:
    - ssn: "never collected"
    - date_of_birth: "never collected"
    - medical_history: "never collected"
    - insurance_info: "never collected"
```

#### Purpose Limitation
- **Primary Purpose**: After-hours call handling and appointment scheduling
- **Secondary Uses**: Quality improvement, system optimization
- **Prohibited Uses**: Marketing, research, data sharing

#### Data Subject Rights
- **Access**: Patients can request their call records
- **Correction**: Patients can correct inaccurate information
- **Deletion**: Patients can request data deletion
- **Portability**: Patients can request data export

### Privacy Controls

#### Consent Management
```json
{
  "consent": {
    "call_logging": {
      "basis": "legitimate_interest",
      "trigger": "inbound call received",
      "note": "Calls are logged for operational continuity"
    },
    "sms_followup": {
      "basis": "explicit_consent",
      "trigger": "sms_consent_explicit === true in call extracted_data",
      "note": "RetellAI agent must ask for verbal consent before sending any SMS"
    }
  }
}
```

> **Note (v1.2):** Post-call SMS follow-up is gated on `sms_consent_explicit: true` from the RetellAI call flow. The AI agent must obtain explicit verbal consent during the call. Implied consent is **not** used for SMS. This aligns with TCPA requirements.

#### Opt-Out Mechanisms
- **SMS Opt-Out**: Reply STOP, CANCEL, END, QUIT, or UNSUBSCRIBE — handled automatically by `inboundSmsHandler.js`, flagged in Redis, logged to Keragon W3. No confirmation SMS is sent (TCPA-compliant).
- **SMS Opt-In**: Reply START, YES, or UNSTOP — removes opt-out flag. Handled automatically.
- **Call Opt-Out**: Patient may request removal during the call — AI agent can flag this.
- **Email Opt-Out**: Unsubscribe link in any email communications.

#### Rating SMS Privacy Note
When patients reply to a post-call follow-up SMS with a 1–5 rating, their phone number and rating score are logged to Keragon W3. For scores ≤2, a `low_score_alert: true` flag is set and a staff email alert may be triggered. The patient's reply body is stored only in Keragon for staff review — it is not stored in Redis or local logs beyond the standard log retention period. Free-text replies are logged to Keragon W3 with `requires_review: true` and are not processed by AI or further distributed.

---

## Security Controls

### Access Management

#### Authentication
```yaml
authentication:
  methods:
    - api_keys: "HMAC-SHA256 signed"
    - oauth2: "JWT tokens with refresh"
    - mfa: "TOTP for admin access"
  
  password_policy:
    min_length: 12
    complexity: true
    rotation: 90_days
```

#### Authorization
```yaml
authorization:
  rbac:
    roles:
      admin:
        - "system:*"
        - "data:*"
        - "user:*"
      
      staff:
        - "call:read"
        - "call:write"
        - "report:read"
      
      auditor:
        - "audit:read"
        - "log:read"
```

### Network Security

#### Firewall Configuration
```bash
# Allowed inbound ports
- 80/tcp   (HTTP, redirect to HTTPS)
- 443/tcp  (HTTPS)
- 22/tcp   (SSH, restricted IPs)

# Allowed outbound ports
- 80/tcp   (HTTP, for external APIs)
- 443/tcp  (HTTPS, for external APIs)
- 6379/tcp (Redis, internal only)

# Blocked traffic
- All other inbound traffic
- All outbound traffic to non-approved services
```

#### Intrusion Detection
- **Network IDS**: Monitor for unusual traffic patterns
- **Host IDS**: Monitor for suspicious system activity
- **File Integrity**: Monitor for unauthorized changes
- **Log Analysis**: Automated threat detection

---

## Monitoring and Auditing

### Compliance Monitoring

#### Automated Controls
```yaml
compliance_checks:
  daily:
    - phi_auto_deletion: "Redis call records > PHI_RETENTION_DAYS (default: 7) deleted at 2:00 AM — logged to Keragon W4"
    - access_review: "unusual access patterns"
    - data_classification: "PHI detection"
    - encryption_status: "data protection"

  weekly:
    - user_access: "privilege review"
    - patch_status: "security updates"
    - backup_verification: "data recovery"

  monthly:
    - risk_assessment: "threat analysis"
    - policy_review: "compliance updates"
    - training_audit: "staff compliance"
```

**PHI Auto-Deletion Audit Trail:** Each time the PHI deletion cron runs, it logs a `phi_auto_deletion` event to Keragon W4 (`receptionist_edge_cases` workflow) with the count of records deleted and the timestamp. This provides an auditable record of data disposal for compliance review.

#### Alerting Rules
```yaml
alerts:
  critical:
    - "phi_exposure": "PHI detected in logs"
    - "unauthorized_access": "Failed login attempts > 5"
    - "data_breach": "Unusual data access patterns"
  
  warning:
    - "encryption_failure": "Data not encrypted"
    - "access_violation": "Access policy violation"
    - "configuration_change": "Unauthorized system changes"
```

### Audit Trail

#### Comprehensive Logging
```json
{
  "audit_log": {
    "timestamp": "2026-01-25T23:45:00.000Z",
    "event_type": "data_access",
    "user_id": "staff_123",
    "resource_type": "call_record",
    "resource_id": "call_456",
    "action": "read",
    "ip_address": "192.168.1.100",
    "user_agent": "ReceptionistAgent/1.0",
    "result": "success",
    "data_fields_accessed": ["caller_name", "phone_number"],
    "session_id": "sess_789",
    "compliance_tags": ["phi_access", "audit_required"]
  }
}
```

#### Log Retention and Protection
- **Storage**: Encrypted, write-once storage
- **Integrity**: Cryptographic hash verification
- **Access**: Strict access controls and audit logging
- **Retention**: 7 years for compliance logs

---

## Vendor and Third-Party Management

### Vendor Assessment

#### Due Diligence Checklist
- [ ] Security assessment (SOC 2, ISO 27001)
- [ ] HIPAA Business Associate Agreement (BAA)
- [ ] Data processing agreements
- [ ] Incident response procedures
- [ ] Right to audit clauses
- [ ] Data breach notification procedures

#### Approved Vendors
| Vendor | Service | BAA Status | Notes |
|--------|---------|------------|-------|
| **RetellAI** | Voice Processing | **Pending — Arthur to obtain** | `data_storage_setting: basic_attributes_only` — no transcripts or recordings stored. `data_storage_retention_days: 7` — basic metadata auto-deleted. BAA required before go-live. |
| **SignalWire** | Telephony + SMS | **Pending — Arthur to obtain** | Handles call routing and SMS delivery |
| **Keragon** | Workflow Automation + Logging | **Pending — Arthur to obtain** | Receives call logs, SMS events, emergencies |
| **Google** | Calendar (service account) | **Pending — Arthur to obtain** | Stores limited PHI (name, phone, reason) as calendar events |
| **Hathr.ai** | Healthcare LLM | N/A — not implemented (stubbed) | No data is sent to Hathr.ai in production |
| **AWS / Cloud Provider** | Infrastructure | Signed (obtain from hosting provider) | Underlying infrastructure BAA |

> ⚠️ **Action Required (Arthur):** BAAs with RetellAI, SignalWire, Keragon, and Google (Workspace/Calendar) must be executed before production go-live. These vendors process or receive data that may include PHI.

### Data Processing Agreements

#### Standard Clauses
- **Purpose Limitation**: Data used only for specified purposes
- **Data Minimization**: Only necessary data processed
- **Security Requirements**: Industry-standard security controls
- **Audit Rights**: Right to audit vendor compliance
- **Breach Notification**: Immediate breach notification
- **Data Return**: Data return upon termination

---

## Incident Management

### Breach Notification

#### Notification Timeline
| Event | Timeline | Responsible |
|-------|----------|-------------|
| **Discovery** | Immediate | System Monitoring |
| **Assessment** | 1 hour | Security Team |
| **Containment** | 2 hours | IT Team |
| **Notification** | 24 hours | Compliance Officer |
| **Report** | 60 days | Management |

#### Notification Requirements
```yaml
breach_notification:
  internal:
    - security_team: "immediate"
    - management: "1 hour"
    - legal_counsel: "2 hours"
  
  external:
    - patients: "within 60 days"
    - hhs_ocr: "within 60 days"
    - media: "as required"
```

### Incident Response Playbook

#### Phase 1: Detection and Analysis
```bash
# Automated detection
- unusual_access_patterns.sh
- phi_exposure_monitor.sh
- data_breach_detector.sh

# Manual analysis
- log_review.sh
- system_forensics.sh
- impact_assessment.sh
```

#### Phase 2: Containment and Eradication
```bash
# System isolation
- isolate_affected_systems.sh
- disable_compromised_accounts.sh
- preserve_evidence.sh

# Threat eradication
- remove_malicious_code.sh
- patch_vulnerabilities.sh
- update_security_controls.sh
```

#### Phase 3: Recovery and Lessons Learned
```bash
# System recovery
- restore_from_backup.sh
- verify_system_integrity.sh
- monitor_for_reinfection.sh

# Post-incident
- root_cause_analysis.sh
- update_procedures.sh
- staff_training.sh
```

---

## Training and Awareness

### Staff Training Program

#### Initial Training (All Staff)
- **Duration**: 2 hours
- **Topics**: HIPAA fundamentals, data handling, security awareness
- **Assessment**: Written test, competency verification

#### Role-Specific Training
```yaml
training_modules:
  administrators:
    - "HIPAA Security Rule"
    - "Incident Response"
    - "Audit and Compliance"
  
  clinical_staff:
    - "Patient Privacy"
    - "Data Minimization"
    - "Consent Management"
  
  technical_staff:
    - "Technical Safeguards"
    - "Encryption Implementation"
    - "Access Control"
```

#### Ongoing Training
- **Monthly**: Security awareness updates
- **Quarterly**: Policy changes and updates
- **Annually**: Full compliance refresher

### Documentation and Resources

#### Policy Library
- **HIPAA Privacy Policy**: Patient rights and data use
- **Security Policy**: Technical and administrative safeguards
- **Incident Response Plan**: Breach response procedures
- **Data Retention Policy**: Data lifecycle management

#### Quick Reference Guides
- **PHI Handling**: What constitutes PHI and how to protect it
- **Security Incidents**: How to report and respond
- **Access Requests**: How to handle patient data requests
- **Vendor Management**: Third-party risk assessment

---

## Compliance Monitoring and Reporting

### Key Performance Indicators

#### Security Metrics
```yaml
security_kpis:
  - mean_time_to_detect: "< 24 hours"
  - mean_time_to_contain: "< 1 hour"
  - mean_time_to_recover: "< 4 hours"
  - security_incidents: "< 5 per year"
  - data_breaches: "0 per year"
```

#### Compliance Metrics
```yaml
compliance_kpis:
  - training_completion: "100%"
  - policy_acknowledgment: "100%"
  - audit_findings: "< 5 per year"
  - vendor_compliance: "100%"
  - risk_assessment_completion: "100%"
```

### Reporting Structure

#### Monthly Reports
- **Security Status**: Incident summary, threat landscape
- **Compliance Status**: Policy adherence, training completion
- **Risk Assessment**: Emerging risks, mitigation strategies

#### Quarterly Reports
- **Executive Summary**: Overall compliance posture
- **Detailed Analysis**: Trend analysis, gap assessment
- **Recommendations**: Improvement opportunities

#### Annual Reports
- **Comprehensive Review**: Full compliance assessment
- **Audit Results**: Internal and external audit findings
- **Strategic Plan**: Compliance roadmap and budget

---

## Continuous Improvement

### Compliance Program Evolution

#### Review Cycle
```yaml
review_schedule:
  monthly:
    - security_incident_review
    - policy_update_review
    - training_effectiveness
  
  quarterly:
    - risk_assessment_update
    - vendor_compliance_review
    - technology_assessment
  
  annually:
    - full_compliance_audit
    - program_effectiveness_review
    - strategic_planning
```

#### Improvement Process
1. **Identify Gaps**: Audits, assessments, feedback
2. **Prioritize Actions**: Risk-based prioritization
3. **Implement Changes**: Policy updates, training, technology
4. **Measure Effectiveness**: KPI tracking, monitoring
5. **Continuous Monitoring**: Ongoing compliance verification

### Future Compliance Considerations

#### Emerging Regulations
- **State Privacy Laws**: CCPA, CPRA, and other state laws
- **Healthcare Modernization**: New healthcare data regulations
- **AI Ethics**: AI decision-making transparency and fairness

#### Technology Evolution
- **Advanced Encryption**: Quantum-resistant cryptography
- **Privacy-Enhancing Technologies**: Homomorphic encryption, zero-knowledge proofs
- **AI Governance**: Ethical AI frameworks and guidelines

---

## Appendix

### A. Compliance Checklists

#### HIPAA Security Rule Checklist
- [ ] Administrative safeguards implemented
- [ ] Physical safeguards in place
- [ ] Technical safeguards configured
- [ ] Policies and procedures documented
- [ ] Staff training completed
- [ ] Business associate agreements executed

#### Data Protection Checklist
- [ ] Encryption implemented (in transit and at rest)
- [ ] Access controls configured
- [ ] Audit logging enabled
- [ ] Data minimization practiced
- [ ] Retention policies enforced
- [ ] Disposal procedures followed

### B. Templates and Forms

#### Incident Report Template
#### Business Associate Agreement Template
#### Data Processing Addendum Template
#### Staff Training Acknowledgment Form

### C. Regulatory References

- **HIPAA Privacy Rule**: 45 CFR Part 160, Subpart A
- **HIPAA Security Rule**: 45 CFR Part 160, Subpart C
- **HITECH Act**: 42 USC § 17931 et seq.
- **TCPA**: 47 USC § 227

---

**Document Control**

- **Owner**: Compliance Officer
- **Review Frequency**: Quarterly
- **Approval**: Chief Privacy Officer
- **Distribution**: All Staff, Management, Legal Counsel

**Next Review Date**: May 25, 2026

**Contact Information**
- **Compliance Office**: compliance@yourclinic.com
- **Security Team**: security@yourclinic.com
- **Legal Counsel**: legal@yourclinic.com
