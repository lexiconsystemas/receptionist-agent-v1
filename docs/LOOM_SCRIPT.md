# Loom Demo Script — Grace AI Receptionist

**For:** Arthur Garnett walkthrough | **Presenter:** Simone Lawson
**Target length:** 12–18 minutes | **Last updated:** 2026-03-14

---

## Before You Record

**Have these open and ready:**
- [ ] RetellAI dashboard — logged in, Grace agent selected
- [ ] Keragon dashboard — logged in, all 4 workflows visible
- [ ] Google Calendar — Grace calendar open, day view for today/tomorrow
- [ ] Terminal or Railway dashboard (optional — for showing server logs live)
- [ ] Phone ready to make test calls

**Suggested recording setup:**
- Screen share your full desktop
- Keep your phone off-screen but nearby
- Speak slowly — you're narrating for someone non-technical
- Pause after each call to show results in Keragon and Calendar before moving on

---

## Scene 1 — Introduction (1–2 min)

**Screen:** Blank / your face or just audio intro

> "Hey Arthur — this is your full walkthrough of Grace, your after-hours AI receptionist. By the end of this video, you'll see every feature working live, understand exactly what your team sees in the morning, and know what you'll need to provide each new client when you start licensing this system.
>
> I'm going to walk through five live calls — a normal scheduling call, a fever triage, a bleeding triage, an emergency, and a spam call. After each one I'll show you exactly what landed in Keragon and your Google Calendar.
>
> Let's jump in."

---

## Scene 2 — The Dashboard Tour (2–3 min)

**Screen:** RetellAI dashboard

> "This is the RetellAI dashboard — it's where Grace lives. Here's her agent profile."

Point to:
- Agent name: Grace
- Voice: Sloane (Cartesia Sonic-3) — mention it sounds natural, not robotic
- The phone number she answers

> "Grace is always on. She picks up every call from the moment the clinic closes. There's no queue, no hold music — she answers immediately, handles as many calls as come in simultaneously, and every call follows the same structured flow."

**Screen:** Switch to Keragon

> "And this is Keragon — your logging and automation hub. Four workflows run automatically every time Grace takes a call."

Click into each workflow briefly:
- W1 — Call Log: "Every single call — who called, what they needed, whether they booked."
- W2 — Emergency Alert: "Fires instantly when Grace hears an emergency keyword. Your team gets notified."
- W3 — SMS Events: "Tracks every text sent, every rating received, every opt-out."
- W4 — Edge Cases: "Dropped calls, failed texts, appointment changes — nothing falls through."

> "You don't have to do anything with these. They run themselves. Let me show you what it looks like after a real call."

---

## Scene 3 — Demo Call 1: Standard Scheduling (3–4 min)

**Screen:** Keep Keragon open in background — have Google Calendar ready to flip to

> "First call — this is your most common scenario. A patient calls after hours, wants to book a visit. Watch how Grace handles the full flow."

**Make the call.** Play the role of a patient:
- When Grace greets you: give your name, say you've been there before, say you have a sore throat
- Give a visit time: "Tomorrow around 10am works"
- Confirm your phone number
- Say yes to the SMS text, yes to the rating text
- Say no when she asks if there's anything else

*After the call ends — wait ~10 seconds — then:*

**Screen:** Keragon → W1 workflow → Runs tab

> "Watch — there it is. The call record just landed. Let me open it."

Click into the run. Walk through the fields:
- `caller_name`: their name
- `caller_id`: anonymized to last 4 digits — *"We never log a full phone number. Privacy by design."*
- `reason_for_visit`: "sore throat"
- `intended_visit_timeframe`: "tomorrow around 10am"
- `disposition`: "completed"
- `patient_type`: "returning"
- `sms_sent`: true/false (mock mode — explain this goes live with Notifyre at Delivery 2)
- `retention_scrub_at`: *"This timestamp tells your team exactly when to delete this record — 7 days out. HIPAA-conscious by design."*

**Screen:** Google Calendar

> "And here's the calendar event Grace just created."

Show the event:
- Title: "Urgent Care Walk-In — [Name]"
- Time block: 10am–11am
- Description: name, DOB, phone, reason, call ID

> "Your morning staff opens this calendar, sees who's expected and when, and they're prepared before the first patient walks in."

---

## Scene 4 — Demo Call 2: Fever Triage (2–3 min)

**Screen:** Phone — make the call

> "Now let's try a fever call. This is where Grace really shows her value — she follows a specific clinical protocol to assess whether this patient needs the ER or can wait until morning."

**Play the patient:**
- Reason for visit: "My daughter has a fever"
- Grace will ask age — say: "She's 6 years old"
- Grace will ask about immune system — say: "No, she's healthy"
- Grace will ask for temperature — say: "It's 100.8"
- Grace will ask follow-up questions — answer no to all
- Grace will ask duration — say: "Since yesterday"
- Accept the scheduling prompt — give a time

*After the call:*

> "Notice how she went through every step of that protocol — age, immune status, temperature, symptoms, duration — and only offered scheduling once she confirmed it was safe. That's your liability protection built into every call."

Show the Keragon record. Point to `reason_for_visit`, `disposition: completed`.

---

## Scene 5 — Demo Call 3: Emergency Detection (1–2 min)

