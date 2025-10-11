/**
 * Template audit logger for security event tracking
 */

import { createLogger } from '../../utils/logger';
import * as helpers from './AuditLoggerHelpers';
import type {
  AuditEntry,
  SecurityEvent,
  AuditVerificationResult,
  AuditLogQuery,
} from './types';

const logger = createLogger('checklist:templates:security:audit-logger');

/**
 * Audit logger configuration
 */
export interface TemplateAuditLoggerConfig {
  secretKey?: string;
  maxLogSize?: number;
  rotationPolicy?: 'size' | 'time' | 'none';
  retentionDays?: number;
  alertOnCritical?: boolean;
}

/**
 * Template audit logger
 */
export class TemplateAuditLogger {
  private readonly config: Required<TemplateAuditLoggerConfig>;
  private readonly entries: AuditEntry[] = [];
  private readonly secretKey: Buffer;

  constructor(config?: TemplateAuditLoggerConfig) {
    this.config = this.initializeConfig(config);
    this.secretKey = Buffer.from(this.config.secretKey, 'hex');
    this.logInitialization();
  }

  /**
   * Initialize configuration with defaults
   */
  private initializeConfig(
    config?: TemplateAuditLoggerConfig
  ): Required<TemplateAuditLoggerConfig> {
    const defaults: Required<TemplateAuditLoggerConfig> = {
      secretKey: helpers.generateSecretKey(),
      maxLogSize: 10000,
      rotationPolicy: 'size',
      retentionDays: 90,
      alertOnCritical: true,
    };

    return { ...defaults, ...config };
  }

  /**
   * Log initialization
   */
  private logInitialization(): void {
    logger.debug({
      msg: 'TemplateAuditLogger initialized',
      config: {
        maxLogSize: this.config.maxLogSize,
        rotationPolicy: this.config.rotationPolicy,
        retentionDays: this.config.retentionDays,
      },
    });
  }

  /**
   * Log security event
   */
  logEvent(event: SecurityEvent, userId?: string): AuditEntry {
    const entry = this.createEntry(event, userId);
    this.entries.push(entry);

    this.checkRotation();

    if (this.shouldAlert(event)) {
      this.alertCriticalEvent(event);
    }

    logger.debug({
      msg: 'Security event logged',
      type: event.type,
      severity: event.severity,
    });

    return entry;
  }

  /**
   * Log template loading event
   */
  logTemplateLoad(
    templateId: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): AuditEntry {
    return this.logEvent(
      {
        type: 'template.load',
        severity: 'info',
        templateId,
        templateVersion: '1.0.0',
        details: metadata ?? {},
      },
      userId
    );
  }

  /**
   * Log template execution event
   */
  logTemplateExecution(
    templateId: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): AuditEntry {
    return this.logEvent(
      {
        type: 'template.execute',
        severity: 'info',
        templateId,
        templateVersion: '1.0.0',
        details: metadata ?? {},
      },
      userId
    );
  }

  /**
   * Log security violation
   */
  logSecurityViolation(
    templateId: string,
    violation: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): AuditEntry {
    return this.logEvent(
      {
        type: 'security.violation',
        severity: 'critical',
        templateId,
        templateVersion: '1.0.0',
        details: { violation, ...metadata },
      },
      userId
    );
  }

  /**
   * Query audit log
   */
  query(options: AuditLogQuery = {}): AuditEntry[] {
    let results = [...this.entries];

    results = helpers.filterByTime(results, options);
    results = helpers.filterByTemplate(results, options);
    results = helpers.filterByEventType(results, options);
    results = helpers.filterBySeverity(results, options);
    results = helpers.applyLimit(results, options);

    return results;
  }

  /**
   * Verify audit log integrity
   */
  verifyIntegrity(): AuditVerificationResult {
    const tamperedIndices: number[] = [];

    this.entries.forEach((entry, index) => {
      if (!helpers.verifyEntry(entry, this.secretKey).valid) {
        tamperedIndices.push(index);
      }
    });

    if (tamperedIndices.length > 0) {
      logger.warn({
        msg: 'Audit log tampering detected',
        tamperedCount: tamperedIndices.length,
      });
    }

    return {
      verified: tamperedIndices.length === 0,
      totalEntries: this.entries.length,
      tamperedEntries: tamperedIndices,
    };
  }

  /**
   * Get audit log statistics
   */
  getStatistics(): Record<string, unknown> {
    const eventTypes = helpers.groupBy(this.entries, 'type');
    const severities = helpers.groupBy(this.entries, 'severity');

    return {
      totalEntries: this.entries.length,
      oldestEntry: helpers.getOldestEntry(this.entries),
      newestEntry: helpers.getNewestEntry(this.entries),
      eventTypes,
      severities,
    };
  }

  /**
   * Clear audit log
   */
  clear(): void {
    logger.info({ msg: 'Clearing audit log' });
    this.entries.length = 0;
  }

  /**
   * Get all entries
   */
  getEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<TemplateAuditLoggerConfig> {
    return { ...this.config };
  }

  /**
   * Create audit entry
   */
  private createEntry(event: SecurityEvent, userId?: string): AuditEntry {
    const timestamp = new Date().toISOString();

    const entry: AuditEntry = {
      timestamp,
      type: event.type,
      severity: event.severity,
      templateId: event.templateId,
      templateVersion: event.templateVersion,
      user: userId ?? 'system',
      pid: process.pid,
      details: event.details,
      integrity: '', // Will be set below
      stackTrace: event.includeStack === true ? new Error().stack : undefined,
    };

    entry.integrity = helpers.calculateIntegrity(entry, this.secretKey);

    return entry;
  }

  /** Check and perform rotation if needed */
  private checkRotation(): void {
    if (
      this.config.rotationPolicy === 'size' &&
      this.entries.length > this.config.maxLogSize
    ) {
      logger.info({
        msg: 'Rotating audit log',
        size: this.entries.length,
      });
      const retained = this.entries.slice(-this.config.maxLogSize);
      this.entries.length = 0;
      this.entries.push(...retained);
    }
  }

  /** Check if event requires alerting */
  private shouldAlert(event: SecurityEvent): boolean {
    return (
      this.config.alertOnCritical === true && event.severity === 'critical'
    );
  }

  /** Alert on critical event */
  private alertCriticalEvent(event: SecurityEvent): void {
    logger.error({
      msg: 'CRITICAL SECURITY EVENT',
      type: event.type,
      templateId: event.templateId,
      details: event.details,
    });
  }
}
