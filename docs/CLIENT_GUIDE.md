# Grace — Client User Guide

**After-Hours AI Receptionist | Urgent Care MVP**
*For: Arthur Garnett | Prepared by: Simone Lawson*

---

## What Grace Does

Grace is your after-hours answering service. She picks up every call the moment your clinic closes, handles unlimited calls at the same time, and makes sure no patient goes unheard overnight.

She does four things on every call:

1. **Answers** — greets the caller, identifies who they are and why they're calling
2. **Triages** — if the reason involves fever or bleeding, she walks them through a structured safety check and redirects to 911 when needed
3. **Schedules** — captures a preferred visit time and creates a placeholder in your Google Calendar
4. **Logs** — sends a full record of every call to your Keragon dashboard for your team to review in the morning

She does not give medical advice. She does not diagnose. If anything sounds like a real emergency, she stops the conversation and tells the caller to call 911 immediately.

---

## What Happens on a Call

Every call follows the same order:

| Step | What Grace Does | What the Caller Experiences |
|------|-----------------|-----------------------------|
| 1 | Greets the caller and confirms this is the after-hours line | Hears a professional greeting; knows the clinic is closed |
| 2 | Asks for patient name and date of birth | Simple intake — just like checking in at a front desk |
| 3 | Asks if they've visited before | New vs. returning patient flagged for your team |
| 4 | Asks reason for visit | Non-diagnostic — Grace only captures what the patient says |
| — | **If fever mentioned:** runs Fever Protocol (6 steps) | Guided through age → temperature → symptoms → scheduling |
| — | **If bleeding mentioned:** runs Bleeding Protocol | Asked location → injury details → symptoms → scheduling |
| — | **If emergency detected:** stops and directs to 911 | Hears exactly: *"Please hang up and call 9-1-1 immediately"* |
| 5 | Asks when they'd like to come in | Gives a time; Grace confirms and logs it |
| 6 | Confirms best callback number | Caller verifies phone number on file |
| 7 | Asks if they'd like a confirmation text | Optional SMS — patient chooses yes or no |
| 8 | Asks if they'd like a post-visit rating text | One-question follow-up; patient can decline |
| 9 | Asks if there's anything else | Wraps up naturally |
| 10 | Closing — gives clinic address, says goodnight | Call ends |

---

## What You'll See After Every Call

### In Keragon (your log dashboard)

Every call generates a record automatically. No setup needed on your end — it appears in your Keragon runs within seconds of the call ending.

**What each call record contains:**
- Date, time, and call duration
- Caller's name and (anonymized) phone number
- Whether they're new or returning
- Reason for visit — exactly what they said
- Preferred visit time
- Whether an emergency was detected
- Whether the call was spam
- Whether an SMS was sent
- A 7-day auto-delete timestamp on patient data

**Four separate logs are maintained:**

| Log | What it captures |
|-----|-----------------|
| **Call Log** | Every call — the standard record above |
| **Emergency Alert** | Fires immediately when Grace detects an emergency keyword — your team sees this right away |
| **SMS Events** | Every text sent, rating received, or opt-out |
| **Edge Cases** | Dropped calls, incomplete info, failed texts, appointment changes/cancellations |

> **How to find them:** Log in to Keragon → Workflows → click the workflow → Runs tab. Each row is one event. Click any row to see the full payload.

---

### In Google Calendar

Every call where a patient gives a visit time creates a 1-hour placeholder event on your Google Calendar automatically.

**Each event includes:**
- Patient name
- Date of birth
- Phone number
- Reason for visit
- Preferred visit window
- Call ID (for reference)

This is a soft reference for your morning staff — it tells them who to expect and roughly when. It is not a hard appointment.

> **Important:** These are walk-in intent placeholders only. Your staff uses them to anticipate overnight arrivals — they don't represent confirmed bookings.

---

## Emergencies

Grace is built to detect emergencies and get out of the way.

The moment a caller mentions anything that sounds like a life-threatening situation — chest pain, stroke symptoms, difficulty breathing, severe bleeding, overdose, suicidal statements, or over 60 other categories — Grace immediately stops the conversation and says:

