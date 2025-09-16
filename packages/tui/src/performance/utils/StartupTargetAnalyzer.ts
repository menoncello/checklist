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
      totalStartupTime: {
        actual: totalDuration,
        target: config.target.totalStartupTime,
        met: totalDuration <= config.target.totalStartupTime,
        percentage: (totalDuration / config.target.totalStartupTime) * 100,
      },
      initializationTime: {
        actual: initPhase?.duration ?? 0,
        target: config.target.initializationTime,
        met: (initPhase?.duration ?? 0) <= config.target.initializationTime,
        percentage:
          ((initPhase?.duration ?? 0) / config.target.initializationTime) * 100,
      },
      renderTime: {
        actual: renderPhase?.duration ?? 0,
        target: config.target.renderTime,
        met: (renderPhase?.duration ?? 0) <= config.target.renderTime,
        percentage:
          ((renderPhase?.duration ?? 0) / config.target.renderTime) * 100,
      },
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
