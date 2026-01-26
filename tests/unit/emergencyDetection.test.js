/**
 * Emergency Detection Unit Tests
 * Tests emergency detection logic per scope requirements (§3.1, §6)
 *
 * Run with: npm test -- tests/unit/emergencyDetection.test.js
 */

const retellConfig = require('../../src/config/retell');

describe('Emergency Detection', () => {
  describe('Physical Emergencies', () => {
    it('should detect chest pain', () => {
      const callData = {
        transcript: 'I am having severe chest pain and pressure.',
        extractedData: { reasonForVisit: '' }
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
      expect(result.detectedKeywords).toContain('chest pain');
    });

    it('should detect difficulty breathing', () => {
      const callData = {
        transcript: 'My husband is having difficulty breathing.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
      expect(result.detectedKeywords).toContain('difficulty breathing');
    });

    it('should detect stroke symptoms', () => {
      const callData = {
        transcript: 'My mother has facial drooping and slurred speech.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
      expect(result.detectedKeywords.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect severe bleeding', () => {
      const callData = {
        transcript: 'There is severe bleeding that won\'t stop.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
    });

    it('should detect loss of consciousness', () => {
      const callData = {
        transcript: 'My son passed out and is unconscious.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
    });

    it('should detect seizures', () => {
      const callData = {
        transcript: 'She is having a seizure right now.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
    });

    it('should detect head injuries', () => {
      const callData = {
        transcript: 'He fell and hit his head really hard. It is a serious head injury.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
    });

    it('should detect severe allergic reactions', () => {
      const callData = {
        transcript: 'My throat is swelling and I can\'t breathe. I think it\'s an allergic reaction.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
    });

    it('should detect overdose', () => {
      const callData = {
        transcript: 'I think my friend took an overdose of pills.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
    });

    it('should detect car accidents', () => {
      const callData = {
        transcript: 'We were just in a car accident on the highway.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
    });
  });

  describe('Mental Health Crisis', () => {
    it('should detect suicidal ideation', () => {
      const callData = {
        transcript: 'I don\'t know what to do. I want to kill myself.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
      expect(result.isMentalHealthCrisis).toBe(true);
    });

    it('should detect self-harm statements', () => {
      const callData = {
        transcript: 'I have been thinking about hurting myself.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
      expect(result.isMentalHealthCrisis).toBe(true);
    });

    it('should provide 988 recommendation for mental health crisis', () => {
      const callData = {
        transcript: 'I want to end my life.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isMentalHealthCrisis).toBe(true);
      expect(result.recommendation).toContain('988');
    });
  });

  describe('Non-Emergency Cases', () => {
    it('should not flag routine symptoms', () => {
      const callData = {
        transcript: 'I have had a cold for a few days and wanted to get checked out.',
        extractedData: { reasonForVisit: 'cold symptoms' }
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(false);
    });

    it('should not flag minor injuries', () => {
      const callData = {
        transcript: 'I twisted my ankle yesterday and it is still sore.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(false);
    });

    it('should not flag general inquiries', () => {
      const callData = {
        transcript: 'I wanted to ask about your hours tomorrow and if I can walk in.',
        extractedData: {}
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(false);
    });
  });

  describe('Detection from Reason for Visit', () => {
    it('should detect emergency from reasonForVisit field', () => {
      const callData = {
        transcript: '',
        extractedData: { reasonForVisit: 'chest pain' }
      };

      const result = retellConfig.detectEmergency(callData);

      expect(result.isEmergency).toBe(true);
    });
  });
});
