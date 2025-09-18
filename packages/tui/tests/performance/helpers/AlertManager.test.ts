import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { AlertManager, PerformanceThreshold, PerformanceAlert } from '../../../src/performance/helpers/AlertManager';
import { PerformanceMetric } from '../../../src/performance/helpers/MetricsTracker';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let originalDateNow: typeof Date.now;
  let originalMathRandom: typeof Math.random;

  beforeEach(() => {
    originalDateNow = Date.now;
    originalMathRandom = Math.random;
    alertManager = new AlertManager();
  });

  afterEach(() => {
    Date.now = originalDateNow;
    Math.random = originalMathRandom;
  });

  describe('constructor', () => {
    test('should initialize with default buffer size', () => {
      const manager = new AlertManager();
      expect(manager.count()).toBe(0);
    });

    test('should initialize with custom buffer size', () => {
      const manager = new AlertManager(500);
      expect(manager.count()).toBe(0);
    });

    test('should setup default thresholds', () => {
      const thresholds = alertManager.getThresholds();
      expect(thresholds.length).toBe(4);

      const metricNames = thresholds.map(t => t.metric);
      expect(metricNames).toContain('memory.heapUsed');
      expect(metricNames).toContain('cpu.usage');
      expect(metricNames).toContain('render.frameTime');
      expect(metricNames).toContain('gc.duration');
    });

    test('should setup correct default threshold values', () => {
      const memoryThreshold = alertManager.getThreshold('memory.heapUsed');
      expect(memoryThreshold?.warningValue).toBe(100 * 1024 * 1024);
      expect(memoryThreshold?.criticalValue).toBe(500 * 1024 * 1024);
      expect(memoryThreshold?.direction).toBe('above');

      const cpuThreshold = alertManager.getThreshold('cpu.usage');
      expect(cpuThreshold?.warningValue).toBe(70);
      expect(cpuThreshold?.criticalValue).toBe(90);
      expect(cpuThreshold?.direction).toBe('above');

      const renderThreshold = alertManager.getThreshold('render.frameTime');
      expect(renderThreshold?.warningValue).toBe(16.67);
      expect(renderThreshold?.criticalValue).toBe(33.33);
      expect(renderThreshold?.direction).toBe('above');

      const gcThreshold = alertManager.getThreshold('gc.duration');
      expect(gcThreshold?.warningValue).toBe(10);
      expect(gcThreshold?.criticalValue).toBe(50);
      expect(gcThreshold?.direction).toBe('above');
    });
  });

  describe('addThreshold', () => {
    test('should add new threshold', () => {
      const threshold: PerformanceThreshold = {
        metric: 'custom.metric',
        warningValue: 100,
        criticalValue: 200,
        direction: 'above',
      };

      alertManager.addThreshold(threshold);
      const result = alertManager.getThreshold('custom.metric');

      expect(result).toEqual(threshold);
    });

    test('should replace existing threshold', () => {
      const newThreshold: PerformanceThreshold = {
        metric: 'cpu.usage',
        warningValue: 50,
        criticalValue: 80,
        direction: 'above',
      };

      alertManager.addThreshold(newThreshold);
      const result = alertManager.getThreshold('cpu.usage');

      expect(result?.warningValue).toBe(50);
      expect(result?.criticalValue).toBe(80);
    });

    test('should handle threshold with below direction', () => {
      const threshold: PerformanceThreshold = {
        metric: 'fps',
        warningValue: 30,
        criticalValue: 15,
        direction: 'below',
      };

      alertManager.addThreshold(threshold);
      const result = alertManager.getThreshold('fps');

      expect(result?.direction).toBe('below');
    });

    test('should handle multiple custom thresholds', () => {
      const threshold1: PerformanceThreshold = {
        metric: 'metric1',
        warningValue: 10,
        criticalValue: 20,
        direction: 'above',
      };

      const threshold2: PerformanceThreshold = {
        metric: 'metric2',
        warningValue: 5,
        criticalValue: 2,
        direction: 'below',
      };

      alertManager.addThreshold(threshold1);
      alertManager.addThreshold(threshold2);

      expect(alertManager.getThresholds().length).toBe(6); // 4 default + 2 custom
    });
  });

  describe('removeThreshold', () => {
    test('should remove existing threshold', () => {
      const result = alertManager.removeThreshold('cpu.usage');
      expect(result).toBe(true);
      expect(alertManager.getThreshold('cpu.usage')).toBe(null);
    });

    test('should return false for non-existent threshold', () => {
      const result = alertManager.removeThreshold('non.existent');
      expect(result).toBe(false);
    });

    test('should handle removing custom threshold', () => {
      const threshold: PerformanceThreshold = {
        metric: 'custom.metric',
        warningValue: 100,
        criticalValue: 200,
        direction: 'above',
      };

      alertManager.addThreshold(threshold);
      expect(alertManager.getThreshold('custom.metric')).not.toBe(null);

      const result = alertManager.removeThreshold('custom.metric');
      expect(result).toBe(true);
      expect(alertManager.getThreshold('custom.metric')).toBe(null);
    });

    test('should handle removing all custom thresholds', () => {
      alertManager.removeThreshold('memory.heapUsed');
      alertManager.removeThreshold('cpu.usage');
      alertManager.removeThreshold('render.frameTime');
      alertManager.removeThreshold('gc.duration');

      expect(alertManager.getThresholds().length).toBe(0);
    });
  });

  describe('checkMetric', () => {
    beforeEach(() => {
      Date.now = mock(() => 1000);
      Math.random = mock(() => 0.5);
    });

    test('should return null for metric without threshold', () => {
      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'unknown.metric',
        value: 100,
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);
      expect(alert).toBe(null);
    });

    test('should return null when metric is within normal range', () => {
      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'cpu.usage',
        value: 50, // Below warning threshold of 70
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);
      expect(alert).toBe(null);
    });

    test('should create warning alert for above threshold', () => {
      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'cpu.usage',
        value: 75, // Above warning (70) but below critical (90)
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);

      expect(alert).not.toBe(null);
      expect(alert?.level).toBe('warning');
      expect(alert?.metric).toBe('cpu.usage');
      expect(alert?.value).toBe(75);
      expect(alert?.message).toContain('above warning threshold');
    });

    test('should create critical alert for above threshold', () => {
      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'cpu.usage',
        value: 95, // Above critical threshold of 90
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);

      expect(alert).not.toBe(null);
      expect(alert?.level).toBe('critical');
      expect(alert?.metric).toBe('cpu.usage');
      expect(alert?.value).toBe(95);
      expect(alert?.message).toContain('above critical threshold');
    });

    test('should handle below threshold direction', () => {
      const threshold: PerformanceThreshold = {
        metric: 'fps',
        warningValue: 30,
        criticalValue: 15,
        direction: 'below',
      };

      alertManager.addThreshold(threshold);

      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'fps',
        value: 25, // Below warning (30) but above critical (15)
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);

      expect(alert).not.toBe(null);
      expect(alert?.level).toBe('warning');
      expect(alert?.message).toContain('below warning threshold');
    });

    test('should create critical alert for below threshold', () => {
      const threshold: PerformanceThreshold = {
        metric: 'fps',
        warningValue: 30,
        criticalValue: 15,
        direction: 'below',
      };

      alertManager.addThreshold(threshold);

      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'fps',
        value: 10, // Below critical threshold of 15
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);

      expect(alert).not.toBe(null);
      expect(alert?.level).toBe('critical');
      expect(alert?.message).toContain('below critical threshold');
    });

    test('should add alert to alerts list', () => {
      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'cpu.usage',
        value: 75,
        timestamp: 1000,
      };

      expect(alertManager.count()).toBe(0);
      alertManager.checkMetric(metric);
      expect(alertManager.count()).toBe(1);
    });

    test('should create unique alert IDs', () => {
      Date.now = mock(() => 1000);
      Math.random = mock(() => 0.123);

      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'cpu.usage',
        value: 75,
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);
      expect(alert?.id).toBe('alert-1000-0.123');
    });

    test('should handle exact threshold values', () => {
      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'cpu.usage',
        value: 70, // Exactly warning threshold
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);
      expect(alert?.level).toBe('warning');
    });

    test('should handle buffer size overflow', () => {
      const smallManager = new AlertManager(2);
      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'cpu.usage',
        value: 75,
        timestamp: 1000,
      };

      // Add 3 alerts to a buffer of size 2
      smallManager.checkMetric(metric);
      smallManager.checkMetric(metric);
      smallManager.checkMetric(metric);

      expect(smallManager.count()).toBe(2); // Should be trimmed to buffer size
    });

    test('should preserve most recent alerts when buffer overflows', () => {
      const smallManager = new AlertManager(2);

      Date.now = mock(() => 1000);
      Math.random = mock(() => 0.1);
      smallManager.checkMetric({
        id: 'test-1', name: 'cpu.usage', value: 75, timestamp: 1000
      });

      Date.now = mock(() => 2000);
      Math.random = mock(() => 0.2);
      smallManager.checkMetric({
        id: 'test-2', name: 'cpu.usage', value: 75, timestamp: 2000
      });

      Date.now = mock(() => 3000);
      Math.random = mock(() => 0.3);
      smallManager.checkMetric({
        id: 'test-3', name: 'cpu.usage', value: 75, timestamp: 3000
      });

      const alerts = smallManager.getAlerts();
      expect(alerts.length).toBe(2);
      expect(alerts[0].id).toBe('alert-2000-0.2');
      expect(alerts[1].id).toBe('alert-3000-0.3');
    });
  });

  describe('createAlert (private method behavior)', () => {
    test('should create alert with correct structure', () => {
      Date.now = mock(() => 1500);
      Math.random = mock(() => 0.75);

      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'cpu.usage',
        value: 75,
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);

      expect(alert).toBeDefined();
      expect(alert!).toEqual({
        id: 'alert-1500-0.75',
        timestamp: 1500,
        metric: 'cpu.usage',
        value: 75,
        threshold: alertManager.getThreshold('cpu.usage')!,
        level: 'warning',
        message: 'Metric \'cpu.usage\' is above warning threshold: 75 above 70',
      });
    });

    test('should create proper message for below direction', () => {
      const threshold: PerformanceThreshold = {
        metric: 'fps',
        warningValue: 30,
        criticalValue: 15,
        direction: 'below',
      };

      alertManager.addThreshold(threshold);

      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'fps',
        value: 25,
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);
      expect(alert?.message).toBe('Metric \'fps\' is below warning threshold: 25 below 30');
    });
  });

  describe('getAlerts', () => {
    beforeEach(() => {
      Date.now = mock(() => 1000);
      Math.random = mock(() => 0.5);

      // Create some test alerts
      alertManager.checkMetric({
        id: 'test-1', name: 'cpu.usage', value: 75, timestamp: 1000
      }); // warning

      alertManager.checkMetric({
        id: 'test-2', name: 'cpu.usage', value: 95, timestamp: 1000
      }); // critical

      alertManager.checkMetric({
        id: 'test-3', name: 'memory.heapUsed', value: 150 * 1024 * 1024, timestamp: 1000
      }); // warning
    });

    test('should return all alerts when no level specified', () => {
      const alerts = alertManager.getAlerts();
      expect(alerts.length).toBe(3);
    });

    test('should return only warning alerts', () => {
      const alerts = alertManager.getAlerts('warning');
      expect(alerts.length).toBe(2);
      expect(alerts.every(a => a.level === 'warning')).toBe(true);
    });

    test('should return only critical alerts', () => {
      const alerts = alertManager.getAlerts('critical');
      expect(alerts.length).toBe(1);
      expect(alerts[0].level).toBe('critical');
    });

    test('should return empty array when no alerts of specified level', () => {
      alertManager.clear();
      const alerts = alertManager.getAlerts('warning');
      expect(alerts).toEqual([]);
    });

    test('should return copy of alerts array', () => {
      const alerts1 = alertManager.getAlerts();
      const alerts2 = alertManager.getAlerts();

      expect(alerts1).not.toBe(alerts2);
      expect(alerts1).toEqual(alerts2);
    });
  });

  describe('getThresholds', () => {
    test('should return all thresholds', () => {
      const thresholds = alertManager.getThresholds();
      expect(thresholds.length).toBe(4); // Default thresholds
    });

    test('should return copy of thresholds', () => {
      const thresholds1 = alertManager.getThresholds();
      const thresholds2 = alertManager.getThresholds();

      expect(thresholds1).not.toBe(thresholds2);
      expect(thresholds1).toEqual(thresholds2);
    });

    test('should include custom thresholds', () => {
      const customThreshold: PerformanceThreshold = {
        metric: 'custom.metric',
        warningValue: 100,
        criticalValue: 200,
        direction: 'above',
      };

      alertManager.addThreshold(customThreshold);
      const thresholds = alertManager.getThresholds();

      expect(thresholds.length).toBe(5);
      expect(thresholds.find(t => t.metric === 'custom.metric')).toEqual(customThreshold);
    });
  });

  describe('getThreshold', () => {
    test('should return specific threshold', () => {
      const threshold = alertManager.getThreshold('cpu.usage');
      expect(threshold?.metric).toBe('cpu.usage');
      expect(threshold?.warningValue).toBe(70);
    });

    test('should return null for non-existent threshold', () => {
      const threshold = alertManager.getThreshold('non.existent');
      expect(threshold).toBe(null);
    });

    test('should return custom threshold', () => {
      const customThreshold: PerformanceThreshold = {
        metric: 'custom.metric',
        warningValue: 100,
        criticalValue: 200,
        direction: 'above',
      };

      alertManager.addThreshold(customThreshold);
      const result = alertManager.getThreshold('custom.metric');

      expect(result).toEqual(customThreshold);
    });
  });

  describe('clear', () => {
    test('should clear all alerts', () => {
      // Add some alerts
      alertManager.checkMetric({
        id: 'test-1', name: 'cpu.usage', value: 75, timestamp: 1000
      });
      alertManager.checkMetric({
        id: 'test-2', name: 'cpu.usage', value: 95, timestamp: 1000
      });

      expect(alertManager.count()).toBe(2);
      alertManager.clear();
      expect(alertManager.count()).toBe(0);
    });

    test('should not affect thresholds', () => {
      alertManager.clear();
      expect(alertManager.getThresholds().length).toBe(4);
    });

    test('should allow new alerts after clear', () => {
      alertManager.checkMetric({
        id: 'test-1', name: 'cpu.usage', value: 75, timestamp: 1000
      });
      alertManager.clear();

      alertManager.checkMetric({
        id: 'test-2', name: 'cpu.usage', value: 80, timestamp: 1000
      });

      expect(alertManager.count()).toBe(1);
    });
  });

  describe('clearThresholds', () => {
    test('should clear all thresholds and restore defaults', () => {
      // Add custom threshold
      alertManager.addThreshold({
        metric: 'custom.metric',
        warningValue: 100,
        criticalValue: 200,
        direction: 'above',
      });

      expect(alertManager.getThresholds().length).toBe(5);

      alertManager.clearThresholds();

      const thresholds = alertManager.getThresholds();
      expect(thresholds.length).toBe(4);
      expect(thresholds.find(t => t.metric === 'custom.metric')).toBeUndefined();
    });

    test('should restore default thresholds correctly', () => {
      alertManager.clearThresholds();

      const cpuThreshold = alertManager.getThreshold('cpu.usage');
      expect(cpuThreshold?.warningValue).toBe(70);
      expect(cpuThreshold?.criticalValue).toBe(90);
    });

    test('should not clear alerts', () => {
      alertManager.checkMetric({
        id: 'test-1', name: 'cpu.usage', value: 75, timestamp: 1000
      });

      alertManager.clearThresholds();
      expect(alertManager.count()).toBe(1);
    });
  });

  describe('count', () => {
    test('should return zero for empty alert manager', () => {
      expect(alertManager.count()).toBe(0);
    });

    test('should return correct count after adding alerts', () => {
      alertManager.checkMetric({
        id: 'test-1', name: 'cpu.usage', value: 75, timestamp: 1000
      });
      expect(alertManager.count()).toBe(1);

      alertManager.checkMetric({
        id: 'test-2', name: 'cpu.usage', value: 95, timestamp: 1000
      });
      expect(alertManager.count()).toBe(2);
    });

    test('should return correct count after clearing', () => {
      alertManager.checkMetric({
        id: 'test-1', name: 'cpu.usage', value: 75, timestamp: 1000
      });
      alertManager.clear();
      expect(alertManager.count()).toBe(0);
    });
  });

  describe('integration tests', () => {
    test('should handle complex scenario with multiple metrics and thresholds', () => {
      // Add custom threshold
      alertManager.addThreshold({
        metric: 'network.latency',
        warningValue: 100,
        criticalValue: 500,
        direction: 'above',
      });

      // Test various metrics
      const metrics: PerformanceMetric[] = [
        { id: '1', name: 'cpu.usage', value: 50, timestamp: 1000 }, // OK
        { id: '2', name: 'cpu.usage', value: 75, timestamp: 1001 }, // Warning
        { id: '3', name: 'cpu.usage', value: 95, timestamp: 1002 }, // Critical
        { id: '4', name: 'memory.heapUsed', value: 200 * 1024 * 1024, timestamp: 1003 }, // Warning
        { id: '5', name: 'network.latency', value: 250, timestamp: 1004 }, // Warning
        { id: '6', name: 'unknown.metric', value: 1000, timestamp: 1005 }, // No threshold
      ];

      let alertCount = 0;
      metrics.forEach(metric => {
        const alert = alertManager.checkMetric(metric);
        if (alert) alertCount++;
      });

      expect(alertCount).toBe(4); // 4 alerts should be created
      expect(alertManager.count()).toBe(4);

      const warningAlerts = alertManager.getAlerts('warning');
      const criticalAlerts = alertManager.getAlerts('critical');

      expect(warningAlerts.length).toBe(3);
      expect(criticalAlerts.length).toBe(1);
    });

    test('should handle edge cases with threshold boundaries', () => {
      const metrics: PerformanceMetric[] = [
        { id: '1', name: 'cpu.usage', value: 69.99, timestamp: 1000 }, // Just below warning
        { id: '2', name: 'cpu.usage', value: 70, timestamp: 1001 }, // Exactly warning
        { id: '3', name: 'cpu.usage', value: 70.01, timestamp: 1002 }, // Just above warning
        { id: '4', name: 'cpu.usage', value: 89.99, timestamp: 1003 }, // Just below critical
        { id: '5', name: 'cpu.usage', value: 90, timestamp: 1004 }, // Exactly critical
        { id: '6', name: 'cpu.usage', value: 90.01, timestamp: 1005 }, // Just above critical
      ];

      const results = metrics.map(metric => alertManager.checkMetric(metric));

      expect(results[0]).toBe(null); // Below warning
      expect(results[1]?.level).toBe('warning'); // Exactly warning
      expect(results[2]?.level).toBe('warning'); // Above warning
      expect(results[3]?.level).toBe('warning'); // Below critical
      expect(results[4]?.level).toBe('critical'); // Exactly critical
      expect(results[5]?.level).toBe('critical'); // Above critical
    });

    test('should handle high-frequency alerts with buffer management', () => {
      const smallManager = new AlertManager(10);

      // Generate 20 alerts with mocked time
      for (let i = 0; i < 20; i++) {
        Date.now = mock(() => 1000 + i);
        Math.random = mock(() => 0.5);

        smallManager.checkMetric({
          id: `test-${i}`,
          name: 'cpu.usage',
          value: 75,
          timestamp: 1000 + i,
        });
      }

      expect(smallManager.count()).toBe(10); // Should be limited by buffer size

      const alerts = smallManager.getAlerts();
      // Should contain the most recent 10 alerts
      expect(alerts[0].timestamp).toBe(1010);
      expect(alerts[9].timestamp).toBe(1019);
    });
  });

  describe('PerformanceThreshold and PerformanceAlert classes', () => {
    test('should have correct property types', () => {
      const threshold: PerformanceThreshold = {
        metric: 'test.metric',
        warningValue: 50,
        criticalValue: 100,
        direction: 'above',
      };

      expect(typeof threshold.metric).toBe('string');
      expect(typeof threshold.warningValue).toBe('number');
      expect(typeof threshold.criticalValue).toBe('number');
      expect(threshold.direction === 'above' || threshold.direction === 'below').toBe(true);
    });

    test('should create valid alert structure', () => {
      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'cpu.usage',
        value: 75,
        timestamp: 1000,
      };

      const alert = alertManager.checkMetric(metric);

      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('timestamp');
      expect(alert).toHaveProperty('metric');
      expect(alert).toHaveProperty('value');
      expect(alert).toHaveProperty('threshold');
      expect(alert).toHaveProperty('level');
      expect(alert).toHaveProperty('message');

      expect(typeof alert?.id).toBe('string');
      expect(typeof alert?.timestamp).toBe('number');
      expect(typeof alert?.metric).toBe('string');
      expect(typeof alert?.value).toBe('number');
      expect(typeof alert?.message).toBe('string');
      expect(alert?.level === 'warning' || alert?.level === 'critical').toBe(true);
    });
  });
});