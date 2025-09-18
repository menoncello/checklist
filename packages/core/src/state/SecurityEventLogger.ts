/**
 * Security event creation and basic logging functionality
 */

import {
  SecurityEventType,
  SecuritySeverity,
  SecurityEvent,
} from './SecurityAudit';

export class SecurityEventLogger {
  private buffer: SecurityEvent[] = [];

  createSecurityEvent(
    type: SecurityEventType,
    message: string,
    options: {
      severity?: SecuritySeverity;
      details?: Record<string, unknown>;
      stackTrace?: boolean;
    } = {}
  ): SecurityEvent {
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      type,
      severity: options.severity ?? this.getDefaultSeverity(type),
      message,
      details: options.details,
      user: this.getCurrentUser(),
      pid: process.pid,
      hostname: process.env.HOSTNAME,
    };

    return event;
  }

  addStackTraceIfNeeded(
    event: SecurityEvent,
    options: { stackTrace?: boolean }
  ): void {
    if (this.shouldIncludeStackTrace(event, options)) {
      const stack = new Error().stack;
      if (this.isValidStack(stack)) {
        event.stackTrace = stack;
      }
    }
  }

  addToBuffer(event: SecurityEvent): void {
    this.buffer.push(event);
  }

  getBuffer(): SecurityEvent[] {
    return [...this.buffer];
  }

  clearBuffer(): void {
    this.buffer.length = 0;
  }

  shouldFlushImmediately(event: SecurityEvent): boolean {
    return (
      event.severity === SecuritySeverity.CRITICAL ||
      event.severity === SecuritySeverity.ERROR
    );
  }

  private getCurrentUser(): string {
    return process.env.USER ?? process.env.USERNAME ?? 'unknown';
  }

  private shouldIncludeStackTrace(
    event: SecurityEvent,
    options: { stackTrace?: boolean }
  ): boolean {
    return Boolean(
      options.stackTrace === true ||
        event.severity === SecuritySeverity.CRITICAL ||
        event.severity === SecuritySeverity.ERROR
    );
  }

  private isValidStack(stack: string | undefined): boolean {
    return Boolean(stack?.includes('at '));
  }

  private getDefaultSeverity(type: SecurityEventType): SecuritySeverity {
    // Use a lookup map for better complexity - aligned with SecurityAudit.getDefaultSeverity
    const severityMap: Record<SecurityEventType, SecuritySeverity> = {
      [SecurityEventType.ACCESS_GRANTED]: SecuritySeverity.INFO,
      [SecurityEventType.ACCESS_DENIED]: SecuritySeverity.WARNING,
      [SecurityEventType.STATE_READ]: SecuritySeverity.INFO,
      [SecurityEventType.STATE_WRITE]: SecuritySeverity.INFO,
      [SecurityEventType.STATE_DELETE]: SecuritySeverity.INFO,
      [SecurityEventType.SECRETS_DETECTED]: SecuritySeverity.CRITICAL,
      [SecurityEventType.ENCRYPTION_SUCCESS]: SecuritySeverity.INFO,
      [SecurityEventType.ENCRYPTION_FAILURE]: SecuritySeverity.CRITICAL,
      [SecurityEventType.DECRYPTION_SUCCESS]: SecuritySeverity.INFO,
      [SecurityEventType.DECRYPTION_FAILURE]: SecuritySeverity.CRITICAL,
      [SecurityEventType.KEY_ROTATION]: SecuritySeverity.INFO,
      [SecurityEventType.LOCK_ACQUIRED]: SecuritySeverity.INFO,
      [SecurityEventType.LOCK_DENIED]: SecuritySeverity.WARNING,
      [SecurityEventType.LOCK_TIMEOUT]: SecuritySeverity.WARNING,
      [SecurityEventType.PERMISSION_CHANGE]: SecuritySeverity.ERROR,
      [SecurityEventType.SUSPICIOUS_ACTIVITY]: SecuritySeverity.WARNING,
      [SecurityEventType.BACKUP_CREATED]: SecuritySeverity.INFO,
      [SecurityEventType.RECOVERY_ATTEMPT]: SecuritySeverity.WARNING,
    };

    return severityMap[type] ?? SecuritySeverity.INFO;
  }
}
