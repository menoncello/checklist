import type { SlowOperationReport } from '../SlowOperationDetector';

export class SlowOperationFormatter {
  static formatReport(report: SlowOperationReport): string {
    const lines = [
      `Slow Operation: ${report.name}`,
      `Duration: ${report.duration.toFixed(2)}ms (threshold: ${report.threshold}ms)`,
      `Time: ${new Date(report.timestamp).toISOString()}`,
    ];

    if (report.context != null) {
      lines.push(`Context: ${JSON.stringify(report.context, null, 2)}`);
    }

    if (report.stackTrace) {
      lines.push('Stack Trace:', report.stackTrace);
    }

    return lines.join('\n');
  }
}
