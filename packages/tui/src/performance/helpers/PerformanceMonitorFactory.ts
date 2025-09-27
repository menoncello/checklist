import { MetricsBuffer } from '../MetricsBuffer';
import { PerformanceBudget } from '../PerformanceBudget';
import type { PerformanceMonitorConfig } from '../PerformanceMonitorConfig';
import { SlowOperationDetector } from '../SlowOperationDetector';
import { AlertManager } from './AlertManager';
import { BenchmarkManager } from './BenchmarkManager';
import { BudgetOperations } from './BudgetOperations';
import { MetricsTracker } from './MetricsTracker';
import {
  AlertDelegates,
  BenchmarkDelegates,
  MetricsDelegates,
  SystemDelegates,
} from './PerformanceDelegates';
import { ReportGenerator } from './ReportGenerator';
import { SystemProfiler } from './SystemProfiler';

export interface PerformanceMonitorComponents {
  metricsTracker: MetricsTracker;
  metricsBuffer: MetricsBuffer;
  benchmarkManager: BenchmarkManager;
  alertManager: AlertManager;
  systemProfiler: SystemProfiler;
  performanceBudget: PerformanceBudget;
  slowOperationDetector: SlowOperationDetector;
  metricsDelegates: MetricsDelegates;
  benchmarkDelegates: BenchmarkDelegates;
  alertDelegates: AlertDelegates;
  systemDelegates: SystemDelegates;
  reportGenerator: ReportGenerator;
  budgetOperations: BudgetOperations;
}

export class PerformanceMonitorFactory {
  static createComponents(
    config: PerformanceMonitorConfig,
    handleSystemMetric: (
      name: string,
      value: number,
      metadata?: Record<string, unknown>
    ) => void
  ): PerformanceMonitorComponents {
    const coreComponents = this.createCoreComponents(
      config,
      handleSystemMetric
    );
    const helperComponents = this.createHelperComponents(coreComponents);

    return { ...coreComponents, ...helperComponents };
  }

  private static createCoreComponents(
    config: PerformanceMonitorConfig,
    handleSystemMetric: (
      name: string,
      value: number,
      metadata?: Record<string, unknown>
    ) => void
  ) {
    return {
      metricsTracker: new MetricsTracker(config.metricsBufferSize),
      metricsBuffer: new MetricsBuffer({
        capacity: config.metricsBufferSize,
        maxAge: 300000, // 5 minutes
        cleanupInterval: 60000, // 1 minute
      }),
      benchmarkManager: new BenchmarkManager(config.benchmarksBufferSize),
      alertManager: new AlertManager(config.alertsBufferSize),
      systemProfiler: new SystemProfiler(
        config.samplingInterval,
        handleSystemMetric
      ),
      performanceBudget: new PerformanceBudget(),
      slowOperationDetector: new SlowOperationDetector(),
    };
  }

  private static createHelperComponents(
    coreComponents: ReturnType<typeof this.createCoreComponents>
  ) {
    return {
      metricsDelegates: new MetricsDelegates(coreComponents.metricsTracker),
      benchmarkDelegates: new BenchmarkDelegates(
        coreComponents.benchmarkManager
      ),
      alertDelegates: new AlertDelegates(coreComponents.alertManager),
      systemDelegates: new SystemDelegates(coreComponents.systemProfiler),
      reportGenerator: new ReportGenerator(
        coreComponents.metricsTracker,
        coreComponents.benchmarkManager,
        coreComponents.alertManager,
        coreComponents.systemProfiler
      ),
      budgetOperations: new BudgetOperations(
        coreComponents.performanceBudget,
        coreComponents.slowOperationDetector
      ),
    };
  }
}