> *"I'm not able to help with emergencies. Based on what you've described, this may be a serious medical situation. Please hang up and call 9-1-1 immediately, or go to the nearest emergency room."*

At the same time, an **Emergency Alert** fires to your Keragon dashboard instantly, so your staff can see it first thing in the morning or sooner if they're monitoring Keragon.

Grace does not attempt to assess severity, suggest treatment, or recommend urgent care over the ER. She redirects — period.

---

## Spam Calls

Grace automatically identifies robocalls and sales calls using a multi-factor scoring system. When she identifies a spam call, she says:

> *"This line is for patient scheduling only. Thank you for calling."*

The call is flagged in your Keragon log with a `spam` tag and the reasons it was flagged, so your team can review it if needed.

---

## Appointment Changes and Cancellations

If a patient calls to change or cancel an existing visit, Grace captures their name, phone number, and what they want to change. She:

1. Logs it to your Keragon dashboard under Edge Cases
2. Sends an SMS alert to your designated staff phone number
3. Notes the update so your team sees it when they arrive

Grace does not automatically edit your calendar — your staff handles the actual update. Grace's job is to make sure no request falls through the cracks overnight.

---

## SMS Messaging *(Delivery 2)*

SMS is built and ready — it just needs the Notifyre account activated and connected.

**What will be sent when SMS goes live:**

| Message | When | Who receives it |
|---------|------|----------------|
| Confirmation text | After call ends | Patients who said yes to SMS |
| 1-day-before reminder | 24 hours before scheduled visit | Same patients |
| 1-hour-before reminder | 1 hour before scheduled visit | Same patients |
| Rating request | After confirmation | Patients who opted into feedback |
| Low-rating follow-up | If rating ≤ 3 | Patients who gave low scores |

All SMS messages are in English and Spanish. Grace auto-detects the caller's language and uses it for the rest of the call and any follow-up texts.

Patients can reply STOP at any time to opt out. That preference is saved permanently.

---

## Managing Grace

### How to turn Grace off temporarily

In Railway (your hosting dashboard):

1. Go to your project → your service
2. Click **Settings** → **Redeploy** or set `SCHEDULER_ENABLED=false`
3. Or: remove the RetellAI phone number from active routing in your RetellAI dashboard

For immediate pause: forward calls to a live voicemail in your phone system and disable the RetellAI number from accepting inbound calls.

### How to update what Grace says

Grace's scripts (including clinic name, hours, and address) are in the RetellAI dashboard under your agent's system prompt. Any wording changes go there. Simone can make these changes remotely — no code deployment needed.

### How to update clinic hours or address

In RetellAI dashboard → Your Agent → System Prompt → update `{{CLINIC_HOURS}}` and `{{CLINIC_ADDRESS}}` values.

---

## Before Grace Goes Live

The following needs to be completed before Grace starts taking real patient calls:

| Task | Who | What it unlocks |
|------|-----|----------------|
| Fill in Railway environment variables | Arthur | Grace runs in production |
| Share Google Calendar with service account | Arthur | Calendar events start creating |
| Add SendGrid key to Keragon workflows | Arthur | Email notifications from Keragon |
| Set clinic name, hours, address in RetellAI | Simone or Arthur | Grace says the right clinic info |
| Enable call forwarding from clinic line | Arthur (with phone provider) | Real calls reach Grace |

---

## Future Client Onboarding Guide

*This section is for you as you license this system to other urgent care clinics.*

When onboarding a new clinic, here is what they need to provide and set up:

---

### 1. Phone Number Setup (most important first step)

A new clinic has two options for getting calls to Grace:

**Option A — New dedicated number (easiest)**
- Simone provisions a new phone number directly inside RetellAI
- Clinic publishes this as their after-hours line
- No forwarding needed — calls go straight to Grace
- Best for: new clinics without an existing after-hours number

**Option B — Forward their existing number to Grace**
- Clinic keeps their existing phone number
- Sets up conditional call forwarding: after-hours and on-busy → forward to the RetellAI number
- Best for: established clinics that don't want to change their published number

