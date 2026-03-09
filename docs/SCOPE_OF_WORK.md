# EXHIBIT A – SCOPE OF WORK

**Project:** After-Hours AI Receptionist – Urgent Care MVP
**Client:** Arthur Garnett
**Contractor:** Simone Lawson
**Timeline:** 14 calendar days after signing

> **Note:** New preferred brain inside of Retell is Claude AI

---

## FEVER PROTOCOL

Steps to take if a reason for visit is a fever. Even if the caller has already explained these details, the AI must follow these steps to verify the information.

### Step 1 — Ask Age

"Can you tell me the age of the patient with the fever?"

Categorize:
- **Infant:** under 3 months
- **Child:** 3 months – 4 years
- **Older child / adult:** 5 years and older

---

### Step 2 — Ask Immunocompromised Status

"Do you have any conditions that affect your immune system, such as cancer, HIV, diabetes, or are you currently on chemotherapy, steroids, or immunosuppressant medications?"

- **If yes:** "Because you have a condition that affects your immune system, even a low grade fever can be serious. Please seek emergency services immediately." → hang up
- **If unsure:** "If you are unsure, out of caution I would recommend seeking emergency services immediately." → hang up

---

### Step 3 — Ask About Current Fever and Temperature

"Does the patient currently have a fever? If so, what is the temperature?"

If they do not know the temperature: "Are you able to take your temperature for me? I need a temperature."

- If they can provide a temperature → proceed with the decision table below.
- If they cannot provide a temperature: "Out of caution I recommend calling 911 or seeking emergency services immediately." → hang up

---

### Step 4 — Decision Table

| Patient Type | Temperature | AI Action |
|---|---|---|
| Infant (< 3 months) | Any fever | Say: "If the patient with a fever is an infant, please call 911 or seek emergency services immediately." Hang up. |
| Child ≤ 4 years | ≥ 102°F | Say: "Because your child's fever exceeds 102°F, please call 911 or seek emergency services immediately." Hang up. |
| Child ≤ 4 years | < 102°F | Proceed to follow-up questions |
| Older child / adult ≥ 5 years | ≥ 102°F | Say: "Because your fever exceeds a temperature of 102°F, please call 911 or seek emergency services immediately." Hang up. |
| Older child / adult ≥ 5 years | < 102°F | Proceed to follow-up questions |

---

### Step 5 — Follow-Up Questions (if fever is under 102°F and not an infant)

Ask each question one at a time:

- "Are you experiencing any trouble breathing?"
- "Have you been able to keep fluids down, or are you vomiting repeatedly?" — If vomiting repeatedly, give emergency statement and hang up.
- "Are you confused or dizzy?"
- "Do you have a rash along with your fever?"

If the patient responds to any of these with "kind of," "maybe," "yes," or anything indicating uncertainty, say: *"Because you are experiencing [symptom] along with a fever, please hang up and seek emergency services immediately."*

If the patient responds **no** to all questions, proceed to Step 6.

---

### Step 6 — Duration

Ask how long they have had the fever.

- **Less than 3 days:** Proceed normally with scheduling.
- **3 days or more:** Say: *"Because your fever has persisted for [X] days, it is important that you are seen as soon as possible."* Then proceed with scheduling.

**Scheduling acknowledgment (example for a 101°F fever with no warning signs):**
> "Since the fever is 101°F and there are no other warning signs, we can go ahead and schedule an appointment. When would you like to come in?"

---

### Fever — Additional Notes

**Focus on current fever, not previous fevers.** Current fever dictates scheduling — past spikes are context only.

If the patient had a fever at 102°F or above but it is now below 102°F, respond: *"I see you mentioned the fever was [prior temp]°F earlier. I'm glad it's lower now."* Then ask the follow-up questions. If all answers are no, proceed with: *"Since the fever is now [current temp] and there are no other warning signs, we can go ahead and schedule an appointment. It is recommended that you come in as soon as possible."*

---

## BLEEDING PROTOCOL

If a reason for visit is bleeding, ask: **"Where on the body is the bleeding occurring?"**

Then categorize:

- **High risk locations (head, neck, chest, abdomen, groin):** Immediately give emergency statement and hang up. These areas are inherently more dangerous regardless of bleeding amount.
- **Moderate risk (hand, foot, leg, arm):** Proceed with the follow-up questions below.
- **Lower risk (finger, toe, small surface cuts):** Proceed with the follow-up questions below.

---

### Next — Ask About Injury

"Was this caused by an injury or accident?"

- **If yes:** Ask: "Did you hit your head or lose consciousness at any point?"
  - If yes or unsure → give emergency statement and hang up.
- **If no:** Proceed to follow-up questions.

---

### Follow-Up Questions

