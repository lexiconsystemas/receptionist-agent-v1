/**
 * Mock Integration Tests
 * Tests the system using mock services when real APIs are unavailable
 * Moved from /test/ → /tests/integration/ for project organisation
 */

// MOCK_MODE must be set before any require() so mockMode.js evaluates
// MOCK_MODE=true when its module-level const is initialised.
process.env.MOCK_MODE = 'true';
process.env.NODE_ENV = 'test';

const ServiceFactory = require('../../src/config/mockMode');
const spamDetection = require('../../src/utils/spamDetection');
const validation = require('../../src/utils/validation');

describe('Mock Integration Tests', () => {
  beforeEach(() => {
    // MOCK_MODE already set at module top-level; kept here for clarity
    process.env.MOCK_MODE = 'true';
    process.env.NODE_ENV = 'test';
  });

  describe('RetellAI Mock Service', () => {
    let retellService;

    beforeEach(() => {
      retellService = ServiceFactory.getRetellService();
    });

    test('should return mock agent config', async () => {
      const config = await retellService.getAgentConfig();
      expect(config).toHaveProperty('agent_id');
      expect(config).toHaveProperty('agent_name');
      expect(config.agent_name).toBe('Urgent Care Receptionist');
    });

    test('should return mock transcript', async () => {
      const transcript = await retellService.getCallTranscript('test_call_123');
      expect(transcript).toHaveProperty('call_id', 'test_call_123');
      expect(transcript).toHaveProperty('extracted_data');
      expect(transcript.extracted_data).toHaveProperty('callerName');
    });

    test('should generate different mock events', () => {
      const normalEvent = retellService.generateMockEvent('call_ended');
      const emergencyEvent = retellService.generateMockEvent('emergency_detected');
      const spamEvent = retellService.generateMockEvent('spam_call');

      expect(normalEvent.extracted_data.callerName).toBe('John Smith');
      // Case-insensitive check — mock returns "Chest pain and difficulty breathing"
      expect(emergencyEvent.extracted_data.reasonForVisit.toLowerCase()).toContain('chest pain');
      expect(spamEvent.transcript).toContain('warranty');
    });
  });

  describe('Keragon Mock Service', () => {
    let keragonService;

    beforeEach(() => {
      keragonService = ServiceFactory.getKeragonService();
    });

    test('should log call records', async () => {
      const callRecord = {
        callId: 'test_call_123',
        timestamp: new Date().toISOString(),
        callerId: '+15551234567',
        callerName: 'John Smith',
        patientType: 'new',
        reasonForVisit: 'Sore throat',
        duration: 145
      };

      const result = await keragonService.logCallRecord(callRecord);
      expect(result.success).toBe(true);
      expect(result.keragonId).toMatch(/mock_log_\d+/);
    });

    test('should log edge cases', async () => {
      const edgeCase = {
        callId: 'test_call_456',
        description: 'Test edge case',
        context: { error: 'Test error' }
      };

      const result = await keragonService.logEdgeCase('test_error', edgeCase);
      expect(result.success).toBe(true);
    });

    test('should query call history', async () => {
      // First log a test call
      await keragonService.logCallRecord({
        callId: 'test_call_789',
        patientType: 'new',
        timestamp: new Date().toISOString()
      });

      const history = await keragonService.queryCallHistory({ patient_type: 'new' });
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].patient_type).toBe('new');
    });
  });

  describe('Hathr.ai Mock Service', () => {
    let hathrService;

    beforeEach(() => {
      hathrService = ServiceFactory.getHathrService();
    });

    test('should process conversation flow', async () => {
      const callId = 'test_conversation_123';

      // Greeting stage
      let response = await hathrService.processConversation(callId, "I'm a new patient");
      expect(response.response).toContain('What\'s your name');
      expect(response.extractedData.patientType).toBe('new');

      // Name capture
      response = await hathrService.processConversation(callId, 'My name is John');
      expect(response.response).toContain('What brings you in today');
      expect(response.extractedData.callerName).toBe('John');

      // Reason capture
      response = await hathrService.processConversation(callId, 'I have a sore throat');
      expect(response.response).toContain('When are you planning to visit');
      expect(response.extractedData.reasonForVisit).toContain('sore throat');
    });

    test('should detect emergencies', async () => {
      const response = await hathrService.processConversation('emergency_test', "I have chest pain and can't breathe");

      expect(response.emergencyDetected).toBe(true);
      expect(response.shouldEndCall).toBe(true);
      expect(response.response).toContain('911');
    });

    test('should detect mental health crisis', async () => {
      // Uses keyword "kill myself" which is in the mock's mental health detection list
      const response = await hathrService.processConversation('mental_health_test', 'I want to kill myself');

      expect(response.emergencyDetected).toBe(true);
      expect(response.response).toContain('988');
    });
  });

  describe('Integration with Business Logic', () => {
    test('spam detection works with mock data', () => {
      const mockCallData = {
        callId: 'spam_test_123',
        transcript: 'This is an automated message about your car warranty. Press 1 now.',
        duration: 15,
        metadata: { callerNumber: '+18001234567' }
      };

      const spamResult = spamDetection.analyzeCall(mockCallData);
      expect(spamResult.isSpam).toBe(true);
      expect(spamResult.reasons).toContain('Robocall speech patterns detected');
    });

    test('validation works with mock extracted data', () => {
      const mockData = {
        callerName: 'John Smith',
        phoneNumber: '555-123-4567',
        patientType: 'new',
        reasonForVisit: 'Sore throat and fever',
        visitTimeframe: 'this evening 6-7pm'
      };

      const validated = validation.validateCallerInfo(mockData);
      expect(validated.isValid).toBe(true);
      expect(validated.phoneNumber).toBe('+15551234567');
      expect(validated.patientType).toBe('new');
    });
  });

  describe('End-to-End Mock Flow', () => {
    test('complete call flow using mock services', async () => {
      const retellService = ServiceFactory.getRetellService();
      const keragonService = ServiceFactory.getKeragonService();
      const hathrService = ServiceFactory.getHathrService();

      // Simulate incoming call
      const callId = 'e2e_test_123';
      const mockEvent = retellService.generateMockEvent('call_ended');
      mockEvent.call_id = callId;

      // Process with Hathr.ai — greeting stage identifies patient as new
      // (mock extractName doesn't support "named X" — uses "my name is X" / "I'm X" patterns)
      const conversationResult = await hathrService.processConversation(callId, "I'm a new patient");

      // Log to Keragon
      const logResult = await keragonService.logCallRecord({
        callId: callId,
        timestamp: mockEvent.timestamp,
        callerId: '+15551234567',
        callerName: conversationResult.extractedData.callerName || 'Unknown',
        patientType: conversationResult.extractedData.patientType,
        reasonForVisit: conversationResult.extractedData.reasonForVisit || 'General visit',
        duration: mockEvent.duration_seconds,
        disposition: 'completed'
      });

      expect(logResult.success).toBe(true);
      expect(conversationResult.extractedData.patientType).toBe('new');
    });
  });
});

// Mock console methods to reduce noise during tests
const originalConsole = global.console;
beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
});

afterAll(() => {
  global.console = originalConsole;
});
