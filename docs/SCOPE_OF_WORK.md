# EXHIBIT A – SCOPE OF WORK

**Project:** After-Hours AI Receptionist – Urgent Care MVP
**Client:** Arthur Garnett
**Contractor:** Simone Lawson
**Signed:** 2/22/2026
**Deadline:** 14 calendar days → ~3/8/2026

---

## 1. Project Objective

Deliver a fully functional AI Receptionist for after-hours urgent care calls that:

- Handles multiple simultaneous inbound calls professionally and quickly
- Captures patient intent and basic information
- Performs soft scheduling (1-hour time windows logged in Google Calendar) and changes/cancels appointment if patient requests
- Filters spam calls effectively
- Multilingual (English and Spanish)
- Send optional SMS reminder for appointment: 1 day before and 1 hour before scheduled time
- Send optional feedback question
- Logs call and AI data in Keragon for audit and possible staff review

The system is non-clinical and does not provide medical advice.

---

## 2. Operating Hours

- After-hours only (outside business hours, weekends, holidays)
- Business-hours call handling is out of scope (future upgrade)

---

## 3. Core Functional Requirements

### 3.1 Inbound Call Handling

- Answer multiple simultaneous calls without dropping sessions
- Identify new vs returning patients
- Maintain professional, calm, urgent-care-appropriate tone
- Follow structured call flows
- Route emergencies appropriately (ER guidance)
  - AI must immediately interrupt the conversation if emergency indicators are detected
  - AI must state: *"If this is a medical emergency, please hang up and dial 911 immediately."*
  - AI must not ask additional intake questions once an emergency is detected
  - Emergency detection overrides all other call flows
- Detect and terminate obvious spam or junk calls; flag in Keragon logs with a "spam" tag
- System must receive messages and take callback requests — log at next business day start (8:00 AM) OR into a "message review" block
- Handle edge cases by logging in Keragon (dropped calls, incomplete info, failed SMS)

### 3.2 Soft Scheduling

- Ask when the patient plans to come in; if they give a specific time, log it
- Provide general guidance on walk-in and wait times (future builds)
- Capture intended visit timeframe — try to get caller to confirm a 1-hour window; if only broader timeframe captured, log that instead
- Book 1-hour timeframes

### 3.3 Information Capture

- Caller name
- Phone number
- Reason for visit (non-diagnostic)
- Intended visit timeframe
- Patient type (new/returning)
- Call disposition (high-intent, emergency, spam, dropped)

### 3.4 Text Messaging

- Optional SMS follow-up after calls, including the booked time and option to receive appointment alerts
- Reminder of clinic hours, location, or visit tips
- Only sent when implied consent is present
- Ask on the phone if they would like to receive a confirmation text; if yes, also send optional feedback question SMS

#### Initial Rating SMS

Send message asking if patient would like optional feedback. If they opt in, send exactly:

> "On a scale of 1–5, how easy was it to schedule your appointment today? Please do NOT include any medical details"

#### Rating Handling

- Accept numeric responses 1–5 only
- Store only the numeric rating score
- Associate rating with the clinic and call instance
- Trigger automated follow-up logic for low scores
- **No additional messages if rating is 4 or 5**

#### Documentation Requirements (SMS)

Contractor must document:
- Where opt-in status is stored
- Where SMS automation is configured
- Where rating data is stored

---

## STEP 2 — Low-Score Follow-Up & Feedback Handling

### 1. Low Score Trigger

If a patient submits a rating of **3 or lower**, automatically send a follow-up SMS.

### 2. Required Follow-Up Message (exact wording)

> "We're sorry to hear that. Could you tell us what went wrong with the scheduling experience? Please do not include any medical details."

### 3. Feedback Handling Rules

- Treat responses as customer service feedback only
- Avoid categorizing responses as medical records
- Allow forwarding of feedback to clinic owner
- Avoid long-term storage of responses containing medical details

### 4. Data Storage Limitations

Store only:
- Numeric rating scores
- Operational feedback related to scheduling experience

Must not intentionally collect or request medical information.

### 5. Documentation Requirements (Feedback)

- Where feedback responses are stored
- How low-score alerts are delivered to the clinic
- How to disable the follow-up system if needed

---

## 3.5 Spam Filtering

