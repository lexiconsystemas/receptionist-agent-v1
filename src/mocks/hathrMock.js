/**
 * Hathr.ai Mock Service
 * Provides mock responses for development and testing without API credentials
 */

const logger = require('../config/logger');

class HathrMock {
  constructor() {
    this.conversationState = new Map();
  }

  /**
   * Mock conversation processing
   */
  async processConversation(callId, userInput, context = {}) {
    logger.info('MOCK: Processing conversation with Hathr.ai', { callId, userInput });

    // Get or create conversation state
    let state = this.conversationState.get(callId) || {
      stage: 'greeting',
      patientType: 'unknown',
      callerName: null,
      reasonForVisit: null,
      visitTimeframe: null,
      emergencyDetected: false
    };

    // Process based on current stage
    const response = this.generateResponse(userInput, state);
    
    // Update state
    state = { ...state, ...response.stateUpdate };
    this.conversationState.set(callId, state);

    return {
      response: response.text,
      state: state,
      extractedData: response.extractedData,
      emergencyDetected: response.emergencyDetected,
      shouldEndCall: response.shouldEndCall
    };
  }

  /**
   * Generate appropriate AI response based on conversation stage
   */
  generateResponse(userInput, state) {
    const input = userInput.toLowerCase();
    
    // Emergency detection first
    const emergencyCheck = this.detectEmergency(input);
    if (emergencyCheck.isEmergency) {
      return {
        text: emergencyCheck.isMentalHealth 
          ? "If you are in crisis, please call 988 (Suicide & Crisis Lifeline) or 911 for immediate help. You are not alone."
          : "If this is a medical emergency, please hang up and dial 911 immediately.",
        emergencyDetected: true,
        shouldEndCall: true,
        stateUpdate: { emergencyDetected: true },
        extractedData: {
          emergencyType: emergencyCheck.type,
          keywords: emergencyCheck.keywords
        }
      };
    }

    // Conversation flow based on stage
    switch (state.stage) {
      case 'greeting':
        if (input.includes('new') || input.includes('first time')) {
          return {
            text: "Thank you for choosing our urgent care. I'll help you get registered. What's your name?",
            stateUpdate: { stage: 'name_capture', patientType: 'new' },
            extractedData: { patientType: 'new' }
          };
        } else if (input.includes('returning') || input.includes('been before')) {
          return {
            text: "Welcome back! To help you faster, could you please tell me your name?",
            stateUpdate: { stage: 'name_capture', patientType: 'returning' },
            extractedData: { patientType: 'returning' }
          };
        } else {
          return {
            text: "Thank you for calling our urgent care. Are you a new or returning patient?",
            stateUpdate: {},
            extractedData: {}
          };
        }

      case 'name_capture':
        const name = this.extractName(userInput);
        if (name) {
          return {
            text: `Thank you, ${name}. What brings you in today? Please briefly describe your symptoms or reason for visit.`,
            stateUpdate: { stage: 'reason_capture', callerName: name },
            extractedData: { callerName: name }
          };
        } else {
          return {
            text: "I didn't catch your name. Could you please tell me your name?",
            stateUpdate: {},
            extractedData: {}
          };
        }

      case 'reason_capture':
        const reason = this.sanitizeReason(userInput);
        if (reason) {
          return {
            text: "I understand. When are you planning to visit us? We accept walk-ins throughout the day.",
            stateUpdate: { stage: 'timeframe_capture', reasonForVisit: reason },
            extractedData: { reasonForVisit: reason }
          };
        } else {
          return {
            text: "Could you please briefly describe what brings you in today?",
            stateUpdate: {},
            extractedData: {}
          };
        }

      case 'timeframe_capture':
        const timeframe = this.extractTimeframe(userInput);
        if (timeframe) {
          return {
            text: `Perfect! We've noted you plan to visit ${timeframe}. Walk-ins are welcome, and we'll see you as soon as possible. Is there anything else I can help you with?`,
            stateUpdate: { stage: 'closing', visitTimeframe: timeframe },
            extractedData: { visitTimeframe: timeframe }
          };
        } else {
          return {
            text: "When would you like to visit? We're open for walk-ins throughout the day.",
            stateUpdate: {},
            extractedData: {}
          };
        }

      case 'closing':
        if (input.includes('no') || input.includes('nothing') || input.includes('that\'s all')) {
          return {
            text: "Thank you for calling. We look forward to helping you when you arrive. Have a great day!",
            shouldEndCall: true,
            stateUpdate: { stage: 'completed' },
            extractedData: {}
          };
        } else {
          return {
            text: "I'm here to help with any other questions about your visit or our services.",
            stateUpdate: {},
            extractedData: {}
          };
        }

      default:
        return {
          text: "Thank you for calling our urgent care. How can I help you today?",
          stateUpdate: { stage: 'greeting' },
          extractedData: {}
        };
    }
  }

