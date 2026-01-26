/**
 * Hathr.ai Mock API
 * Simulates Hathr.ai healthcare LLM responses for development/testing
 *
 * REPLACE WITH REAL API WHEN CLIENT PROVIDES:
 * - HATHR_API_KEY
 * - HATHR_API_URL
 * - HATHR_MODEL_ID
 *
 * Note: In production, Hathr.ai is configured as the LLM backend in RetellAI,
 * so direct API calls may not be needed. This mock is for testing conversation
 * logic and emergency detection independently.
 */

const logger = require('../src/config/logger');

const MOCK_ENABLED = process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'development';

/**
 * Mock Hathr.ai model configuration
 */
const mockModelConfig = {
  model_id: 'hathr-healthcare-v1',
  model_name: 'Hathr Healthcare Assistant',
  capabilities: [
    'healthcare_conversation',
    'emergency_detection',
    'soft_scheduling',
    'patient_intake',
    'non_diagnostic_triage'
  ],
  constraints: [
    'no_medical_advice',
    'no_diagnosis',
    'no_treatment_recommendations',
    'emergency_redirect_required',
    'hipaa_conscious'
  ],
  max_tokens: 500,
  temperature: 0.7
};

/**
 * Emergency keywords that Hathr.ai should detect
 * Matches scope requirements (§6)
 */
const emergencyKeywords = {
  physical: [
    'chest pain', 'chest pressure',
    'can\'t breathe', 'difficulty breathing', 'shortness of breath',
    'stroke', 'facial drooping', 'slurred speech', 'arm weakness',
    'severe bleeding', 'uncontrolled bleeding',
    'unconscious', 'passed out', 'fainted', 'loss of consciousness',
    'seizure', 'convulsion',
    'head injury', 'hit my head', 'head trauma',
    'allergic reaction', 'throat swelling', 'anaphylaxis',
    'blue lips', 'not breathing',
    'car accident', 'vehicle accident', 'crash',
    'severe burn', 'burned',
    'overdose', 'poisoning', 'swallowed poison'
  ],
  mental_health: [
    'suicide', 'suicidal',
    'kill myself', 'end my life',
    'self-harm', 'hurt myself', 'cutting myself',
    'want to die', 'don\'t want to live'
  ]
};

/**
 * Mock conversation responses
 */
const mockResponses = {
  greeting: {
    message: "Thank you for calling [Clinic Name] after-hours line. My name is the AI assistant. How can I help you today?",
    next_action: 'capture_intent'
  },
  capture_name: {
    message: "May I have your name, please?",
    next_action: 'capture_reason'
  },
  capture_reason: {
    message: "I understand. Can you briefly describe the reason for your visit today?",
    next_action: 'capture_timeframe'
  },
  capture_timeframe: {
    message: "When were you planning to come in? We can note your preferred time.",
    next_action: 'confirm_and_close'
  },
  new_vs_returning: {
    message: "Have you visited our clinic before, or would this be your first visit?",
    next_action: 'capture_reason'
  },
  emergency_redirect: {
    message: "I'm hearing some concerning symptoms. If this is a medical emergency, please hang up and dial 911 immediately. Are you experiencing a medical emergency right now?",
    next_action: 'terminate_or_continue'
  },
  mental_health_redirect: {
    message: "I hear that you're going through a very difficult time. Your safety is important. If you're having thoughts of hurting yourself, please call 988, the Suicide and Crisis Lifeline, or 911 for immediate help. You are not alone.",
    next_action: 'terminate'
  },
  closing: {
    message: "Thank you for calling. We've noted your information and a staff member will follow up during business hours. Have a good evening.",
    next_action: 'end_call'
  },
  spam_detected: {
    message: null, // Silent termination
    next_action: 'terminate'
  }
};

/**
 * Mock Hathr.ai chat completion
 * Simulates the LLM response for conversation
 */
