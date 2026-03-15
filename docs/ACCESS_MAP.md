# Access Map (Scope §6)

**Project:** After-Hours AI Receptionist — Urgent Care MVP  
**Client:** Arthur Garnett  
**Contractor:** Simone Lawson  

This document lists all systems involved in the MVP stack, who owns them, what credentials exist, and what access should be revoked at project close.

---

## Systems & Ownership

| System | URL | Access level | Credential type | Who holds it |
|---|---|---|---|---|
| RetellAI | https://app.retellai.com | Agent owner | API key + webhook signing secret | Arthur |
| Railway (Hosting) | https://railway.app | Project owner | Dashboard login + environment variables | Arthur |
| Keragon | https://app.keragon.com | Workspace owner | Workflow webhook URLs (W1–W4) | Arthur |
| Google Calendar | https://calendar.google.com | Calendar owner (shared calendar) | Calendar ID | Arthur |
| Google Cloud (GCP) | https://console.cloud.google.com | Project owner | Service account + private key | Arthur |
| Redis (Railway-managed) | https://railway.app | Service owner (via Railway) | `REDIS_URL` environment variable | Arthur (Railway) |
| SMS Provider (Twilio) | https://console.twilio.com | Account owner | Account SID + Auth Token + From-number | Arthur |

---

## Contractor (Simone) Temporary Access — Must Be Revoked at Project Close

Arthur should revoke all contractor access after the mandatory walkthrough and written acceptance.

- **RetellAI**
  - **Revoke**: remove Simone from RetellAI workspace (if added) and rotate API key if it was shared.
- **Railway**
  - **Revoke**: remove Simone from Railway project collaborators.
  - **Rotate**: regenerate any shared deploy tokens or environment secrets if applicable.
- **Keragon**
  - **Revoke**: remove Simone from Keragon workspace collaborators.
- **Google Cloud / Service Account Key**
  - **Revoke**: delete the service account key that was shared for deployment.
  - **Optional rotate**: create a new service account key for ongoing use.
- **Twilio**
  - **Revoke/Rotate**: rotate auth token if it was shared.

---

## Credential Handling Rules (Per Scope)

- All accounts must be client-owned.
- Contractor access must be temporary and revocable.
- Contractor must not remain an account owner/recovery contact/billing owner.
- Contractor must not retain any credentials, API keys, or copies of proprietary materials after completion.
