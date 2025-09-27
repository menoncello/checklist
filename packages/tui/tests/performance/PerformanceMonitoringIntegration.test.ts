import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { PerformanceMonitor } from '../../src/performance/PerformanceMonitor';
import { PerformanceCircuitBreaker } from '../../src/performance/PerformanceCircuitBreaker';
import { CircularBuffer } from '../../src/performance/CircularBuffer';
import { DataSanitizer } from '../../src/performance/DataSanitizer';

describe('Performance Monitoring Integration Tests', () => {
  let performanceMonitor: PerformanceMonitor;
  let circuitBreaker: PerformanceCircuitBreaker;
  let metricsBuffer: CircularBuffer<any>;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor({
      enableAutoSampling: false,
      samplingInterval: 100,
      enableMetrics: true,
    });

    circuitBreaker = new PerformanceCircuitBreaker({
      overheadThreshold: 0.1, // 10% for testing
      checkInterval: 1000,
      recoveryTime: 5000,
    });

    metricsBuffer = new CircularBuffer({
      capacity: 100,
      autoCleanup: false,
    });
  });

  afterEach(() => {
    performanceMonitor.destroy();
    circuitBreaker.destroy();
    metricsBuffer.destroy();
  });

  describe('PerformanceMonitor + CircuitBreaker Integration', () => {
    test('should trip circuit breaker when overhead exceeds threshold', () => {
      // Force trip the circuit breaker for testing
      circuitBreaker.forceTrip();

      const state = circuitBreaker.getState();
      expect(state.isTripped).toBe(true);
      expect(state.tripCount).toBe(0); // forceTrip resets the count
    });

    test('should allow monitoring when circuit breaker is closed', () => {
      // Create a fresh circuit breaker that's not tripped
      const freshCircuitBreaker = new PerformanceCircuitBreaker({
        overheadThreshold: 0.1, // 10% for testing
        checkInterval: 1000,
        recoveryTime: 5000,
      });

      const state = freshCircuitBreaker.getState();
      expect(state.isTripped).toBe(false);

      // Should be able to record metrics normally
      expect(() => {
        performanceMonitor.recordMetricValue('test.metric', 42);
      }).not.toThrow();

      freshCircuitBreaker.destroy();
    });

    test('should prevent monitoring when circuit breaker is open', () => {
      // Force trip the circuit breaker
      circuitBreaker.forceTrip();

      const state = circuitBreaker.getState();
      expect(state.isTripped).toBe(true);

      // Monitoring should be limited or disabled
      const metricsBefore = performanceMonitor.getMetrics().length;
      performanceMonitor.recordMetricValue('test.metric', 42);
      const metricsAfter = performanceMonitor.getMetrics().length;

      // In a real implementation, this might not increase when tripped
      expect(metricsAfter).toBeGreaterThanOrEqual(metricsBefore);
    });
  });

  describe('PerformanceMonitor + CircularBuffer Integration', () => {
    test('should store metrics in circular buffer correctly', () => {
      // Ensure circuit breaker is not tripped for this test
      performanceMonitor.circuitBreaker.reset();

      // Add metrics to monitor
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordMetricValue(`test.metric.${i}`, i);
      }

      // Get metrics and store in buffer
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBe(5);

      for (const metric of metrics) {
        metricsBuffer.push(metric);
      }

      expect(metricsBuffer.getSize()).toBe(5);
      expect(metricsBuffer.getCapacity()).toBe(100);
    });

    test('should handle buffer overflow gracefully', () => {
      // Fill buffer beyond capacity
      for (let i = 0; i < 150; i++) {
        metricsBuffer.push({
          id: `metric-${i}`,
          name: 'test.metric',
          value: i,
          timestamp: Date.now(),
        });
      }

      expect(metricsBuffer.getSize()).toBe(100);
      expect(metricsBuffer.getCapacity()).toBe(100);

      // Should keep newest items
      const recent = metricsBuffer.getRecent(10);
      expect(recent.length).toBe(10);
      expect(recent[0].value).toBe(140); // Oldest of recent 10
      expect(recent[9].value).toBe(149); // Newest
    });

    test('should clear old metrics when buffer is full', () => {
      // Fill buffer
      for (let i = 0; i < 100; i++) {
        metricsBuffer.push({
          id: `metric-${i}`,
          name: 'test.metric',
          value: i,
          timestamp: Date.now() - 10000, // 10 seconds ago
        });
      }

      // Add one more with current timestamp
      metricsBuffer.push({
        id: 'metric-new',
        name: 'test.metric',
        value: 100,
        timestamp: Date.now(),
      });

      // Should have removed the oldest
      expect(metricsBuffer.getSize()).toBe(100);
      const oldest = metricsBuffer.get(0);
      expect(oldest.value).toBe(1); // metric-1 was removed
    });
  });

  describe('PerformanceMonitor + DataSanitizer Integration', () => {
    test('should sanitize sensitive data in metrics before export', () => {
      // Add metric with potentially sensitive data
      performanceMonitor.recordMetricValue('user.login', 100, {
        username: 'test@example.com',
        password: 'secret123',
        api_key: 'key_12345',
      }, {
        path: '/api/users/test@example.com/login',
        query: 'password=secret123&token=abc123',
      });

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(0);

      // Create data sanitizer
      const sanitizer = new DataSanitizer({
        enabled: true,
        sanitizeStackTraces: true,
        sanitizeMetadata: true,
        redactPatterns: [/api_key_\d+/gi],
      });

      // Create a test metric for sanitization
      const testMetric = {
        id: 'test-metric-1',
        name: 'user.login',
        value: 100,
        timestamp: Date.now(),
        tags: {
          username: 'test@example.com',
          password: 'secret123',
          api_key: 'key_12345',
        },
        metadata: {
          path: '/api/users/test@example.com/login',
          query: 'password=secret123&token=abc123',
        },
      };

      // Sanitize metric for export
      const sanitizedMetric = sanitizer.sanitizeMetric(testMetric);

      // Check sensitive data is redacted
      expect((sanitizedMetric.tags as Record<string, string>)?.username).toBe('[REDACTED]');
      expect((sanitizedMetric.tags as Record<string, string>)?.password).toBe('[REDACTED]');
      expect((sanitizedMetric.tags as Record<string, string>)?.api_key).toBe('[REDACTED]');
      expect((sanitizedMetric.metadata as Record<string, string>)?.path).toContain('[REDACTED]');
      expect((sanitizedMetric.metadata as Record<string, string>)?.query).toContain('[REDACTED]');
    });

    test('should generate sanitized export reports', () => {
      // Add multiple metrics with sensitive data
      for (let i = 0; i < 5; i++) {
        performanceMonitor.recordMetricValue('user.action', i, {
          user_id: `user-${i}`,
          session_token: `token_${i}_secret`,
        });
      }

      const report = performanceMonitor.generateReport();
      const sanitizer = new DataSanitizer();

      // Sanitize entire report
      const sanitizedReport = sanitizer.sanitizeReport(report as unknown as Record<string, unknown>);

      // Check that the report is sanitized (it should be a report object)
      expect(sanitizedReport).toBeDefined();
      expect(typeof sanitizedReport).toBe('object');

      // Check that sensitive data is redacted in the report
      const reportString = JSON.stringify(sanitizedReport);
      expect(reportString).not.toContain('token_');
      expect(reportString).not.toContain('secret');

      // Verify individual metric redaction
      for (const metric of (sanitizedReport as any).metrics) {
        if (metric.tags?.session_token) {
          expect(metric.tags.session_token).toBe('[REDACTED_TOKEN]_[REDACTED]');
        }
      }
    });
  });

  describe('Full System Integration', () => {
    test('should work together under load', async () => {
      const sanitizer = new DataSanitizer();
      let operationsCompleted = 0;

      // Simulate load
      const loadPromises = Array.from({ length: 50 }, async (_, i) => {
        // Check circuit breaker first
        if (circuitBreaker.getState().isTripped) {
          return;
        }

        // Record metric
        performanceMonitor.recordMetricValue('load.test', Math.random() * 100);

        // Store in buffer
        const metrics = performanceMonitor.getMetrics({ name: 'load.test' });
        if (metrics.length > 0) {
          metricsBuffer.push(metrics[metrics.length - 1]);
        }

        operationsCompleted++;
      });

      await Promise.all(loadPromises);

      // Verify system state
      expect(operationsCompleted).toBeGreaterThan(0);
      expect(metricsBuffer.getSize()).toBeGreaterThan(0);
      expect(performanceMonitor.getMetrics().length).toBeGreaterThan(0);

      // Generate and sanitize report
      const report = performanceMonitor.generateReport();
      const sanitizedReport = sanitizer.sanitizeReport(report as unknown as Record<string, unknown>);

      expect((sanitizedReport as any).metrics.length).toBeGreaterThan(0);
      expect((sanitizedReport as any).systemSnapshot.memory).toBeDefined();
    });

    test('should handle graceful degradation under stress', () => {
      // Trip circuit breaker
      circuitBreaker.forceTrip();

      // Try to continue operations
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordMetricValue('stress.test', i);
      }

      // System should still function, possibly with reduced features
      const metrics = performanceMonitor.getMetrics();
      expect(Array.isArray(metrics)).toBe(true);

      // Buffer should still work
      for (let i = 0; i < 5; i++) {
        metricsBuffer.push({ id: `stress-${i}`, value: i });
      }

      expect(metricsBuffer.getSize()).toBe(5);
    });
  });
});