**Call forwarding setup (varies by carrier):**

| Carrier | How to enable call forwarding |
|---------|------------------------------|
| **AT&T (mobile)** | Dial `*21*[RetellAI number]#` from the clinic line |
| **Verizon (mobile)** | Call 611 or go to My Verizon → Call Forwarding |
| **T-Mobile** | Dial `**21*[RetellAI number]#` |
| **VoIP (RingCentral, Grasshopper, OpenPhone)** | Admin portal → Call Handling → After Hours → Forward to [RetellAI number] |
| **VoIP (Dialpad, 8x8, Vonage)** | Admin portal → Rules → Business Hours → Off-Hours → Forward |
| **Traditional landline (AT&T business)** | Dial `*72` + [RetellAI number] to enable; `*73` to disable |
| **Traditional landline (Verizon business)** | Call business support (611) to configure |

> **Tip for new clinics:** OpenPhone and Grasshopper are the easiest VoIP options if they don't already have a business phone system — both have simple after-hours forwarding in their web dashboards for under $30/month.

**What to collect from the clinic:**
- Their existing after-hours phone number (or confirm they want a new one)
- Their carrier/VoIP provider so you know which forwarding method applies
- Confirmation that after-hours hours are defined (Grace needs to know when to be "active")

---

### 2. Google Calendar

Each clinic gets their own dedicated calendar:

**What to ask for / set up:**
1. Create a new Google Calendar specifically for Grace (name it "Grace — After Hours Walk-Ins" or similar)
2. Share it with the Grace service account: `receptionist-calendar@urgent-care-demo-mvp.iam.gserviceaccount.com` → permission: **"Make changes to events"**
3. Collect: **Calendar ID** (found in Google Calendar → Settings → scroll to "Integrate calendar")
4. Provide these to Simone for Railway env vars

> **Optional:** Give the clinic's morning staff read access to the same calendar so they see walk-in expectations each morning.

---

### 3. Keragon

Each clinic gets their own Keragon workspace with 4 workflows:

**What Simone does:**
- Duplicate the 4 existing workflows into the new clinic's Keragon account
- Update webhook URLs in Railway env vars for that clinic's deployment

**What the clinic needs:**
- A Keragon account (or Simone sets one up under the clinic's email)
- A SendGrid account (or Simone creates one) — for email notifications
- Email address(es) to receive: emergency alerts, low-rating alerts, staff notifications

**What to collect:**
- Who should receive emergency alert emails
- Who should receive low-rating follow-up alerts
- Who should receive appointment change/cancel notifications

---

### 4. Clinic Information to Collect at Onboarding

| Field | Example | Used for |
|-------|---------|---------|
| Clinic name | "Lakeside Urgent Care" | Grace's greeting, SMS messages |
| Clinic address | "123 Main St, Atlanta, GA" | Closing message, SMS |
| Clinic phone (main) | +14045551234 | Optional — callback reference |
| After-hours line / forwarding number | +14045559999 | Call routing to Grace |
| Business hours | Mon–Fri 8am–8pm, Sat–Sun 9am–5pm | Grace redirects "today" to "tomorrow" |
| Timezone | America/New_York | Appointment logging, reminders |
| Staff alert phone | +14045558888 | SMS alerts for appointment changes |
| Staff notification email(s) | staff@lakesideurgent.com | Keragon email steps |
| Google Calendar ID | abc123@group.calendar.google.com | Calendar event creation |

---

### 5. Deployment Checklist for Each New Clinic

- [ ] Collect all clinic information above
- [ ] Provision or confirm phone number / call forwarding
- [ ] Create Google Calendar → share with service account → collect Calendar ID
- [ ] Duplicate Keragon workflows → update email recipients → collect SendGrid key
- [ ] Set all Railway env vars for that clinic's deployment
- [ ] Update Grace's system prompt with real clinic name, hours, address
- [ ] Do a test call to confirm Grace answers correctly and calendar event is created
- [ ] Send recording to clinic for review before go-live

---

*Document version: 1.0 | Last updated: 2026-03-14*
