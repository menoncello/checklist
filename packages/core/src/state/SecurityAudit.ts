/**
 * Security audit logging for state operations
 * Tracks security-relevant events and access patterns
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { STATE_DIR } from './constants';

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
  private static readonly AUDIT_FILE = path.join(
    STATE_DIR,
    'security-audit.log'
  );
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_ROTATION_COUNT = 5;
  private static buffer: SecurityEvent[] = [];
  private static flushInterval: Timer | null = null;
  private static readonly FLUSH_INTERVAL_MS = 1000; // Flush every second
  private static isInitialized = false;

  /**
   * Initialize the security audit system
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure audit file exists
      await this.ensureAuditFile();

      // Start periodic flush
      this.startPeriodicFlush();

      this.isInitialized = true;
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
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      type,
      severity: options.severity ?? this.getDefaultSeverity(type),
      message,
      details: options.details,
      user: Bun.env.USER ?? Bun.env.USERNAME ?? 'unknown',
      pid: process.pid,
      hostname: undefined, // Hostname not available in Bun
    };

    // Add stack trace for errors and critical events
    if (
      options.stackTrace === true ||
      event.severity === SecuritySeverity.ERROR ||
      event.severity === SecuritySeverity.CRITICAL
    ) {
      const stack = new Error().stack;
      if (stack !== undefined && stack !== null && stack !== '') {
        // Remove first two lines (Error message and this function)
        event.stackTrace = stack.split('\n').slice(2).join('\n');
      }
    }

    // Add to buffer
    this.buffer.push(event);

    // Flush immediately for critical events
    if (event.severity === SecuritySeverity.CRITICAL) {
      await this.flush();
    }
  }

  /**
   * Log state access
   */
  public static async logStateAccess(
    operation: 'READ' | 'WRITE' | 'DELETE',
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    const typeMap = {
      READ: SecurityEventType.STATE_READ,
      WRITE: SecurityEventType.STATE_WRITE,
      DELETE: SecurityEventType.STATE_DELETE,
    };

    await this.logEvent(
      typeMap[operation],
      `State ${operation.toLowerCase()} ${success ? 'succeeded' : 'failed'}`,
      {
        severity: success ? SecuritySeverity.INFO : SecuritySeverity.WARNING,
        details,
      }
    );
  }

  /**
   * Log secrets detection
   */
  public static async logSecretsDetection(
    detectedSecrets: Array<{ type: string; line: number; column: number }>,
    action: 'BLOCKED' | 'WARNED'
  ): Promise<void> {
    await this.logEvent(
      SecurityEventType.SECRETS_DETECTED,
      `${detectedSecrets.length} potential secrets detected - ${action}`,
      {
        severity:
          action === 'BLOCKED'
            ? SecuritySeverity.WARNING
            : SecuritySeverity.INFO,
        details: {
          count: detectedSecrets.length,
          types: [...new Set(detectedSecrets.map((s) => s.type))],
          action,
        },
      }
    );
  }

  /**
   * Log encryption operations
   */
  public static async logEncryption(
    operation: 'ENCRYPT' | 'DECRYPT',
    success: boolean,
    fieldCount?: number,
    error?: string
  ): Promise<void> {
    const typeMap = {
      ENCRYPT: success
        ? SecurityEventType.ENCRYPTION_SUCCESS
        : SecurityEventType.ENCRYPTION_FAILURE,
      DECRYPT: success
        ? SecurityEventType.DECRYPTION_SUCCESS
        : SecurityEventType.DECRYPTION_FAILURE,
    };

    await this.logEvent(
      typeMap[operation],
      `${operation} operation ${success ? 'succeeded' : 'failed'}${fieldCount !== undefined && fieldCount > 0 ? ` for ${fieldCount} fields` : ''}`,
      {
        severity: success ? SecuritySeverity.INFO : SecuritySeverity.ERROR,
        details: {
          fieldCount,
          error,
        },
      }
    );
  }

  /**
   * Log lock operations
   */
  public static async logLockOperation(
    operation: 'ACQUIRED' | 'DENIED' | 'TIMEOUT',
    lockPath: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const typeMap = {
      ACQUIRED: SecurityEventType.LOCK_ACQUIRED,
      DENIED: SecurityEventType.LOCK_DENIED,
      TIMEOUT: SecurityEventType.LOCK_TIMEOUT,
    };

    await this.logEvent(
      typeMap[operation],
      `Lock ${operation.toLowerCase()} for ${path.basename(lockPath)}`,
      {
        severity:
          operation === 'ACQUIRED'
            ? SecuritySeverity.INFO
            : SecuritySeverity.WARNING,
        details: {
          ...details,
          lockPath,
        },
      }
    );
  }

  /**
   * Log suspicious activity
   */
  public static async logSuspiciousActivity(
    reason: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.logEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, reason, {
      severity: SecuritySeverity.WARNING,
      details,
      stackTrace: true,
    });
  }

  /**
   * Get audit log statistics
   */
  public static async getStatistics(since?: Date): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    suspiciousActivities: number;
    failedOperations: number;
  }> {
    const logs = await this.readLogs(since);

    const stats = {
      totalEvents: logs.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      suspiciousActivities: 0,
      failedOperations: 0,
    };

    for (const log of logs) {
      // Count by type
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;

      // Count by severity
      stats.bySeverity[log.severity] =
        (stats.bySeverity[log.severity] || 0) + 1;

      // Count suspicious activities
      if (log.type === SecurityEventType.SUSPICIOUS_ACTIVITY) {
        stats.suspiciousActivities++;
      }

      // Count failed operations
      if (
        log.type.includes('FAILURE') ||
        log.type.includes('DENIED') ||
        log.type.includes('TIMEOUT')
      ) {
        stats.failedOperations++;
      }
    }

    return stats;
  }

  /**
   * Read audit logs
   */
  private static async readLogs(since?: Date): Promise<SecurityEvent[]> {
    try {
      const file = Bun.file(this.AUDIT_FILE);
      if (!(await file.exists())) {
        return [];
      }

      const content = await file.text();
      const lines = content.trim().split('\n');
      const logs: SecurityEvent[] = [];

      for (const line of lines) {
        if (!line) continue;
        try {
          const log = JSON.parse(line) as SecurityEvent;
          if (!since || new Date(log.timestamp) >= since) {
            logs.push(log);
          }
        } catch {
          // Skip malformed lines
        }
      }

      return logs;
    } catch {
      return [];
    }
  }

  /**
   * Ensure audit file exists and is rotated if needed
   */
  private static async ensureAuditFile(): Promise<void> {
    try {
      // Ensure directory exists first
      const dir = path.dirname(this.AUDIT_FILE);
      await Bun.$`mkdir -p ${dir}`.quiet();

      const file = Bun.file(this.AUDIT_FILE);

      // Check if rotation is needed
      if (await file.exists()) {
        const stats = await file.size;
        if (stats > this.MAX_FILE_SIZE) {
          await this.rotateAuditFile();
        }
      }

      // Create file if it doesn't exist
      if (!(await file.exists())) {
        await Bun.write(this.AUDIT_FILE, '');
      }
    } catch (error) {
      logger.error({ msg: 'Failed to ensure audit file', error });
    }
  }

  /**
   * Rotate audit file
   */
  private static async rotateAuditFile(): Promise<void> {
    try {
      // Rotate existing files
      for (let i = this.MAX_ROTATION_COUNT - 1; i >= 1; i--) {
        const oldPath = `${this.AUDIT_FILE}.${i}`;
        const newPath = `${this.AUDIT_FILE}.${i + 1}`;

        try {
          await fs.rename(oldPath, newPath);
        } catch {
          // File might not exist
        }
      }

      // Move current to .1
      await fs.rename(this.AUDIT_FILE, `${this.AUDIT_FILE}.1`);

      // Create new empty file
      await Bun.write(this.AUDIT_FILE, '');
    } catch (error) {
      logger.error({ msg: 'Failed to rotate audit file', error });
    }
  }

  /**
   * Get default severity for event type
   */
  private static getDefaultSeverity(type: SecurityEventType): SecuritySeverity {
    const criticalTypes = [
      SecurityEventType.SECRETS_DETECTED,
      SecurityEventType.ENCRYPTION_FAILURE,
      SecurityEventType.DECRYPTION_FAILURE,
    ];

    const warningTypes = [
      SecurityEventType.ACCESS_DENIED,
      SecurityEventType.LOCK_DENIED,
      SecurityEventType.LOCK_TIMEOUT,
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      SecurityEventType.RECOVERY_ATTEMPT,
    ];

    const errorTypes = [SecurityEventType.PERMISSION_CHANGE];

    if (criticalTypes.includes(type)) {
      return SecuritySeverity.CRITICAL;
    }
    if (warningTypes.includes(type)) {
      return SecuritySeverity.WARNING;
    }
    if (errorTypes.includes(type)) {
      return SecuritySeverity.ERROR;
    }

    return SecuritySeverity.INFO;
  }

  /**
   * Flush buffered events to disk
   */
  private static async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    try {
      await this.ensureAuditFile();

      const lines =
        this.buffer.map((event) => JSON.stringify(event)).join('\n') + '\n';

      // Append to file
      const file = Bun.file(this.AUDIT_FILE);
      const existing = await file.text();
      await Bun.write(this.AUDIT_FILE, existing + lines);

      // Clear buffer
      this.buffer = [];
    } catch (error) {
      logger.error({ msg: 'Failed to flush audit events', error });
    }
  }

  /**
   * Start periodic flush
   */
  private static startPeriodicFlush(): void {
    if (this.flushInterval) {
      return;
    }

    this.flushInterval = setInterval(async () => {
      await this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Stop periodic flush and flush remaining events
   */
  public static async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flush();
    this.isInitialized = false;
  }
}
