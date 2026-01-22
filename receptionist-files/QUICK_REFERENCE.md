# Quick Reference - Day 1 Setup

## 🎯 Accounts Needed
- [ ] Twilio (https://twilio.com) - $1.50/month for phone number
- [ ] RetellAI (https://retellai.com) - $99/month Starter plan
- [ ] Make.com (https://make.com) - Free tier OK for MVP
- [ ] Google Account (for Sheets) - Free
- [ ] OpenAI (https://openai.com) - Pay per use

## 🔑 Credentials to Collect

### From Twilio:
- Account SID
- Auth Token
- Phone Number (+1XXXXXXXXXX)
- Messaging Service SID

### From RetellAI:
- API Key
- Agent ID

### From Make.com:
- Webhook URL

### From Google Sheets:
- Sheet ID (from URL)

### From OpenAI:
- API Key

## 🛠️ Quick Setup Commands

```bash
# Clone and setup
git clone <repo> receptionist-agent-v1
cd receptionist-agent-v1
./setup.sh

# Or manual:
npm install
cp .env.example .env
# Edit .env with your credentials

# Run
npm run dev
```

## 🌐 Webhook URLs You'll Need

### Twilio → RetellAI:
```
https://api.retellai.com/twilio-voice-webhook/{YOUR_AGENT_ID}
```
→ Set this in Twilio Phone Number settings

### RetellAI → Make.com:
```
https://hook.us1.make.com/{YOUR_WEBHOOK_ID}
```
→ Set this in RetellAI agent Post-Call Webhook

## 📊 Google Sheets Columns

```
call_id | timestamp | caller_name | phone_number | reason_for_visit | 
patient_type | visit_timeframe | disposition | sms_consent | sms_sent | 
is_spam_suspected | transcript_summary
```

## 🧪 Testing Checklist

1. [ ] Call Twilio number → Reaches RetellAI
2. [ ] Complete conversation → Agent captures data
3. [ ] Call ends → Webhook fires to Make.com
4. [ ] Make.com → Adds row to Google Sheets
5. [ ] If SMS consent → Twilio sends SMS
6. [ ] Check logs → No errors

## 🔧 Common Issues

**Call doesn't connect:**
- Check Twilio webhook URL
- Verify RetellAI agent is active

**No data in Sheets:**
- Check Make.com scenario is ON
- View execution history in Make.com

**SMS not sending:**
- Verify Messaging Service configured
- Check SMS_ENABLED=true in .env

## 📞 Test Phone Numbers

Twilio provides test numbers:
- +15005550006 - Valid number
- +15005550001 - Invalid number

## ⚡ Quick Commands

```bash
# Start dev server
npm run dev

# View logs
tail -f logs/combined.log

# Test health endpoint
curl http://localhost:3000/health

# Test webhook (with ngrok)
ngrok http 3000
```

## 📱 RetellAI Agent Configuration Quick Copy

**Voice Settings:**
- Voice: Rachel (Eleven Labs)
- Language: English (US)
- Latency: Low
- Interruption: Medium

**Required Custom Functions:**
1. log_call_information
2. flag_potential_spam

## 🎯 Success Criteria for Day 1

- ✅ All accounts created
- ✅ Phone number purchased
- ✅ Agent responding to calls
- ✅ Data flowing to Google Sheets
- ✅ SMS sending (if consent given)
- ✅ No errors in logs

## ⏱️ Time Estimates

- Twilio setup: 30 min
- RetellAI setup: 45 min
- Make.com setup: 45 min
- Google Sheets: 20 min
- App config: 15 min
- Testing: 20 min
- **Total: 2-3 hours**

## 🆘 Support

- Twilio Docs: https://www.twilio.com/docs
- RetellAI Docs: https://docs.retellai.com
- Make.com Help: https://www.make.com/en/help
- Project Issues: [Your GitHub Issues URL]

## 📝 Notes Section

Use this space during setup to track:
- Account usernames
- Support ticket numbers
- Special configurations
- Things to remember

---

**Last Updated:** Day 1 Setup
**Next:** Day 2 - Core Conversation Flow Refinement
