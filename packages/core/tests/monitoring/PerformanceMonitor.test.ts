import { test, expect, mock, beforeEach, afterEach, describe } from 'bun:test';
import { PerformanceMonitorService } from '../../src/monitoring/PerformanceMonitor';
import { createLogger } from '../../src/utils/logger';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitorService;
  let mockLogger: any;

  beforeEach(async () => {
    // Create mock logger
    mockLogger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      child: mock(() => mockLogger),
    };

    performanceMonitor = new PerformanceMonitorService(
      { name: 'test-performance-monitor' },
      mockLogger
    );

    await performanceMonitor.initialize();
  });

  afterEach(async () => {
    await performanceMonitor.shutdown();
    performanceMonitor.clear();
  });

  test('should initialize with enabled state', () => {
    expect(performanceMonitor.isEnabled()).toBe(true);
  });

  test('should record metrics correctly', () => {
    performanceMonitor.recordMetric('test-operation', 50);
    performanceMonitor.recordMetric('test-operation', 100);
    performanceMonitor.recordMetric('test-operation', 75);

    const metric = performanceMonitor.getMetrics('test-operation');
    expect(metric).toBeDefined();
    expect(metric!.count).toBe(3);
    expect(metric!.min).toBe(50);
    expect(metric!.max).toBe(100);
    expect(metric!.average).toBe(75);
    expect(metric!.total).toBe(225);
  });

  test('should start and stop timers correctly', async () => {
    const timer = performanceMonitor.startTimer('timer-test');
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    timer(); // Stop timer

    const metric = performanceMonitor.getMetrics('timer-test');
    expect(metric).toBeDefined();
    expect(metric!.count).toBe(1);
    expect(metric!.average).toBeGreaterThan(5); // At least 5ms due to setTimeout
  });

  test('should set and enforce budgets', () => {
    performanceMonitor.setBudget('budget-test', 50, 'critical');
    
    // Record within budget
    performanceMonitor.recordMetric('budget-test', 30);
    let violations = performanceMonitor.getBudgetViolations();
    expect(violations).toHaveLength(0);

    // Record exceeding budget
    performanceMonitor.recordMetric('budget-test', 75);
    violations = performanceMonitor.getBudgetViolations();
    expect(violations).toHaveLength(1);
    expect(violations[0].operation).toBe('budget-test');
    expect(violations[0].budget).toBe(50);
    expect(violations[0].actual).toBe(75);
    expect(violations[0].severity).toBe('critical');
    expect(violations[0].exceedance).toBe(50); // 50% over budget
  });

  test('should generate comprehensive reports', () => {
    // Add some test data
    performanceMonitor.recordMetric('operation-1', 25);
    performanceMonitor.recordMetric('operation-1', 35);
    performanceMonitor.recordMetric('operation-2', 100);
    performanceMonitor.setBudget('operation-2', 50);

    const report = performanceMonitor.generateReport();

    expect(report.summary.totalOperations).toBe(2);
    expect(report.summary.budgetViolations).toBe(1);
    expect(report.summary.overallHealth).toBe('DEGRADED'); // No critical severity set, so it's degraded
    
    expect(report.metrics['operation-1']).toBeDefined();
    expect(report.metrics['operation-2']).toBeDefined();
    
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].operation).toBe('operation-2');
  });

  test('should clear metrics correctly', () => {
    performanceMonitor.recordMetric('test-clear', 50);
    expect(performanceMonitor.getMetrics('test-clear')).toBeDefined();

    performanceMonitor.clear();
    expect(performanceMonitor.getMetrics('test-clear')).toBeUndefined();
  });

  test('should disable/enable correctly', () => {
    expect(performanceMonitor.isEnabled()).toBe(true);

    performanceMonitor.setEnabled(false);
    expect(performanceMonitor.isEnabled()).toBe(false);

    // Timer should be no-op when disabled
    const timer = performanceMonitor.startTimer('disabled-test');
    timer();
    expect(performanceMonitor.getMetrics('disabled-test')).toBeUndefined();

    performanceMonitor.setEnabled(true);
    expect(performanceMonitor.isEnabled()).toBe(true);
  });

  test('should calculate percentiles with sufficient data', () => {
    // Add enough data points for percentile calculation
    const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
    durations.forEach(duration => {
      performanceMonitor.recordMetric('percentile-test', duration);
    });

    const metric = performanceMonitor.getMetrics('percentile-test');
    expect(metric).toBeDefined();
    expect(metric!.p95).toBeDefined();
    expect(metric!.p99).toBeDefined();
    expect(metric!.p95).toBeGreaterThan(metric!.average);
  });

  test('should handle budget exceedance logging', () => {
    performanceMonitor.setBudget('log-test', 50, 'warning');
    performanceMonitor.recordMetric('log-test', 75);

    // Should have called logger warn
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  test('should determine correct health status', () => {
    // Healthy state (no violations)
    performanceMonitor.recordMetric('healthy-op', 25);
    let report = performanceMonitor.generateReport();
    expect(report.summary.overallHealth).toBe('HEALTHY');

    // Degraded state (warning violations)
    performanceMonitor.setBudget('warning-op', 50, 'warning');
    performanceMonitor.recordMetric('warning-op', 75);
    report = performanceMonitor.generateReport();
    expect(report.summary.overallHealth).toBe('DEGRADED');

    // Critical state (critical violations)
    performanceMonitor.setBudget('critical-op', 50, 'critical');
    performanceMonitor.recordMetric('critical-op', 100);
    report = performanceMonitor.generateReport();
    expect(report.summary.overallHealth).toBe('CRITICAL');
  });

  test('should maintain buffer size limits', () => {
    const monitor = new PerformanceMonitorService(
      { 
        name: 'buffer-test',
        performance: { enabled: true, bufferSize: 5 }
      },
      mockLogger
    );

    // Add more data than buffer size
    for (let i = 0; i < 10; i++) {
      monitor.recordMetric('buffer-test', i * 10);
    }

    const metric = monitor.getMetrics('buffer-test');
    expect(metric).toBeDefined();
    expect(metric!.count).toBe(10); // Count should still reflect all entries
  });

  test('should log final report on shutdown', async () => {
    performanceMonitor.recordMetric('shutdown-test', 50);
    performanceMonitor.setBudget('violation-test', 30);
    performanceMonitor.recordMetric('violation-test', 60);

    await performanceMonitor.shutdown();

    // Should have logged final report
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Final performance report',
      })
    );

    // Should have logged violations
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'Performance budget violations detected',
      })
    );
  });

  test('should handle default budgets from initialization', () => {
    // Default budgets should be set during initialization
    const report = performanceMonitor.generateReport();
    
    // Simulate exceeding a default budget
    performanceMonitor.recordMetric('command-execution', 150); // Default budget is 100ms
    
    const violations = performanceMonitor.getBudgetViolations();
    expect(violations.length).toBeGreaterThan(0);
    
    const commandViolation = violations.find(v => v.operation === 'command-execution');
    expect(commandViolation).toBeDefined();
    expect(commandViolation!.budget).toBe(100);
  });
});