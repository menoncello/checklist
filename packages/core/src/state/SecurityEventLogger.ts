/**
 * Security event creation and basic logging functionality
 */

import { SecurityEventType, SecuritySeverity, SecurityEvent } from './SecurityAudit';

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

  addStackTraceIfNeeded(event: SecurityEvent, options: { stackTrace?: boolean }): void {
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
    // Use a lookup map for better complexity
    const severityMap: Record<SecurityEventType, SecuritySeverity> = {
      [SecurityEventType.ACCESS_DENIED]: SecuritySeverity.ERROR,
      [SecurityEventType.ENCRYPTION_FAILURE]: SecuritySeverity.ERROR,
      [SecurityEventType.DECRYPTION_FAILURE]: SecuritySeverity.ERROR,
      [SecurityEventType.LOCK_DENIED]: SecuritySeverity.ERROR,
      [SecurityEventType.LOCK_TIMEOUT]: SecuritySeverity.ERROR,
      [SecurityEventType.SUSPICIOUS_ACTIVITY]: SecuritySeverity.CRITICAL,
      [SecurityEventType.SECRETS_DETECTED]: SecuritySeverity.CRITICAL,
      [SecurityEventType.PERMISSION_CHANGE]: SecuritySeverity.WARNING,
      [SecurityEventType.KEY_ROTATION]: SecuritySeverity.WARNING,
      [SecurityEventType.RECOVERY_ATTEMPT]: SecuritySeverity.WARNING,
    };

    return severityMap[type] ?? SecuritySeverity.INFO;
  }
}