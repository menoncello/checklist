import { SecurityEventType, SecuritySeverity } from './SecurityAudit';

/**
 * Helper for determining security event severity
 */
export class SecuritySeverityHelper {
  private static readonly CRITICAL_EVENTS = new Set([
    SecurityEventType.SECRETS_DETECTED,
    SecurityEventType.ENCRYPTION_FAILURE,
    SecurityEventType.DECRYPTION_FAILURE,
  ]);

  private static readonly WARNING_EVENTS = new Set([
    SecurityEventType.ACCESS_DENIED,
    SecurityEventType.LOCK_DENIED,
    SecurityEventType.LOCK_TIMEOUT,
    SecurityEventType.SUSPICIOUS_ACTIVITY,
    SecurityEventType.RECOVERY_ATTEMPT,
  ]);

  private static readonly ERROR_EVENTS = new Set([
    SecurityEventType.PERMISSION_CHANGE,
  ]);

  /**
   * Get default severity for an event type
   */
  static getDefaultSeverity(eventType: SecurityEventType): SecuritySeverity {
    if (this.CRITICAL_EVENTS.has(eventType)) {
      return SecuritySeverity.CRITICAL;
    }

    if (this.WARNING_EVENTS.has(eventType)) {
      return SecuritySeverity.WARNING;
    }

    if (this.ERROR_EVENTS.has(eventType)) {
      return SecuritySeverity.ERROR;
    }

    return SecuritySeverity.INFO;
  }
}
