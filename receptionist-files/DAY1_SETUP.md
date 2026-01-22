# Day 1 Setup Guide - Foundation

Complete guide for setting up Twilio, RetellAI, Make.com, and Google Sheets.

## ⏱️ Estimated Time: 2-3 hours

---

## 1. Twilio Setup (30 minutes)

### Step 1.1: Create Twilio Account
1. Go to https://www.twilio.com/try-twilio
2. Sign up for a free trial account
3. Verify your email and phone number
4. Complete the onboarding questionnaire

### Step 1.2: Purchase Phone Number
1. Navigate to Phone Numbers → Manage → Buy a number
2. Select "Voice" capability
3. Choose a local number in your area code
4. Purchase the number (~$1.50/month)

### Step 1.3: Get API Credentials
1. Go to Console Dashboard
2. Copy your **Account SID**
3. Copy your **Auth Token**
4. Save these for your `.env` file

### Step 1.4: Create Messaging Service (for SMS)
1. Navigate to Messaging → Services
2. Click "Create Messaging Service"
3. Name it "Receptionist SMS Service"
4. Add your phone number as a sender
5. Copy the **Messaging Service SID**

### Step 1.5: Configure Voice Webhook (Do this AFTER RetellAI setup)
- We'll come back to this after configuring RetellAI

---

## 2. RetellAI Setup (45 minutes)

### Step 2.1: Create RetellAI Account
1. Go to https://www.retellai.com
2. Sign up for an account
3. Choose the Starter plan ($99/month)
4. Complete email verification

### Step 2.2: Get API Key
1. Navigate to Settings → API Keys
2. Click "Create New API Key"
3. Copy the API key (save immediately - shown once)
4. Save to your `.env` file

### Step 2.3: Create Your First Agent
1. Navigate to Agents → Create Agent
2. Configure agent settings:
   - **Name**: "After-Hours Receptionist"
   - **Voice**: Select a natural voice (e.g., "Rachel" from Eleven Labs)
   - **Language**: English (US)
   - **Response Latency**: Low
   - **Interruption Sensitivity**: Medium

### Step 2.4: Configure Agent Prompt
Paste this prompt in the Agent Instructions field:

```
# Role
You are the after-hours AI receptionist for [CLINIC_NAME], a professional urgent care clinic. 
You answer calls when the clinic is closed and gather information for staff review.

# Core Rules
1. You are NOT a medical professional and cannot provide medical advice
2. You CANNOT book appointments or schedule visits
3. You CANNOT access medical records
4. If someone describes an emergency, tell them to hang up and call 911
5. Maintain a calm, professional, empathetic tone
6. Keep responses concise (1-2 sentences max per turn)

# Your Task
Capture the following information in a natural conversation:
- Caller's name
- Callback phone number
- Reason they're calling
- When they plan to visit
- Whether they're a new or returning patient
- Whether they want an SMS confirmation

# Greeting
"Thank you for calling [CLINIC_NAME] after-hours line. This is our AI assistant. How can I help you today?"

# Clinic Information
- Name: [CLINIC_NAME]
- Hours: [HOURS]
- Address: [ADDRESS]
- Services: Urgent care, walk-ins welcome

# Handling Difficult Scenarios
- Medical questions: "I can't provide medical advice, but our staff will review your call tomorrow. If this is urgent, please visit an emergency room or call 911."
- Appointment requests: "We operate on a walk-in basis. Just come in during our business hours."
```

### Step 2.5: Configure Custom Functions
Add these custom functions to extract structured data:

**Function 1: log_call_information**
```json
{
  "name": "log_call_information",
  "description": "Store structured information captured during the call",
  "parameters": {
    "type": "object",
    "properties": {
      "caller_name": { "type": "string" },
      "phone_number": { "type": "string" },
      "reason_for_visit": { "type": "string" },
      "patient_type": { 
        "type": "string", 
        "enum": ["new", "returning", "unknown"] 
      },
      "visit_timeframe": { "type": "string" },
      "sms_consent": { "type": "boolean" }
    },
    "required": ["caller_name", "phone_number", "reason_for_visit"]
  }
}
```

**Function 2: flag_potential_spam**
```json
{
  "name": "flag_potential_spam",
  "description": "Flag call if spam indicators detected",
  "parameters": {
    "type": "object",
    "properties": {
      "reason": { "type": "string" },
      "confidence": { 
        "type": "string", 
        "enum": ["low", "medium", "high"] 
      }
    }
  }
}
```

### Step 2.6: Enable Twilio Integration
1. Navigate to Integrations → Twilio
2. Click "Connect Twilio"
3. Enter your Twilio Account SID and Auth Token
4. Save the connection

### Step 2.7: Copy Agent ID
1. From your agent page, copy the **Agent ID**
2. Save to your `.env` file

---

## 3. Connect Twilio to RetellAI (15 minutes)

### Step 3.1: Get RetellAI Webhook URL
1. In RetellAI, go to your agent
2. Navigate to Integrations → Twilio
3. Copy the webhook URL (format: `https://api.retellai.com/twilio-voice-webhook/{agent_id}`)

### Step 3.2: Configure Twilio Phone Number
1. Go back to Twilio Console
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Click your phone number
4. Under "Voice & Fax", configure:
   - **A Call Comes In**: Webhook
   - **URL**: Paste the RetellAI webhook URL
   - **HTTP Method**: POST
5. Click "Save"

### Step 3.3: Test the Connection
1. Call your Twilio phone number from your personal phone
2. You should hear the RetellAI agent greeting
3. Have a brief test conversation
4. Hang up

---

## 4. Google Sheets Setup (20 minutes)

