import type {
  StartupPhase,
  StartupProfilerConfig,
  TargetAnalysis,
} from '../types/StartupProfilerTypes.js';

export class StartupTargetAnalyzer {
  static analyzeTargets(
    phases: Map<string, StartupPhase>,
    config: StartupProfilerConfig,
    totalDuration: number
  ): TargetAnalysis {
    const initPhase = phases.get('framework_init');
    const renderPhase = phases.get('render') ?? phases.get('initial_render');

    return {
      totalStartupTime: this.createMetric(
        totalDuration,
        config.target.totalStartupTime
      ),
      initializationTime: this.createMetric(
        initPhase?.duration ?? 0,
        config.target.initializationTime
      ),
      renderTime: this.createMetric(
        renderPhase?.duration ?? 0,
        config.target.renderTime
      ),
    };
  }

  private static createMetric(actual: number, target: number) {
    return {
      actual,
      target,
      met: actual <= target,
      percentage: (actual / target) * 100,
    };
  }

  static meetsAllTargets(analysis: TargetAnalysis): boolean {
    return (
      analysis.totalStartupTime.met &&
      analysis.initializationTime.met &&
      analysis.renderTime.met
    );
  }

  static generateTargetWarnings(analysis: TargetAnalysis): string[] {
    const warnings: string[] = [];

    if (!analysis.totalStartupTime.met) {
      warnings.push(
        `Total startup time exceeded target by ${analysis.totalStartupTime.percentage - 100}%`
      );
    }

    if (!analysis.initializationTime.met) {
      warnings.push(
        `Initialization time exceeded target by ${analysis.initializationTime.percentage - 100}%`
      );
    }

    if (!analysis.renderTime.met) {
      warnings.push(
        `Render time exceeded target by ${analysis.renderTime.percentage - 100}%`
      );
    }

    return warnings;
  }
}
