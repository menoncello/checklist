export interface VisualTestScenario {
  name: string;
  description: string;
  content: string;
  renderModes: ('normal' | 'ascii' | 'monochrome' | 'minimal')[];
  expectedWidth?: number;
  expectedHeight?: number;
}

export interface VisualTestResult {
  scenario: VisualTestScenario;
  terminal: string;
  renderMode: string;
  output: string;
  screenshot?: string;
  dimensions: { width: number; height: number };
  metrics: {
    renderTime: number;
    characterCount: number;
    lineCount: number;
    ansiSequenceCount: number;
  };
  differences?: {
    baseline?: string;
    diff?: string;
    similarityScore: number;
    hasRegressions: boolean;
  };
  passed: boolean;
  errors?: string[];
}

export class VisualTestManager {
  private scenarios: VisualTestScenario[] = [];
  private results: VisualTestResult[] = [];

  public addScenario(scenario: VisualTestScenario): void {
    this.scenarios.push(scenario);
  }

  public getScenarios(): VisualTestScenario[] {
    return [...this.scenarios];
  }

  public addResult(result: VisualTestResult): void {
    this.results.push(result);
  }

  public getResults(): VisualTestResult[] {
    return [...this.results];
  }

  public clearResults(): void {
    this.results = [];
  }

  public generateReport(): {
    totalTests: number;
    passed: number;
    failed: number;
    regressions: number;
  } {
    const totalTests = this.results.length;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = totalTests - passed;
    const regressions = this.results.filter(
      (r) => r.differences?.hasRegressions === true
    ).length;

    return { totalTests, passed, failed, regressions };
  }
}