  /**
   * Detect emergency indicators
   */
  detectEmergency(input) {
    const emergencyKeywords = [
      { keywords: ['chest pain', 'chest pressure'], type: 'cardiac' },
      { keywords: ['can\'t breathe', 'difficulty breathing', 'shortness of breath'], type: 'respiratory' },
      { keywords: ['stroke', 'facial drooping', 'slurred speech', 'arm weakness'], type: 'neurological' },
      { keywords: ['severe bleeding', 'uncontrolled bleeding'], type: 'hemorrhage' },
      { keywords: ['unconscious', 'passed out', 'fainted'], type: 'consciousness' },
      { keywords: ['seizure', 'convulsion'], type: 'neurological' },
      { keywords: ['head injury', 'hit my head'], type: 'trauma' },
      { keywords: ['allergic reaction', 'throat swelling'], type: 'allergic' },
      { keywords: ['blue lips', 'not breathing'], type: 'respiratory' },
      { keywords: ['car accident', 'vehicle crash'], type: 'trauma' },
      { keywords: ['overdose', 'poisoning'], type: 'toxicology' },
      { keywords: ['suicide', 'kill myself', 'self-harm', 'end my life'], type: 'mental_health' }
    ];

    for (const emergency of emergencyKeywords) {
      if (emergency.keywords.some(keyword => input.includes(keyword))) {
        return {
          isEmergency: true,
          type: emergency.type,
          keywords: emergency.keywords.filter(k => input.includes(k)),
          isMentalHealth: emergency.type === 'mental_health'
        };
      }
    }

    return { isEmergency: false };
  }

  /**
   * Extract name from user input
   */
  extractName(input) {
    // Simple name extraction - look for patterns like "my name is John" or "I'm John"
    const patterns = [
      /my name is (\w+)/i,
      /i'm (\w+)/i,
      /i am (\w+)/i,
      /this is (\w+)/i
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      }
    }

    // If no pattern matches, assume the entire input is a name if it's short enough
    if (input.length > 1 && input.length < 30 && !input.includes(' ')) {
      return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    }

    return null;
  }

  /**
   * Sanitize reason for visit
   */
  sanitizeReason(input) {
    // Remove any potential PHI and limit length
    let sanitized = input.trim().substring(0, 200);
    
    // Remove dates and numbers that could be PHI
    sanitized = sanitized.replace(/\d{2}\/\d{2}\/\d{4}/g, '[DATE]');
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED]');
    
    return sanitized || 'General visit';
  }

  /**
   * Extract timeframe from user input
   */
  extractTimeframe(input) {
    const timeframePatterns = [
      /(\d+:\d+\s*(am|pm)?\s*-\s*\d+:\d+\s*(am|pm)?)/i,
      /(this (morning|afternoon|evening))/i,
      /(in \d+ (hour|hours|minute|minutes))/i,
      /(within (the )?(hour|next hour))/i,
      /(asap|as soon as possible)/i,
      /(today|tomorrow)/i
    ];

    for (const pattern of timeframePatterns) {
      const match = input.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Get conversation state for testing
   */
  getState(callId) {
    return this.conversationState.get(callId);
  }

  /**
   * Clear conversation state
   */
  clearState(callId) {
    this.conversationState.delete(callId);
  }

  /**
   * Clear all states
   */
  clearAllStates() {
    this.conversationState.clear();
  }
}

module.exports = new HathrMock();
