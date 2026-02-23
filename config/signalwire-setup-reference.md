# ⚠️  DEPRECATED — SignalWire has been replaced by RetellAI for telephony.
# This file is kept for historical reference only.
# RetellAI now handles: inbound calls, PSTN, phone number management, and HIPAA BAA.
# For SMS setup, see .env.example (SMS section) once provider is confirmed.
# ---

# SignalWire Setup Reference (ARCHIVED)
# After-Hours AI Receptionist — Urgent Care MVP
#
# Everything needed to configure SignalWire once you have account access.
# All webhook URLs use YOUR_SERVER_URL as a placeholder —
# replace with your ngrok URL (testing) or Railway URL (production).
#
# Contract reference: Exhibit A §4 (SignalWire = telephony + SMS + webhooks)
# ─────────────────────────────────────────────────────────────────────────────

---

## Step 1 — Create SignalWire Account

1. Go to https://signalwire.com → Sign Up
2. Create under **Arthur Garnett's** email (scope §6 — client-owned accounts)
3. Create a Space — name it something like `arthurgarnett-urgentcare`
4. Your Space URL will be: `arthurgarnett-urgentcare.signalwire.com`

---

## Step 2 — Collect Credentials

From the SignalWire dashboard → **Settings → General**:

| Credential | Where to Find | `.env` Variable |
|---|---|---|
| Project ID | Settings → General → Project ID | `SIGNALWIRE_PROJECT_ID` |
| API Token | Settings → API → Create Token | `SIGNALWIRE_API_TOKEN` |
| Space URL | Your space subdomain | `SIGNALWIRE_SPACE_URL` |

**Create the API Token:**
1. Settings → API → Create New Token
2. Name: `receptionist-agent-v1`
3. Permissions: Voice + Messaging (read/write)
4. Copy immediately — shown once

---

## Step 3 — Purchase Phone Number

1. SignalWire dashboard → **Phone Numbers → Search**
2. Search by area code matching the clinic location
3. Requirements: **Voice** + **SMS** capabilities (both required)
4. Purchase the number
5. Copy the number in E.164 format (e.g. `+17325550100`)
6. Add to `.env` as `SIGNALWIRE_PHONE_NUMBER`

---

## Step 4 — Configure Inbound Voice Webhook

This routes incoming calls to RetellAI via our server.

1. SignalWire → **Phone Numbers → [your number] → Edit**
2. Under **Voice & Fax**:

| Setting | Value |
|---|---|
| **Handle Calls Using** | LaML Webhooks |
| **When a Call Comes In** | `POST` |
| **Webhook URL** | `YOUR_SERVER_URL/webhook/signalwire/voice` |
| **Fallback URL** | _(leave blank for now)_ |
| **Status Callback URL** | `YOUR_SERVER_URL/webhook/retell/status` |

3. Click **Save**

**What happens:** When a patient calls the SignalWire number, SignalWire POSTs to our server, which returns LaML XML connecting the call to RetellAI via WebSocket.

---

## Step 5 — Configure Inbound SMS Webhook

This routes patient SMS replies (ratings, opt-outs, free text) to our handler.

1. SignalWire → **Phone Numbers → [your number] → Edit**
2. Under **Messaging**:

| Setting | Value |
|---|---|
| **Handle Messages Using** | LaML Webhooks |
| **When a Message Comes In** | `POST` |
| **Webhook URL** | `YOUR_SERVER_URL/webhook/signalwire/inbound-sms` |
| **Status Callback URL** | `YOUR_SERVER_URL/webhook/signalwire/sms-status` |

3. Click **Save**

---

## Step 6 — Connect RetellAI to SignalWire

RetellAI needs to know which SignalWire number to use for outbound/inbound call handling.

In the **RetellAI dashboard**:
1. Go to **Integrations → Telephony → SignalWire**
2. Enter:
   - SignalWire Project ID
   - SignalWire API Token
   - SignalWire Space URL
3. Select your purchased phone number
4. Save

RetellAI will then use our SignalWire number for all calls.

---

## Step 7 — Verify Webhook Signature (Production Only)

Our server validates that webhook POSTs genuinely come from SignalWire.

1. SignalWire → Settings → Security → Webhook Signing
2. Enable webhook signing
3. Copy the signing secret
4. Add to `.env` as `WEBHOOK_SIGNATURE_SECRET`

This is auto-enforced in `src/config/signalwire.js` → `validateWebhookSignature()` when `NODE_ENV=production`.

---

## Webhook URL Reference

Replace `YOUR_SERVER_URL` with:
- **Testing:** `https://abc123.ngrok.io` (from `npx ngrok http 3000`)
- **Production:** `https://your-app.up.railway.app` (Railway URL)

| Event | Webhook URL | Method |
|---|---|---|
| Inbound voice call | `YOUR_SERVER_URL/webhook/signalwire/voice` | POST |
| Inbound SMS reply | `YOUR_SERVER_URL/webhook/signalwire/inbound-sms` | POST |
| SMS delivery status | `YOUR_SERVER_URL/webhook/signalwire/sms-status` | POST |
| RetellAI call events | `YOUR_SERVER_URL/webhook/retell` | POST |
| RetellAI call status | `YOUR_SERVER_URL/webhook/retell/status` | POST |
| Keragon callbacks | `YOUR_SERVER_URL/webhook/keragon/callback` | POST |

---

## Test the Voice Webhook (Without Making a Call)

```bash
curl -X POST YOUR_SERVER_URL/webhook/signalwire/voice \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B12125550199&To=%2B17325550100&CallSid=CAtest123&CallStatus=ringing"
```

Expected response: XML LaML connecting to RetellAI WebSocket.

## Test the SMS Webhook

```bash
curl -X POST YOUR_SERVER_URL/webhook/signalwire/inbound-sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B12125550199&To=%2B17325550100&Body=4&SmsSid=SMtest123"
```

Expected response: `200 OK` (no body — we respond immediately and process async).

---

## .env Values to Fill In After Setup

```env
SIGNALWIRE_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SIGNALWIRE_API_TOKEN=PTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SIGNALWIRE_SPACE_URL=yourspace.signalwire.com
SIGNALWIRE_PHONE_NUMBER=+1XXXXXXXXXX
WEBHOOK_SIGNATURE_SECRET=your_signing_secret_from_signalwire
```

---

## Checklist

- [ ] SignalWire account created under Arthur Garnett
- [ ] Project ID, API Token, Space URL copied to `.env`
- [ ] Phone number purchased (voice + SMS capable)
- [ ] Voice webhook configured → `/webhook/signalwire/voice`
- [ ] SMS webhook configured → `/webhook/signalwire/inbound-sms`
- [ ] SMS status callback configured → `/webhook/signalwire/sms-status`
- [ ] RetellAI connected to SignalWire in RetellAI dashboard
- [ ] Webhook signature secret copied to `.env`
- [ ] Voice webhook tested with curl
- [ ] SMS webhook tested with curl
- [ ] Live call test — call the number and hear the AI answer
