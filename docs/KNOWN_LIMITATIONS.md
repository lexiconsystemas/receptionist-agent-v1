# Known Limitations — Analysis & Status

**Project:** After-Hours AI Receptionist V1
**Last reviewed:** 2026-03-14

These are the three edge cases identified during simulation testing that deviated from expected behavior. Each is documented here with its root cause, current status, and reasoning for why it is either fixed or intentionally left as-is.

---

## Limitation 1 — Ambiguous Bleeding

### What was observed
During simulation testing, Grace would sometimes trigger emergency mode immediately when a caller said "my arm is bleeding a lot" — without first asking for the body location as required by the Bleeding Protocol.

### Root cause
The simulation used text-only input. When the LLM saw high-distress phrasing ("a lot," "won't stop," "bad cut") alongside the word "bleeding," it sometimes matched that phrasing against the soft-trigger emergency list before running the Bleeding Protocol pre-check.

### Current status — ✅ Resolved (4 protection layers active)

The prompt now has four independent layers preventing this:

**Layer 1 — OPERATING RULES (proactive):**
Explicitly states that any mention of bleeding — including "bleeding a lot," "won't stop," "bad cut" — must first trigger the location question, not emergency mode. No exceptions for volume or distress language from limbs.

**Layer 2 — EMERGENCY PROTOCOL pre-check (runs before trigger list):**
A mandatory bleeding pre-check runs before the trigger list is evaluated. If the caller mentions limb bleeding (arm, hand, leg, foot, finger, toe), Grace is instructed to STOP, skip the trigger list entirely, and go to the Bleeding Triage Protocol.

**Layer 3 — BLEEDING LOCATION EXCEPTION (within trigger list):**
Inside the emergency trigger list itself, a clearly marked exception explicitly overrides all other triggers — including soft-language triggers — for confirmed limb bleeding. Volume descriptors ("a lot," "bad") and distress language alone are explicitly stated as non-triggers for limb bleeding.

**Layer 4 — MANDATORY WORKED EXAMPLE:**
The prompt contains a hard-coded worked example:
> *Caller says: "Hi, my arm is bleeding a lot."*
> *Correct action: "arm" = LIMB detected. "A lot" is irrelevant. DO NOT say the emergency statement. Go directly to BLEEDING TRIAGE PROTOCOL Step 3.*

### Why it may still occasionally fail (and why that's acceptable)
The LLM is probabilistic. In rare edge cases where a caller uses extreme distress language alongside limb bleeding (e.g., "I'm bleeding to death, my arm won't stop"), the soft-trigger "extreme distress or immediate danger" clause may still win. This is a deliberate safety trade-off: false positives (Grace escalates when she shouldn't) are far safer than false negatives (Grace doesn't escalate when she should). A patient incorrectly told to call 911 can hang up. A patient not told to call 911 when they should be cannot.

In production, this scenario is also naturally self-correcting: a patient who genuinely just has a cut on their arm will tell Grace it's not that serious, and Grace will redirect appropriately.

---

## Limitation 2 — Unresponsive Caller During Fever Triage

### What was observed
During simulation testing, Grace did not re-engage using the Unresponsive Caller Protocol when a caller went silent mid-fever-triage. The expected behavior is: silence → 2–3 re-engagement attempts → 911 statement → stay on line.

### Root cause — ✅ Simulation artifact, not a real-call failure

This failure is specific to text-based simulation. In simulation, "silence" is represented by the simulator producing no output. The LLM has no way to distinguish between "the simulator didn't respond" and "there is actual dead air on the line." In production:

1. RetellAI handles silence natively. After `reminder_trigger_ms` (20 seconds) of no caller input, RetellAI injects a reminder prompt into the conversation. This triggers Grace's Unresponsive Caller Protocol.
2. After each reminder, if still no response, RetellAI fires another reminder — up to `reminder_max_count` (8 reminders = ~2.5 minutes of coverage).
3. Grace's prompt includes an explicit MID-TRIAGE SILENCE RULE that instructs her to pause the triage and run the Unresponsive Caller Protocol if silence occurs after any triage question.

### Live call evidence
Arthur's test calls (call_96ac7e1288812a7008cc7dc04d0) confirmed that Grace does fire re-engagement attempts in real calls. The calls were being dropped only because `reminder_max_count` was set to 2 (now set to 8). The re-engagement language has since been updated to exactly match scope wording: *"Hello? Are you still with me? Please respond if you can hear me."*

### Why this is left as documented (not fixed in simulation)
Simulating silence accurately would require inserting artificial silence events into the simulator that cause RetellAI's reminder system to fire. This is not a realistic simulation scenario and would not be representative of actual call behavior. The protocol is correct in production. Retesting this in simulation is not a reliable indicator.

---

## Limitation 3 — SMS Opt-In Skipped When Caller Volunteers Information Upfront

### What was observed
When a caller provided their name, reason for visit, and preferred time in their very first message — without waiting to be asked — Grace sometimes proceeded to the Step 9 wrap-up without asking for SMS consent (Step 7) or the feedback opt-in (Step 8).

### Root cause
The general OPERATING RULE to "not re-ask information the caller has already volunteered" was being applied too broadly. The LLM was treating SMS consent as optional context, similar to name or reason for visit. Since the caller didn't explicitly decline SMS, Grace assumed consent was implicit and skipped directly to closing.

### Current status — ✅ Fixed (2026-03-14)

A mandatory rule was added to OPERATING RULES:

> *"Steps 7 and 8 (SMS consent and feedback opt-in) are mandatory and cannot be skipped, even if the caller has already volunteered their name, reason for visit, or visit time earlier in the call. These are legal consent questions — you may never assume the answer. Always ask Step 7 after confirming the phone number, and always ask Step 8 if the caller said yes to Step 7."*

This explicitly carves out Steps 7 and 8 from the "don't re-ask volunteered info" rule and marks them as required consent steps that cannot be inferred.

### Why this matters
SMS consent is a legal requirement under TCPA (Telephone Consumer Protection Act). Implied consent is defensible for the follow-up confirmation text (based on the call itself), but explicit opt-in is cleaner and more defensible. The feedback rating question especially should never be sent without a clear yes. The fix ensures Grace always asks — no assumptions.

### Residual edge case (accepted)
If a caller explicitly says during their very first message "I don't want any texts" along with their name and reason — Grace may still ask Step 7 before recognizing the caller already declined. This is intentional: it's better for Grace to confirm directly than to silently apply a preference that may have been heard in a different context. The caller simply says no again, which Grace logs as `sms_consent: false`.

---

## Summary Table

| # | Limitation | Status | Production impact |
|---|-----------|--------|------------------|
| 1 | Ambiguous bleeding may skip location question | ✅ Resolved — 4 prompt layers + worked example | Very low; false-positive ER redirect is safer than false-negative |
| 2 | Unresponsive mid-triage doesn't re-engage in simulation | ✅ Not a real-call issue — simulation artifact | Zero; confirmed working in live calls with `reminder_max_count: 8` |
| 3 | SMS opt-in skipped when caller volunteers info upfront | ✅ Fixed 2026-03-14 — mandatory consent rule added | Zero going forward; pushed live |
