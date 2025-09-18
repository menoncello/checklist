import { PerformanceManager } from '../performance';
import { DebugManager } from './DebugManager';

export class PerformanceIntegrationSetup {
  public static setupMetricRecording(
    performanceManager: PerformanceManager,
    debugManager: DebugManager
  ): void {
    performanceManager.addPerformanceListener(
      'metricRecorded',
      (data: unknown) => {
        const metricData = extractMetricData(data);
        if (metricData != null) {
          debugManager.log(
            'debug',
            'Performance',
            `Metric recorded: ${metricData.metric.name}`,
            { value: metricData.metric.value, tags: metricData.metric.tags }
          );
        }
      }
    );
  }

  public static setupAlerts(
    performanceManager: PerformanceManager,
    debugManager: DebugManager
  ): void {
    this.setupPerformanceAlert(performanceManager, debugManager);
    this.setupMemoryAlert(performanceManager, debugManager);
    this.setupMemoryLeakAlert(performanceManager, debugManager);
  }

  private static setupPerformanceAlert(
    pm: PerformanceManager,
    dm: DebugManager
  ): void {
    pm.addPerformanceListener('performanceAlert', (data: unknown) => {
      const alertData = extractAlertData(data);
      if (alertData != null) {
        dm.log(
          'warn',
          'Performance',
          `Performance alert: ${alertData.metric} ${alertData.condition} threshold`,
          { value: alertData.value, threshold: alertData.threshold }
        );
      }
    });
  }

  private static setupMemoryAlert(
    pm: PerformanceManager,
    dm: DebugManager
  ): void {
    pm.addPerformanceListener('memoryAlert', (data: unknown) => {
      const memoryData = extractMemoryAlertData(data);
      if (memoryData != null) {
        dm.log(
          'warn',
          'Memory',
          `Memory usage: ${(memoryData.used / 1024 / 1024).toFixed(2)}MB`,
          { total: memoryData.total, percentage: memoryData.percentage }
        );
      }
    });
  }

  private static setupMemoryLeakAlert(
    pm: PerformanceManager,
    dm: DebugManager
  ): void {
    pm.addPerformanceListener('memoryLeak', (data: unknown) => {
      const leakData = extractMemoryLeakData(data);
      if (leakData != null) {
        dm.log('error', 'Memory', 'Potential memory leak detected', {
          growth: leakData.growth,
          duration: leakData.duration,
        });
      }
    });
  }

  public static setupMetricsInterval(
    performanceManager: PerformanceManager,
    debugManager: DebugManager,
    interval: number = 10000
  ): NodeJS.Timer {
    return setInterval(() => {
      const _report = performanceManager.getPerformanceReport();
      // Note: getMetrics() only gets current metrics, not sets them
      // We would need to add a method to update debug metrics
      const _currentMetrics = debugManager.getMetrics();
      // For now, just trigger a performance report generation
    }, interval);
  }
}

export class ConsoleIntegrationSetup {
  private static originalMethods = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  public static setup(debugManager: DebugManager): void {
    console.log = (...args) => {
      this.originalMethods.log.apply(console, args);
      debugManager.log('info', 'Console', args.join(' '));
    };

    console.error = (...args) => {
      this.originalMethods.error.apply(console, args);
      debugManager.log('error', 'Console', args.join(' '));
    };

    console.warn = (...args) => {
      this.originalMethods.warn.apply(console, args);
      debugManager.log('warn', 'Console', args.join(' '));
    };

    console.info = (...args) => {
      this.originalMethods.info.apply(console, args);
      debugManager.log('info', 'Console', args.join(' '));
    };

    console.debug = (...args) => {
      this.originalMethods.debug.apply(console, args);
      debugManager.log('debug', 'Console', args.join(' '));
    };
  }

  public static restore(): void {
    console.log = this.originalMethods.log;
    console.error = this.originalMethods.error;
    console.warn = this.originalMethods.warn;
    console.info = this.originalMethods.info;
    console.debug = this.originalMethods.debug;
  }
}

// Helper functions for data extraction
function extractMetricData(data: unknown): {
  metric: { name: string; value: number; tags?: Record<string, unknown> };
} | null {
  if (data != null && typeof data === 'object' && 'metric' in data) {
    const d = data as { metric: unknown };
    if (
      d.metric != null &&
      typeof d.metric === 'object' &&
      'name' in d.metric
    ) {
      return data as {
        metric: { name: string; value: number; tags?: Record<string, unknown> };
      };
    }
  }
  return null;
}

function extractAlertData(data: unknown): {
  metric: string;
  condition: string;
  value: number;
  threshold: number;
} | null {
  if (
    data != null &&
    typeof data === 'object' &&
    'metric' in data &&
    'value' in data
  ) {
    const d = data as {
      metric: unknown;
      value: unknown;
      condition?: unknown;
      threshold?: unknown;
    };
    if (typeof d.metric === 'string' && typeof d.value === 'number') {
      return {
        metric: d.metric,
        condition: typeof d.condition === 'string' ? d.condition : 'exceeded',
        value: d.value,
        threshold: typeof d.threshold === 'number' ? d.threshold : 0,
      };
    }
  }
  return null;
}

function extractMemoryAlertData(data: unknown): {
  used: number;
  total: number;
  percentage: number;
} | null {
  if (data != null && typeof data === 'object' && 'used' in data) {
    const d = data as { used: unknown; total?: unknown; percentage?: unknown };
    if (typeof d.used === 'number') {
      return {
        used: d.used,
        total: typeof d.total === 'number' ? d.total : 0,
        percentage: typeof d.percentage === 'number' ? d.percentage : 0,
      };
    }
  }
  return null;
}

function extractMemoryLeakData(data: unknown): {
  growth: number;
  duration: number;
} | null {
  if (data != null && typeof data === 'object' && 'growth' in data) {
    const d = data as { growth: unknown; duration?: unknown };
    if (typeof d.growth === 'number') {
      return {
        growth: d.growth,
        duration: typeof d.duration === 'number' ? d.duration : 0,
      };
    }
  }
  return null;
}
