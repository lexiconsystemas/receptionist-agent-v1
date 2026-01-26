/**
 * Winston Logger Configuration
 * Structured logging for the Receptionist Agent
 *
 * HIPAA-Conscious: This logger is configured to avoid logging PHI.
 * Only log: call IDs, timestamps, dispositions, and system events.
 * Never log: medical history, insurance info, or detailed health conditions.
 */

const winston = require('winston');
const path = require('path');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Human-readable format for development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create transports array
const transports = [
  // Console transport - always enabled
  new winston.transports.Console({
    format: NODE_ENV === 'development' ? devFormat : structuredFormat
  })
];

// File transport for production
if (NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: structuredFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: structuredFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Create the logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: {
    service: 'receptionist-agent-v1'
  },
  transports
});

/**
 * Sanitize log data to remove potential PHI
 * @param {Object} data - Data to sanitize
 * @returns {Object} Sanitized data
 */
logger.sanitize = (data) => {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };

  // Fields that should never be logged in detail
  const sensitiveFields = [
    'medicalHistory',
    'insurance',
    'ssn',
    'dateOfBirth',
    'dob',
    'diagnosis',
    'treatment',
    'medication',
    'prescription'
  ];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

/**
 * Log a call event with sanitization
 * @param {string} event - Event type
 * @param {Object} callData - Call data to log
 */
logger.logCall = (event, callData) => {
  const sanitized = logger.sanitize(callData);
  logger.info(`Call Event: ${event}`, {
    callId: sanitized.callId,
    disposition: sanitized.disposition,
    timestamp: sanitized.timestamp,
    duration: sanitized.duration,
    isEmergency: sanitized.isEmergency,
    isSpam: sanitized.isSpam
  });
};

module.exports = logger;
