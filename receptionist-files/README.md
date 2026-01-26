# AI Voice Receptionist - Urgent Care (After-Hours)

Non-clinical AI voice agent that answers after-hours calls for urgent care clinics, captures caller intent, filters spam, provides general info, and logs all interactions for staff follow-up.

## 🎯 Project Goals

- **No missed calls** - Answer all after-hours calls automatically
- **Clean call logs** - Structured data for staff review
- **Spam filtering** - Detect and filter robocalls
- **Non-clinical** - No medical advice, appointment booking, or EMR integration
- **Emergency routing** - Immediate detection and 911/988 redirection
- **HIPAA-conscious** - Minimal PHI, no medical history or insurance logging

## 📋 Features

- ✅ Inbound voice handling via Twilio + RetellAI
- ✅ Healthcare-focused AI via Hathr.ai
- ✅ Natural conversational intake
- ✅ Caller data capture (name, phone, reason, timeframe)
- ✅ Spam/robocall detection and termination
- ✅ Emergency detection with immediate interruption
- ✅ SMS follow-up with implied consent
- ✅ Structured call logging via Keragon
- ✅ Multi-call concurrency support

## 🏗️ Architecture

```
Caller → Twilio → RetellAI (Voice Agent) → Hathr.ai (LLM)
                     ↓
                  Keragon (Automation)
                     ↓
              Structured Logs (Staff Review)
                     ↓
                Twilio SMS (Follow-up)
```

See `docs/ARCHITECTURE.md` for detailed system diagrams and data flow.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Twilio account
- RetellAI account
- Hathr.ai account (LLM layer)
- Keragon account (automation)
- Google account (for Calendar)

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
- Set up Messaging Service for SMS

### 2. RetellAI Setup
- Create agent with Hathr.ai as LLM backend
- Configure voice settings (tone, speed, latency)
- Set post-call webhook to your Express server

### 3. Hathr.ai Setup
- Configure healthcare-focused conversation model
- Set up emergency detection prompts
- Configure soft scheduling logic

### 4. Keragon Setup
- Create webhook receiver for call logging
- Build automation workflows for staff notifications
- Configure Google Calendar integration

### 5. Google Calendar Setup
- Connect clinic hours calendar
- Share with Keragon for soft scheduling reference

## 📊 Call Log Schema (Keragon)

| Field | Type | Description |
|-------|------|-------------|
| call_id | String | RetellAI call ID |
| timestamp | DateTime | Call start time (ISO8601) |
| caller_id | String | Phone number (E.164) |
| caller_name | String | Captured name |
| call_duration_seconds | Number | Call length |
| patient_type | Enum | new/returning/unknown |
| reason_for_visit | Text | Non-diagnostic description |
| intended_visit_timeframe | String | 1-hour windows preferred |
| disposition | Enum | completed/high_intent/emergency/spam/dropped |
| emergency_trigger | Boolean | Emergency detected |
| spam_flag | Boolean | Spam call flagged |
| sms_sent | Boolean | SMS delivery attempted |
| sms_delivery_status | String | delivered/failed/pending |
| ai_decision_path | Array | Conversation flow tracking |
| error_notes | String | Any errors or edge cases |

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

## ⚡ Emergency Detection

The AI immediately interrupts and redirects for:
- Chest pain/pressure
- Difficulty breathing
- Signs of stroke
- Severe bleeding
- Loss of consciousness
- Seizures
- Serious head injuries
- Severe allergic reactions
- Suspected overdose
- Suicidal thoughts/self-harm (→ 988 Lifeline)

## 📝 License

UNLICENSED - Private project

## 👥 Team

Client: Arthur Garnett
Contractor: Simone
