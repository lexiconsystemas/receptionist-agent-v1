# Grace AI Receptionist — Client Setup Checklist
**For: Arthur Garnett**
**Prepared by: Simone Lawson**

This checklist covers everything Arthur needs to provide or complete before the system can go live. Each section tells you exactly where to go and what to do. You do not need to be technical — just follow the steps.

---

## SECTION 1 — Railway (Your Server)

Railway is where the system runs 24/7.

**Go to:** [railway.app](https://railway.app) → log in → open project **b26e09c6**

### Step 1 — Add Your Clinic Info

In Railway: click your service → **Variables** tab → click **+ New Variable** for each item below.

| Variable Name | What to put in |
|---|---|
| `CLINIC_NAME` | Your clinic's exact name (e.g. `Garnett Urgent Care`) |
| `CLINIC_ADDRESS` | Your full address (e.g. `123 Main St, Atlanta, GA 30301`) |
| `CLINIC_HOURS` | Use format below ↓ |
| `CLINIC_TIMEZONE` | Your timezone (e.g. `America/New_York` or `America/Chicago`) |
| `STAFF_ALERT_PHONE` | Your mobile number in this format: `+12125550100` |
| `APP_BASE_URL` | Your public server URL (e.g. `https://your-app.up.railway.app`) |

**Clinic Hours format** — replace the times with your actual hours:
```
MON:08:00-20:00,TUE:08:00-20:00,WED:08:00-20:00,THU:08:00-20:00,FRI:08:00-20:00,SAT:09:00-17:00,SUN:10:00-16:00
```
Times are in 24-hour format. `08:00` = 8am. `20:00` = 8pm.

> **APP_BASE_URL note:** This must be the public HTTPS base URL for your Railway service. It is used to build webhook URLs and SMS status callback URLs.

---

### Step 2 — Add Your RetellAI API Key

**Go to:** [app.retellai.com](https://app.retellai.com) → Settings → API Keys → copy your key

Back in Railway → Variables → add:

| Variable Name | What to put in |
|---|---|
| `RETELL_API_KEY` | Your RetellAI API key |
| `RETELL_WEBHOOK_SECRET` | RetellAI → Agent → Webhook → copy the Signing Secret |

---

### Step 3 — Add Your Google Calendar Info

You'll need three pieces from your Google account. Simone can walk you through this if needed.

| Variable Name | What to put in |
|---|---|
| `GOOGLE_CALENDAR_ID` | Your clinic calendar ID (looks like `abc123@group.calendar.google.com`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The service account email Simone sends you (ends in `.iam.gserviceaccount.com`) |
| `GOOGLE_PRIVATE_KEY` | The private key from the service account JSON file Simone sends you |

> **GOOGLE_PRIVATE_KEY note:** The key starts with `-----BEGIN PRIVATE KEY-----` and ends with `-----END PRIVATE KEY-----`. Paste the full thing exactly as provided. Do not add extra spaces or line breaks.

---

### Step 4 — Share Your Google Calendar

**Go to:** Google Calendar → find your clinic calendar → click the three dots → **Settings and sharing**

Under **Share with specific people:**
- Click **+ Add people**
- Enter the service account email (the one ending in `.iam.gserviceaccount.com` that Simone provides)
- Permission level: **Make changes to events**
- Click **Send**

This allows the system to write appointment entries to your calendar automatically.

---

## SECTION 2 — RetellAI (Grace's Voice & Prompt)

**Go to:** [app.retellai.com](https://app.retellai.com) → Agents → your Grace agent

### Step 5 — Update the Prompt Placeholders

In the agent → **Prompt** tab, find and replace:

| Find this | Replace with |
|---|---|
| `{{CLINIC_NAME}}` | Your clinic name (same as Step 1) |
| `{{CLINIC_HOURS}}` | Your hours written out in plain English (e.g. `Monday through Friday, 8 AM to 8 PM; Saturday 9 AM to 5 PM; Sunday 10 AM to 4 PM`) |
| `{{CLINIC_ADDRESS}}` | Your clinic address |

Save the prompt after making these changes.

---

### Step 6 — Fix the Greeting Pause

In RetellAI → Agent → **Speech Settings** → find **Pause Before Speaking** under Welcome Message:
- Change from `0` to `1.0`
- Save

This prevents Grace from cutting off the first word of her greeting.

---

## SECTION 3 — Keragon (Logging & Alerts)

**Go to:** [app.keragon.com](https://app.keragon.com)

### Step 7 — Add SendGrid API Key to Email Steps

You need a SendGrid account with a verified sender email. If you don't have one, Simone can guide you.

For each of the 3 workflows that have email steps (W1 Call Log, W3 SMS Events, W4 Edge Cases):
1. Open the workflow
2. Find the email/SendGrid step
3. Enter your SendGrid API key and your verified sender email
4. Save

This enables email alerts to be sent to staff when there are low ratings, failed SMS, or other events requiring review.

---

## SECTION 4 — Final Test Call

Once all steps above are complete, let Simone know. She will:
1. Trigger a deploy on Railway
2. Update the RetellAI webhook URL to point to your live server
3. Run a test call together to verify everything is working

**You'll need:** Access to the RetellAI phone number and your mobile phone for the test call.

---

## Checklist Summary

| # | Task | Who | Done? |
|---|------|-----|-------|
| 1 | Add clinic info to Railway (name, address, hours, timezone, staff phone) | Arthur | ☐ |
| 2 | Add RetellAI API key + webhook secret to Railway | Arthur | ☐ |
| 3 | Add Google Calendar credentials to Railway | Arthur + Simone | ☐ |
| 4 | Share Google Calendar with service account email | Arthur | ☐ |
| 5 | Replace `{{CLINIC_NAME}}`, `{{CLINIC_HOURS}}`, `{{CLINIC_ADDRESS}}` in RetellAI prompt | Arthur or Simone | ☐ |
| 6 | Set Pause Before Speaking → 1.0s in RetellAI | Arthur or Simone | ☐ |
| 7 | Add SendGrid API key to Keragon email steps | Arthur + Simone | ☐ |
| 8 | Live test call | Both | ☐ |

---

*Questions? Contact Simone before making any changes you're unsure about.*