### Step 4.1: Create New Spreadsheet
1. Go to Google Sheets (https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it "Receptionist Call Logs"

### Step 4.2: Set Up Schema
Create these column headers in Row 1:

```
call_id | timestamp | caller_name | phone_number | reason_for_visit | patient_type | visit_timeframe | disposition | sms_consent | sms_sent | is_spam_suspected | transcript_summary
```

### Step 4.3: Share with Make.com (Will do in next step)
- Keep this sheet open, we'll connect it in Make.com

### Step 4.4: Copy Sheet ID
- From the URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
- Copy the SHEET_ID
- Save to your `.env` file

---

## 5. Make.com Setup (45 minutes)

### Step 5.1: Create Make.com Account
1. Go to https://www.make.com
2. Sign up for a free account
3. Verify your email

### Step 5.2: Create New Scenario
1. Click "Create a new scenario"
2. Name it "RetellAI Call Logger"

### Step 5.3: Build the Scenario

**Module 1: Webhooks - Custom Webhook**
1. Add "Webhooks" → "Custom webhook" module
2. Click "Create a webhook"
3. Name it "RetellAI Calls"
4. Copy the webhook URL
5. **Save this URL** - you'll add it to RetellAI

**Module 2: Google Sheets - Add a Row**
1. Add "Google Sheets" → "Add a row" module
2. Connect your Google account (authorize access)
3. Select your "Receptionist Call Logs" spreadsheet
4. Map the fields from webhook data:
   - `call_id` → {{1.call_id}}
   - `timestamp` → {{1.timestamp}}
   - `caller_name` → {{1.caller_name}}
   - `phone_number` → {{1.phone_number}}
   - (Map all other fields similarly)

**Module 3: Router (Optional - for SMS)**
1. Add a "Router" module
2. Create route: "If SMS consent is true"
3. Filter: `{{1.sms_consent}}` equals `true`

**Module 4: Twilio - Send SMS (Optional)**
1. Add "Twilio" → "Send SMS Message"
2. Connect your Twilio account
3. Configure:
   - From: Your Twilio number
   - To: {{1.phone_number}}
   - Message: Use template with variables

### Step 5.4: Activate Scenario
1. Click "Save" (bottom left)
2. Turn the scenario "ON"
3. Copy the webhook URL from Module 1

---

## 6. Configure RetellAI Post-Call Webhook (10 minutes)

### Step 6.1: Add Webhook to RetellAI
1. Go back to RetellAI dashboard
2. Navigate to your agent settings
3. Find "Post-Call Webhook" configuration
4. Paste your Make.com webhook URL
5. Save changes

---

## 7. Configure Your Application (15 minutes)

### Step 7.1: Create .env File
1. In your project root, create a `.env` file
2. Copy from `.env.example`
3. Fill in all the values you collected:

```env
PORT=3000
NODE_ENV=development

# From Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15555551234
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxx

# From RetellAI
RETELL_API_KEY=your_retell_api_key
RETELL_AGENT_ID=agent_xxxxxxxxxx

# OpenAI (if using directly)
OPENAI_API_KEY=sk-xxxxxxxxxx

# From Make.com
MAKE_WEBHOOK_URL=https://hook.us1.make.com/xxxxxxxxxx

# From Google Sheets
GOOGLE_SHEET_ID=your_sheet_id

# Your Clinic Info
CLINIC_NAME=Urgent Care Center
CLINIC_HOURS=Monday-Friday 8am-8pm, Saturday-Sunday 9am-5pm
CLINIC_ADDRESS=123 Main St, City, State 12345
CLINIC_PHONE=+15555551234

SMS_ENABLED=true
LOG_LEVEL=info
```

### Step 7.2: Install Dependencies
```bash
cd /path/to/receptionist-agent-v1
npm install
```

### Step 7.3: Start the Application
```bash
npm run dev
```

You should see:
```
Server started on port 3000
AI Voice Receptionist is running
```

---

## 8. End-to-End Test (20 minutes)

### Test 1: Basic Call Flow
1. Call your Twilio number
2. Complete full conversation with the AI
3. Provide all information (name, phone, reason, etc.)
4. Opt-in to SMS
5. End call

### Test 2: Verify Data Flow
1. Check Make.com scenario history (should show execution)
2. Check Google Sheets (should have new row)
3. Check SMS delivery (should receive text)

### Test 3: Check Logs
1. View your application logs
2. Confirm webhook was received
3. Check for any errors

---

## ✅ Day 1 Checklist

- [ ] Twilio account created and phone number purchased
- [ ] RetellAI account created and agent configured
- [ ] Twilio connected to RetellAI
- [ ] Google Sheets created with schema
- [ ] Make.com scenario built and activated
- [ ] RetellAI webhook pointed to Make.com
- [ ] Application `.env` configured
- [ ] Dependencies installed
- [ ] Application running locally
- [ ] End-to-end test successful
- [ ] Data flowing to Google Sheets
- [ ] SMS delivery working

---

## 🐛 Troubleshooting

### Issue: Call doesn't connect to RetellAI
- Verify Twilio webhook URL is correct
- Check Twilio debugger logs
- Ensure RetellAI agent is active

### Issue: No data in Google Sheets
- Check Make.com scenario execution history
- Verify Google Sheets connection is authorized
- Test webhook directly with Postman

### Issue: SMS not sending
- Verify Twilio Messaging Service is configured
- Check phone number is added to Messaging Service
- Ensure SMS_ENABLED=true in .env

### Issue: Application won't start
- Check all required env vars are set
- Verify no port conflicts (3000)
- Check npm install completed successfully

---

## 📚 Next Steps

Day 1 Complete! Tomorrow (Day 2) you'll:
- Refine the conversation flow
- Add more sophisticated prompts
- Test edge cases
- Tune voice settings