async function mockChatCompletion(messages, options = {}) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real HATHR_API_KEY');
  }

  const lastMessage = messages[messages.length - 1];
  const userInput = lastMessage?.content?.toLowerCase() || '';

  // Check for emergency
  const emergencyResult = detectEmergency(userInput);
  if (emergencyResult.isEmergency) {
    logger.warn('[MOCK] Hathr.ai detected emergency', emergencyResult);

    return {
      id: 'mock_completion_emergency',
      model: mockModelConfig.model_id,
      choices: [{
        message: {
          role: 'assistant',
          content: emergencyResult.isMentalHealth
            ? mockResponses.mental_health_redirect.message
            : mockResponses.emergency_redirect.message
        },
        finish_reason: 'emergency_detected'
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      metadata: {
        emergency_detected: true,
        emergency_type: emergencyResult.isMentalHealth ? 'mental_health' : 'physical',
        keywords_detected: emergencyResult.detectedKeywords
      }
    };
  }

  // Determine conversation stage and respond
  const stage = determineConversationStage(messages);
  const response = mockResponses[stage] || mockResponses.greeting;

  logger.info('[MOCK] Hathr.ai generating response', { stage });

  return {
    id: `mock_completion_${Date.now()}`,
    model: mockModelConfig.model_id,
    choices: [{
      message: {
        role: 'assistant',
        content: response.message
      },
      finish_reason: 'stop'
    }],
    usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
    metadata: {
      conversation_stage: stage,
      next_action: response.next_action
    }
  };
}

/**
 * Detect emergency in user input
 */
function detectEmergency(text) {
  const lowerText = text.toLowerCase();

  const physicalMatches = emergencyKeywords.physical.filter(kw =>
    lowerText.includes(kw)
  );

  const mentalHealthMatches = emergencyKeywords.mental_health.filter(kw =>
    lowerText.includes(kw)
  );

  const allMatches = [...physicalMatches, ...mentalHealthMatches];

  return {
    isEmergency: allMatches.length > 0,
    isMentalHealth: mentalHealthMatches.length > 0,
    detectedKeywords: allMatches,
    confidence: Math.min(allMatches.length / 2, 1)
  };
}

/**
 * Determine conversation stage based on message history
 */
function determineConversationStage(messages) {
  const messageCount = messages.filter(m => m.role === 'user').length;

  if (messageCount === 0) return 'greeting';
  if (messageCount === 1) return 'capture_name';
  if (messageCount === 2) return 'new_vs_returning';
  if (messageCount === 3) return 'capture_reason';
  if (messageCount === 4) return 'capture_timeframe';
  return 'closing';
}

/**
 * Mock Hathr.ai function calling
 * Simulates structured data extraction
 */
async function mockExtractCallerInfo(transcript) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real HATHR_API_KEY');
  }

  logger.info('[MOCK] Hathr.ai extracting caller info from transcript');

  // Simple regex-based extraction for mock
  const nameMatch = transcript.match(/my name is ([a-zA-Z\s]+)/i);
  const phoneMatch = transcript.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/);
  const timeMatch = transcript.match(/(today|tomorrow|this (morning|afternoon|evening)|around \d{1,2}(pm|am)?|\d{1,2}(:\d{2})?\s*(pm|am))/i);

  return {
    caller_name: nameMatch ? nameMatch[1].trim() : null,
    phone_number: phoneMatch ? phoneMatch[0] : null,
    reason_for_visit: 'Extracted from transcript', // Would be more sophisticated in real API
    visit_timeframe: timeMatch ? timeMatch[0] : null,
    patient_type: transcript.toLowerCase().includes('first time') ? 'new' : 'unknown',
    confidence: 0.7
  };
}

/**
 * Mock Hathr.ai prompt template for RetellAI
 * This is the system prompt that would be configured in RetellAI
 */
const systemPromptTemplate = `You are a professional after-hours AI receptionist for {{clinic_name}}, an urgent care clinic.

Your role:
- Answer calls professionally and warmly
- Capture caller information (name, phone if not available, reason for visit, preferred visit time)
- Determine if the caller is a new or returning patient
- Provide general information about walk-in availability
- NEVER provide medical advice, diagnoses, or treatment recommendations

CRITICAL - Emergency Detection:
You MUST immediately interrupt the conversation if you detect ANY of these emergency indicators:
- Chest pain or pressure
- Difficulty breathing
- Signs of stroke (facial drooping, slurred speech, arm weakness)
- Severe or uncontrolled bleeding
- Loss of consciousness
- Seizures
- Serious head injuries
- Severe allergic reactions
- Blue lips or not breathing
- Major accidents
- Burns
- Suspected overdose or poisoning
- Suicidal thoughts or self-harm

If emergency detected, IMMEDIATELY say:
"If this is a medical emergency, please hang up and dial 911 immediately."
For mental health crisis, also mention: "You can also call 988, the Suicide and Crisis Lifeline."

Do NOT continue with intake questions after detecting an emergency.

Soft Scheduling:
- Ask when the patient plans to visit (prefer 1-hour windows)
- Provide general guidance: "Walk-ins are welcome. Wait times vary but typically [X]."
- Do NOT book confirmed appointments

Call Flow:
1. Greeting
2. Capture name
3. New or returning patient?
4. Reason for visit (keep non-diagnostic)
5. Preferred visit time
6. Confirm information and close

Keep responses concise and conversational. Avoid long pauses.`;

module.exports = {
  MOCK_ENABLED,
  mockModelConfig,
  emergencyKeywords,
  mockResponses,
  mockChatCompletion,
  mockExtractCallerInfo,
  detectEmergency,
  systemPromptTemplate
};
