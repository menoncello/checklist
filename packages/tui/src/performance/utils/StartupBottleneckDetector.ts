import type {
  StartupPhase,
  BottleneckInfo,
  PhaseStatistics,
} from '../types/StartupProfilerTypes.js';

export class StartupBottleneckDetector {
  static calculatePhaseStatistics(
    phases: Map<string, StartupPhase>
  ): PhaseStatistics {
    const validPhases = this.getValidPhases(phases);

    if (validPhases.length === 0) {
      return this.emptyStatistics();
    }

    const totalDuration = this.calculateTotalDuration(validPhases);
    const averageDuration = totalDuration / validPhases.length;

    return {
      longestPhase: this.findLongestPhase(validPhases),
      shortestPhase: this.findShortestPhase(validPhases),
      averageDuration,
      totalPhases: validPhases.length,
      averagePhaseTime: averageDuration, // Alias for backward compatibility
      totalPhaseTime: totalDuration,
    };
  }

  private static getValidPhases(
    phases: Map<string, StartupPhase>
  ): StartupPhase[] {
    return Array.from(phases.values()).filter(
      (phase) => phase.duration != null && phase.duration > 0
    );
  }

  private static emptyStatistics(): PhaseStatistics {
    return {
      longestPhase: null,
      shortestPhase: null,
      averageDuration: 0,
      totalPhases: 0,
      averagePhaseTime: 0,
      totalPhaseTime: 0,
    };
  }

  private static calculateTotalDuration(phases: StartupPhase[]): number {
    return phases.reduce((sum, phase) => sum + (phase.duration ?? 0), 0);
  }

  private static findLongestPhase(phases: StartupPhase[]): StartupPhase {
    return phases.reduce((longest, current) =>
      (current.duration ?? 0) > (longest.duration ?? 0) ? current : longest
    );
  }

  private static findShortestPhase(phases: StartupPhase[]): StartupPhase {
    return phases.reduce((shortest, current) =>
      (current.duration ?? 0) < (shortest.duration ?? 0) ? current : shortest
    );
  }

  static detectBottlenecks(
    phases: Map<string, StartupPhase>,
    statistics: PhaseStatistics
  ): BottleneckInfo[] {
    const validPhases = Array.from(phases.values()).filter(
      (phase) => phase.duration != null
    );

    if (validPhases.length === 0) {
      return [];
    }

    const ratioBottlenecks = this.detectRatioBottlenecks(
      validPhases,
      statistics
    );
    const thresholdBottlenecks = this.detectThresholdBottlenecks(validPhases);

    return [...ratioBottlenecks, ...thresholdBottlenecks];
  }

  private static detectRatioBottlenecks(
    phases: StartupPhase[],
    statistics: PhaseStatistics
  ): BottleneckInfo[] {
    const bottlenecks: BottleneckInfo[] = [];

    for (const phase of phases) {
      const duration = phase.duration ?? 0;
      const ratio = duration / statistics.averageDuration;

      if (ratio > 2) {
        bottlenecks.push(
          this.createBottleneck(
            phase,
            ratio,
            'high',
            `Optimize ${phase.name} - consider breaking into smaller phases`
          )
        );
      } else if (ratio > 1.5) {
        bottlenecks.push(
          this.createBottleneck(
            phase,
            ratio,
            'medium',
            `Review ${phase.name} for potential optimizations`
          )
        );
      }
    }

    return bottlenecks;
  }

  private static detectThresholdBottlenecks(
    phases: StartupPhase[]
  ): BottleneckInfo[] {
    const bottlenecks: BottleneckInfo[] = [];
    const criticalThreshold = 20;

    for (const phase of phases) {
      const duration = phase.duration ?? 0;
      if (duration > criticalThreshold) {
        bottlenecks.push({
          phase,
          reason: `Phase exceeds critical threshold of ${criticalThreshold}ms`,
          severity: 'high',
          recommendation: `Critical: ${phase.name} must be optimized`,
          impact: 'high',
          percentage: (duration / criticalThreshold) * 100,
        });
      }
    }

    return bottlenecks;
  }

  private static createBottleneck(
    phase: StartupPhase,
    ratio: number,
    severity: 'high' | 'medium',
    recommendation: string
  ): BottleneckInfo {
    return {
      phase,
      reason: `Phase duration is ${ratio.toFixed(1)}x longer than average`,
      severity,
      recommendation,
      impact: severity,
      percentage: ratio * 100,
    };
  }

  static calculatePerformanceScore(
    totalDuration: number,
    targetDuration: number,
    bottlenecks: BottleneckInfo[]
  ): number {
    let score = 100;

    // Penalize for exceeding target
    if (totalDuration > targetDuration) {
      const overageRatio = totalDuration / targetDuration;
      score -= (overageRatio - 1) * 50;
    }

    // Penalize for bottlenecks
    for (const bottleneck of bottlenecks) {
      switch (bottleneck.severity) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }
}
