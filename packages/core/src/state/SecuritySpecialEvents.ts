/**
 * Specialized security event logging methods
 * Provides convenient methods for common security events
 */

import { SecurityEventType, SecuritySeverity } from './SecurityAudit';
import { SecurityEventLogger } from './SecurityEventLogger';

export class SecuritySpecialEvents {
  constructor(private eventLogger: SecurityEventLogger) {}

  async logStateAccess(
    operation: 'read' | 'write' | 'delete',
    filePath: string,
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    const type = this.getStateAccessEventType(operation);
    const severity = success ? SecuritySeverity.INFO : SecuritySeverity.WARNING;
    const message = `State ${operation} ${success ? 'succeeded' : 'failed'}`;

    const event = this.eventLogger.createSecurityEvent(type, message, {
      severity,
      details: {
        operation,
        filePath,
        success,
        ...details,
      },
    });

    this.eventLogger.addStackTraceIfNeeded(event, { stackTrace: !success });
    this.eventLogger.addToBuffer(event);
  }

  async logSecretsDetection(
    filePath: string,
    secretType: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const message = `Potential ${secretType} detected in ${filePath}`;

    const event = this.eventLogger.createSecurityEvent(
      SecurityEventType.SECRETS_DETECTED,
      message,
      {
        severity: SecuritySeverity.CRITICAL,
        details: {
          filePath,
          secretType,
          ...details,
        },
        stackTrace: true,
      }
    );

    this.eventLogger.addStackTraceIfNeeded(event, { stackTrace: true });
    this.eventLogger.addToBuffer(event);
  }

  async logEncryption(
    operation: 'encrypt' | 'decrypt',
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    const type = success
      ? operation === 'encrypt'
        ? SecurityEventType.ENCRYPTION_SUCCESS
        : SecurityEventType.DECRYPTION_SUCCESS
      : operation === 'encrypt'
        ? SecurityEventType.ENCRYPTION_FAILURE
        : SecurityEventType.DECRYPTION_FAILURE;

    const severity = success
      ? SecuritySeverity.INFO
      : operation === 'decrypt'
        ? SecuritySeverity.ERROR
        : SecuritySeverity.CRITICAL;
    const message = `${operation} operation ${success ? 'succeeded' : 'failed'}`;

    const event = this.eventLogger.createSecurityEvent(type, message, {
      severity,
      details: {
        operation,
        success,
        ...details,
      },
      stackTrace: !success,
    });

    this.eventLogger.addStackTraceIfNeeded(event, { stackTrace: !success });
    this.eventLogger.addToBuffer(event);
  }

  async logLockOperation(options: {
    operation: 'acquire' | 'release';
    lockId: string;
    success: boolean;
    timeout?: boolean;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const { operation, lockId, success, timeout, details } = options;
    const type = this.getLockEventType(operation, success, timeout);
    const severity = this.getLockSeverity(success, timeout);
    const message = this.getLockMessage(operation, lockId, success, timeout);

    const event = this.eventLogger.createSecurityEvent(type, message, {
      severity,
      details: {
        operation,
        lockId,
        success,
        timeout: Boolean(timeout),
        ...details,
      },
      stackTrace: !success || Boolean(timeout),
    });

    this.eventLogger.addStackTraceIfNeeded(event, {
      stackTrace: !success || Boolean(timeout),
    });
    this.eventLogger.addToBuffer(event);
  }

  async logSuspiciousActivity(
    activity: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const event = this.eventLogger.createSecurityEvent(
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      activity,
      {
        severity: SecuritySeverity.WARNING,
        details: {
          activity,
          ...details,
        },
        stackTrace: true,
      }
    );

    this.eventLogger.addStackTraceIfNeeded(event, { stackTrace: true });
    this.eventLogger.addToBuffer(event);
  }

  private getStateAccessEventType(
    operation: 'read' | 'write' | 'delete'
  ): SecurityEventType {
    switch (operation) {
      case 'read':
        return SecurityEventType.STATE_READ;
      case 'write':
        return SecurityEventType.STATE_WRITE;
      case 'delete':
        return SecurityEventType.STATE_DELETE;
    }
  }

  private getLockEventType(
    operation: 'acquire' | 'release',
    success: boolean,
    timeout?: boolean
  ): SecurityEventType {
    if (Boolean(timeout)) {
      return SecurityEventType.LOCK_TIMEOUT;
    }

    if (operation === 'acquire') {
      return success
        ? SecurityEventType.LOCK_ACQUIRED
        : SecurityEventType.LOCK_DENIED;
    }

    return SecurityEventType.LOCK_ACQUIRED; // Release operations use same type
  }

  private getLockSeverity(
    success: boolean,
    timeout?: boolean
  ): SecuritySeverity {
    if (Boolean(timeout)) return SecuritySeverity.WARNING;
    return success ? SecuritySeverity.INFO : SecuritySeverity.WARNING;
  }

  private getLockMessage(
    operation: 'acquire' | 'release',
    lockId: string,
    success: boolean,
    timeout?: boolean
  ): string {
    if (Boolean(timeout)) {
      return `Lock ${operation} timeout for ${lockId}`;
    }

    const status = success ? 'succeeded' : 'failed';
    return `Lock ${operation} ${status} for ${lockId}`;
  }
}
