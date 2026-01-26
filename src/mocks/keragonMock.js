/**
 * Keragon Mock Service
 * Provides mock responses for development and testing without API credentials
 */

const logger = require('../config/logger');
const fs = require('fs').promises;
const path = require('path');

class KeragonMock {
  constructor() {
    this.logs = [];
    this.logCounter = 1000;
    this.logFile = path.join(__dirname, '../../logs/mock-keragon-logs.json');
  }

  /**
   * Mock logging to Keragon
   */
  async logToKeragon(data) {
    const logEntry = {
      id: `mock_log_${this.logCounter++}`,
      timestamp: new Date().toISOString(),
      ...data,
      mock: true
    };

    this.logs.push(logEntry);
    
    // Save to file for persistence during development
    await this.saveLogsToFile();

    logger.info('MOCK: Data logged to Keragon', {
      event: data.event,
      callId: data.callId || data.call_id,
      logId: logEntry.id
    });

    return {
      success: true,
      status: 200,
      keragonId: logEntry.id
    };
  }

  /**
   * Mock call record logging
   */
  async logCallRecord(callRecord) {
    const structuredRecord = {
      event: 'call_record',
      call_id: callRecord.callId,
      timestamp: callRecord.timestamp,
      caller_id: callRecord.callerId,
      caller_name: callRecord.callerName,
      patient_type: callRecord.patientType,
      reason_for_visit: callRecord.reasonForVisit,
      intended_visit_timeframe: callRecord.visitTimeframe,
      call_duration_seconds: callRecord.duration,
      disposition: callRecord.disposition,
      emergency_trigger: callRecord.isEmergency || false,
      spam_flag: callRecord.isSpam || false,
      spam_reasons: callRecord.spamReasons || [],
      sms_sent: callRecord.smsSent || false,
      sms_delivery_status: callRecord.smsStatus,
      ai_decision_path: callRecord.decisionPath || [],
      error_notes: callRecord.errorNotes,
      end_reason: callRecord.endReason,
      clinic_id: process.env.CLINIC_ID || 'mock_clinic_001'
    };

    return this.logToKeragon(structuredRecord);
  }

  /**
   * Mock edge case logging
   */
  async logEdgeCase(type, details) {
    const edgeCaseRecord = {
      event: 'edge_case',
      edge_case_type: type,
      call_id: details.callId,
      timestamp: new Date().toISOString(),
      description: details.description,
      context: details.context,
      requires_review: true
    };

    logger.warn('MOCK: Edge case logged', { type, callId: details.callId });
    return this.logToKeragon(edgeCaseRecord);
  }

  /**
   * Mock SMS status logging
   */
  async logSmsStatus(callId, smsData) {
    return this.logToKeragon({
      event: 'sms_status_update',
      call_id: callId,
      message_sid: smsData.messageSid,
      status: smsData.status,
      error_code: smsData.errorCode,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Mock call history query
   */
  async queryCallHistory(filters = {}) {
    logger.info('MOCK: Querying call history', { filters });
    
    // Filter mock logs based on filters
    let filteredLogs = this.logs.filter(log => log.event === 'call_record');
    
    if (filters.call_id) {
      filteredLogs = filteredLogs.filter(log => log.call_id === filters.call_id);
    }
    
    if (filters.patient_type) {
      filteredLogs = filteredLogs.filter(log => log.patient_type === filters.patient_type);
    }
    
    if (filters.date_from) {
      const fromDate = new Date(filters.date_from);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= fromDate);
    }

    return filteredLogs;
  }

  /**
   * Save logs to file for development persistence
   */
  async saveLogsToFile() {
    try {
      await fs.writeFile(this.logFile, JSON.stringify(this.logs, null, 2));
    } catch (error) {
      logger.error('Failed to save mock logs to file', { error: error.message });
    }
  }

  /**
   * Load logs from file on startup
   */
  async loadLogsFromFile() {
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      this.logs = JSON.parse(data);
      logger.info(`Loaded ${this.logs.length} mock logs from file`);
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      this.logs = [];
      logger.info('Starting with empty mock logs');
    }
  }

  /**
   * Get mock logs for testing
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Clear mock logs
   */
  clearLogs() {
    this.logs = [];
    this.logCounter = 1000;
    return this.saveLogsToFile();
  }

  /**
   * Generate mock workflow callback
   */
  generateMockCallback(workflowId, status = 'completed') {
    return {
      workflowId,
      status,
      timestamp: new Date().toISOString(),
      data: {
        processed: true,
        recordsCreated: 1
      }
    };
  }
}

// Initialize and load existing logs
const keragonMock = new KeragonMock();
keragonMock.loadLogsFromFile().catch(console.error);

module.exports = keragonMock;