**Screen:** Phone — make the call

> "This one's important to see. Grace is designed to stop everything the second she hears an emergency."

**Play the patient:**
- When Grace asks what brings you in: say "I'm having chest pain and I can't breathe properly"

Grace should immediately say: *"I'm not able to help with emergencies. Based on what you've described, this may be a serious medical situation. Please hang up and call 9-1-1 immediately, or go to the nearest emergency room."*

*After the call:*

**Screen:** Keragon → W2 Emergency Alert workflow → Runs

> "That emergency alert fired the moment Grace detected 'chest pain' and 'can't breathe.' Your team can see exactly what triggered it, what the patient said, and when. In a real deployment, Keragon can email or text your staff the moment this fires — so even if you're monitoring overnight, you know immediately."

---

## Scene 6 — Demo Call 4: Spam Detection (1 min)

**Screen:** Phone — make the call

> "Grace also protects your log from clutter. Watch what happens with a robocall."

**Play the spam caller:**
- When Grace asks what she can help with: say something like "Congratulations, you've been selected for an extended warranty offer. Press one to speak to a representative."

Grace should say: *"This line is for patient scheduling only. Thank you for calling."*

*After the call:*

Show Keragon W1 run — point to `spam_flag: true` and `spam_reasons`.

> "Flagged and logged. Your team can review it, ignore it, or use it to block the number. It never pollutes your real patient records."

---

## Scene 7 — SMS Overview (1 min)

**Screen:** Show smsService.js or just explain verbally — no need to go deep into code

> "SMS is fully built and ready — it just needs your Notifyre account activated, which is part of Delivery 2.
>
> When it goes live, every patient who says yes to a text during the call will automatically receive: a confirmation with your address, a reminder the day before their visit, and a reminder one hour before. If they gave a rating, they'll get that too.
>
> Patients can reply STOP at any time and they're off the list permanently. It's fully TCPA-compliant. Everything in English and Spanish."

---

## Scene 8 — What You'll See Every Morning (1 min)

**Screen:** Keragon dashboard + Google Calendar side by side if possible

> "Here's your morning routine once Grace is live:
>
> 1. Open Google Calendar — see who called overnight and when they're planning to come in.
> 2. Open Keragon — review any calls flagged as emergencies, edge cases, or incomplete.
> 3. If any appointment changes or cancellations came in overnight, those are in the Edge Cases workflow — Grace texted your staff phone too.
>
> That's it. Grace handled everything. Your team just executes."

---

## Scene 9 — Future Clinic Onboarding Overview (1–2 min)

**Screen:** Blank / face cam / simple slide

> "One more thing — as you start licensing this to other clinics, here's what each new client will need to provide:
>
> **Phone number setup** — either you provision them a new number through RetellAI, or they forward their existing after-hours line. Most VoIP systems like RingCentral or Grasshopper make this a 2-minute change in their portal. Traditional carriers are a quick call to business support.
>
> **Google Calendar** — create a new calendar, share it with the Grace service account, give you the calendar ID. 10 minutes.
>
> **Keragon** — you duplicate the 4 workflows into their account, they give you the email address for notifications, you give them a SendGrid key. 20 minutes.
>
> **Clinic info** — name, address, hours, timezone, staff alert phone. That's it.
>
> From that point, you update the prompt, set the env vars, do a test call, and they're live. Full onboarding is under 2 hours once you have a system for it."

---

## Scene 10 — Closing (30 sec)

> "That's Grace. Every call answered, every protocol followed, every record logged — automatically, every night, without you having to think about it.
>
> I'll send you the CLIENT_GUIDE document separately — it has the full breakdown of everything you just saw, plus the onboarding checklist for new clients with carrier-specific call forwarding instructions.
>
> Let me know if you have any questions before our walkthrough. Talk soon."

---

## Demo Call Cheat Sheet

*Quick reference while recording — print or keep on second monitor*

| Call | Your role | What to say | What Grace should do |
|------|-----------|-------------|---------------------|
| **Standard** | Patient | Name + returning + sore throat + tomorrow 10am + yes SMS + yes rating + nothing else | Full 10-step flow → Keragon W1 + Calendar event |
| **Fever** | Parent | Daughter, age 6, healthy, 100.8°F, no symptoms, since yesterday, tomorrow morning | Fever protocol → scheduling → Keragon W1 + Calendar |
| **Emergency** | Patient | "I'm having chest pain and I can't breathe properly" | Emergency statement immediately → Keragon W2 |
| **Spam** | Robocall | "Congratulations you've been selected for an extended warranty. Press one." | "This line is for patient scheduling only." → Keragon W1 spam flag |

---

## If Something Goes Wrong Mid-Demo

**Grace doesn't answer:** Check RetellAI dashboard — confirm agent is active and number is assigned. Try calling again after 30 seconds.

**Call connects but Grace is silent:** Speak first — say "Hello?" — Grace is waiting for the caller to engage.

**Keragon record doesn't appear:** Wait 15 seconds and refresh. If still missing, check W1 workflow is enabled and the Railway server is running (`/health` endpoint should return 200).

**Calendar event doesn't appear:** Confirm the call completed with a visit timeframe (Grace must have captured a time). Check Google Calendar is refreshed. The event appears under the service account calendar, not your personal one.
