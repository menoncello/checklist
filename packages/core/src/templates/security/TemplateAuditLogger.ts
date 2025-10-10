/**
 * Template audit logger for security event tracking
 */

import { createHmac } from 'node:crypto';
import { createLogger } from '../../utils/logger';
import type {
  AuditEntry,
  SecurityEvent,
  AuditVerificationResult,
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
 * Audit log query options
 */
export interface AuditLogQuery {
  startTime?: Date;
  endTime?: Date;
  templateId?: string;
  eventType?: SecurityEvent['type'];
  severity?: SecurityEvent['severity'];
  limit?: number;
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
      secretKey: this.generateSecretKey(),
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
  logEvent(event: SecurityEvent): AuditEntry {
    const entry = this.createEntry(event);
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
    return this.logEvent({
      type: 'templateLoad',
      severity: 'info',
      templateId,
      userId,
      timestamp: new Date(),
      details: metadata,
    });
  }

  /**
   * Log template execution event
   */
  logTemplateExecution(
    templateId: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): AuditEntry {
    return this.logEvent({
      type: 'templateExecution',
      severity: 'info',
      templateId,
      userId,
      timestamp: new Date(),
      details: metadata,
    });
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
    return this.logEvent({
      type: 'securityViolation',
      severity: 'critical',
      templateId,
      userId,
      timestamp: new Date(),
      details: { violation, ...metadata },
    });
  }

  /**
   * Query audit log
   */
  query(options: AuditLogQuery = {}): AuditEntry[] {
    let results = [...this.entries];

    results = this.filterByTime(results, options);
    results = this.filterByTemplate(results, options);
    results = this.filterByEventType(results, options);
    results = this.filterBySeverity(results, options);
    results = this.applyLimit(results, options);

    return results;
  }

  /**
   * Verify audit log integrity
   */
  verifyIntegrity(): AuditVerificationResult {
    const results = this.entries.map((entry) =>
      this.verifyEntry(entry)
    );

    const tampered = results.filter((r) => !r.valid);

    if (tampered.length > 0) {
      logger.warn({
        msg: 'Audit log tampering detected',
        tamperedCount: tampered.length,
      });
    }

    return {
      valid: tampered.length === 0,
      totalEntries: this.entries.length,
      tamperedEntries: tampered.length,
      tamperedIds: tampered.map((r) => r.entry?.id ?? 'unknown'),
    };
  }

  /**
   * Get audit log statistics
   */
  getStatistics(): Record<string, unknown> {
    const eventTypes = this.groupByEventType();
    const severities = this.groupBySeverity();

    return {
      totalEntries: this.entries.length,
      oldestEntry: this.getOldestEntry(),
      newestEntry: this.getNewestEntry(),
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
  private createEntry(event: SecurityEvent): AuditEntry {
    const id = this.generateEntryId();
    const timestamp = new Date();

    const entry: AuditEntry = {
      id,
      event,
      timestamp,
      integrity: '', // Will be set below
    };

    entry.integrity = this.calculateIntegrity(entry);

    return entry;
  }

  /**
   * Calculate entry integrity hash
   */
  private calculateIntegrity(entry: AuditEntry): string {
    const data = JSON.stringify({
      id: entry.id,
      event: entry.event,
      timestamp: entry.timestamp.toISOString(),
    });

    const hmac = createHmac('sha256', this.secretKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify entry integrity
   */
  private verifyEntry(
    entry: AuditEntry
  ): { valid: boolean; entry: AuditEntry } {
    const expected = this.calculateIntegrity(entry);
    const valid = entry.integrity === expected;

    return { valid, entry };
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
      this.config.alertOnCritical && event.severity === 'critical'
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

  /** Generate secret key */
  private generateSecretKey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('hex');
  }

  /** Generate entry ID */
  private generateEntryId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /** Filter by time range */
  private filterByTime(
    entries: AuditEntry[],
    options: AuditLogQuery
  ): AuditEntry[] {
    let filtered = entries;
    if (options.startTime !== undefined) {
      const start = options.startTime;
      filtered = filtered.filter((e) => e.timestamp >= start);
    }
    if (options.endTime !== undefined) {
      const end = options.endTime;
      filtered = filtered.filter((e) => e.timestamp <= end);
    }
    return filtered;
  }

  /** Filter by template ID */
  private filterByTemplate(
    entries: AuditEntry[],
    options: AuditLogQuery
  ): AuditEntry[] {
    if (options.templateId === undefined || options.templateId === '') {
      return entries;
    }
    return entries.filter(
      (e) => e.event.templateId === options.templateId
    );
  }

  /** Filter by event type */
  private filterByEventType(
    entries: AuditEntry[],
    options: AuditLogQuery
  ): AuditEntry[] {
    return options.eventType === undefined
      ? entries
      : entries.filter((e) => e.event.type === options.eventType);
  }

  /** Filter by severity */
  private filterBySeverity(
    entries: AuditEntry[],
    options: AuditLogQuery
  ): AuditEntry[] {
    return options.severity === undefined
      ? entries
      : entries.filter((e) => e.event.severity === options.severity);
  }

  /** Apply result limit */
  private applyLimit(
    entries: AuditEntry[],
    options: AuditLogQuery
  ): AuditEntry[] {
    return options.limit === undefined || options.limit === 0
      ? entries
      : entries.slice(-options.limit);
  }

  /** Group entries by field */
  private groupBy(field: 'type' | 'severity'): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const entry of this.entries) {
      const key = field === 'type' ? entry.event.type : entry.event.severity;
      groups[key] = (groups[key] ?? 0) + 1;
    }
    return groups;
  }

  /** Group entries by event type */
  private groupByEventType(): Record<string, number> {
    return this.groupBy('type');
  }

  /** Group entries by severity */
  private groupBySeverity(): Record<string, number> {
    return this.groupBy('severity');
  }

  /** Get oldest entry timestamp */
  private getOldestEntry(): Date | null {
    return this.entries.length === 0 ? null : this.entries[0].timestamp;
  }

  /** Get newest entry timestamp */
  private getNewestEntry(): Date | null {
    return this.entries.length === 0
      ? null
      : this.entries[this.entries.length - 1].timestamp;
  }
}
