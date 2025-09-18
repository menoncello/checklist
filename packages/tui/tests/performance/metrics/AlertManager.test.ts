import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { AlertManager } from '../../../src/performance/metrics/AlertManager';
import { MetricPoint, AlertRule, MetricAlert } from '../../../src/performance/metrics/types';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let originalMathRandom: typeof Math.random;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    originalMathRandom = Math.random;
    originalDateNow = Date.now;
    alertManager = new AlertManager();
  });

  afterEach(() => {
    Math.random = originalMathRandom;
    Date.now = originalDateNow;
  });

  describe('Constructor', () => {
    it('should initialize with default max alerts', () => {
      const manager = new AlertManager();
      expect(manager.getAlerts()).toEqual([]);
    });

    it('should initialize with custom max alerts', () => {
      const manager = new AlertManager(50);
      expect(manager.getAlerts()).toEqual([]);
    });

    it('should setup default alert rules', () => {
      // The constructor calls setupDefaultAlertRules, which creates default rules
      // We can verify by checking if rules exist for default metrics
      const memoryPoint: MetricPoint = {
        timestamp: Date.now(),
        value: 200 * 1024 * 1024, // 200MB - above default threshold
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(memoryPoint);
      const alerts = alertManager.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Default Rule Creation', () => {
    it('should create memory usage rule', () => {
      const memoryPoint: MetricPoint = {
        timestamp: Date.now(),
        value: 150 * 1024 * 1024, // Above 100MB threshold
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(memoryPoint);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].metric).toBe('memory.usage');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].message).toBe('High memory usage detected');
    });

    it('should create CPU usage rule', () => {
      const cpuPoint: MetricPoint = {
        timestamp: Date.now(),
        value: 85, // Above 80% threshold
        metadata: { metric: 'cpu.usage' }
      };

      alertManager.checkAlerts(cpuPoint);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].metric).toBe('cpu.usage');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].message).toBe('High CPU usage detected');
    });

    it('should create response time rule', () => {
      const responsePoint: MetricPoint = {
        timestamp: Date.now(),
        value: 1500, // Above 1000ms threshold
        metadata: { metric: 'response.time' }
      };

      alertManager.checkAlerts(responsePoint);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].metric).toBe('response.time');
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].message).toBe('Slow response time detected');
    });

    it('should create error rate rule', () => {
      const errorPoint: MetricPoint = {
        timestamp: Date.now(),
        value: 10, // Above 5% threshold
        metadata: { metric: 'error.rate' }
      };

      alertManager.checkAlerts(errorPoint);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].metric).toBe('error.rate');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].message).toBe('High error rate detected');
    });

    it('should create disk usage rule', () => {
      const diskPoint: MetricPoint = {
        timestamp: Date.now(),
        value: 95, // Above 90% threshold
        metadata: { metric: 'disk.usage' }
      };

      alertManager.checkAlerts(diskPoint);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].metric).toBe('disk.usage');
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].message).toBe('High disk usage detected');
    });
  });

  describe('Alert Rule Management', () => {
    it('should add custom alert rule', () => {
      const customRule: AlertRule = {
        id: 'custom-rule',
        metric: 'custom.metric',
        threshold: 50,
        operator: '>',
        severity: 'warning',
        message: 'Custom alert triggered'
      };

      alertManager.addAlertRule(customRule);

      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 60, // Above threshold
        metadata: { metric: 'custom.metric' }
      };

      alertManager.checkAlerts(point);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].ruleId).toBe('custom-rule');
      expect(alerts[0].metric).toBe('custom.metric');
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].message).toBe('Custom alert triggered');
    });

    it('should replace existing alert rule', () => {
      const newMemoryRule: AlertRule = {
        id: 'new-memory-rule',
        metric: 'memory.usage',
        threshold: 50 * 1024 * 1024, // 50MB - lower threshold
        operator: '>',
        severity: 'critical',
        message: 'Memory usage is very high'
      };

      alertManager.addAlertRule(newMemoryRule);

      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 60 * 1024 * 1024, // 60MB
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(point);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].ruleId).toBe('new-memory-rule');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].message).toBe('Memory usage is very high');
    });

    it('should remove alert rule', () => {
      alertManager.removeAlertRule('memory.usage');

      const memoryPoint: MetricPoint = {
        timestamp: Date.now(),
        value: 200 * 1024 * 1024, // Above original threshold
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(memoryPoint);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(0);
    });

    it('should handle removing non-existent rule', () => {
      expect(() => {
        alertManager.removeAlertRule('non.existent.metric');
      }).not.toThrow();
    });
  });

  describe('Alert Triggering Logic', () => {
    describe('Comparison Operators', () => {
      beforeEach(() => {
        const testRule: AlertRule = {
          id: 'test-rule',
          metric: 'test.metric',
          threshold: 100,
          operator: '>',
          severity: 'medium',
          message: 'Test alert'
        };
        alertManager.addAlertRule(testRule);
      });

      it('should trigger alert with > operator', () => {
        const rule = {
          id: 'test-gt',
          metric: 'test.gt',
          threshold: 100,
          operator: '>' as const,
          severity: 'medium' as const,
          message: 'Greater than test'
        };
        alertManager.addAlertRule(rule);

        const point: MetricPoint = {
          timestamp: Date.now(),
          value: 150,
          metadata: { metric: 'test.gt' }
        };

        alertManager.checkAlerts(point);
        expect(alertManager.getAlerts().length).toBe(1);
      });

      it('should trigger alert with < operator', () => {
        const rule = {
          id: 'test-lt',
          metric: 'test.lt',
          threshold: 100,
          operator: '<' as const,
          severity: 'medium' as const,
          message: 'Less than test'
        };
        alertManager.addAlertRule(rule);

        const point: MetricPoint = {
          timestamp: Date.now(),
          value: 50,
          metadata: { metric: 'test.lt' }
        };

        alertManager.checkAlerts(point);
        expect(alertManager.getAlerts().length).toBe(1);
      });

      it('should trigger alert with >= operator', () => {
        const rule = {
          id: 'test-gte',
          metric: 'test.gte',
          threshold: 100,
          operator: '>=' as const,
          severity: 'medium' as const,
          message: 'Greater than or equal test'
        };
        alertManager.addAlertRule(rule);

        const point: MetricPoint = {
          timestamp: Date.now(),
          value: 100, // Exactly equal
          metadata: { metric: 'test.gte' }
        };

        alertManager.checkAlerts(point);
        expect(alertManager.getAlerts().length).toBe(1);
      });

      it('should trigger alert with <= operator', () => {
        const rule = {
          id: 'test-lte',
          metric: 'test.lte',
          threshold: 100,
          operator: '<=' as const,
          severity: 'medium' as const,
          message: 'Less than or equal test'
        };
        alertManager.addAlertRule(rule);

        const point: MetricPoint = {
          timestamp: Date.now(),
          value: 100, // Exactly equal
          metadata: { metric: 'test.lte' }
        };

        alertManager.checkAlerts(point);
        expect(alertManager.getAlerts().length).toBe(1);
      });

      it('should trigger alert with == operator', () => {
        const rule = {
          id: 'test-eq',
          metric: 'test.eq',
          threshold: 100,
          operator: '==' as const,
          severity: 'medium' as const,
          message: 'Equal test'
        };
        alertManager.addAlertRule(rule);

        const point: MetricPoint = {
          timestamp: Date.now(),
          value: 100,
          metadata: { metric: 'test.eq' }
        };

        alertManager.checkAlerts(point);
        expect(alertManager.getAlerts().length).toBe(1);
      });

      it('should trigger alert with != operator', () => {
        const rule = {
          id: 'test-neq',
          metric: 'test.neq',
          threshold: 100,
          operator: '!=' as const,
          severity: 'medium' as const,
          message: 'Not equal test'
        };
        alertManager.addAlertRule(rule);

        const point: MetricPoint = {
          timestamp: Date.now(),
          value: 50,
          metadata: { metric: 'test.neq' }
        };

        alertManager.checkAlerts(point);
        expect(alertManager.getAlerts().length).toBe(1);
      });

      it('should not trigger with unknown operator', () => {
        const rule = {
          id: 'test-unknown',
          metric: 'test.unknown',
          threshold: 100,
          operator: 'unknown' as any,
          severity: 'medium' as const,
          message: 'Unknown operator test'
        };
        alertManager.addAlertRule(rule);

        const point: MetricPoint = {
          timestamp: Date.now(),
          value: 150,
          metadata: { metric: 'test.unknown' }
        };

        alertManager.checkAlerts(point);
        expect(alertManager.getAlerts().length).toBe(0);
      });
    });

    it('should not trigger when rule has no threshold', () => {
      const rule: AlertRule = {
        id: 'no-threshold',
        metric: 'test.metric',
        operator: '>',
        severity: 'medium',
        message: 'No threshold test'
      };
      alertManager.addAlertRule(rule);

      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 1000,
        metadata: { metric: 'test.metric' }
      };

      alertManager.checkAlerts(point);
      expect(alertManager.getAlerts().length).toBe(0);
    });

    it('should not trigger when rule has no operator', () => {
      const rule: AlertRule = {
        id: 'no-operator',
        metric: 'test.metric',
        threshold: 100,
        severity: 'medium',
        message: 'No operator test'
      };
      alertManager.addAlertRule(rule);

      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 1000,
        metadata: { metric: 'test.metric' }
      };

      alertManager.checkAlerts(point);
      expect(alertManager.getAlerts().length).toBe(0);
    });

    it('should not trigger for metric without rule', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 1000,
        metadata: { metric: 'unknown.metric' }
      };

      alertManager.checkAlerts(point);
      expect(alertManager.getAlerts().length).toBe(0);
    });

    it('should not trigger when condition is not met', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 50, // Below memory threshold
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(point);
      expect(alertManager.getAlerts().length).toBe(0);
    });
  });

  describe('Alert Creation', () => {
    beforeEach(() => {
      Date.now = mock(() => 1234567890);
      Math.random = mock(() => 0.123456789);
    });

    it('should create alert with correct structure', () => {
      const point: MetricPoint = {
        timestamp: 1234567890,
        value: 150 * 1024 * 1024,
        tags: { host: 'server1', env: 'prod' },
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(point);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].ruleId).toBe('memory-usage');
      expect(alerts[0].timestamp).toBe(1234567890);
      expect(alerts[0].severity).toBe('medium');
      expect(alerts[0].metric).toBe('memory.usage');
      expect(alerts[0].value).toBe(150 * 1024 * 1024);
      expect(alerts[0].threshold).toBe(100 * 1024 * 1024);
      expect(alerts[0].message).toBe('High memory usage detected');
      expect(alerts[0].tags).toEqual({ host: 'server1', env: 'prod' });
      expect(alerts[0].id).toMatch(/^alert-1234567890-/);
    });

    it('should generate unique alert IDs', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 150 * 1024 * 1024,
        metadata: { metric: 'memory.usage' }
      };

      // Mock different random values
      Math.random = mock(() => 0.111);
      alertManager.checkAlerts(point);

      Math.random = mock(() => 0.222);
      alertManager.checkAlerts(point);

      const alerts = alertManager.getAlerts();
      expect(alerts.length).toBe(2);
      expect(alerts[0].id).not.toBe(alerts[1].id);
    });

    it('should merge rule tags with point tags', () => {
      const ruleWithTags: AlertRule = {
        id: 'tagged-rule',
        metric: 'test.metric',
        threshold: 100,
        operator: '>',
        severity: 'medium',
        message: 'Tagged alert',
        tags: { ruleName: 'test', priority: 'high' }
      };
      alertManager.addAlertRule(ruleWithTags);

      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 150,
        tags: { host: 'server1', priority: 'medium' }, // priority will be overridden
        metadata: { metric: 'test.metric' }
      };

      alertManager.checkAlerts(point);
      const alerts = alertManager.getAlerts();

      expect(alerts[0].tags).toEqual({
        ruleName: 'test',
        priority: 'medium', // Point tags override rule tags
        host: 'server1'
      });
    });

    it('should handle missing tags gracefully', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 150 * 1024 * 1024,
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(point);
      const alerts = alertManager.getAlerts();

      expect(alerts[0].tags).toEqual({});
    });
  });

  describe('Alert Storage and Retrieval', () => {
    it('should store and retrieve alerts', () => {
      const points: MetricPoint[] = [
        {
          timestamp: Date.now(),
          value: 150 * 1024 * 1024,
          metadata: { metric: 'memory.usage' }
        },
        {
          timestamp: Date.now(),
          value: 85,
          metadata: { metric: 'cpu.usage' }
        }
      ];

      points.forEach(point => alertManager.checkAlerts(point));
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(2);
      expect(alerts[0].metric).toBe('memory.usage');
      expect(alerts[1].metric).toBe('cpu.usage');
    });

    it('should return copy of alerts array', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 150 * 1024 * 1024,
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(point);
      const alerts1 = alertManager.getAlerts();
      const alerts2 = alertManager.getAlerts();

      expect(alerts1).not.toBe(alerts2); // Different array instances
      expect(alerts1).toEqual(alerts2); // Same content
    });

    it('should clear all alerts', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 150 * 1024 * 1024,
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(point);
      expect(alertManager.getAlerts().length).toBe(1);

      alertManager.clearAlerts();
      expect(alertManager.getAlerts().length).toBe(0);
    });

    it('should trim alerts when max limit is exceeded', () => {
      const smallManager = new AlertManager(2); // Max 2 alerts

      const points: MetricPoint[] = [
        { timestamp: 1000, value: 150 * 1024 * 1024, metadata: { metric: 'memory.usage' } },
        { timestamp: 2000, value: 85, metadata: { metric: 'cpu.usage' } },
        { timestamp: 3000, value: 1500, metadata: { metric: 'response.time' } }
      ];

      points.forEach(point => smallManager.checkAlerts(point));
      const alerts = smallManager.getAlerts();

      expect(alerts.length).toBe(2);
      // Should keep the most recent alerts (cpu.usage and response.time)
      expect(alerts[0].metric).toBe('cpu.usage');
      expect(alerts[1].metric).toBe('response.time');
    });
  });

  describe('Active Alerts Filtering', () => {
    beforeEach(() => {
      Date.now = mock(() => 1000000); // Fixed current time
    });

    it('should return recent alerts as active', () => {
      const recentPoint: MetricPoint = {
        timestamp: 1000000 - 60000, // 1 minute ago
        value: 150 * 1024 * 1024,
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(recentPoint);
      const activeAlerts = alertManager.getActiveAlerts();

      expect(activeAlerts.length).toBe(1);
      expect(activeAlerts[0].metric).toBe('memory.usage');
    });

    it('should filter out old alerts', () => {
      const oldPoint: MetricPoint = {
        timestamp: 1000000 - (6 * 60 * 1000), // 6 minutes ago (older than 5 min threshold)
        value: 150 * 1024 * 1024,
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(oldPoint);
      const activeAlerts = alertManager.getActiveAlerts();

      expect(activeAlerts.length).toBe(0);
    });

    it('should mix active and inactive alerts correctly', () => {
      const points: MetricPoint[] = [
        {
          timestamp: 1000000 - (6 * 60 * 1000), // 6 minutes ago (inactive)
          value: 150 * 1024 * 1024,
          metadata: { metric: 'memory.usage' }
        },
        {
          timestamp: 1000000 - 60000, // 1 minute ago (active)
          value: 85,
          metadata: { metric: 'cpu.usage' }
        },
        {
          timestamp: 1000000 - 30000, // 30 seconds ago (active)
          value: 1500,
          metadata: { metric: 'response.time' }
        }
      ];

      points.forEach(point => alertManager.checkAlerts(point));

      const allAlerts = alertManager.getAlerts();
      const activeAlerts = alertManager.getActiveAlerts();

      expect(allAlerts.length).toBe(3);
      expect(activeAlerts.length).toBe(2);
      expect(activeAlerts.map(a => a.metric)).toEqual(['cpu.usage', 'response.time']);
    });

    it('should return empty array when no active alerts', () => {
      const oldPoint: MetricPoint = {
        timestamp: 1000000 - (10 * 60 * 1000), // 10 minutes ago
        value: 150 * 1024 * 1024,
        metadata: { metric: 'memory.usage' }
      };

      alertManager.checkAlerts(oldPoint);
      const activeAlerts = alertManager.getActiveAlerts();

      expect(activeAlerts).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle point without metadata', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 150
      };

      expect(() => {
        alertManager.checkAlerts(point);
      }).not.toThrow();

      expect(alertManager.getAlerts().length).toBe(0);
    });

    it('should handle point with null metadata', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 150,
        metadata: null as any
      };

      expect(() => {
        alertManager.checkAlerts(point);
      }).not.toThrow();

      expect(alertManager.getAlerts().length).toBe(0);
    });

    it('should handle point with undefined metric in metadata', () => {
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 150,
        metadata: { otherField: 'value' }
      };

      expect(() => {
        alertManager.checkAlerts(point);
      }).not.toThrow();

      expect(alertManager.getAlerts().length).toBe(0);
    });

    it('should handle very large values', () => {
      const rule: AlertRule = {
        id: 'large-value-rule',
        metric: 'large.metric',
        threshold: Number.MAX_SAFE_INTEGER - 1,
        operator: '>',
        severity: 'critical',
        message: 'Large value detected'
      };
      alertManager.addAlertRule(rule);

      const point: MetricPoint = {
        timestamp: Date.now(),
        value: Number.MAX_SAFE_INTEGER,
        metadata: { metric: 'large.metric' }
      };

      alertManager.checkAlerts(point);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].value).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle negative values', () => {
      const rule: AlertRule = {
        id: 'negative-rule',
        metric: 'negative.metric',
        threshold: -10,
        operator: '<',
        severity: 'medium',
        message: 'Negative value detected'
      };
      alertManager.addAlertRule(rule);

      const point: MetricPoint = {
        timestamp: Date.now(),
        value: -20,
        metadata: { metric: 'negative.metric' }
      };

      alertManager.checkAlerts(point);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].value).toBe(-20);
    });

    it('should handle zero values', () => {
      const rule: AlertRule = {
        id: 'zero-rule',
        metric: 'zero.metric',
        threshold: 0,
        operator: '==',
        severity: 'info',
        message: 'Zero value detected'
      };
      alertManager.addAlertRule(rule);

      const point: MetricPoint = {
        timestamp: Date.now(),
        value: 0,
        metadata: { metric: 'zero.metric' }
      };

      alertManager.checkAlerts(point);
      const alerts = alertManager.getAlerts();

      expect(alerts.length).toBe(1);
      expect(alerts[0].value).toBe(0);
    });
  });
});