- "Are you coughing or vomiting blood?"
- "Is there blood in your urine or stool?"
- "Do you have severe abdominal or chest pain?"
- "Is the bleeding soaking through a bandage or clothing?"
- "Has it been bleeding continuously for more than 10 minutes?"
- "Is the blood spurting or flowing heavily?"
- "Are you feeling dizzy, lightheaded, or weak?"

If the patient answers yes, maybe, kind of, or any uncertain answer to any of these questions → give emergency statement and hang up.

If the answers to all questions are no → tell the patient we will take care of them as soon as they can come in, and ask what time they would like to come in.

---

## IF CALLER BECOMES UNRESPONSIVE MID-CALL

The AI should immediately say something like:

> "Hello? Are you still with me? Please respond if you can hear me."

Attempt to re-engage **two to three times** with brief pauses between each attempt.

If no response, the AI should say:

> "I am unable to get a response. If anyone is present with the caller, please call 911 immediately and stay on the line with them."

The AI should then **stay on the line** rather than hang up.

---

**AI MUST NEVER:** Improvise medical advice, guess severity, miss red-flag phrases, or fail to escalate properly.

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
- Business-hours call handling is out of scope, but will likely be part of future upgrades

---

## 3. Core Functional Requirements

### 3.1 Inbound Call Handling

- Answer multiple simultaneous calls without dropping sessions
- Identify new vs returning patients
- Maintain professional, calm, urgent-care-appropriate tone
- Follow structured call flows
- Route emergencies appropriately (ER guidance)
  - The AI must immediately interrupt the conversation if emergency indicators are detected
  - The AI must state: *"If this is a medical emergency, please hang up and dial 911 immediately."*
  - The AI must not ask additional intake questions once an emergency is detected
  - Emergency detection overrides all other call flows
- Detect and terminate obvious spam or junk calls; flag calls in the Keragon logs with a "spam" tag
- System must be able to receive messages and also take callback requests from patients — log at next business day start (8:00 AM) OR into a "message review" block
- Handle edge cases by logging in Keragon (dropped calls, incomplete info, failed SMS)

### 3.2 Soft Scheduling

- Ask when the patient plans to come in; if they give a specific time, log the time
- Provide general guidance on walk-in and wait times (more so for future builds)
- Capture intended visit timeframe — system should try to get a customer to confirm a 1-hour time frame; if only able to capture a broader timeframe, log that instead
- Book 1-hour timeframes

### 3.3 Information Capture

- Caller name
- Phone number
- Reason for visit (non-diagnostic)
- Intended visit timeframe
- Patient type (new/returning)
- Call disposition (high-intent, emergency, spam, dropped)

### 3.4 Text Messaging

- Optional SMS follow-up after calls, which will include the booked time and an option to receive alerts for their appointment
- Reminder of clinic hours, location, or visit tips
- Only sent when implied consent is present
- Ask on the phone if they would like to receive a confirmation text; if yes, also send the optional feedback question text

#### Initial Rating SMS

Send a message asking if patient would like to receive a text for an optional feedback question. If the patient opts in, the system must send one SMS. The message must read exactly:

> "On a scale of 1–5, how easy was it to schedule your appointment today? Please do NOT include any medical details"

#### Rating Handling

The system must:

- Accept numeric responses 1–5 only
- Store only the numeric rating score
- Associate the rating with the clinic and call instance
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

If a patient submits a rating of **3 or lower**, the system must automatically send a follow-up SMS.

### 2. Required Follow-Up Message

The message must read exactly:

> "We're sorry to hear that. Could you tell us what went wrong with the scheduling experience? Please do not include any medical details."

### 3. Feedback Handling Rules

The system must:

- Treat responses as customer service feedback only
- Avoid categorizing responses as medical records
- Allow forwarding of feedback to the clinic owner
- Avoid long-term storage of responses containing medical details

### 4. Data Storage Limitations

The system must intentionally store only:

- Numeric rating scores
- Operational feedback related to scheduling experience

The system must not intentionally collect or request medical information.

### 5. Documentation Requirements (Feedback)

Contractor must document:
- Where feedback responses are stored
- How low-score alerts are delivered to the clinic
- How to disable the follow-up system if needed

---

### 3.5 Spam Filtering

- Filter robocalls, sales calls, and irrelevant calls
- Flag suspicious calls in logs so that it can be easily passed to staff

---

## 4. AI & Integration Requirements

- The system must be built as a base model that is reusable and modular, so it can be customized for individual urgent care centers in the future without rewriting core AI, automation, or call flows
- RetellAI handles conversation logic, soft scheduling, and urgency assessment
- RetellAI handles voice synthesis and recognition, enabling natural speech and multi-call concurrency
- RetellAI handles inbound/outbound calls, SMS, and webhooks
- Keragon orchestrates workflow and logging:
  - Caller ID, timestamp, call duration
  - AI responses & decision paths
  - Soft scheduling info
  - Spam detection flags
  - SMS sent and delivery status
  - Error notifications and automation failures