- Filter robocalls, sales calls, and irrelevant calls
- Flag suspicious calls in logs so they can be easily passed to staff

---

## 4. AI & Integration Requirements

- System must be built as a reusable, modular base model
- **RetellAI:** conversation logic, soft scheduling, urgency assessment, voice synthesis/recognition, multi-call concurrency
- **SignalWire:** inbound/outbound calls, SMS, webhooks
- **Keragon:** workflow orchestration and logging:
  - Caller ID, timestamp, call duration
  - AI responses & decision paths
  - Soft scheduling info
  - Spam detection flags
  - SMS sent and delivery status
  - Error notifications and automation failures
- **Google Calendar:** clinic hours and availability context; soft scheduling reference
- All integrations must be documented

---

## 5. Logging & Documentation

### 1. Contractor Documentation

- How each system was built (key decisions + setup steps)
- How to use the system day-to-day
- How to customize and deploy the base system for future clinics
- How to turn system off temporarily
- How each system connects

### 2. Build Logging

- RetellAI prompt creation and testing
- RetellAI voice setup (prompts, speed, tone, concurrency settings)
- SignalWire number configuration, call routing, SMS setup
- Keragon flow creation, testing, automation triggers
- Google Calendar integration and soft-scheduling reference

### 3. System Architecture & Data Flow

- Architecture diagram: RetellAI → SignalWire → Keragon → Google Calendar
- Data flow for calls, SMS, and logs
- Multi-call concurrency setup

### 4. Keragon Logging Requirements

Required fields:
- Caller ID, phone number, booking outcome
- Emergency trigger yes/no
- Reason for visit or notes captured by AI
- Timestamp
- Spam flags, failed SMS, dropped calls, incomplete info, edge cases

Rules:
- Documentation must explain how to access, read, and manage logs
- Logs must maintain restricted access and data protection
- PHI must be minimized — no logging of medical history or insurance
- **PHI must be deleted from Keragon 7 days after call**

### 5. Spam Filtering Documentation

- Exact rules for terminating or flagging spam calls (thresholds, patterns, keywords)

### 6. Testing & Edge Cases

Instructions for testing:
- Multi-call handling
- Edge cases (dropped calls, incomplete info, failed SMS)
- Emergency routing
- Logs and system behavior before going live

### 7. Data Protection & Compliance

- How logs are protected and safely retrieved or deleted
- NO data stored outside of Keragon
- Data must only be accessible to urgent care staff
- HIPAA-conscious handling notes (even if not fully compliant yet)
- System and logs must be structured to support future compliance review or audit requests

---

## 6. Extras

- All accounts, API keys, phone numbers, and integrations must be created under Client-owned accounts
- Contractor access must be temporary and revocable
- No systems may be built under contractor-owned accounts
- Contractor shall not retain any credentials, API keys, system access, or copies of proprietary materials after project completion
- Contractor may not designate themselves as account owner, recovery contact, billing owner, or permanent administrator
- Contractor must provide a complete access map (all systems, permission levels, API keys, integrations) prior to final payment

### AI Performance Requirements

- AI must respond with minimal latency
- Responses must be concise and conversational
- Long pauses, verbose explanations, or delayed acknowledgments are unacceptable
- If AI can't answer a question (outside provided knowledge), advise caller to call during normal staff hours and ask if there's anything else it can help with

---

## Emergency Protocol

Any statements indicating self-harm or suicidal ideation must immediately trigger:

> "I'm not able to help with emergencies. Based on what you've told me, this could be a serious medical situation. Please hang up and call 911 immediately, or go to the nearest emergency room."

**AI MUST NEVER:** diagnose, suggest treatment, assess severity.

### Emergency Situations AI Must Recognize

**Primary list:**
- Chest pain or chest pressure
- Difficulty breathing or shortness of breath
- Signs of stroke (facial drooping, slurred speech, arm weakness)
- Severe or uncontrolled bleeding
- Loss of consciousness or fainting
- Seizures
- Serious head injuries
- Severe allergic reactions (throat swelling or difficulty breathing)
- Blue lips or not breathing
- High-speed motor vehicle accidents
- Major burns
- Suspected overdose or poisoning
- Statements indicating suicidal thoughts or self-harm

