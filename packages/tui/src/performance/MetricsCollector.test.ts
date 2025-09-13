import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import {
  MetricsCollector,
  type MetricsCollectorConfig,
  type MetricPoint,
  type AlertRule,
} from './MetricsCollector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  let config: Partial<MetricsCollectorConfig>;

  beforeEach(() => {
    config = {
      enableCollection: true,
      bufferSize: 100,
      flushInterval: 100,
      compressionThreshold: 10,
      retentionPeriod: 1000,
      enableAggregation: false, // Disable for faster tests
      enableAlerts: true,
      exportFormat: 'json',
      persistMetrics: false,
    };
    collector = new MetricsCollector(config);
  });

  afterEach(() => {
    collector.destroy();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultCollector = new MetricsCollector();
      const retrievedConfig = defaultCollector.getConfig();

      expect(retrievedConfig.enableCollection).toBe(true);
      expect(retrievedConfig.bufferSize).toBe(10000);
      expect(retrievedConfig.flushInterval).toBe(30000);

      defaultCollector.destroy();
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { bufferSize: 500, enableAlerts: false };
      const customCollector = new MetricsCollector(customConfig);
      const retrievedConfig = customCollector.getConfig();

      expect(retrievedConfig.bufferSize).toBe(500);
      expect(retrievedConfig.enableAlerts).toBe(false);
      expect(retrievedConfig.enableCollection).toBe(true); // Default

      customCollector.destroy();
    });

    it('should update configuration', () => {
      const newConfig = { bufferSize: 200, flushInterval: 500 };
      collector.updateConfig(newConfig);

      const retrievedConfig = collector.getConfig();
      expect(retrievedConfig.bufferSize).toBe(200);
      expect(retrievedConfig.flushInterval).toBe(500);
    });
  });

  describe('Metric Collection', () => {
    it('should collect metrics using record method', () => {
      collector.record('test-metric', 100, { tag: 'value' });

      const metrics = collector.getMetrics();
      expect(metrics.totalSeries).toBe(1);
    });

    it('should collect metrics using recordMetric method', () => {
      collector.recordMetric('test-metric', 42, { meta: 'data' });

      const series = collector.getSeries();
      expect(series).toHaveLength(1);
      expect(series[0].name).toBe('test-metric');
    });

    it('should collect metrics using collect method', () => {
      collector.collect('cpu-usage', 75, { host: 'server1' });

      // collect() puts data in buffer, need to check buffer metrics
      const metrics = collector.getMetrics();
      expect(metrics.bufferSize).toBeGreaterThan(0);
      expect(metrics.totalPointsCollected).toBe(1);
    });

    it('should not collect metrics when collection is disabled', () => {
      collector.updateConfig({ enableCollection: false });
      collector.collect('disabled-metric', 50);

      const metrics = collector.getMetrics();
      expect(metrics.totalSeries).toBe(0);
    });

    it('should handle buffer overflow by trimming old data', () => {
      const smallBufferConfig = { bufferSize: 3 };
      const smallCollector = new MetricsCollector(smallBufferConfig);

      // Add more metrics than buffer can hold
      for (let i = 0; i < 5; i++) {
        smallCollector.collect('test-metric', i);
      }

      const metrics = smallCollector.getMetrics();
      expect(metrics.bufferSize).toBeLessThanOrEqual(3);

      smallCollector.destroy();
    });

    it('should update aggregations when collecting metrics', () => {
      collector.record('test-metric', 10);
      collector.record('test-metric', 20);
      collector.record('test-metric', 30);

      const series = collector.getSeries();
      const metric = series.find((s) => s.name === 'test-metric');

      expect(metric).toBeDefined();
      expect(metric!.aggregations.count).toBe(3);
      expect(metric!.aggregations.sum).toBe(60);
      expect(metric!.aggregations.avg).toBe(20);
      expect(metric!.aggregations.min).toBe(10);
      expect(metric!.aggregations.max).toBe(30);
      expect(metric!.aggregations.latest).toBe(30);
    });
  });

  describe('Alert System', () => {
    it('should setup default alert rules', () => {
      const rules = collector.getAlertRules();
      expect(rules.length).toBeGreaterThan(0);

      const memoryRule = rules.find((r) => r.id === 'high-memory');
      expect(memoryRule).toBeDefined();
      expect(memoryRule!.metric).toBe('memory_heap_used');
    });

    it('should add custom alert rule', () => {
      const customRule: AlertRule = {
        id: 'custom-rule',
        metric: 'custom-metric',
        condition: 'value > 50',
        severity: 'warning',
        message: 'Custom alert',
      };

      collector.addAlertRule(customRule);
      const rules = collector.getAlertRules();

      const foundRule = rules.find((r) => r.id === 'custom-rule');
      expect(foundRule).toEqual(customRule);
    });

    it('should remove alert rule', () => {
      const customRule: AlertRule = {
        id: 'removable-rule',
        metric: 'test-metric',
        condition: 'value > 100',
        severity: 'error',
        message: 'Test alert',
      };

      collector.addAlertRule(customRule);
      expect(collector.removeAlertRule('removable-rule')).toBe(true);
      expect(collector.removeAlertRule('non-existent')).toBe(false);

      const rules = collector.getAlertRules();
      const foundRule = rules.find((r) => r.id === 'removable-rule');
      expect(foundRule).toBeUndefined();
    });

    it('should trigger alert when condition is met', () => {
      let alertTriggered: any = null;
      collector.on('alertTriggered', (data: any) => {
        alertTriggered = data;
      });

      // Add a rule that will trigger
      collector.addAlertRule({
        id: 'test-trigger',
        metric: 'test-value',
        condition: 'value > 50',
        severity: 'warning',
        message: 'Test alert triggered',
      });

      collector.collect('test-value', 75); // This should trigger the alert

      expect(alertTriggered).not.toBeNull();
      expect(alertTriggered.alert.metric).toBe('test-value');
      expect(alertTriggered.alert.value).toBe(75);
    });

    it('should not trigger alert when condition is not met', () => {
      let alertTriggered = false;
      collector.on('alertTriggered', () => {
        alertTriggered = true;
      });

      collector.addAlertRule({
        id: 'no-trigger',
        metric: 'safe-value',
        condition: 'value > 100',
        severity: 'error',
        message: 'Should not trigger',
      });

      collector.collect('safe-value', 50); // This should not trigger

      expect(alertTriggered).toBe(false);
    });

    it('should get alerts by severity', () => {
      collector.addAlertRule({
        id: 'critical-rule',
        metric: 'critical-metric',
        condition: 'value > 0',
        severity: 'critical',
        message: 'Critical alert',
      });

      collector.addAlertRule({
        id: 'warning-rule',
        metric: 'warning-metric',
        condition: 'value > 0',
        severity: 'warning',
        message: 'Warning alert',
      });

      collector.collect('critical-metric', 1);
      collector.collect('warning-metric', 1);

      const criticalAlerts = collector.getAlerts('critical');
      const warningAlerts = collector.getAlerts('warning');
      const allAlerts = collector.getAlerts();

      expect(criticalAlerts.some((a) => a.severity === 'critical')).toBe(true);
      expect(warningAlerts.some((a) => a.severity === 'warning')).toBe(true);
      expect(allAlerts.length).toBeGreaterThanOrEqual(2);
    });

    it('should limit alert buffer size', () => {
      collector.addAlertRule({
        id: 'spam-rule',
        metric: 'spam-metric',
        condition: 'value > 0',
        severity: 'info',
        message: 'Spam alert',
      });

      // Trigger more than 1000 alerts
      for (let i = 0; i < 1200; i++) {
        collector.collect('spam-metric', 1);
      }

      const alerts = collector.getAlerts();
      expect(alerts.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Query System', () => {
    beforeEach(() => {
      // Set up test data using record() for immediate series creation
      collector.record('metric-a', 10, { type: 'cpu' }, { host: 'server1' });
      collector.record('metric-a', 20, { type: 'cpu' }, { host: 'server2' });
      collector.record('metric-b', 30, { type: 'memory' }, { host: 'server1' });
      collector.record('metric-c', 40, { type: 'disk' }, { host: 'server3' });
    });

    it('should query all metrics when no filters provided', () => {
      const results = collector.query({});
      expect(results.length).toBe(3); // metric-a, metric-b, metric-c
    });

    it('should filter by metric name', () => {
      const results = collector.query({ name: 'metric-a' });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('metric-a');
    });

    it('should filter by partial metric name', () => {
      const results = collector.query({ name: 'metric' });
      expect(results.length).toBe(3); // All metrics contain 'metric'
    });

    it('should filter by tags', () => {
      const results = collector.query({ tags: { type: 'cpu' } });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('metric-a');
    });

    it('should filter by time range', () => {
      const now = Date.now();
      const results = collector.query({
        timeRange: { start: now - 1000, end: now + 1000 },
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should apply limit to points within series', () => {
      // Add more points to one metric to test limiting
      collector.record('metric-a', 5);
      collector.record('metric-a', 15);

      const results = collector.query({ limit: 2, name: 'metric-a' });
      expect(results.length).toBe(1);
      // Limit applies to points within the series, should get last 2 points
      expect(results[0].points.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty results', () => {
      const results = collector.query({ name: 'non-existent' });
      expect(results).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      // Set up test data using record() for immediate series creation
      collector.record('cpu', 70);
      collector.record('memory', 80);
      collector.record('cpu', 90);
    });

    it('should generate comprehensive report', () => {
      const report = collector.generateReport();

      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('timeRange');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('series');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('recommendations');

      expect(report.summary.totalMetrics).toBeGreaterThan(0);
      expect(report.series.length).toBeGreaterThan(0);
    });

    it('should generate report for custom time range', () => {
      const now = Date.now();
      const report = collector.generateReport({
        start: now - 1000,
        end: now + 1000,
      });

      expect(report.timeRange.start).toBe(now - 1000);
      expect(report.timeRange.end).toBe(now + 1000);
    });

    it('should include recommendations', () => {
      // Create high variance data to trigger recommendation using record()
      for (let i = 0; i < 10; i++) {
        collector.record('variable-metric', Math.random() * 1000);
      }

      const report = collector.generateReport();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Event System', () => {
    it('should emit metricCollected event', () => {
      let eventData: any = null;
      collector.on('metricCollected', (data: any) => {
        eventData = data;
      });

      collector.collect('test-metric', 42);

      expect(eventData).not.toBeNull();
      expect(eventData.name).toBe('test-metric');
      expect(eventData.point.value).toBe(42);
    });

    it('should remove event handlers', () => {
      let eventCount = 0;
      const handler = () => {
        eventCount++;
      };

      collector.on('metricCollected', handler);
      collector.collect('test', 1);
      expect(eventCount).toBe(1);

      collector.off('metricCollected', handler);
      collector.collect('test', 2);
      expect(eventCount).toBe(1); // Should not increment
    });

    it('should handle errors in event handlers gracefully', () => {
      collector.on('metricCollected', () => {
        throw new Error('Handler error');
      });

      // This should not throw
      expect(() => {
        collector.collect('test', 1);
      }).not.toThrow();
    });
  });

  describe('Data Management', () => {
    it('should clear buffer', () => {
      collector.collect('test', 1);
      collector.clearBuffer();

      const metrics = collector.getMetrics();
      expect(metrics.bufferSize).toBe(0);
    });

    it('should clear series', () => {
      collector.record('test', 1);
      collector.clearSeries();

      const series = collector.getSeries();
      expect(series).toHaveLength(0);
    });

    it('should clear alerts', () => {
      collector.addAlertRule({
        id: 'test-clear',
        metric: 'test',
        condition: 'value > 0',
        severity: 'info',
        message: 'Test',
      });
      collector.collect('test', 1);

      collector.clearAlerts();
      const alerts = collector.getAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should clear all data', () => {
      collector.record('test', 1);
      collector.addAlertRule({
        id: 'test-all',
        metric: 'test',
        condition: 'value > 0',
        severity: 'info',
        message: 'Test',
      });

      collector.clearAll();

      const metrics = collector.getMetrics();
      expect(metrics.bufferSize).toBe(0);
      expect(metrics.totalSeries).toBe(0);
      expect(metrics.totalPointsCollected).toBe(0);
    });

    it('should get collector metrics', () => {
      // Use collect() to increment totalPointsCollected counter
      collector.collect('test', 1);
      collector.collect('test2', 2);

      const metrics = collector.getMetrics();

      expect(typeof metrics.uptime).toBe('number');
      expect(typeof metrics.totalSeries).toBe('number');
      expect(typeof metrics.totalPoints).toBe('number');
      expect(typeof metrics.collectionRate).toBe('number');
      expect(metrics.totalPointsCollected).toBe(2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty metrics calculations', () => {
      const emptyCollector = new MetricsCollector();
      const series = emptyCollector.getSeries();
      expect(series).toHaveLength(0);

      const metrics = emptyCollector.getMetrics();
      expect(metrics.totalSeries).toBe(0);

      emptyCollector.destroy();
    });

    it('should handle invalid alert conditions gracefully', () => {
      collector.addAlertRule({
        id: 'invalid-condition',
        metric: 'test',
        condition: 'invalid javascript code',
        severity: 'error',
        message: 'Should not trigger',
      });

      expect(() => {
        collector.collect('test', 100);
      }).not.toThrow();
    });

    it('should handle unsafe alert conditions', () => {
      collector.addAlertRule({
        id: 'unsafe-condition',
        metric: 'test',
        condition: 'console.log("hack")',
        severity: 'error',
        message: 'Unsafe condition',
      });

      expect(() => {
        collector.collect('test', 1);
      }).not.toThrow();

      // Should not trigger any alerts for unsafe conditions
      const alerts = collector.getAlerts();
      const unsafeAlerts = alerts.filter((a) =>
        a.id.includes('unsafe-condition')
      );
      expect(unsafeAlerts).toHaveLength(0);
    });

    it('should maintain compatibility with start() method', () => {
      const compatCollector = new MetricsCollector({ enableCollection: false });

      expect(() => {
        compatCollector.start();
      }).not.toThrow();

      compatCollector.destroy();
    });

    it('should handle destruction properly', () => {
      collector.collect('test', 1);

      expect(() => {
        collector.destroy();
      }).not.toThrow();

      // Should be safe to call destroy multiple times
      expect(() => {
        collector.destroy();
      }).not.toThrow();
    });

    it('should handle percentile calculation edge cases', () => {
      // Test with single value using record() for immediate series creation
      collector.record('single', 100);
      const singleSeries = collector
        .getSeries()
        .find((s) => s.name === 'single');
      expect(singleSeries).toBeDefined();
      expect(singleSeries!.aggregations.p50).toBe(100);
      expect(singleSeries!.aggregations.p95).toBe(100);
      expect(singleSeries!.aggregations.p99).toBe(100);
    });
  });
});
