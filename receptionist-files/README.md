# AI Voice Receptionist - Urgent Care (After-Hours)

Non-clinical AI voice agent that answers after-hours calls for urgent care clinics, captures caller intent, filters spam, provides general info, and logs all interactions for staff follow-up.

## 🎯 Project Goals

- **No missed calls** - Answer all after-hours calls automatically
- **Clean call logs** - Structured data for staff review
- **Spam filtering** - Detect and filter robocalls
- **Non-clinical** - No medical advice, appointment booking, or EMR integration

## 📋 Features

- ✅ Inbound voice handling via Twilio + RetellAI
- ✅ Natural conversational intake
- ✅ Caller data capture (name, phone, reason, timeframe)
- ✅ Spam/robocall detection
- ✅ SMS follow-up with consent
- ✅ Structured call logging to Google Sheets
- ✅ Make.com orchestration

## 🏗️ Architecture

```
Caller → Twilio → RetellAI (Voice Agent) → OpenAI (LLM)
                     ↓
                  Make.com (Orchestration)
                     ↓
              Google Sheets (Call Logs)
                     ↓
                Twilio SMS (Follow-up)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Twilio account
- RetellAI account
- Make.com account
- Google account (for Sheets)
- OpenAI API key

### Installation

1. Clone the repository
```bash
git clone <repo-url>
cd receptionist-agent-v1
```

2. Install dependencies
```bash
npm install
```

3. Copy environment variables
```bash
cp .env.example .env
```

4. Configure your `.env` file with actual credentials

5. Run the application
```bash
npm run dev
```

## 📁 Project Structure

```
receptionist-agent-v1/
├── src/
│   ├── index.js              # Main application entry
│   ├── config/
│   │   ├── twilio.js         # Twilio configuration
│   │   ├── retell.js         # RetellAI configuration
│   │   └── logger.js         # Winston logger setup
│   ├── services/
│   │   ├── callLogger.js     # Call logging service
│   │   └── smsService.js     # SMS sending service
│   ├── webhooks/
│   │   └── retellHandler.js  # RetellAI webhook handler
│   └── utils/
│       ├── validation.js     # Input validation
│       └── spamDetection.js  # Spam detection logic
├── docs/
│   ├── SETUP.md              # Detailed setup guide
│   ├── CALL_FLOW.md          # Call flow documentation
│   └── API.md                # API documentation
├── logs/                     # Application logs
├── .env.example              # Environment template
├── .gitignore
├── package.json
└── README.md
```

## 🔧 Configuration

### 1. Twilio Setup
- Purchase phone number
- Configure Voice webhook URL
- Set up Messaging Service

### 2. RetellAI Setup
- Create agent with prompt
- Configure voice settings
- Set post-call webhook

### 3. Make.com Setup
- Create webhook receiver
- Build data pipeline scenario
- Connect to Google Sheets

### 4. Google Sheets Setup
- Create new spreadsheet
- Add call log schema
- Share with Make.com

## 📊 Call Log Schema

| Field | Type | Description |
|-------|------|-------------|
| call_id | String | RetellAI call ID |
| timestamp | DateTime | Call start time |
| caller_name | String | Captured name |
| phone_number | String | E.164 format |
| reason_for_visit | Text | Free-form description |
| patient_type | Enum | new/returning/unknown |
| visit_timeframe | String | When they plan to visit |
| disposition | Enum | completed/incomplete/spam |
| sms_consent | Boolean | SMS opt-in |
| sms_sent | Boolean | SMS delivery status |

## 🗓️ Development Timeline

- **Day 1**: Foundation setup (Twilio + RetellAI)
- **Day 2**: Core conversation flow
- **Day 3**: Data pipeline (Make.com + Sheets)
- **Day 4**: Spam detection
- **Day 5**: SMS functionality
- **Day 6**: Edge cases & polish
- **Day 7**: Testing & launch

## ⚠️ Out of Scope

- Medical advice or triage
- Appointment booking
- EMR/EHR integration
- HIPAA compliance claims
- Real-time dashboards
- Business-hours routing

## 📝 License

MIT

## 👥 Team

Lexicon Systemas - [lexiconsystemas.atlassian.net](https://lexiconsystemas.atlassian.net)