**Neurological Emergencies:**
- Sudden confusion or inability to speak
- Sudden severe headache ("worst headache of my life")
- Sudden vision loss or double vision
- New inability to walk or severe dizziness
- Sudden numbness or tingling on one side of the body
- Sudden personality change or disorientation

**Cardiac & Circulatory:**
- Rapid or irregular heartbeat with dizziness
- Heart rate extremely fast or extremely slow
- Fainting with no known cause
- Severe swelling of face/neck with breathing issues
- Severe leg pain/swelling with shortness of breath (possible clot)

**Severe Respiratory:**
- Gasping for air
- Unable to speak full sentences due to breathing
- Stridor (high-pitched breathing sounds)
- Choking or airway blockage
- Sudden severe asthma attack

**Dangerous Bleeding:**
- Vomiting blood
- Coughing up blood
- Blood in stool (black/tarry or large amounts of red)
- Heavy bleeding during pregnancy

**Pregnancy Emergencies:**
- Severe abdominal pain during pregnancy
- Heavy vaginal bleeding while pregnant
- Sudden swelling of face/hands with headache
- Decreased fetal movement late pregnancy
- Possible ectopic pregnancy symptoms

**Severe Infection / Sepsis:**
- Very high fever with confusion
- Fever in infants under 3 months
- Stiff neck with fever
- Severe dehydration (not urinating, extremely weak)
- Skin turning purple or mottled
- Rapid breathing with fever

**Traumatic Injuries:**
- Suspected broken bone sticking out
- Inability to move limb after injury
- Severe neck or spinal pain after trauma
- Crush injuries

**Chemical / Environmental:**
- Carbon monoxide exposure symptoms
- Chemical burns to eyes or skin
- Toxic inhalation exposure
- Electric shock injuries

**Diabetic & Metabolic:**
- Unresponsive diabetic patient
- Extremely high or low blood sugar symptoms
- Fruity breath + confusion (possible DKA)

**Pediatric Red Flags:**
- Infant not feeding or lethargic
- Child turning blue
- Persistent inconsolable crying with fever
- Seizure in a child with no history

**Soft Language Triggers (indirect wording):**
- "I think I'm dying"
- "I can't stay awake"
- "Something is very wrong"
- "I feel like passing out"
- "I can't breathe properly"
- "My heart is racing and I feel faint"

### Gold-Standard Rule

If a symptom involves **airway, breathing, circulation, consciousness, severe trauma, or uncontrolled bleeding → automatic 911 redirect. No exceptions.**

### After Emergency Trigger — AI Must:

- STOP scheduling
- STOP asking questions
- STOP collecting info
- REPEAT emergency instruction if user continues talking

**Required message (exact):**
> "I'm not able to help with emergencies. Based on what you've described, this may be a serious medical situation. Please hang up and call 911 immediately, or go to the nearest emergency room."

**If caller continues:**
> "I'm unable to assist with emergencies. Based on what you've described, this may be a serious medical situation. Please call 911 right now."

**NEVER:**
- Say "you will be okay"
- Estimate risk level
- Suggest urgent care vs ER
- Give medical instructions
- Attempt triage

---

## 7. Testing Requirements

- End-to-end testing of all call flows
- Edge-case testing (errors, emergencies, spam, multi-call concurrency)
- Verification of soft scheduling and SMS delivery
- Testing must be completed before the mandatory walkthrough

---

## 8. Mandatory Walkthrough

Contractor conducts a live session demonstrating:
- System operation & call flows
- AI prompt & response logic
- How to update or troubleshoot the system

Client must understand how all systems work together.

---

## 9. Explicit Exclusions

- Hard appointment booking or EMR/EHR integration
- Business-hours call handling
- CRM setup beyond basic logging
- Dashboards/reporting beyond Keragon logs
- Website or frontend development

Any additional work requires written approval.

---

## 10. Acceptance Criteria

Project is complete **only** when:

1. All in-scope functionality works as described
2. System is HIPAA compliant
3. Keragon logging captures all required events
4. Documentation is delivered
5. Mandatory walkthrough is completed
6. Client confirms acceptance in writing
7. There is a number to call for demo purposes in closing meetings with clients

---

*Signed 2/22/2026 — Arthur Garnett (Client) & Simone Lawson (Contractor)*
