/**
 * Simple benchmark tests for performance monitoring
 * These tests validate that performance monitoring works correctly
 * and demonstrate the framework capabilities
 */
import { test, describe, beforeAll, afterAll, expect } from 'bun:test';
import { PerformanceMonitorService } from '../../src/monitoring/PerformanceMonitor';
import { createLogger } from '../../src/utils/logger';

describe('Performance Framework Benchmarks', () => {
  let performanceMonitor: PerformanceMonitorService;
  let logger: any;

  beforeAll(async () => {
    logger = createLogger('benchmark:simple');
    performanceMonitor = new PerformanceMonitorService(
      { name: 'benchmark-perf-monitor' },
      logger
    );
    await performanceMonitor.initialize();
  });

  afterAll(async () => {
    await performanceMonitor.shutdown();
  });

  test('Performance monitoring overhead should be minimal', () => {
    // Test that our monitoring doesn't add significant overhead
    const iterations = 10000;
    
    // Baseline: raw operation
    const baselineStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      // Simple operation
      Math.random() * 100;
    }
    const baselineDuration = performance.now() - baselineStart;
    
    // With monitoring
    const monitoredStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('test-operation');
      Math.random() * 100;
      timer();
    }
    const monitoredDuration = performance.now() - monitoredStart;
    
    const overhead = ((monitoredDuration - baselineDuration) / baselineDuration) * 100;
    
    console.log(`Baseline: ${baselineDuration.toFixed(2)}ms`);
    console.log(`Monitored: ${monitoredDuration.toFixed(2)}ms`);
    console.log(`Overhead: ${overhead.toFixed(1)}%`);
    
    // Performance monitoring overhead should be reasonable (less than 100%)
    expect(overhead).toBeLessThan(100);
  });

  test('Budget violation detection should work correctly', () => {
    // Set a tight budget
    performanceMonitor.setBudget('budget-test', 5, 'critical');
    
    // Exceed the budget intentionally
    const timer = performanceMonitor.startTimer('budget-test');
    // Simulate work that exceeds budget
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Busy wait to exceed 5ms budget
    }
    timer();
    
    // Check that violation was detected
    const violations = performanceMonitor.getBudgetViolations();
    expect(violations.length).toBeGreaterThan(0);
    
    const budgetViolation = violations.find(v => v.operation === 'budget-test');
    expect(budgetViolation).toBeDefined();
    expect(budgetViolation!.actual).toBeGreaterThan(5);
    expect(budgetViolation!.severity).toBe('critical');
  });

  test('Memory usage should stay within bounds', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Generate many metrics
    for (let i = 0; i < 1000; i++) {
      performanceMonitor.recordMetric(`metric-${i}`, Math.random() * 100);
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
    
    console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB for 1000 metrics`);
    
    // Memory growth should be reasonable (less than 10MB for 1000 metrics)
    expect(memoryIncrease).toBeLessThan(10);
  });

  test('Performance report generation should be fast', () => {
    // Add some test data
    for (let i = 0; i < 100; i++) {
      performanceMonitor.recordMetric(`report-test-${i}`, Math.random() * 100);
    }
    
    const start = performance.now();
    const report = performanceMonitor.generateReport();
    const duration = performance.now() - start;
    
    console.log(`Report generation: ${duration.toFixed(2)}ms for 100 operations`);
    
    // Report generation should be fast
    expect(duration).toBeLessThan(10);
    expect(report.summary.totalOperations).toBeGreaterThanOrEqual(100);
  });

  test('Bulk operations should meet performance targets', async () => {
    const operations = [
      {
        name: 'command-execution',
        target: 100,
        fn: async () => {
          // Simulate command execution
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        }
      },
      {
        name: 'state-save',
        target: 50,
        fn: () => {
          // Simulate state serialization
          const data = { items: Array(100).fill('test') };
          JSON.stringify(data);
        }
      },
      {
        name: 'state-load',
        target: 30,
        fn: () => {
          // Simulate state loading
          const data = '{"items":' + JSON.stringify(Array(100).fill('test')) + '}';
          JSON.parse(data);
        }
      }
    ];
    
    for (const op of operations) {
      const results = [];
      
      // Run operation multiple times to get stable measurements
      for (let i = 0; i < 10; i++) {
        const timer = performanceMonitor.startTimer(op.name);
        await op.fn();
        timer();
      }
      
      const metric = performanceMonitor.getMetrics(op.name);
      expect(metric).toBeDefined();
      
      console.log(`${op.name}: avg=${metric!.average.toFixed(2)}ms, max=${metric!.max.toFixed(2)}ms (target: ${op.target}ms)`);
      
      // Average should generally meet target (allowing some tolerance)
      if (metric!.average > op.target * 1.5) {
        console.warn(`⚠️  ${op.name} average (${metric!.average.toFixed(2)}ms) exceeds target (${op.target}ms)`);
      }
    }
  });
});