/**
 * Security audit logging for state operations
 * Tracks security-relevant events and access patterns
 *
 * Refactored to use composition pattern with specialized components
 */

import { createLogger } from '../utils/logger';
import { SecurityAuditFileManager } from './SecurityAuditFileManager';
import { SecurityEventLogger } from './SecurityEventLogger';
import { SecuritySpecialEvents } from './SecuritySpecialEvents';
import { SecurityStatistics } from './SecurityStatistics';

const logger = createLogger('checklist:security-audit');

export enum SecurityEventType {
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  STATE_READ = 'STATE_READ',
  STATE_WRITE = 'STATE_WRITE',
  STATE_DELETE = 'STATE_DELETE',
  SECRETS_DETECTED = 'SECRETS_DETECTED',
  ENCRYPTION_SUCCESS = 'ENCRYPTION_SUCCESS',
  ENCRYPTION_FAILURE = 'ENCRYPTION_FAILURE',
  DECRYPTION_SUCCESS = 'DECRYPTION_SUCCESS',
  DECRYPTION_FAILURE = 'DECRYPTION_FAILURE',
  KEY_ROTATION = 'KEY_ROTATION',
  LOCK_ACQUIRED = 'LOCK_ACQUIRED',
  LOCK_DENIED = 'LOCK_DENIED',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  BACKUP_CREATED = 'BACKUP_CREATED',
  RECOVERY_ATTEMPT = 'RECOVERY_ATTEMPT',
}

export enum SecuritySeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface SecurityEvent {
  timestamp: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  message: string;
  details?: Record<string, unknown>;
  user?: string;
  pid: number;
  hostname?: string;
  stackTrace?: string;
}

export class SecurityAudit {
  private static readonly FLUSH_INTERVAL_MS = 1000; // Flush every second
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_ROTATION_COUNT = 5;
  private static AUDIT_FILE = '.checklist/security-audit.log'; // Can be overridden for testing
  private static flushInterval: Timer | null = null;
  private static isInitialized = false;
  private static autoFlushEnabled = true; // Can be disabled for testing

  // Composed services
  private static eventLogger = new SecurityEventLogger();
  private static _fileManager: SecurityAuditFileManager | null = null;
  private static statistics = new SecurityStatistics();
  private static specialEvents = new SecuritySpecialEvents(
    SecurityAudit.eventLogger
  );

  private static get fileManager(): SecurityAuditFileManager {
    if (
      !this._fileManager ||
      this._fileManager['auditFilePath'] !== this.AUDIT_FILE
    ) {
      this._fileManager = new SecurityAuditFileManager(this.AUDIT_FILE);
    }
    return this._fileManager;
  }

  /**
   * Initialize the security audit system
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.fileManager.ensureAuditFile();
      this.startPeriodicFlush();
      this.isInitialized = true;
      logger.info({ msg: 'Security audit system initialized' });
    } catch (error) {
      logger.error({ msg: 'Failed to initialize security audit', error });
    }
  }

  /**
   * Log a security event
   */
  public static async logEvent(
    type: SecurityEventType,
    message: string,
    options: {
      severity?: SecuritySeverity;
      details?: Record<string, unknown>;
      stackTrace?: boolean;
    } = {}
  ): Promise<void> {
    const event = this.eventLogger.createSecurityEvent(type, message, options);
    this.eventLogger.addStackTraceIfNeeded(event, options);
    this.eventLogger.addToBuffer(event);

    if (
      this.autoFlushEnabled &&
      this.eventLogger.shouldFlushImmediately(event)
    ) {
      await this.flush();
    }
  }

  /**
   * Log state access events
   */
  public static async logStateAccess(
    operation: 'read' | 'write' | 'delete',
    filePath: string,
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.specialEvents.logStateAccess(
      operation,
      filePath,
      success,
      details
    );

    if (
      this.autoFlushEnabled &&
      this.eventLogger.shouldFlushImmediately(
        this.eventLogger.getBuffer().slice(-1)[0]
      )
    ) {
      await this.flush();
    }
  }

  /**
   * Log secrets detection
   */
  public static async logSecretsDetection(
    filePath: string,
    secretType: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.specialEvents.logSecretsDetection(filePath, secretType, details);

    if (
      this.autoFlushEnabled &&
      this.eventLogger.shouldFlushImmediately(
        this.eventLogger.getBuffer().slice(-1)[0]
      )
    ) {
      await this.flush();
    }
  }

  /**
   * Log encryption/decryption operations
   */
  public static async logEncryption(
    operation: 'encrypt' | 'decrypt',
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.specialEvents.logEncryption(operation, success, details);

    if (this.autoFlushEnabled && !success) {
      await this.flush(); // Flush failures immediately
    }
  }

