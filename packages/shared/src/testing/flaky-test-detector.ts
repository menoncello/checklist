import { afterEach, beforeEach } from 'bun:test';

interface TestRun {
  name: string;
  duration: number;
  passed: boolean;
  timestamp: number;
}

interface FlakyTestReport {
  name: string;
  totalRuns: number;
  failures: number;
  averageDuration: number;
  varianceDuration: number;
  flakinessScore: number;
}

export class FlakyTestDetector {
  private testRuns: Map<string, TestRun[]> = new Map();
  private currentTest: string | null = null;
  private startTime: number = 0;

  constructor(private readonly threshold: number = 0.1) {}

  startTest(name: string): void {
    this.currentTest = name;
    this.startTime = performance.now();
  }

  endTest(passed: boolean): void {
    if (this.currentTest === null) return;

    const duration = performance.now() - this.startTime;
    const runs = this.testRuns.get(this.currentTest) ?? [];

    runs.push({
      name: this.currentTest,
      duration,
      passed,
      timestamp: Date.now(),
    });

    this.testRuns.set(this.currentTest, runs);
    this.currentTest = null;
  }

  analyze(): FlakyTestReport[] {
    const reports: FlakyTestReport[] = [];

    for (const [name, runs] of this.testRuns.entries()) {
      if (runs.length < 2) continue;

      const failures = runs.filter((r) => !r.passed).length;
      const durations = runs.map((r) => r.duration);
      const averageDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length;

      const variance =
        durations.reduce((sum, duration) => {
          return sum + Math.pow(duration - averageDuration, 2);
        }, 0) / durations.length;

      const flakinessScore = this.calculateFlakinessScore(
        failures,
        runs.length,
        variance
      );

      reports.push({
        name,
        totalRuns: runs.length,
        failures,
        averageDuration,
        varianceDuration: variance,
        flakinessScore,
      });
    }

    return reports.sort((a, b) => b.flakinessScore - a.flakinessScore);
  }

  private calculateFlakinessScore(
    failures: number,
    totalRuns: number,
    variance: number
  ): number {
    const failureRate = failures / totalRuns;
    const inconsistencyRate = failureRate > 0 && failureRate < 1 ? 1 : 0;
    const varianceScore = Math.min(variance / 1000, 1);

    return failureRate * 0.5 + inconsistencyRate * 0.3 + varianceScore * 0.2;
  }

  detectFlaky(): string[] {
    const reports = this.analyze();
    return reports
      .filter((r) => r.flakinessScore > this.threshold)
      .map((r) => r.name);
  }

  reset(): void {
    this.testRuns.clear();
    this.currentTest = null;
    this.startTime = 0;
  }

  install(): void {
    beforeEach(() => {
      const testName = (global as any).currentTestName ?? 'unknown';
      this.startTest(testName);
    });

    afterEach(() => {
      const passed = (global as any).currentTestFailed !== true;
      this.endTest(passed);
    });
  }

  getReport(): string {
    const reports = this.analyze();
    if (reports.length === 0) {
      return 'No flaky tests detected.';
    }

    const lines = ['Flaky Test Report:', '=================='];

    for (const report of reports) {
      if (report.flakinessScore > this.threshold) {
        lines.push('');
        lines.push(`Test: ${report.name}`);
        lines.push(`  Runs: ${report.totalRuns}`);
        lines.push(`  Failures: ${report.failures}`);
        lines.push(`  Avg Duration: ${report.averageDuration.toFixed(2)}ms`);
        lines.push(`  Variance: ${report.varianceDuration.toFixed(2)}`);
        lines.push(
          `  Flakiness Score: ${(report.flakinessScore * 100).toFixed(1)}%`
        );
      }
    }

    return lines.join('\n');
  }
}
