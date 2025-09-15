import type { RegressionResult } from '../RegressionDetector';

export class RegressionClassifier {
  determineSeverity(
    changePercent: number,
    confidence: number
  ): RegressionResult['severity'] {
    if (confidence < 0.5) return 'minor';

    if (changePercent >= 100) return 'critical';
    if (changePercent >= 50) return 'major';
    if (changePercent >= 25) return 'moderate';
    return 'minor';
  }

  generateRecommendation(
    severity: RegressionResult['severity'],
    changePercent: number,
    operation: string
  ): string {
    switch (severity) {
      case 'critical':
        return `URGENT: ${operation} is ${changePercent.toFixed(1)}% slower. Immediate investigation required. Consider rollback if affecting users.`;
      case 'major':
        return `HIGH PRIORITY: ${operation} shows significant performance degradation (${changePercent.toFixed(1)}%). Profile the operation to identify bottlenecks.`;
      case 'moderate':
        return `MEDIUM PRIORITY: ${operation} performance declined by ${changePercent.toFixed(1)}%. Review recent changes and optimize if possible.`;
      case 'minor':
        return `LOW PRIORITY: Minor regression in ${operation} (${changePercent.toFixed(1)}%). Monitor for continued degradation.`;
    }
  }

  sortRegressionResults(results: RegressionResult[]): RegressionResult[] {
    return results.sort((a, b) => b.changePercent - a.changePercent);
  }
}