  /**
   * Log lock operations
   */
  public static async logLockOperation(options: {
    operation: 'acquire' | 'release';
    lockId: string;
    success: boolean;
    timeout?: boolean;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.specialEvents.logLockOperation(options);

    if (
      this.autoFlushEnabled &&
      (!options.success || Boolean(options.timeout))
    ) {
      await this.flush(); // Flush failures and timeouts immediately
    }
  }

  /**
   * Log suspicious activity
   */
  public static async logSuspiciousActivity(
    activity: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.specialEvents.logSuspiciousActivity(activity, details);

    if (
      this.autoFlushEnabled &&
      this.eventLogger.shouldFlushImmediately(
        this.eventLogger.getBuffer().slice(-1)[0]
      )
    ) {
      await this.flush();
    }
  }

  /**
   * Get security statistics
   */
  public static async getStatistics(since?: Date): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    criticalEvents: number;
    errorEvents: number;
    suspiciousActivityCount: number;
    failedAccessAttempts: number;
    encryptionFailures: number;
    lockTimeouts: number;
    mostCommonEventType: string;
    mostCommonSeverity: string;
  }> {
    const logs = await this.fileManager.readLogs(since);
    return this.statistics.calculateStatistics(logs);
  }

  /**
   * Shutdown the security audit system
   */
  public static async shutdown(): Promise<void> {
    try {
      await this.flush();

      if (this.flushInterval !== null) {
        clearInterval(this.flushInterval);
        this.flushInterval = null;
      }

      this.isInitialized = false;
      logger.info({ msg: 'Security audit system shutdown completed' });
    } catch (error) {
      logger.error({ msg: 'Error during security audit shutdown', error });
    }
  }

  private static async flush(): Promise<void> {
    try {
      const events = this.eventLogger.getBuffer();
      if (events.length > 0) {
        await this.fileManager.writeEvents(events);
        this.eventLogger.clearBuffer();
      }
    } catch (error) {
      logger.error({ msg: 'Failed to flush security audit events', error });
    }
  }

  private static startPeriodicFlush(): void {
    this.flushInterval ??= setInterval(() => {
      this.flush().catch((error) => {
        logger.error({ msg: 'Periodic flush failed', error });
      });
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Get default severity for an event type
   */
  static getDefaultSeverity(eventType: SecurityEventType): SecuritySeverity {
    switch (eventType) {
      case SecurityEventType.SECRETS_DETECTED:
      case SecurityEventType.ENCRYPTION_FAILURE:
      case SecurityEventType.DECRYPTION_FAILURE:
        return SecuritySeverity.CRITICAL;

      case SecurityEventType.ACCESS_DENIED:
      case SecurityEventType.LOCK_DENIED:
      case SecurityEventType.LOCK_TIMEOUT:
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
      case SecurityEventType.RECOVERY_ATTEMPT:
        return SecuritySeverity.WARNING;

      case SecurityEventType.PERMISSION_CHANGE:
        return SecuritySeverity.ERROR;

      case SecurityEventType.ACCESS_GRANTED:
      case SecurityEventType.STATE_READ:
      case SecurityEventType.STATE_WRITE:
      case SecurityEventType.STATE_DELETE:
      case SecurityEventType.ENCRYPTION_SUCCESS:
      case SecurityEventType.DECRYPTION_SUCCESS:
      case SecurityEventType.KEY_ROTATION:
      case SecurityEventType.LOCK_ACQUIRED:
      case SecurityEventType.BACKUP_CREATED:
      default:
        return SecuritySeverity.INFO;
    }
  }

  static async auditState(state: unknown): Promise<{
    violations: string[];
    passed: boolean;
  }> {
    const violations: string[] = [];

    // Basic security checks
    const stateStr = JSON.stringify(state);
    if (
      stateStr.includes('password') ||
      stateStr.includes('secret') ||
      stateStr.includes('token')
    ) {
      violations.push('State may contain sensitive data');
    }

    return {
      violations,
      passed: violations.length === 0,
    };
  }

  /**
   * Read audit logs (internal method exposed for testing)
   */
  private static async readLogs(since?: Date): Promise<SecurityEvent[]> {
    return await this.fileManager.readLogs(since);
  }

  /**
   * Get event buffer (internal method exposed for testing)
   */
  private static getBuffer(): SecurityEvent[] {
    return this.eventLogger.getBuffer();
  }

  /**
   * Clear event buffer (internal method exposed for testing)
   */
  private static clearBuffer(): void {
    this.eventLogger.clearBuffer();
  }

  /**
   * Ensure audit file exists (internal method exposed for testing)
   */
  private static async ensureAuditFile(): Promise<void> {
    return await this.fileManager.ensureAuditFile();
  }

  /**
   * Get buffer property for tests
   */
  private static get buffer(): SecurityEvent[] {
    return this.eventLogger.getBuffer();
  }

  /**
   * Set buffer property for tests (mainly for clearing)
   */
  private static set buffer(events: SecurityEvent[]) {
    this.eventLogger.clearBuffer();
    if (events?.length > 0) {
      events.forEach((event) => this.eventLogger.addToBuffer(event));
    }
  }
}
