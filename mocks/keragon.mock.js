/**
 * Keragon Mock API
 * Simulates Keragon workflow automation responses for development/testing
 *
 * REPLACE WITH REAL API WHEN CLIENT PROVIDES:
 * - KERAGON_API_KEY
 * - KERAGON_WEBHOOK_URL
 * - KERAGON_WORKSPACE_ID
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../src/config/logger');

const MOCK_ENABLED = process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'development';

/**
 * In-memory store for mock logged data
 * In production, this would be Keragon's database
 */
const mockDataStore = {
  calls: [],
  smsLogs: [],
  edgeCases: [],
  emergencies: []
};

/**
 * Mock Keragon webhook receiver
 * Simulates successful webhook acceptance
 */
async function mockLogToKeragon(data) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real KERAGON_WEBHOOK_URL');
  }

  const recordId = `keragon_${uuidv4().substring(0, 8)}`;

  // Store based on event type
  const record = {
    id: recordId,
    received_at: new Date().toISOString(),
    ...data
  };

  switch (data.event) {
    case 'call_started':
    case 'call_ended':
    case 'call_record':
    case 'call_analyzed':
      mockDataStore.calls.push(record);
      break;
    case 'sms_sent':
    case 'sms_status_update':
      mockDataStore.smsLogs.push(record);
      break;
    case 'edge_case':
      mockDataStore.edgeCases.push(record);
      break;
    case 'emergency_detected':
      mockDataStore.emergencies.push(record);
      break;
    default:
      mockDataStore.calls.push(record);
  }

  logger.info('[MOCK] Data logged to mock Keragon', {
    event: data.event,
    recordId,
    callId: data.call_id || data.callId
  });

  // Simulate Keragon response
  return {
    success: true,
    id: recordId,
    status: 200,
    message: 'Record created successfully',
    workflow_triggered: true
  };
}

/**
 * Mock query Keragon records
 * Simulates Keragon API query
 */
async function mockQueryRecords(filters = {}) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real KERAGON_API_KEY');
  }

  let results = [...mockDataStore.calls];

  // Apply filters
  if (filters.disposition) {
    results = results.filter(r => r.disposition === filters.disposition);
  }
  if (filters.emergency_trigger) {
    results = results.filter(r => r.emergency_trigger === true);
  }
  if (filters.spam_flag) {
    results = results.filter(r => r.spam_flag === true);
  }
  if (filters.start_date) {
    results = results.filter(r => new Date(r.timestamp) >= new Date(filters.start_date));
  }

  logger.info('[MOCK] Queried mock Keragon records', { count: results.length });

  return results;
}

/**
 * Get mock data store stats
 * Useful for testing and debugging
 */
function getMockStats() {
  return {
    total_calls: mockDataStore.calls.length,
    total_sms: mockDataStore.smsLogs.length,
    total_edge_cases: mockDataStore.edgeCases.length,
    total_emergencies: mockDataStore.emergencies.length,
    emergency_calls: mockDataStore.calls.filter(c => c.emergency_trigger).length,
    spam_calls: mockDataStore.calls.filter(c => c.spam_flag).length,
    completed_calls: mockDataStore.calls.filter(c => c.disposition === 'completed').length
  };
}

/**
 * Clear mock data store
 * Useful for test cleanup
 */
function clearMockStore() {
  mockDataStore.calls = [];
  mockDataStore.smsLogs = [];
  mockDataStore.edgeCases = [];
  mockDataStore.emergencies = [];
  logger.info('[MOCK] Mock data store cleared');
}

/**
 * Get all records from mock store
 * For debugging and testing
 */
function getAllMockRecords() {
  return { ...mockDataStore };
}

/**
 * Mock Keragon workflow trigger
 * Simulates workflow execution
 */
async function mockTriggerWorkflow(workflowId, payload) {
  if (!MOCK_ENABLED) {
    throw new Error('Mocks disabled - configure real KERAGON_API_KEY');
  }

  const executionId = `exec_${uuidv4().substring(0, 8)}`;

  logger.info('[MOCK] Triggered mock Keragon workflow', {
    workflowId,
    executionId
  });

  return {
    success: true,
    execution_id: executionId,
    workflow_id: workflowId,
    status: 'running',
    started_at: new Date().toISOString()
  };
}

/**
 * Mock expected Keragon workflow definitions
 * Document what workflows need to be created in Keragon
 */
const expectedWorkflows = {
  call_logging: {
    name: 'Call Logging Workflow',
    trigger: 'webhook',
    description: 'Receives call data from receptionist agent and stores for staff review',
    expected_payload: {
      event: 'string',
      call_id: 'string',
      timestamp: 'ISO8601',
      caller_id: 'string',
      call_duration_seconds: 'number',
      caller_name: 'string|null',
      patient_type: 'new|returning|unknown',
      reason_for_visit: 'string|null',
      intended_visit_timeframe: 'string|null',
      disposition: 'completed|high_intent|emergency|spam|dropped',
      emergency_trigger: 'boolean',
      spam_flag: 'boolean',
      sms_sent: 'boolean',
      sms_delivery_status: 'string|null'
    }
  },
  emergency_alert: {
    name: 'Emergency Alert Workflow',
    trigger: 'webhook',
    description: 'Alerts staff immediately when emergency is detected',
    expected_payload: {
      event: 'emergency_detected',
      call_id: 'string',
      timestamp: 'ISO8601',
      detectedKeywords: 'string[]',
      isMentalHealthCrisis: 'boolean'
    }
  },
  sms_followup: {
    name: 'SMS Follow-up Workflow',
    trigger: 'webhook',
    description: 'Triggers SMS follow-up for completed calls',
    expected_payload: {
      event: 'sms_sent',
      call_id: 'string',
      phone_number: 'string',
      message: 'string',
      status: 'string'
    }
  },
  staff_notification: {
    name: 'Staff Notification Workflow',
    trigger: 'schedule',
    description: 'Daily summary of after-hours calls for staff review',
    expected_output: {
      total_calls: 'number',
      emergencies: 'number',
      high_intent: 'number',
      spam_filtered: 'number'
    }
  }
};

module.exports = {
  MOCK_ENABLED,
  mockLogToKeragon,
  mockQueryRecords,
  getMockStats,
  clearMockStore,
  getAllMockRecords,
  mockTriggerWorkflow,
  expectedWorkflows,
  mockDataStore
};
