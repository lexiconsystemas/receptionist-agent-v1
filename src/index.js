/**
 * Receptionist Agent V1 - Main Express Server
 * After-Hours AI Receptionist for Urgent Care
 *
 * Architecture:
 * Caller → RetellAI (Telephony + Voice AI) → Keragon (Automation)
 * SMS (outbound/inbound) via SignalWire (same credentials as telephony)
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const logger = require('./config/logger');
const retellConfig = require('./config/retell');
const retellHandler = require('./webhooks/retellHandler');
const inboundSmsHandler = require('./webhooks/inboundSmsHandler');
const healthCheck = require('./lib/healthCheck');
const { registry: circuitBreakerRegistry } = require('./lib/circuitBreaker');
const { startScheduler, stopScheduler } = require('./services/schedulerService');
const mocks = require('../mocks');

const app = express();
const PORT = process.env.PORT || 3000;

// ===========================================
// MIDDLEWARE
// ===========================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    'https://api.retellai.com',
    'https://api.keragon.com'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Retell-Signature']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Body parsing — capture raw body for webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// ===========================================
// HEALTH CHECK ENDPOINTS
// ===========================================

app.get('/', (req, res) => {
  res.json({
    service: 'receptionist-agent-v1',
    status: 'operational',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Basic health check (for load balancers)
app.get('/health', (req, res) => {
  res.json(healthCheck.liveness());
});

// Kubernetes liveness probe
app.get('/health/live', (req, res) => {
  res.json(healthCheck.liveness());
});

// Kubernetes readiness probe
app.get('/health/ready', async (req, res) => {
  try {
    const status = await healthCheck.readiness();
    const statusCode = status.ready ? 200 : 503;
    res.status(statusCode).json(status);
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});

// Detailed health check (for monitoring dashboards)
app.get('/health/detailed', async (req, res) => {
  try {
    const status = await healthCheck.checkAll();
    const statusCode = status.status === 'healthy' ? 200 :
                       status.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(status);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Circuit breaker status
app.get('/health/circuits', (req, res) => {
  res.json(circuitBreakerRegistry.getAllStatus());
});

// Mock status (development)
app.get('/health/mocks', (req, res) => {
  res.json(mocks.getMockStatus());
});

// ===========================================
// RETELL AI WEBHOOK ENDPOINTS
// ===========================================

// Begin-call webhook — fires before the first LLM message on inbound calls.
// RetellAI calls this URL (configured on the phone number as inbound_dynamic_variables_webhook_url)
// and injects the returned dynamic_variables into the LLM prompt.
// This populates {{caller_phone_number}} so the agent can proactively confirm it.
app.post('/webhook/retell/begin-call', (req, res) => {
  try {
    const fromNumber = req.body?.call?.from_number || req.body?.from_number || null;
    const tz = process.env.CLINIC_TIMEZONE || 'America/New_York';
    const now = new Date();
    const current_date = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz
    }); // e.g. "Monday, March 16, 2026"
    const current_day = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz }); // e.g. "Monday"
    const current_time = now.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz
    }); // e.g. "10:30 PM"
    const tomorrow_date = new Date(now);
    tomorrow_date.setDate(tomorrow_date.getDate() + 1);
    const tomorrow = tomorrow_date.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: tz
    }); // e.g. "Tuesday, March 17"
    logger.info('Begin-call webhook fired', { fromNumber, current_date, current_time });
    res.json({
      dynamic_variables: {
        caller_phone_number: fromNumber || '',
        current_date,
        current_day,
        current_time,
        tomorrow
      }
    });
  } catch (error) {
    logger.error('Begin-call webhook error', { error: error.message });
    // Return empty variables on error — call continues normally
    res.json({ dynamic_variables: { caller_phone_number: '' } });
  }
});

// Main webhook for RetellAI call events
app.post('/webhook/retell', retellHandler.handleWebhook);

// Webhook for call status updates
app.post('/webhook/retell/status', retellHandler.handleCallStatus);

// RetellAI custom function call handler — log_call_information
// Grace calls this at the end of every call (Step 10) to push collected data.
// Responds 200 immediately so Grace is never blocked; the actual structured
// logging is already handled downstream by the call_ended + call_analyzed webhooks.
app.post('/webhook/retell/function/log-call-information', (req, res) => {
  try {
    logger.info('log_call_information function called', {
      callId: req.body?.call_id || req.body?.callId || 'unknown',
      args: req.body?.args ? Object.keys(req.body.args) : []
    });
    // Respond immediately so Grace is not blocked awaiting this
    res.json({ success: true });
  } catch (error) {
    logger.error('log_call_information function handler error', { error: error.message });
    res.json({ success: false });
  }
});

// ===========================================
// SMS WEBHOOK ENDPOINTS
// NOTE: RetellAI handles all telephony AND outbound SMS.
// Inbound SMS replies (ratings, opt-outs) are routed here from whatever
// number/provider Retell uses. Signature validation will be added once
// the Retell SMS integration approach is confirmed.
// ===========================================

// SMS delivery status callback (provider-agnostic path)
app.post('/webhook/sms/status', async (req, res) => {
  try {
    logger.info('SMS status update', {
      messageSid: req.body.MessageSid || req.body.SmsSid,
      status: req.body.MessageStatus || req.body.SmsStatus,
      to: req.body.To
    });
    res.sendStatus(200);
  } catch (error) {
    logger.error('Error handling SMS status webhook', { error: error.message });
    res.sendStatus(500);
  }
});

// Inbound SMS from patients (ratings, opt-outs, free-text replies)
app.post('/webhook/sms/inbound', inboundSmsHandler.handleInboundSms);

// ===========================================
// KERAGON WEBHOOK ENDPOINTS
// ===========================================

// Callback from Keragon automation workflows
app.post('/webhook/keragon/callback', async (req, res) => {
  try {
    logger.info('Keragon callback received', {
      workflowId: req.body.workflowId,
      status: req.body.status
    });

    // Handle Keragon workflow callbacks
    // (e.g., confirmation that call was logged, SMS was triggered)

    res.json({ received: true });
  } catch (error) {
    logger.error('Error handling Keragon callback', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===========================================
// ERROR HANDLING
// ===========================================

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', { path: req.path, method: req.method });
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ===========================================
// SERVER STARTUP
// ===========================================

const server = app.listen(PORT, () => {
  logger.info(`Receptionist Agent V1 started`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });

  // Start cron jobs (appointment reminders + PHI deletion)
  startScheduler();

  console.log(`
╔═══════════════════════════════════════════════════════╗
║     RECEPTIONIST AGENT V1 - After-Hours AI           ║
╠═══════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                          ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(38)}║
║                                                       ║
║  Endpoints:                                           ║
║  • GET  /health                        - Health check ║
║  • POST /webhook/retell                - RetellAI     ║
║  • POST /webhook/sms/inbound           - SMS replies  ║
║  • POST /webhook/keragon/callback      - Automation   ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  stopScheduler();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  stopScheduler();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Export app and server for testing
app.server = server;
module.exports = app;
