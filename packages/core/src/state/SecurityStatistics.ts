/**
 * Security audit statistics calculation and reporting
 */

import { SecurityEvent, SecurityEventType, SecuritySeverity } from './SecurityAudit';

export class SecurityStatistics {
  calculateStatistics(logs: SecurityEvent[]): {
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
  } {
    const stats = this.initializeStats(logs.length);

    for (const log of logs) {
      this.updateTypeStats(stats, log);
      this.updateSeverityStats(stats, log);
      this.updateSpecialCounters(stats, log);
    }

    stats.mostCommonEventType = this.findMostCommon(stats.eventsByType);
    stats.mostCommonSeverity = this.findMostCommon(stats.eventsBySeverity);

    return stats;
  }

  private initializeStats(totalEvents: number) {
    return {
      totalEvents,
      eventsByType: {} as Record<string, number>,
      eventsBySeverity: {} as Record<string, number>,
      criticalEvents: 0,
      errorEvents: 0,
      suspiciousActivityCount: 0,
      failedAccessAttempts: 0,
      encryptionFailures: 0,
      lockTimeouts: 0,
      mostCommonEventType: 'N/A',
      mostCommonSeverity: 'N/A',
    };
  }

  private updateTypeStats(
    stats: ReturnType<typeof SecurityStatistics.prototype.initializeStats>,
    log: SecurityEvent
  ): void {
    stats.eventsByType[log.type] = (stats.eventsByType[log.type] ?? 0) + 1;
  }

  private updateSeverityStats(
    stats: ReturnType<typeof SecurityStatistics.prototype.initializeStats>,
    log: SecurityEvent
  ): void {
    stats.eventsBySeverity[log.severity] = (stats.eventsBySeverity[log.severity] ?? 0) + 1;
  }

  private updateSpecialCounters(
    stats: ReturnType<typeof SecurityStatistics.prototype.initializeStats>,
    log: SecurityEvent
  ): void {
    if (log.severity === SecuritySeverity.CRITICAL) stats.criticalEvents++;
    if (log.severity === SecuritySeverity.ERROR) stats.errorEvents++;
    if (log.type === SecurityEventType.SUSPICIOUS_ACTIVITY) stats.suspiciousActivityCount++;
    if (this.isFailedOperation(log.type)) stats.failedAccessAttempts++;
    if (log.type === SecurityEventType.ENCRYPTION_FAILURE) stats.encryptionFailures++;
    if (log.type === SecurityEventType.LOCK_TIMEOUT) stats.lockTimeouts++;
  }

  private isFailedOperation(type: SecurityEventType): boolean {
    return [
      SecurityEventType.ACCESS_DENIED,
      SecurityEventType.ENCRYPTION_FAILURE,
      SecurityEventType.DECRYPTION_FAILURE,
      SecurityEventType.LOCK_DENIED,
    ].includes(type);
  }

  private findMostCommon(stats: Record<string, number>): string {
    const entries = Object.entries(stats);
    if (entries.length === 0) return 'N/A';

    return entries.reduce((max, current) =>
      current[1] > max[1] ? current : max
    )[0];
  }
}