- Google Calendar provides clinic hours and availability context; used for soft scheduling reference and clinic hours, while Keragon stores call details for staff review
- All integrations must be documented

---

## 5. Logging & Documentation

### 1. Contractor Documentation

The contractor will provide complete documentation covering:

- How each system was built, including key decisions and setup steps
- How to use the system day-to-day
- How to customize and deploy the base system for future clinics
- How to turn system off temporarily
- How each system connects

### 2. Build Logging

During the build, the contractor must log all important steps, including:

- RetellAI prompt creation and testing
- RetellAI voice setup, including prompts, speed, tone, and concurrency settings
- RetellAI number configuration, call routing, and SMS setup
- Keragon flow creation, testing, and automation triggers
- Google Calendar integration and soft-scheduling reference

### 3. System Architecture & Data Flow

Documentation must include:

- Architecture diagram of all systems: RetellAI → Keragon → Google Calendar
- Data flow for calls, SMS, and logs
- Multi-call concurrency setup

### 4. Keragon Logging Requirements

Required fields:
- Caller ID, phone number, and booking outcome
- Emergency trigger yes/no
- Reason for visit or notes captured by the AI
- Timestamp
- Spam flags, failed SMS, dropped calls, incomplete info, and other edge cases

Rules:
- Documentation must explain how to access, read, and manage logs
- Logs must maintain restricted access and data protection
- PHI must be minimized — no logging of medical history or insurance
- PHI must be deleted from Keragon 7 days after call

### 5. Spam Filtering Documentation

Documentation must include exact rules for terminating or flagging spam calls, including thresholds, patterns, or keywords.

### 6. Testing & Edge Cases

Contractor must provide instructions for testing:

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
- Contractor shall not retain any credentials, API keys, system access, or copies of proprietary materials after project completion or termination
- Contractor may not designate themselves as an account owner, recovery contact, billing owner, or permanent administrator on any system
- Contractor must provide a complete access map listing all systems, permission levels, API keys, and integrations prior to final payment

### AI Performance Requirements

- The AI must respond with minimal latency
- Responses must be concise and conversational
- Long pauses, verbose explanations, or delayed acknowledgments are unacceptable
- If the AI can't answer a question (it is outside of the knowledge the AI has been provided with), simply advise the caller to call during normal staff hours, and the AI then asks if there is anything else it can help with

---

## EMERGENCY PROTOCAL

Any statements indicating self-harm or suicidal ideation must immediately trigger emergency messaging:

> "I'm not able to help with emergencies. Based on what you've told me, this could be a serious medical situation. Please hang up and call 911 immediately, or go to the nearest emergency room."

**AI MUST NEVER:** diagnose, suggest treatment, assess severity.

**AI MUST be aware of emergency situations including:**

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

### ❗ VERY IMPORTANT RULE

After triggering emergency mode, the AI should:

- STOP scheduling
- STOP asking questions
- STOP collecting info
- REPEAT emergency instruction if user continues talking

*This is critical for liability protection.*

---

## 🚨 Additional Emergency Situations the AI MUST Recognize

### 🧠 Neurological Emergencies

These are high-priority 911 triggers:

- Sudden confusion or inability to speak
- Sudden severe headache ("worst headache of my life")
- Sudden vision loss or double vision
- New inability to walk or severe dizziness
- Sudden numbness or tingling on one side of the body
- Sudden personality change or disorientation

*These often indicate stroke, brain bleed, or severe neurological events.*

### ❤ Cardiac & Circulatory Emergencies

Beyond chest pain:

- Rapid or irregular heartbeat with dizziness
- Heart rate extremely fast or extremely slow
- Fainting with no known cause
- Severe swelling of face/neck with breathing issues
- Severe leg pain/swelling with shortness of breath (possible clot)

### 🫁 Severe Respiratory Distress Signals

Beyond "difficulty breathing":

- Gasping for air
- Unable to speak full sentences due to breathing
- Stridor (high-pitched breathing sounds)
- Choking or airway blockage
- Sudden severe asthma attack

### 🩸 Dangerous Bleeding Situations

You listed uncontrolled bleeding — add:

- Vomiting blood
- Coughing up blood
- Blood in stool that is black/tarry or large amounts of red blood
- Heavy bleeding during pregnancy

### 🤰 Pregnancy Emergencies (VERY IMPORTANT — often missed)

These MUST be flagged:

- Severe abdominal pain during pregnancy
- Heavy vaginal bleeding while pregnant
- Sudden swelling of face/hands with headache
- Decreased fetal movement late pregnancy
- Possible ectopic pregnancy symptoms

*Urgent care cannot handle many of these.*

### 🦠 Severe Infection / Sepsis Indicators

These are critical:

