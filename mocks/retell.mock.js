/**
 * RetellAI Mock API
 * Simulates RetellAI responses for development/testing
 *
 * REPLACE WITH REAL API WHEN CLIENT PROVIDES:
 * - RETELL_API_KEY
 * - RETELL_AGENT_ID
 * - RETELL_WEBHOOK_SECRET
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../src/config/logger');

const MOCK_ENABLED = process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'development';

/**
 * Mock call data generator
 */
function generateMockCallId() {
  return `mock_call_${uuidv4().substring(0, 8)}`;
}

/**
 * Mock RetellAI agent configuration
 */
const mockAgentConfig = {
  agent_id: 'mock_agent_001',
  agent_name: 'Urgent Care Receptionist',
  llm_provider: 'hathr_ai',
  voice_id: 'professional_female_01',
  voice_settings: {
    speed: 1.0,
    pitch: 1.0,
    stability: 0.75
  },
  prompt: 'You are a professional after-hours receptionist for an urgent care clinic...',
  functions: ['capture_caller_info', 'detect_emergency', 'soft_schedule'],
  webhook_url: process.env.BASE_URL + '/webhook/retell',
  created_at: '2026-01-01T00:00:00Z'
};

/**
 * Mock call scenarios for testing
 */
const mockCallScenarios = {
  normal_call: {
    call_id: null, // Generated
    event_type: 'call_ended',
    call_status: 'completed',
    end_reason: 'agent_hangup',
    duration_seconds: 145,
    transcript: 'Hi, I\'d like to come in today. My name is John Smith. I have a sore throat and mild fever. I can come in around 6pm this evening.',
    extracted_data: {
      callerName: 'John Smith',
      reasonForVisit: 'Sore throat and mild fever',
      visitTimeframe: 'around 6pm this evening',
      patientType: 'new'
    },
    metadata: {
      callerNumber: '+15551234567',
      decisionPath: ['greeting', 'new_patient_intake', 'reason_capture', 'timeframe_capture', 'closing']
    }
  },

  emergency_call: {
    call_id: null,
    event_type: 'call_ended',
    call_status: 'completed',
    end_reason: 'emergency_redirect',
    duration_seconds: 25,
    transcript: 'Help, my husband is having chest pain and difficulty breathing. He\'s sweating a lot.',
    extracted_data: {
      callerName: null,
      reasonForVisit: 'chest pain difficulty breathing',
      patientType: 'unknown'
    },
    metadata: {
      callerNumber: '+15559876543',
      decisionPath: ['greeting', 'emergency_detected', 'emergency_redirect']
    }
  },

  spam_call: {
    call_id: null,
    event_type: 'call_ended',
    call_status: 'terminated',
    end_reason: 'spam_detected',
    duration_seconds: 8,
    transcript: 'This is an automated message about your car warranty. Press 1 to speak with a representative.',
    extracted_data: {},
    metadata: {
      callerNumber: '+18005551234',
      silenceAtStart: 4500,
      decisionPath: ['greeting', 'spam_detected', 'terminated']
    }
  },

  dropped_call: {
    call_id: null,
    event_type: 'call_ended',
    call_status: 'incomplete',
    end_reason: 'caller_hangup',
    duration_seconds: 12,
    transcript: 'Hi, I wanted to ask about...',
    extracted_data: {},
    metadata: {
      callerNumber: '+15551112222',
      decisionPath: ['greeting', 'caller_hangup']
    }
  },

  mental_health_crisis: {
    call_id: null,
    event_type: 'call_ended',
    call_status: 'completed',
    end_reason: 'crisis_redirect',
    duration_seconds: 35,
    transcript: 'I don\'t know what to do anymore. I\'ve been thinking about hurting myself.',
    extracted_data: {
      reasonForVisit: 'mental health crisis'
    },
    metadata: {
      callerNumber: '+15553334444',
      decisionPath: ['greeting', 'mental_health_crisis_detected', 'crisis_redirect_988']
    }
  }
};

/**
 * Mock getAgentConfig - simulates RetellAI API
 */
async function mockGetAgentConfig() {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real RETELL_API_KEY');
  }

  logger.info('[MOCK] Returning mock agent config');
  return mockAgentConfig;
}

/**
 * Mock getCallTranscript - simulates RetellAI API
 */
async function mockGetCallTranscript(callId) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real RETELL_API_KEY');
  }

  logger.info('[MOCK] Returning mock call transcript', { callId });

  return {
    call_id: callId,
    transcript: 'Mock transcript for testing purposes.',
    duration_seconds: 120,
    status: 'completed'
  };
}

/**
 * Mock listCalls - simulates RetellAI API
 */
async function mockListCalls(options = {}) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real RETELL_API_KEY');
  }

  logger.info('[MOCK] Returning mock call list');

  return Object.keys(mockCallScenarios).map(scenario => ({
    call_id: generateMockCallId(),
    status: mockCallScenarios[scenario].call_status,
    duration: mockCallScenarios[scenario].duration_seconds,
    created_at: new Date().toISOString()
  }));
}

/**
 * Generate a mock webhook payload for testing
 * @param {string} scenario - One of: normal_call, emergency_call, spam_call, dropped_call, mental_health_crisis
 */
function generateMockWebhookPayload(scenario = 'normal_call') {
  const template = mockCallScenarios[scenario] || mockCallScenarios.normal_call;

  return {
    ...template,
    call_id: generateMockCallId(),
    timestamp: new Date().toISOString(),
    agent_id: mockAgentConfig.agent_id
  };
}

/**
 * Mock webhook signature validator (always passes in mock mode)
 */
function mockValidateWebhookSignature(payload, signature) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - use real signature validation');
  }

  logger.warn('[MOCK] Skipping webhook signature validation');
  return true;
}

module.exports = {
  MOCK_ENABLED,
  mockAgentConfig,
  mockCallScenarios,
  mockGetAgentConfig,
  mockGetCallTranscript,
  mockListCalls,
  generateMockWebhookPayload,
  mockValidateWebhookSignature,
  generateMockCallId
};
