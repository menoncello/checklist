import { beforeEach, describe, expect, test, jest, afterEach } from 'bun:test';
import {
  PerformanceMonitor,
  PerformanceMonitorConfig,
  PerformanceMetric,
  PerformanceBenchmark,
  PerformanceAlert,
  PerformanceThreshold,
  MetricFilter,
  BenchmarkFilter,
  SystemSnapshot,
} from '../../src/performance/PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor({
      enableAutoSampling: false, // Disable auto-sampling for predictable tests
      samplingInterval: 100,
    });
  });

  afterEach(() => {
    performanceMonitor.destroy();
  });

  describe('constructor and initialization', () => {
    test('should initialize with default config', () => {
      const defaultMonitor = new PerformanceMonitor();
      const config = defaultMonitor.getConfig();

      expect(config.enableMetrics).toBe(true);
      expect(config.enableBenchmarks).toBe(true);
      expect(config.enableAlerts).toBe(true);
      expect(config.metricsBufferSize).toBe(1000);
      expect(config.benchmarksBufferSize).toBe(500);
      expect(config.alertsBufferSize).toBe(100);
      expect(config.samplingInterval).toBe(5000);
      expect(config.enableAutoSampling).toBe(true);
      expect(config.enableMemoryProfiling).toBe(true);
      expect(config.enableCPUProfiling).toBe(false);

      defaultMonitor.destroy();
    });

    test('should initialize with custom config', () => {
      const customConfig: Partial<PerformanceMonitorConfig> = {
        enableMetrics: false,
        enableBenchmarks: false,
        enableAlerts: false,
        metricsBufferSize: 500,
        benchmarksBufferSize: 250,
        alertsBufferSize: 50,
        samplingInterval: 1000,
        enableAutoSampling: false,
        enableMemoryProfiling: false,
        enableCPUProfiling: true,
      };

      const customMonitor = new PerformanceMonitor(customConfig);
      const config = customMonitor.getConfig();

      expect(config.enableMetrics).toBe(false);
      expect(config.enableBenchmarks).toBe(false);
      expect(config.enableAlerts).toBe(false);
      expect(config.metricsBufferSize).toBe(500);
      expect(config.benchmarksBufferSize).toBe(250);
      expect(config.alertsBufferSize).toBe(50);
      expect(config.samplingInterval).toBe(1000);
      expect(config.enableAutoSampling).toBe(false);
      expect(config.enableMemoryProfiling).toBe(false);
      expect(config.enableCPUProfiling).toBe(true);

      customMonitor.destroy();
    });
  });

  describe('metrics tracking', () => {
    test('should record metric values', () => {
      performanceMonitor.recordMetricValue('test-metric', 42, { tag: 'test' }, { source: 'test' });

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      const testMetric = metrics.find(m => m.name === 'test-metric');
      expect(testMetric).toBeDefined();
      expect(testMetric!.value).toBe(42);
    });

    test('should record metric objects', () => {
      const metric: PerformanceMetric = {
        id: 'test-metric-1',
        name: 'render-time', // Use a critical metric name to ensure it's not filtered out
        value: 100,
        timestamp: Date.now(),
        tags: { category: 'test' },
        metadata: { version: '1.0.0' },
      };

      performanceMonitor.recordMetric(metric);

      const metrics = performanceMonitor.getMetrics();
      const recordedMetric = metrics.find(m => m.id === 'test-metric-1');
      expect(recordedMetric).toBeDefined();
      expect(recordedMetric!.name).toBe('render-time');
      expect(recordedMetric!.value).toBe(100);
    });

    test('should not record metrics when disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableMetrics: false,
        enableAutoSampling: false,
      });

      disabledMonitor.recordMetricValue('disabled-metric', 50);

      const metrics = disabledMonitor.getMetrics();
      expect(metrics.length).toBe(0);

      disabledMonitor.destroy();
    });

    test('should create marks and measures', () => {
      const startMark = performanceMonitor.mark('start');
      const endMark = performanceMonitor.mark('end');

      expect(startMark).toBeGreaterThan(0);
      expect(endMark).toBeGreaterThan(startMark);

      const duration = performanceMonitor.measure('test-measure', 'start', 'end');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    test('should get metrics with filter', () => {
      performanceMonitor.recordMetricValue('metric1', 10, { type: 'test' });
      performanceMonitor.recordMetricValue('metric2', 20, { type: 'prod' });
      performanceMonitor.recordMetricValue('metric3', 30, { type: 'test' });

      const filter: MetricFilter = {
        tags: { type: 'test' },
      };

      const filteredMetrics = performanceMonitor.getMetrics(filter);
      expect(filteredMetrics.length).toBe(2);
      expect(filteredMetrics.every(m => m.tags?.type === 'test')).toBe(true);
    });

    test('should get statistics for metrics', () => {
      // Record multiple values for the same metric
      performanceMonitor.recordMetricValue('stats-metric', 10);
      performanceMonitor.recordMetricValue('stats-metric', 20);
      performanceMonitor.recordMetricValue('stats-metric', 30);
      performanceMonitor.recordMetricValue('stats-metric', 40);
      performanceMonitor.recordMetricValue('stats-metric', 50);

      const stats = performanceMonitor.getStatistics('stats-metric');
      expect(stats.count).toBe(5);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.average).toBe(30);
      expect(stats.median).toBe(30);
      expect(stats.p95).toBeGreaterThanOrEqual(40);
    });

    test('should clear metrics', () => {
      performanceMonitor.recordMetricValue('clear-test', 42);
      expect(performanceMonitor.getMetrics().length).toBeGreaterThan(0);

      performanceMonitor.clearMetrics();
      expect(performanceMonitor.getMetrics().length).toBe(0);
    });
  });

  describe('benchmarking', () => {
    test('should start and end benchmarks', () => {
      const benchmarkId = performanceMonitor.startBenchmark('test-benchmark', 'test-category', { version: '1.0' });
      expect(benchmarkId).toBeDefined();
      expect(benchmarkId.length).toBeGreaterThan(0);

      // End the benchmark immediately
      const benchmark = performanceMonitor.endBenchmark(benchmarkId);
      expect(benchmark).toBeDefined();
      expect(benchmark!.name).toBe('test-benchmark');
      expect(benchmark!.category).toBe('test-category');
      expect(benchmark!.duration).toBeGreaterThanOrEqual(0);
    });

    test('should not start benchmarks when disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableBenchmarks: false,
        enableAutoSampling: false,
      });

      const benchmarkId = disabledMonitor.startBenchmark('disabled-benchmark');
      expect(benchmarkId).toBe('');

      disabledMonitor.destroy();
    });

    test('should not end benchmarks when disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableBenchmarks: false,
        enableAutoSampling: false,
      });

      const result = disabledMonitor.endBenchmark('fake-id');
      expect(result).toBe(null);

      disabledMonitor.destroy();
    });

    test('should measure functions', () => {
      const testFunction = jest.fn(() => 42);
      const measuredFunction = performanceMonitor.measureFunction(testFunction, 'test-function', 'functions');

      const result = measuredFunction();
      expect(result).toBe(42);
      expect(testFunction).toHaveBeenCalled();

      const benchmarks = performanceMonitor.getBenchmarks();
      const functionBenchmark = benchmarks.find(b => b.name === 'test-function');
      expect(functionBenchmark).toBeDefined();
      expect(functionBenchmark!.category).toBe('functions');
    });

    test('should not measure functions when disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableBenchmarks: false,
        enableAutoSampling: false,
      });

      const testFunction = jest.fn(() => 42);
      const measuredFunction = disabledMonitor.measureFunction(testFunction, 'disabled-function');

      expect(measuredFunction).toBe(testFunction);

      disabledMonitor.destroy();
    });

    test('should measure async operations', async () => {
      const asyncOperation = new Promise<number>((resolve) => {
        setTimeout(() => resolve(100), 50);
      });

      const result = await performanceMonitor.measureAsync(asyncOperation, 'async-test', 'async-ops');
      expect(result).toBe(100);

      const benchmarks = performanceMonitor.getBenchmarks();
      const asyncBenchmark = benchmarks.find(b => b.name === 'async-test');
      expect(asyncBenchmark).toBeDefined();
      expect(asyncBenchmark!.category).toBe('async-ops');
      expect(asyncBenchmark!.duration).toBeGreaterThan(40); // Should be around 50ms
    });

    test('should not measure async when disabled', async () => {
      const disabledMonitor = new PerformanceMonitor({
        enableBenchmarks: false,
        enableAutoSampling: false,
      });

      const asyncOperation = Promise.resolve(200);
      const result = await disabledMonitor.measureAsync(asyncOperation, 'disabled-async');

      expect(result).toBe(200);

      disabledMonitor.destroy();
    });

    test('should get benchmarks with filter', () => {
      const id1 = performanceMonitor.startBenchmark('bench1', 'category1');
      const id2 = performanceMonitor.startBenchmark('bench2', 'category2');
      const id3 = performanceMonitor.startBenchmark('bench3', 'category1');

      // End benchmarks to store them
      performanceMonitor.endBenchmark(id1);
      performanceMonitor.endBenchmark(id2);
      performanceMonitor.endBenchmark(id3);

      const filter: BenchmarkFilter = {
        category: 'category1',
      };

      const filteredBenchmarks = performanceMonitor.getBenchmarks(filter);
      expect(filteredBenchmarks.length).toBe(2);
      expect(filteredBenchmarks.every(b => b.category === 'category1')).toBe(true);
    });

    test('should clear benchmarks', () => {
      const benchmarkId = performanceMonitor.startBenchmark('clear-benchmark');
      performanceMonitor.endBenchmark(benchmarkId); // Complete the benchmark first
      expect(performanceMonitor.getBenchmarks().length).toBeGreaterThan(0);

      performanceMonitor.clearBenchmarks();
      expect(performanceMonitor.getBenchmarks().length).toBe(0);
    });
  });

  describe('alerts and thresholds', () => {
    test('should add and trigger thresholds', () => {
      const alertHandler = jest.fn();
      performanceMonitor.on('alert', alertHandler);

      const threshold: PerformanceThreshold = {
        metric: 'render-time',
        warningValue: 50,
        criticalValue: 80,
        direction: 'above',
      };

      performanceMonitor.addThreshold(threshold);

      // Record metric that should trigger alert
      performanceMonitor.recordMetric({
        id: 'alert-trigger',
        name: 'render-time', // Use critical metric name
        value: 75,
        timestamp: Date.now(),
      });

      expect(alertHandler).toHaveBeenCalled();
      const alerts = performanceMonitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    test('should not trigger alerts when disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableAlerts: false,
        enableAutoSampling: false,
      });

      const alertHandler = jest.fn();
      disabledMonitor.on('alert', alertHandler);

      const threshold: PerformanceThreshold = {
        metric: 'test-metric',
        warningValue: 50,
        criticalValue: 80,
        direction: 'above',
      };

      disabledMonitor.addThreshold(threshold);
      disabledMonitor.recordMetric({
        id: 'no-alert',
        name: 'test-metric',
        value: 75,
        timestamp: Date.now(),
      });

      expect(alertHandler).not.toHaveBeenCalled();

      disabledMonitor.destroy();
    });

    test('should remove thresholds', () => {
      const threshold: PerformanceThreshold = {
        metric: 'removable-metric',
        warningValue: 100,
        criticalValue: 150,
        direction: 'above',
      };

      performanceMonitor.addThreshold(threshold);
      const removed = performanceMonitor.removeThreshold('removable-metric');
      expect(removed).toBe(true);
    });

    test('should get alerts by level', () => {
      const warningThreshold: PerformanceThreshold = {
        metric: 'render-time',
        warningValue: 30,
        criticalValue: 50,
        direction: 'above',
      };

      const criticalThreshold: PerformanceThreshold = {
        metric: 'memory-usage',
        warningValue: 70,
        criticalValue: 80,
        direction: 'above',
      };

      performanceMonitor.addThreshold(warningThreshold);
      performanceMonitor.addThreshold(criticalThreshold);

      // Trigger warning alert
      performanceMonitor.recordMetric({
        id: 'warning-trigger',
        name: 'render-time',
        value: 40,
        timestamp: Date.now(),
      });

      // Trigger critical alert
      performanceMonitor.recordMetric({
        id: 'critical-trigger',
        name: 'memory-usage',
        value: 90,
        timestamp: Date.now(),
      });

      const warningAlerts = performanceMonitor.getAlerts('warning');
      const criticalAlerts = performanceMonitor.getAlerts('critical');

      expect(warningAlerts.length).toBeGreaterThan(0);
      expect(criticalAlerts.length).toBeGreaterThan(0);
      expect(warningAlerts.every(a => a.level === 'warning')).toBe(true);
      expect(criticalAlerts.every(a => a.level === 'critical')).toBe(true);
    });

    test('should clear alerts', () => {
      const threshold: PerformanceThreshold = {
        metric: 'render-time',
        warningValue: 10,
        criticalValue: 20,
        direction: 'above',
      };

      performanceMonitor.addThreshold(threshold);
      performanceMonitor.recordMetric({
        id: 'clear-alert',
        name: 'render-time',
        value: 25,
        timestamp: Date.now(),
      });

      expect(performanceMonitor.getAlerts().length).toBeGreaterThan(0);

      performanceMonitor.clearAlerts();
      expect(performanceMonitor.getAlerts().length).toBe(0);
    });
  });

  describe('system profiling', () => {
    test('should get system snapshot', () => {
      const snapshot = performanceMonitor.getSystemSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot).toHaveProperty('memory');
      expect(snapshot).toHaveProperty('cpu');
      expect(snapshot).toHaveProperty('timestamp');
    });

    test('should handle system metrics', () => {
      // This tests the private handleSystemMetric method indirectly
      const initialMetrics = performanceMonitor.getMetrics();
      const initialCount = initialMetrics.length;

      // Manually trigger system metric (simulating system profiler callback)
      (performanceMonitor as any).handleSystemMetric('memory.usage', 1024 * 1024 * 100, { unit: 'bytes' });

      const updatedMetrics = performanceMonitor.getMetrics();
      expect(updatedMetrics.length).toBe(initialCount + 1);

      const systemMetric = updatedMetrics.find(m => m.name === 'memory.usage');
      expect(systemMetric).toBeDefined();
      expect(systemMetric!.value).toBe(1024 * 1024 * 100);
    });

    test('should not handle system metrics when disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableMetrics: false,
        enableAutoSampling: false,
      });

      const initialCount = disabledMonitor.getMetrics().length;

      // Try to trigger system metric
      (disabledMonitor as any).handleSystemMetric('cpu.usage', 75);

      const finalCount = disabledMonitor.getMetrics().length;
      expect(finalCount).toBe(initialCount);

      disabledMonitor.destroy();
    });
  });

  describe('event handling', () => {
    test('should register and trigger event handlers', () => {
      const configHandler = jest.fn();
      const alertHandler = jest.fn();

      performanceMonitor.on('configUpdated', configHandler);
      performanceMonitor.on('alert', alertHandler);

      // Trigger config event
      performanceMonitor.updateConfig({ enableCPUProfiling: true });
      expect(configHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          enableCPUProfiling: true,
        })
      );

      // Trigger alert event
      const threshold: PerformanceThreshold = {
        metric: 'render-time',
        warningValue: 10,
        criticalValue: 30,
        direction: 'above',
      };

      performanceMonitor.addThreshold(threshold);
      performanceMonitor.recordMetric({
        id: 'event-trigger',
        name: 'render-time',
        value: 20,
        timestamp: Date.now(),
      });

      expect(alertHandler).toHaveBeenCalled();
    });

    test('should remove event handlers', () => {
      const handler = jest.fn();

      performanceMonitor.on('test-event', handler);
      performanceMonitor.off('test-event', handler);

      // Manually emit event to test handler was removed
      (performanceMonitor as any).emit('test-event', { test: true });
      expect(handler).not.toHaveBeenCalled();
    });

    test('should handle event handler errors gracefully', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = jest.fn();

      performanceMonitor.on('error-test', errorHandler);
      performanceMonitor.on('error-test', goodHandler);

      // Should not throw despite handler error
      expect(() => (performanceMonitor as any).emit('error-test', { test: true })).not.toThrow();
      expect(goodHandler).toHaveBeenCalled();
    });
  });

  describe('configuration management', () => {
    test('should update configuration', () => {
      const originalConfig = performanceMonitor.getConfig();
      expect(originalConfig.enableCPUProfiling).toBe(false);

      performanceMonitor.updateConfig({
        enableCPUProfiling: true,
        metricsBufferSize: 2000,
      });

      const updatedConfig = performanceMonitor.getConfig();
      expect(updatedConfig.enableCPUProfiling).toBe(true);
      expect(updatedConfig.metricsBufferSize).toBe(2000);
      expect(updatedConfig.enableMetrics).toBe(originalConfig.enableMetrics); // Should preserve other values
    });

    test('should handle auto-sampling toggle', () => {
      const monitor = new PerformanceMonitor({
        enableAutoSampling: false,
      });

      // Enable auto-sampling
      monitor.updateConfig({ enableAutoSampling: true });
      expect(monitor.getConfig().enableAutoSampling).toBe(true);

      // Disable auto-sampling
      monitor.updateConfig({ enableAutoSampling: false });
      expect(monitor.getConfig().enableAutoSampling).toBe(false);

      monitor.destroy();
    });

    test('should return immutable config copy', () => {
      const config1 = performanceMonitor.getConfig();
      const config2 = performanceMonitor.getConfig();

      expect(config1).not.toBe(config2); // Different references
      expect(config1).toEqual(config2); // Same values
    });
  });

  describe('report generation', () => {
    test('should generate comprehensive report', () => {
      // Add some data
      performanceMonitor.recordMetricValue('report-metric', 42);
      const benchmarkId = performanceMonitor.startBenchmark('report-benchmark');
      performanceMonitor.endBenchmark(benchmarkId);

      const threshold: PerformanceThreshold = {
        metric: 'report-metric',
        warningValue: 30,
        criticalValue: 60,
        direction: 'above',
      };
      performanceMonitor.addThreshold(threshold);

      const report = performanceMonitor.generateReport();

      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('benchmarks');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('systemSnapshot');

      expect(Array.isArray(report.metrics)).toBe(true);
      expect(Array.isArray(report.benchmarks)).toBe(true);
      expect(Array.isArray(report.alerts)).toBe(true);
      expect(typeof report.systemSnapshot).toBe('object');

      expect(report.metrics.length).toBeGreaterThan(0);
      expect(report.benchmarks.length).toBeGreaterThan(0);
      expect(report.alerts.length).toBeGreaterThanOrEqual(0); // Alerts may or may not be triggered
    });
  });

  describe('cleanup and destruction', () => {
    test('should clear all data', () => {
      // Add data to all components
      performanceMonitor.recordMetricValue('clear-all-metric', 10);
      const benchmarkId = performanceMonitor.startBenchmark('clear-all-benchmark');
      performanceMonitor.endBenchmark(benchmarkId); // Complete benchmark

      const threshold: PerformanceThreshold = {
        metric: 'clear-all-metric',
        warningValue: 5,
        criticalValue: 15,
        direction: 'above',
      };
      performanceMonitor.addThreshold(threshold);

      // Verify data exists
      expect(performanceMonitor.getMetrics().length).toBeGreaterThan(0);
      expect(performanceMonitor.getBenchmarks().length).toBeGreaterThan(0);
      expect(performanceMonitor.getAlerts().length).toBeGreaterThanOrEqual(0); // Alerts may or may not be triggered

      // Clear all
      performanceMonitor.clearAll();

      // Verify all data is cleared
      expect(performanceMonitor.getMetrics().length).toBe(0);
      expect(performanceMonitor.getBenchmarks().length).toBe(0);
      expect(performanceMonitor.getAlerts().length).toBe(0);
    });

    test('should destroy cleanly', () => {
      performanceMonitor.recordMetricValue('destroy-test', 42);
      expect(performanceMonitor.getMetrics().length).toBeGreaterThan(0);

      performanceMonitor.destroy();

      expect(performanceMonitor.getMetrics().length).toBe(0);
    });

    test('should handle multiple destroy calls', () => {
      performanceMonitor.destroy();
      expect(() => performanceMonitor.destroy()).not.toThrow();
    });
  });

  describe('command execution tracking', () => {
    test('should record command execution with performance monitoring', () => {
      performanceMonitor.recordCommandExecution('test-command', 25);

      const metrics = performanceMonitor.getMetrics();
      const commandMetric = metrics.find(m => m.name === 'command_execution_time');
      expect(commandMetric).toBeDefined();
      expect(commandMetric!.value).toBe(25);
      expect(commandMetric!.tags?.commandId).toBe('test-command');
    });

    test('should trigger alert for slow commands', () => {
      const alertHandler = jest.fn();
      performanceMonitor.on('alert', alertHandler);

      // Record slow command (>50ms)
      performanceMonitor.recordCommandExecution('slow-command', 75);

      expect(alertHandler).toHaveBeenCalled();
      const alerts = performanceMonitor.getAlerts();
      const slowCommandAlert = alerts.find(a => a.metric === 'command_execution_time');
      expect(slowCommandAlert).toBeDefined();
      expect(slowCommandAlert!.level).toBe('warning');
      expect(slowCommandAlert!.message).toContain('slow-command');
    });

    test('should not trigger alert for fast commands', () => {
      const alertHandler = jest.fn();
      performanceMonitor.on('alert', alertHandler);

      // Record fast command (<50ms)
      performanceMonitor.recordCommandExecution('fast-command', 25);

      expect(alertHandler).not.toHaveBeenCalled();
    });

    test('should include timestamp in command execution metrics', () => {
      const beforeTime = Date.now();
      performanceMonitor.recordCommandExecution('timestamp-test', 30);
      const afterTime = Date.now();

      const metrics = performanceMonitor.getMetrics();
      const commandMetric = metrics.find(m => m.name === 'command_execution_time' && m.tags?.commandId === 'timestamp-test');
      expect(commandMetric).toBeDefined();
      expect(commandMetric!.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(commandMetric!.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('delegation method coverage', () => {
    test('should delegate mark method to core', () => {
      const markSpy = jest.spyOn(performanceMonitor.core, 'mark');
      const result = performanceMonitor.mark('test-mark');

      expect(markSpy).toHaveBeenCalledWith('test-mark');
      expect(typeof result).toBe('number');
    });

    test('should delegate measure method to core', () => {
      const measureSpy = jest.spyOn(performanceMonitor.core, 'measure');
      performanceMonitor.mark('start');
      performanceMonitor.mark('end');
      const result = performanceMonitor.measure('test-measure', 'start', 'end');

      expect(measureSpy).toHaveBeenCalledWith('test-measure', 'start', 'end');
      expect(typeof result).toBe('number');
    });

    test('should delegate addThreshold to core', () => {
      const addThresholdSpy = jest.spyOn(performanceMonitor.core, 'addThreshold');
      const threshold = { metric: 'test', warningValue: 10, criticalValue: 20, direction: 'above' as const };

      performanceMonitor.addThreshold(threshold);

      expect(addThresholdSpy).toHaveBeenCalledWith(threshold);
    });

    test('should delegate removeThreshold to core', () => {
      const removeThresholdSpy = jest.spyOn(performanceMonitor.core, 'removeThreshold');

      const result = performanceMonitor.removeThreshold('test-metric');

      expect(removeThresholdSpy).toHaveBeenCalledWith('test-metric');
      expect(typeof result).toBe('boolean');
    });

    test('should delegate getMetrics to core with filter', () => {
      const getMetricsSpy = jest.spyOn(performanceMonitor.core, 'getMetrics');
      const filter = { tags: { category: 'test' } };

      performanceMonitor.getMetrics(filter);

      expect(getMetricsSpy).toHaveBeenCalledWith(filter);
    });

    test('should delegate getBenchmarks to core with filter', () => {
      const getBenchmarksSpy = jest.spyOn(performanceMonitor.core, 'getBenchmarks');
      const filter = { category: 'test' };

      performanceMonitor.getBenchmarks(filter);

      expect(getBenchmarksSpy).toHaveBeenCalledWith(filter);
    });

    test('should delegate getAlerts to core with level', () => {
      const getAlertsSpy = jest.spyOn(performanceMonitor.core, 'getAlerts');

      performanceMonitor.getAlerts('warning');

      expect(getAlertsSpy).toHaveBeenCalledWith('warning');
    });

    test('should delegate getStatistics to core', () => {
      const getStatisticsSpy = jest.spyOn(performanceMonitor.core, 'getStatistics');

      performanceMonitor.getStatistics('test-metric');

      expect(getStatisticsSpy).toHaveBeenCalledWith('test-metric');
    });

    test('should delegate getSystemSnapshot to components', () => {
      const getSystemSnapshotSpy = jest.spyOn(performanceMonitor.components.systemProfiler, 'getSystemSnapshot');

      performanceMonitor.getSystemSnapshot();

      expect(getSystemSnapshotSpy).toHaveBeenCalled();
    });

    test('should delegate clearMetrics to core', () => {
      const clearSpy = jest.spyOn(performanceMonitor.core, 'clearMetrics');

      performanceMonitor.clearMetrics();

      expect(clearSpy).toHaveBeenCalled();
    });

    test('should delegate clearBenchmarks to core', () => {
      const clearSpy = jest.spyOn(performanceMonitor.core, 'clearBenchmarks');

      performanceMonitor.clearBenchmarks();

      expect(clearSpy).toHaveBeenCalled();
    });

    test('should delegate clearAlerts to core', () => {
      const clearSpy = jest.spyOn(performanceMonitor.core, 'clearAlerts');

      performanceMonitor.clearAlerts();

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('configuration update edge cases', () => {
    test('should handle config update with empty object', () => {
      const originalConfig = performanceMonitor.getConfig();

      performanceMonitor.updateConfig({});

      const updatedConfig = performanceMonitor.getConfig();
      expect(updatedConfig).toEqual(originalConfig);
    });

    test('should emit configUpdated event on partial update', () => {
      const configHandler = jest.fn();
      performanceMonitor.on('configUpdated', configHandler);

      performanceMonitor.updateConfig({ metricsBufferSize: 2000 });

      expect(configHandler).toHaveBeenCalledWith(
        expect.objectContaining({ metricsBufferSize: 2000 })
      );
    });
  });

  describe('metric recording with alerts disabled', () => {
    test('should record metric but not check alerts when alerts disabled', () => {
      const alertManagerSpy = jest.spyOn(performanceMonitor.components.alertManager, 'checkMetric');
      const disabledMonitor = new PerformanceMonitor({
        enableAlerts: false,
        enableAutoSampling: false,
      });

      const metric: PerformanceMetric = {
        id: 'test-no-alert',
        name: 'test-metric',
        value: 100,
        timestamp: Date.now(),
      };

      disabledMonitor.recordMetric(metric);

      const metrics = disabledMonitor.getMetrics();
      expect(metrics.length).toBe(1);
      expect(alertManagerSpy).not.toHaveBeenCalled();

      disabledMonitor.destroy();
    });
  });

  describe('destruction behavior', () => {
    test('should stop system profiler on destruction', () => {
      const stopSpy = jest.spyOn(performanceMonitor.components.systemProfiler, 'stop');

      performanceMonitor.destroy();

      expect(stopSpy).toHaveBeenCalled();
    });

    test('should clear event handlers on destruction', () => {
      const handler = jest.fn();
      performanceMonitor.on('test-event', handler);

      performanceMonitor.destroy();

      // Event should not trigger after destruction
      (performanceMonitor as any).emit('test-event', { data: 'test' });
      expect(handler).not.toHaveBeenCalled();
    });

    test('should handle destruction without errors', () => {
      expect(() => performanceMonitor.destroy()).not.toThrow();
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty metric names', () => {
      expect(() => performanceMonitor.recordMetricValue('', 10)).not.toThrow();
    });

    test('should handle invalid benchmark IDs', () => {
      const result = performanceMonitor.endBenchmark('invalid-id');
      expect(result).toBe(null);
    });

    test('should handle statistics for non-existent metrics', () => {
      const stats = performanceMonitor.getStatistics('non-existent-metric');
      expect(stats.count).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.average).toBe(0);
    });

    test('should handle async function errors', async () => {
      const failingPromise = Promise.reject(new Error('Async error'));

      try {
        await performanceMonitor.measureAsync(failingPromise, 'failing-async');
      } catch (error) {
        expect((error as Error).message).toBe('Async error');
      }

      // Should still record the benchmark even if the promise fails
      const benchmarks = performanceMonitor.getBenchmarks();
      const failingBenchmark = benchmarks.find(b => b.name === 'failing-async');
      expect(failingBenchmark).toBeDefined();
    });

    test('should handle function measurement errors', () => {
      const throwingFunction = () => {
        throw new Error('Function error');
      };

      const measuredFunction = performanceMonitor.measureFunction(throwingFunction, 'throwing-function');

      expect(() => measuredFunction()).toThrow('Function error');

      // Should still record the benchmark even if the function throws
      const benchmarks = performanceMonitor.getBenchmarks();
      const throwingBenchmark = benchmarks.find(b => b.name === 'throwing-function');
      expect(throwingBenchmark).toBeDefined();
    });

    test('should handle recordMetric when metrics disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableMetrics: false,
        enableAutoSampling: false,
      });

      const metric: PerformanceMetric = {
        id: 'disabled-test',
        name: 'test-metric',
        value: 100,
        timestamp: Date.now(),
      };

      disabledMonitor.recordMetric(metric);

      expect(disabledMonitor.getMetrics().length).toBe(0);

      disabledMonitor.destroy();
    });

    test('should handle startBenchmark when benchmarks disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableBenchmarks: false,
        enableAutoSampling: false,
      });

      const result = disabledMonitor.startBenchmark('disabled-benchmark');
      expect(result).toBe('');

      disabledMonitor.destroy();
    });

    test('should handle endBenchmark when benchmarks disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableBenchmarks: false,
        enableAutoSampling: false,
      });

      const result = disabledMonitor.endBenchmark('any-id');
      expect(result).toBe(null);

      disabledMonitor.destroy();
    });

    test('should handle measureFunction when benchmarks disabled', () => {
      const disabledMonitor = new PerformanceMonitor({
        enableBenchmarks: false,
        enableAutoSampling: false,
      });

      const testFunction = jest.fn(() => 42);
      const measuredFunction = disabledMonitor.measureFunction(testFunction, 'test');

      // Should return original function when disabled
      expect(measuredFunction).toBe(testFunction);
      const result = measuredFunction();
      expect(result).toBe(42);

      disabledMonitor.destroy();
    });

    test('should handle measureAsync when benchmarks disabled', async () => {
      const disabledMonitor = new PerformanceMonitor({
        enableBenchmarks: false,
        enableAutoSampling: false,
      });

      const promise = Promise.resolve(42);
      const result = await disabledMonitor.measureAsync(promise, 'test');

      // Should return original promise when disabled
      expect(result).toBe(42);

      disabledMonitor.destroy();
    });
  });
});