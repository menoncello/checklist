import { describe, it, expect, beforeEach } from 'bun:test';

import {
  PerformanceBudget,
  type BudgetViolation,
  type PerformanceBudgetConfig,
} from './PerformanceBudget';
import type { PerformanceMetric } from './helpers/MetricsTracker';

describe('PerformanceBudget', () => {
  let budget: PerformanceBudget;

  beforeEach(() => {
    budget = new PerformanceBudget();
  });

  describe('configuration', () => {
    it('should have default configuration', () => {
      const config = budget.getConfig();
      expect(config.renderTime).toBe(50);
      expect(config.memoryBaseline).toBe(52428800); // 50MB
      expect(config.memoryDelta).toBe(10485760); // 10MB
      expect(config.cpuUsage).toBe(80);
      expect(config.startupTime).toBe(100);
      expect(config.responseTime).toBe(50);
      expect(config.frameRate).toBe(30);
    });

    it('should accept custom configuration', () => {
      const customBudget = new PerformanceBudget({
        renderTime: 100,
        memoryBaseline: 104857600, // 100MB
        cpuUsage: 90,
      });

      const config = customBudget.getConfig();
      expect(config.renderTime).toBe(100);
      expect(config.memoryBaseline).toBe(104857600);
      expect(config.cpuUsage).toBe(90);
    });

    it('should update configuration', () => {
      budget.updateConfig({ renderTime: 75 });
      const config = budget.getConfig();
      expect(config.renderTime).toBe(75);
      expect(config.memoryBaseline).toBe(52428800); // unchanged
    });
  });

  describe('metric checking', () => {
    it('should detect render time violations', () => {
      const metric: PerformanceMetric = {
        id: 'test-1',
        name: 'render.time',
        value: 60, // over 50ms budget
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).not.toBeNull();
      expect(violation?.metric).toBe('renderTime');
      expect(violation?.actual).toBe(60);
      expect(violation?.budget).toBe(50);
      expect(violation?.severity).toBe('warning');
    });

    it('should detect critical render time violations', () => {
      const metric: PerformanceMetric = {
        id: 'test-2',
        name: 'render.time',
        value: 80, // over 75ms (50 * 1.5)
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('critical');
    });

    it('should detect memory baseline violations', () => {
      const metric: PerformanceMetric = {
        id: 'test-3',
        name: 'memory.usage',
        value: 60000000, // 60MB, over 50MB budget
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).not.toBeNull();
      expect(violation?.metric).toBe('memoryBaseline');
      expect(violation?.severity).toBe('warning');
    });

    it('should detect memory delta violations', () => {
      const metric: PerformanceMetric = {
        id: 'test-4',
        name: 'memory.delta',
        value: 15000000, // 15MB, over 10MB budget
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).not.toBeNull();
      expect(violation?.metric).toBe('memoryDelta');
      expect(violation?.severity).toBe('critical');
    });

    it('should detect CPU usage violations', () => {
      const metric: PerformanceMetric = {
        id: 'test-5',
        name: 'cpu.usage',
        value: 85, // over 80% budget
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).not.toBeNull();
      expect(violation?.metric).toBe('cpuUsage');
      expect(violation?.severity).toBe('warning');
    });

    it('should detect critical CPU usage violations', () => {
      const metric: PerformanceMetric = {
        id: 'test-6',
        name: 'cpu.usage',
        value: 95, // over 90%
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('critical');
    });

    it('should detect low frame rate', () => {
      const metric: PerformanceMetric = {
        id: 'test-7',
        name: 'frame.rate',
        value: 25, // under 30fps budget
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).not.toBeNull();
      expect(violation?.metric).toBe('frameRate');
      expect(violation?.severity).toBe('warning');
    });

    it('should detect critical low frame rate', () => {
      const metric: PerformanceMetric = {
        id: 'test-8',
        name: 'frame.rate',
        value: 10, // under 15fps (30/2)
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('critical');
    });

    it('should return null for metrics within budget', () => {
      const metric: PerformanceMetric = {
        id: 'test-9',
        name: 'render.time',
        value: 30, // under 50ms budget
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).toBeNull();
    });

    it('should return null for unknown metrics', () => {
      const metric: PerformanceMetric = {
        id: 'test-10',
        name: 'unknown.metric',
        value: 999999,
        timestamp: Date.now(),
      };

      const violation = budget.checkMetric(metric);
      expect(violation).toBeNull();
    });
  });

  describe('violation tracking', () => {
    it('should track violations', () => {
      const metric: PerformanceMetric = {
        id: 'test-11',
        name: 'render.time',
        value: 60,
        timestamp: Date.now(),
      };

      budget.checkMetric(metric);
      const violations = budget.getViolations();
      expect(violations.length).toBe(1);
      expect(violations[0].metric).toBe('renderTime');
    });

    it('should filter violations by severity', () => {
      // Add warning violation
      budget.checkMetric({
        id: 'test-12',
        name: 'render.time',
        value: 60,
        timestamp: Date.now(),
      });

      // Add critical violation
      budget.checkMetric({
        id: 'test-13',
        name: 'render.time',
        value: 100,
        timestamp: Date.now(),
      });

      const warnings = budget.getViolations('warning');
      const criticals = budget.getViolations('critical');

      expect(warnings.length).toBe(1);
      expect(criticals.length).toBe(1);
    });

    it('should filter violations by time', () => {
      const now = Date.now();
      const old = now - 10000;

      // Manually add old violation
      const oldViolation = {
        metric: 'renderTime',
        actual: 60,
        budget: 50,
        severity: 'warning' as const,
        timestamp: old,
      };

      // Add it by checking a metric that will violate
      budget.checkMetric({
        id: 'old',
        name: 'render.time',
        value: 60,
        timestamp: old,
      });

      // Add recent violation
      budget.checkMetric({
        id: 'recent',
        name: 'render.time',
        value: 70,
        timestamp: now,
      });

      const recentViolations = budget.getViolations(undefined, now - 5000);
      expect(recentViolations.length).toBe(1);
      expect(recentViolations[0].actual).toBe(70);
    });

    it('should limit violation buffer size', () => {
      // Add more than 100 violations
      for (let i = 0; i < 110; i++) {
        budget.checkMetric({
          id: `test-${i}`,
          name: 'render.time',
          value: 60 + i,
          timestamp: Date.now(),
        });
      }

      const violations = budget.getViolations();
      expect(violations.length).toBeLessThanOrEqual(100);
    });

    it('should clear violations', () => {
      budget.checkMetric({
        id: 'test-14',
        name: 'render.time',
        value: 60,
        timestamp: Date.now(),
      });

      expect(budget.getViolations().length).toBe(1);
      budget.clearViolations();
      expect(budget.getViolations().length).toBe(0);
    });
  });

  describe('status reporting', () => {
    it('should report status correctly', () => {
      const status = budget.getStatus();
      expect(status.hasViolations).toBe(false);
      expect(status.criticalCount).toBe(0);
      expect(status.warningCount).toBe(0);
      expect(status.recentViolations.length).toBe(0);
    });

    it('should report violations in status', () => {
      budget.checkMetric({
        id: 'test-15',
        name: 'render.time',
        value: 60,
        timestamp: Date.now(),
      });

      budget.checkMetric({
        id: 'test-16',
        name: 'render.time',
        value: 100,
        timestamp: Date.now(),
      });

      const status = budget.getStatus();
      expect(status.hasViolations).toBe(true);
      expect(status.criticalCount).toBe(1);
      expect(status.warningCount).toBe(1);
      expect(status.recentViolations.length).toBe(2);
    });
  });

  describe('event handling', () => {
    it('should emit violation events', () => {
      let violationReceived = false;
      let receivedViolation: BudgetViolation | null = null;

      budget.on('violation', (violation: BudgetViolation) => {
        violationReceived = true;
        receivedViolation = violation;
      });

      budget.checkMetric({
        id: 'test-17',
        name: 'render.time',
        value: 60,
        timestamp: Date.now(),
      });

      expect(violationReceived).toBe(true);
      expect(receivedViolation).not.toBeNull();
      expect(receivedViolation!.metric).toBe('renderTime');
    });

    it('should emit configUpdated events', () => {
      let configUpdated = false;
      let receivedConfig: PerformanceBudgetConfig | null = null;

      budget.on('configUpdated', (config: PerformanceBudgetConfig) => {
        configUpdated = true;
        receivedConfig = config;
      });

      budget.updateConfig({ renderTime: 75 });

      expect(configUpdated).toBe(true);
      expect(receivedConfig).not.toBeNull();
      expect(receivedConfig!.renderTime).toBe(75);
    });

    it('should handle event handler errors gracefully', () => {
      budget.on('violation', () => {
        throw new Error('Handler error');
      });

      // Should not throw
      expect(() => {
        budget.checkMetric({
          id: 'test-18',
          name: 'render.time',
          value: 60,
          timestamp: Date.now(),
        });
      }).not.toThrow();
    });

    it('should support removing event handlers', () => {
      let callCount = 0;
      const handler = () => callCount++;

      budget.on('violation', handler);

      budget.checkMetric({
        id: 'test-19',
        name: 'render.time',
        value: 60,
        timestamp: Date.now(),
      });

      expect(callCount).toBe(1);

      budget.off('violation', handler);

      budget.checkMetric({
        id: 'test-20',
        name: 'render.time',
        value: 70,
        timestamp: Date.now(),
      });

      expect(callCount).toBe(1); // Should not increase
    });
  });
});
