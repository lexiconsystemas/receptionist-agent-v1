/**
 * Call Flow Integration Tests
 * Tests end-to-end call handling scenarios
 *
 * Run with: npm test -- tests/integration/callFlow.test.js
 */

const request = require('supertest');

// Set mock mode before importing app
process.env.USE_MOCKS = 'true';
process.env.NODE_ENV = 'test';

// Import app (this starts the server)
const app = require('../../src/index');
const mocks = require('../../mocks');

// Get reference to server for cleanup
let server;

beforeAll(() => {
  // The server is already started by index.js, get its reference
  // We need to close it after tests
  server = app.server;
});

afterAll((done) => {
  // Close the server to allow Jest to exit
  if (app.server) {
    app.server.close(done);
  } else {
    done();
  }
});

describe('Call Flow Integration Tests', () => {
  beforeEach(() => {
    // Clear mock stores between tests
    mocks.clearAllMockStores();
  });

  describe('Incoming Call Webhook', () => {
    it('should accept incoming Twilio call and return TwiML', async () => {
      const callPayload = mocks.twilio.generateMockIncomingCallPayload({
        from: '+15551234567',
        to: '+15559999999'
      });

      const response = await request(app)
        .post('/webhook/twilio/voice')
        .send(callPayload)
        .expect('Content-Type', /xml/)
        .expect(200);

      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Connect>');
    });
  });

  describe('RetellAI Webhooks', () => {
    it('should handle call_started event', async () => {
      const payload = mocks.retell.generateMockWebhookPayload('normal_call');
      payload.event_type = 'call_started';

      const response = await request(app)
        .post('/webhook/retell')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle normal call_ended event', async () => {
      const payload = mocks.retell.generateMockWebhookPayload('normal_call');

      const response = await request(app)
        .post('/webhook/retell')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify call was logged to mock Keragon
      const keragonStats = mocks.keragon.getMockStats();
      expect(keragonStats.total_calls).toBeGreaterThan(0);
    });

    it('should detect and handle emergency call', async () => {
      const payload = mocks.retell.generateMockWebhookPayload('emergency_call');

      const response = await request(app)
        .post('/webhook/retell')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify emergency was logged (emergency calls have emergency_trigger: true)
      const keragonStats = mocks.keragon.getMockStats();
      expect(keragonStats.emergency_calls).toBeGreaterThan(0);
    });

    it('should detect and flag spam call', async () => {
      const payload = mocks.retell.generateMockWebhookPayload('spam_call');

      const response = await request(app)
        .post('/webhook/retell')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify spam was flagged
      const keragonStats = mocks.keragon.getMockStats();
      expect(keragonStats.spam_calls).toBeGreaterThan(0);
    });

    it('should handle mental health crisis call', async () => {
      const payload = mocks.retell.generateMockWebhookPayload('mental_health_crisis');

      const response = await request(app)
        .post('/webhook/retell')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle dropped call', async () => {
      const payload = mocks.retell.generateMockWebhookPayload('dropped_call');

      const response = await request(app)
        .post('/webhook/retell')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('SMS Status Callback', () => {
    it('should handle SMS delivery status update', async () => {
      const messageSid = mocks.twilio.generateMockSid('SM');
      const payload = mocks.twilio.generateMockSmsStatusPayload(messageSid, 'delivered');

      const response = await request(app)
        .post('/webhook/twilio/sms-status')
        .send(payload)
        .expect(200);
    });
  });

  describe('Keragon Callback', () => {
    it('should handle Keragon workflow callback', async () => {
      const payload = {
        workflowId: 'test_workflow',
        status: 'completed',
        callId: 'test_call_123'
      };

      const response = await request(app)
        .post('/webhook/keragon/callback')
        .send(payload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });
  });
});

describe('Health Check Endpoints', () => {
  it('should return liveness status', async () => {
    const response = await request(app)
      .get('/health/live')
      .expect(200);

    expect(response.body.status).toBe('alive');
  });

  it('should return readiness status', async () => {
    const response = await request(app)
      .get('/health/ready')
      .expect(200);

    expect(response.body).toHaveProperty('ready');
  });

  it('should return detailed health status', async () => {
    const response = await request(app)
      .get('/health/detailed')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('checks');
  });

  it('should return circuit breaker status', async () => {
    const response = await request(app)
      .get('/health/circuits')
      .expect(200);

    expect(typeof response.body).toBe('object');
  });

  it('should return mock status', async () => {
    const response = await request(app)
      .get('/health/mocks')
      .expect(200);

    expect(response.body.mock_enabled).toBe(true);
  });
});
