/**
 * Google Calendar Mock
 * Simulates Google Calendar API responses for development/testing
 *
 * Follows the same pattern as keragon.mock.js:
 * - MOCK_ENABLED guard
 * - In-memory mockDataStore
 * - [MOCK] logger prefix
 * - Returns success response objects matching real service
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../src/config/logger');

const MOCK_ENABLED = process.env.USE_MOCKS === 'true' || process.env.NODE_ENV === 'test';

/**
 * In-memory store for mock calendar events
 */
const mockDataStore = {
  events: []
};

/**
 * Mock Google Calendar event creation
 * Simulates a successful calendar.events.insert() response
 * @param {Object} callLog - Call log data from retellHandler
 * @returns {Object} Mock response matching real googleCalendarService return shape
 */
async function mockCreateAppointmentEvent(callLog) {
  if (!MOCK_ENABLED) {
    throw new Error('Google Calendar mocks disabled — configure real GOOGLE_CALENDAR_ID');
  }

  const eventId = `mock_gcal_${uuidv4().substring(0, 8)}`;
  const callerName = callLog.caller_name || 'Patient';

  const record = {
    id: eventId,
    summary: `Urgent Care Walk-In — ${callerName}`,
    description: [
      `Reason: ${callLog.reason_for_visit || 'Not specified'}`,
      `Phone: ${callLog.caller_id || 'Unknown'}`,
      `Patient type: ${callLog.patient_type || 'Unknown'}`,
      `Call ID: ${callLog.call_id}`
    ].join('\n'),
    start: callLog.intended_visit_timeframe || callLog.timestamp,
    callId: callLog.call_id,
    createdAt: new Date().toISOString(),
    htmlLink: `https://calendar.google.com/calendar/event?eid=mock_${eventId}`
  };

  mockDataStore.events.push(record);

  logger.info('[MOCK] Google Calendar event created', {
    eventId,
    callId: callLog.call_id,
    summary: record.summary
  });

  return {
    success: true,
    eventId,
    htmlLink: record.htmlLink
  };
}

/**
 * Mock Google Calendar event deletion
 * @param {string} eventId - Google Calendar event ID to delete
 * @returns {Object} Mock response
 */
async function mockDeleteAppointmentEvent(eventId) {
  if (!MOCK_ENABLED) {
    throw new Error('Google Calendar mocks disabled');
  }

  const before = mockDataStore.events.length;
  mockDataStore.events = mockDataStore.events.filter(e => e.id !== eventId);
  const deleted = before !== mockDataStore.events.length;

  logger.info('[MOCK] Google Calendar event deleted', { eventId, found: deleted });

  return {
    success: true,
    deleted
  };
}

/**
 * Get all mock calendar events (for test assertions)
 * @returns {Array} All events in the mock store
 */
function getMockEvents() {
  return [...mockDataStore.events];
}

/**
 * Clear the mock data store (call in test beforeEach/afterEach)
 */
function clearMockStore() {
  mockDataStore.events = [];
}

module.exports = {
  MOCK_ENABLED,
  mockCreateAppointmentEvent,
  mockDeleteAppointmentEvent,
  getMockEvents,
  clearMockStore,
  mockDataStore
};
