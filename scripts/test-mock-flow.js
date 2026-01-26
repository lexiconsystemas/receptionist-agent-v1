#!/usr/bin/env node

/**
 * Mock Flow Testing Script
 * Tests the complete call flow using mock services
 */

require('dotenv').config({ path: '.env.example' });

const ServiceFactory = require('../src/config/mockMode');
const logger = require('../src/config/logger');

async function testMockFlow() {
  console.log('\n🧪 Testing Mock Integration Flow\n');

  try {
    // Initialize services
    const retellService = ServiceFactory.getRetellService();
    const keragonService = ServiceFactory.getKeragonService();
    const hathrService = ServiceFactory.getHathrService();

    console.log('✅ Services initialized successfully');

    // Test 1: Normal call flow
    console.log('\n📞 Test 1: Normal Call Flow');
    const callId = 'test_call_normal_001';
    
    // Simulate call events
    const startEvent = retellService.generateMockEvent('call_started');
    startEvent.call_id = callId;
    console.log('   📋 Call started');

    // Process conversation through Hathr.ai
    const conversationSteps = [
      "Hi, I'm a new patient",
      "My name is John Smith",
      "I have a sore throat and fever",
      "I'll come in this evening around 6pm",
      "No, that's all. Thank you!"
    ];

    let conversationState = null;
    for (const input of conversationSteps) {
      const result = await hathrService.processConversation(callId, input);
      console.log(`   💬 AI: ${result.response.substring(0, 60)}...`);
      conversationState = result;
    }

    // End call
    const endEvent = retellService.generateMockEvent('call_ended');
    endEvent.call_id = callId;
    endEvent.extracted_data = {
      callerName: conversationState.extractedData.callerName,
      patientType: conversationState.extractedData.patientType,
      reasonForVisit: conversationState.extractedData.reasonForVisit,
      visitTimeframe: conversationState.extractedData.visitTimeframe
    };
    console.log('   📋 Call ended');

    // Log to Keragon
    const logResult = await keragonService.logCallRecord({
      callId: callId,
      timestamp: endEvent.timestamp,
      callerId: '+15551234567',
      callerName: conversationState.extractedData.callerName,
      patientType: conversationState.extractedData.patientType,
      reasonForVisit: conversationState.extractedData.reasonForVisit,
      visitTimeframe: conversationState.extractedData.visitTimeframe,
      duration: endEvent.duration_seconds,
      disposition: 'completed'
    });

    console.log(`   💾 Logged to Keragon: ${logResult.success ? '✅' : '❌'}`);

    // Test 2: Emergency call
    console.log('\n🚨 Test 2: Emergency Call Flow');
    const emergencyCallId = 'test_call_emergency_002';
    
    const emergencyResult = await hathrService.processConversation(
      emergencyCallId, 
      "Help! I have chest pain and can't breathe"
    );
    
    console.log(`   🚨 Emergency detected: ${emergencyResult.emergencyDetected ? '✅' : '❌'}`);
    console.log(`   📞 AI response: ${emergencyResult.response}`);
    console.log(`   🛑 Call ended: ${emergencyResult.shouldEndCall ? '✅' : '❌'}`);

    // Log emergency
    const emergencyLogResult = await keragonService.logCallRecord({
      callId: emergencyCallId,
      timestamp: new Date().toISOString(),
      callerId: '+15559876543',
      callerName: 'Jane Doe',
      patientType: 'unknown',
      reasonForVisit: 'Chest pain and difficulty breathing',
      duration: 45,
      disposition: 'emergency',
      isEmergency: true
    });

    console.log(`   💾 Emergency logged: ${emergencyLogResult.success ? '✅' : '❌'}`);

    // Test 3: Spam call
    console.log('\n🚫 Test 3: Spam Call Detection');
    const spamCallId = 'test_call_spam_003';
    const spamEvent = retellService.generateMockEvent('spam_call');
    spamEvent.call_id = spamCallId;

    const spamDetection = require('../src/utils/spamDetection');
    const spamResult = spamDetection.analyzeCall(spamEvent);
    
    console.log(`   🚫 Spam detected: ${spamResult.isSpam ? '✅' : '❌'}`);
    console.log(`   📊 Spam score: ${spamResult.spamScore}`);
    console.log(`   📝 Reasons: ${spamResult.reasons.join(', ')}`);

    // Query call history
    console.log('\n📊 Test 4: Call History Query');
    const history = await keragonService.queryCallHistory();
    console.log(`   📈 Total calls in history: ${history.length}`);

    const newPatientHistory = await keragonService.queryCallHistory({ patient_type: 'new' });
    console.log(`   👤 New patient calls: ${newPatientHistory.length}`);

    console.log('\n✅ All mock integration tests completed successfully!');
    
    // Show mock logs location
    console.log('\n📁 Mock logs saved to: ./logs/mock-keragon-logs.json');
    console.log('\n🔧 To use real APIs, set MOCK_MODE=false in your .env file');

  } catch (error) {
    console.error('\n❌ Mock flow test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testMockFlow();
}

module.exports = testMockFlow;
