import type { RegressionResult } from '../RegressionDetector';

export class RegressionReportGenerator {
  generateRegressionReport(regressions: RegressionResult[]): string {
    if (regressions.length === 0) {
      return '✅ No performance regressions detected.';
    }

    const groupedRegressions = this.groupRegressionsBySeverity(regressions);
    const lines = ['🚨 Performance Regression Report\n'];

    lines.push(this.createRegressionSummary(groupedRegressions));
    lines.push(...this.createRegressionDetails(groupedRegressions));

    return lines.join('\n');
  }

  private groupRegressionsBySeverity(regressions: RegressionResult[]): {
    critical: RegressionResult[];
    major: RegressionResult[];
    moderate: RegressionResult[];
    minor: RegressionResult[];
  } {
    return {
      critical: regressions.filter((r) => r.severity === 'critical'),
      major: regressions.filter((r) => r.severity === 'major'),
      moderate: regressions.filter((r) => r.severity === 'moderate'),
      minor: regressions.filter((r) => r.severity === 'minor'),
    };
  }

  private createRegressionSummary(grouped: {
    critical: RegressionResult[];
    major: RegressionResult[];
    moderate: RegressionResult[];
    minor: RegressionResult[];
  }): string {
    return `Summary: ${grouped.critical.length} critical, ${grouped.major.length} major, ${grouped.moderate.length} moderate, ${grouped.minor.length} minor\n`;
  }

  private createRegressionDetails(grouped: {
    critical: RegressionResult[];
    major: RegressionResult[];
    moderate: RegressionResult[];
    minor: RegressionResult[];
  }): string[] {
    const lines: string[] = [];

    const severityConfigs = [
      { severity: 'critical', items: grouped.critical, emoji: '🔴' },
      { severity: 'major', items: grouped.major, emoji: '🟠' },
      { severity: 'moderate', items: grouped.moderate, emoji: '🟡' },
      { severity: 'minor', items: grouped.minor, emoji: '🟢' },
    ];

    severityConfigs.forEach(({ severity, items, emoji }) => {
      if (items.length > 0) {
        lines.push(`${emoji} ${severity.toUpperCase()} Regressions:`);
        lines.push(...this.formatRegressionItems(items));
        lines.push('');
      }
    });

    return lines;
  }

  private formatRegressionItems(items: RegressionResult[]): string[] {
    const lines: string[] = [];
    items.forEach((item) => {
      lines.push(
        `  • ${item.operation}: +${item.changePercent.toFixed(1)}% (${item.confidence.toFixed(2)} confidence)`
      );
      lines.push(`    ${item.recommendation}`);
    });
    return lines;
  }
}
