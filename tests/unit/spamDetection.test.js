/**
 * Spam Detection Unit Tests
 * Tests spam detection logic in isolation
 *
 * Run with: npm test -- tests/unit/spamDetection.test.js
 */

const spamDetection = require('../../src/utils/spamDetection');

describe('Spam Detection', () => {
  describe('analyzeCall', () => {
    it('should identify robocall by transcript', () => {
      const callData = {
        transcript: 'This is an automated message about your car warranty. Press 1 to speak with a representative.',
        duration: 10,
        metadata: { callerNumber: '+18001234567' }
      };

      const result = spamDetection.analyzeCall(callData);

      expect(result.isSpam).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should identify spam by toll-free number', () => {
      const callData = {
        transcript: 'Hello, I am calling about...',
        duration: 30,
        metadata: { callerNumber: '+18005551234' }
      };

      const result = spamDetection.analyzeCall(callData);

      expect(result.reasons).toContain('Caller number matches spam pattern');
    });

    it('should pass legitimate healthcare call', () => {
      const callData = {
        transcript: 'Hi, I am feeling sick and would like to come in for an appointment. I have a fever.',
        duration: 120,
        metadata: { callerNumber: '+15551234567' }
      };

      const result = spamDetection.analyzeCall(callData);

      expect(result.isSpam).toBe(false);
    });

    it('should flag call with extended silence', () => {
      const callData = {
        transcript: 'Hello?',
        duration: 15,
        metadata: {
          callerNumber: '+15551234567',
          silenceAtStart: 5000
        }
      };

      const result = spamDetection.analyzeCall(callData);

      expect(result.reasons).toContain('Extended silence at call start');
    });

    it('should detect multiple spam keywords', () => {
      const callData = {
        transcript: 'Congratulations you\'ve won a free vacation! This is a limited time special offer. Act now!',
        duration: 60,
        metadata: { callerNumber: '+15551234567' }
      };

      const result = spamDetection.analyzeCall(callData);

      expect(result.isSpam).toBe(true);
      expect(result.spamScore).toBeGreaterThanOrEqual(3);
    });
  });

  describe('quickNumberCheck', () => {
    it('should flag toll-free numbers', () => {
      const result = spamDetection.quickNumberCheck('+18001234567');
      expect(result.isSuspicious).toBe(true);
    });

    it('should flag international numbers', () => {
      const result = spamDetection.quickNumberCheck('+441234567890');
      expect(result.isSuspicious).toBe(true);
    });

    it('should pass regular US numbers', () => {
      const result = spamDetection.quickNumberCheck('+15551234567');
      expect(result.isSuspicious).toBe(false);
    });
  });

  describe('shouldTerminate', () => {
    it('should terminate on recorded message announcement', () => {
      const result = spamDetection.shouldTerminate('This is a recorded message about your account.');
      expect(result).toBe(true);
    });

    it('should terminate on car warranty mention', () => {
      const result = spamDetection.shouldTerminate('We are calling about your car warranty.');
      expect(result).toBe(true);
    });

    it('should not terminate on legitimate content', () => {
      const result = spamDetection.shouldTerminate('Hi, I have a sore throat and would like to come in.');
      expect(result).toBe(false);
    });
  });

  describe('getSpamRules', () => {
    it('should return documented spam rules', () => {
      const rules = spamDetection.getSpamRules();

      expect(rules).toHaveProperty('description');
      expect(rules).toHaveProperty('thresholds');
      expect(rules).toHaveProperty('terminationTriggers');
      expect(rules).toHaveProperty('flaggingCriteria');
      expect(rules.terminationTriggers).toBeInstanceOf(Array);
    });
  });
});