- Very high fever with confusion
- Fever in infants under 3 months
- Stiff neck with fever
- Severe dehydration (not urinating, extremely weak)
- Skin turning purple or mottled
- Rapid breathing with fever

### 🦴 Traumatic Injuries Beyond Head Injury

- Suspected broken bone sticking out
- Inability to move limb after injury
- Severe neck or spinal pain after trauma
- Crush injuries

### 🧪 Dangerous Chemical / Environmental Exposures

- Carbon monoxide exposure symptoms
- Chemical burns to eyes or skin
- Toxic inhalation exposure
- Electric shock injuries

### 🩺 Diabetic & Metabolic Emergencies

- Unresponsive diabetic patient
- Extremely high or low blood sugar symptoms
- Fruity breath + confusion (possible DKA)

### 🧒 Pediatric Red-Flag Emergencies

- Infant not feeding or lethargic
- Child turning blue
- Persistent inconsolable crying with fever
- Seizure in a child with no history

### 🧠 VERY IMPORTANT: "Soft Language" Emergency Triggers

The AI must also recognize indirect wording, like:

- "I think I'm dying"
- "I can't stay awake"
- "Something is very wrong"
- "I feel like passing out"
- "I can't breathe properly"
- "My heart is racing and I feel faint"

*These often appear before people say the clinical symptom.*

---

## ⚠ GOLD-STANDARD RULE

Here's the safest operational logic used by major triage systems:

> If a symptom involves **airway, breathing, circulation, consciousness, severe trauma, or uncontrolled bleeding → automatic 911 redirect. No exceptions.**

You are NOT building a triage AI. You are building a **RED FLAG DETECTION SYSTEM.**

---

## 🛡 EMERGENCY DETECTION SYSTEM PROMPT

This is written specifically for AI receptionist systems (not triage bots).

### 🔴 CORE RULE

You are NOT a medical professional and must NEVER:

- Diagnose
- Assess severity
- Suggest treatment
- Provide medical advice
- Ask follow-up clinical questions

Your ONLY role is to detect potential emergencies and redirect.

### 🔴 EMERGENCY DETECTION CRITERIA

Immediately trigger emergency protocol if the caller mentions:

- Life-threatening symptoms
- Severe trauma
- Loss of consciousness
- Breathing problems
- Stroke symptoms
- Severe bleeding
- Overdose or poisoning
- Severe allergic reactions
- Suicidal or self-harm statements
- Any situation that could require emergency services

OR uses phrases indicating extreme distress such as:

- "I think I'm dying"
- "I can't breathe"
- "I might pass out"
- "Something is very wrong"

### 🔴 EMERGENCY PROTOCOL ACTIONS

When an emergency is detected:

1. Immediately stop all normal conversation
2. Do NOT ask any additional questions
3. Do NOT attempt to gather more details
4. Provide the emergency redirection message below

### 🔴 REQUIRED EMERGENCY MESSAGE (USE EXACTLY)

> "I'm not able to help with emergencies. Based on what you've described, this may be a serious medical situation. Please hang up and call 911 immediately, or go to the nearest emergency room."

### 🔴 IF CALLER CONTINUES TALKING AFTER REDIRECTION

Repeat:

> "I'm unable to assist with emergencies. Based on what you've described, this may be a serious medical situation. Please call 911 right now."

Do not provide any additional information.

### 🔴 NEVER DO THESE

- Never say "you will be okay"
- Never estimate risk level
- Never suggest urgent care vs ER
- Never give medical instructions
- Never attempt triage

---

## 7. Testing Requirements

- End-to-end testing of all call flows
- Edge-case testing for errors, emergencies, spam calls, and multi-call concurrency
- Verification of soft scheduling and SMS delivery
- Testing must be completed before the mandatory walkthrough

---

## 8. Mandatory Walkthrough

Contractor conducts a live session demonstrating:

- System operation & call flows
- AI prompt & response logic
- How to update or troubleshoot the system

Client must have an understanding of how the systems work together and operate.

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

The project is complete **only** when:

1. All in-scope functionality works as described
2. System is HIPAA compliant
3. Keragon logging captures all required events
4. Documentation is delivered
5. Mandatory walkthrough is completed
6. Client confirms acceptance in writing
7. There is a number to call for demo purposes in closing meetings with clients

---

## EXECUTION OF AGREEMENT

By signing below, both parties acknowledge that they have read, understood, and agree to the terms, requirements, and responsibilities outlined in this document.

This document represents the full understanding between the Client and Contractor regarding the services described and supersedes any prior discussions or informal agreements.

No modifications to this agreement shall be valid unless made in writing and signed by both parties.

**Client**
Name: Arthur Garnett
Signature: Arthur Garnett
Date: 2/23/26

**Contractor**
Name: Simone Lawson
Signature: Simone Lawson
Date: 2/23/2026
