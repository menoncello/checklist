import type { SlowOperationReport } from '../SlowOperationDetector';

export interface OperationStats {
  count: number;
  totalTime: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
}

export class SlowOperationStats {
  static getOperationStats(
    reports: SlowOperationReport[],
    name?: string
  ): OperationStats {
    const relevantReports =
      name != null ? reports.filter((r) => r.name === name) : reports;

    if (relevantReports.length === 0) {
      return {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        maxTime: 0,
        minTime: 0,
      };
    }

    const durations = relevantReports.map((r) => r.duration);

    return {
      count: relevantReports.length,
      totalTime: durations.reduce((a, b) => a + b, 0),
      averageTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxTime: Math.max(...durations),
      minTime: Math.min(...durations),
    };
  }

  static getSlowestOperations(
    reports: SlowOperationReport[],
    count: number = 10
  ): SlowOperationReport[] {
    return [...reports].sort((a, b) => b.duration - a.duration).slice(0, count);
  }
}
