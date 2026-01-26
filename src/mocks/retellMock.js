/**
 * RetellAI Mock Service
 * Provides mock responses for development and testing without API credentials
 */

const logger = require('../config/logger');

class RetellMock {
  constructor() {
    this.mockCalls = new Map();
    this.callCounter = 1000;
  }

  /**
   * Mock agent configuration
   */
  async getAgentConfig() {
    logger.info('MOCK: Returning RetellAI agent config');
    return {
      agent_id: process.env.RETELL_AGENT_ID || 'mock_agent_123',
      agent_name: 'Urgent Care Receptionist',
      voice_id: 'mock_voice_001',
      language: 'en-US',
      prompt: 'Mock prompt for testing',
      llm_config: {
        model: 'gpt-4',
        temperature: 0.7
      }
    };
  }

  /**
   * Mock call transcript
   */
  async getCallTranscript(callId) {
    logger.info('MOCK: Returning mock transcript', { callId });
    
    const mockTranscript = {
      call_id: callId,
      agent_id: process.env.RETELL_AGENT_ID || 'mock_agent_123',
      transcript: "Caller: Hi, I need to see a doctor\nAI: Hello, thank you for calling our urgent care. Are you a new or returning patient?",
      duration_seconds: 145,
      call_status: 'ended',
      end_reason: 'agent_hangup',
      extracted_data: {
        callerName: 'John Smith',
        patientType: 'new',
        reasonForVisit: 'Sore throat and mild fever',
        visitTimeframe: 'this evening 6-7pm'
      },
      metadata: {
        decisionPath: ['greeting', 'new_patient_intake', 'reason_capture', 'timeframe_capture', 'closing'],
        silenceAtStart: 1200
      }
    };

    return mockTranscript;
  }

  /**
   * Mock call list
   */
  async listCalls(options = {}) {
    logger.info('MOCK: Returning mock call list');
    return {
      calls: [
        {
          call_id: 'mock_call_001',
          agent_id: process.env.RETELL_AGENT_ID || 'mock_agent_123',
          created_at: new Date().toISOString(),
          duration_seconds: 145,
          call_status: 'ended'
        }
      ],
      total: 1
    };
  }

  /**
   * Generate mock call event
   */
  generateMockEvent(eventType = 'call_ended') {
    const callId = `mock_call_${this.callCounter++}`;
    
    const baseEvent = {
      call_id: callId,
      agent_id: process.env.RETELL_AGENT_ID || 'mock_agent_123',
      event_type: eventType,
      timestamp: new Date().toISOString(),
      call_status: 'ended',
      end_reason: 'agent_hangup',
      duration_seconds: 145,
      transcript: "Caller: Hi, I need to see a doctor\nAI: Hello, thank you for calling our urgent care.",
      metadata: {
        decisionPath: ['greeting', 'intake', 'closing'],
        silenceAtStart: 1200,
        callerNumber: '+15551234567'
      },
      extracted_data: {
        callerName: 'John Smith',
        patientType: 'new',
        reasonForVisit: 'Sore throat and mild fever',
        visitTimeframe: 'this evening 6-7pm'
      }
    };

    // Modify based on event type
    switch (eventType) {
      case 'call_started':
        return {
          ...baseEvent,
          event_type: 'call_started',
          call_status: 'ongoing',
          duration_seconds: 0,
          transcript: '',
          extracted_data: {}
        };
      
      case 'emergency_detected':
        return {
          ...baseEvent,
          transcript: "Caller: I'm having chest pain and can't breathe\nAI: If this is a medical emergency, please hang up and dial 911 immediately.",
          extracted_data: {
            callerName: 'Jane Doe',
            patientType: 'unknown',
            reasonForVisit: 'Chest pain and difficulty breathing',
            visitTimeframe: 'immediate'
          }
        };
      
      case 'spam_call':
        return {
          ...baseEvent,
          transcript: "This is an automated message about your car warranty...",
          extracted_data: {},
          metadata: {
            ...baseEvent.metadata,
            silenceAtStart: 5000
          }
        };
      
      default:
        return baseEvent;
    }
  }

  /**
   * Mock webhook signature validation
   */
  validateWebhookSignature(payload, signature) {
    // In mock mode, always return true
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    logger.warn('MOCK: Signature validation bypassed in development');
    return true;
  }
}

module.exports = new RetellMock();
