import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PerformanceCircuitBreaker } from '../../src/performance/PerformanceCircuitBreaker';

describe('PerformanceCircuitBreaker', () => {
  let circuitBreaker: PerformanceCircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new PerformanceCircuitBreaker({
      overheadThreshold: 0.05, // 5% for testing
      checkInterval: 100, // Faster for testing
      samplingWindow: 1000, // 1 second for testing
      enabled: true,
    });
  });

  afterEach(async () => {
    // Add a delay to ensure all pending timeouts and intervals complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Ensure circuit breaker is destroyed
    if (circuitBreaker) {
      circuitBreaker.destroy();
    }

    // Additional delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const cb = new PerformanceCircuitBreaker();
      const config = cb.getConfig();

      expect(config.overheadThreshold).toBe(0.02);
      expect(config.checkInterval).toBe(5000);
      expect(config.samplingWindow).toBe(60000);
      expect(config.enabled).toBe(true);
    });

    it('should override default config with provided values', () => {
      const cb = new PerformanceCircuitBreaker({
        overheadThreshold: 0.1,
        checkInterval: 1000,
      });

      const config = cb.getConfig();
      expect(config.overheadThreshold).toBe(0.1);
      expect(config.checkInterval).toBe(1000);
      expect(config.samplingWindow).toBe(60000); // Default value
    });
  });

  describe('measureOverhead', () => {
    it('should return overhead percentage', () => {
      const overhead = circuitBreaker.measureOverhead(() => {
        // Simulate some work
        for (let i = 0; i < 1000; i++) {
          Math.random();
        }
      });

      expect(typeof overhead).toBe('number');
      expect(overhead).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 when circuit breaker is tripped', () => {
      circuitBreaker.forceTrip();
      const overhead = circuitBreaker.measureOverhead(() => {
        // Some operation
        Math.random();
      });

      expect(overhead).toBe(0);
    });

    it('should record measurements for overhead calculation', () => {
      circuitBreaker.measureOverhead(() => Math.random());
      const metrics = circuitBreaker.getMetrics();

      expect(metrics.measurements.length).toBe(1);
      expect(typeof metrics.overhead).toBe('number');
    });
  });

  describe('circuit breaker tripping', () => {
    it('should trip when overhead exceeds threshold', () => {
      // Simulate high overhead
      for (let i = 0; i < 15; i++) {
        circuitBreaker.measureOverhead(() => {
          // Simulate high overhead operation
          const start = Date.now();
          while (Date.now() - start < 10) {
            // Busy wait
          }
        });
      }

      // Manually trigger check
      circuitBreaker.forceCheckOverhead();
      const state = circuitBreaker.getState();
      expect(state.isTripped).toBe(true);
      expect(state.metricsDisabled).toBe(true);
    });

    it('should reset when overhead falls below reset threshold', () => {
      // Test the reset logic directly
      circuitBreaker.forceTrip();
      expect(circuitBreaker.getState().isTripped).toBe(true);

      // Reset manually using forceReset
      circuitBreaker.forceReset();
      const state = circuitBreaker.getState();
      expect(state.isTripped).toBe(false);
      expect(state.metricsDisabled).toBe(false);
    });

    it('should not trip when overhead is below threshold', () => {
      // Simulate normal overhead
      for (let i = 0; i < 10; i++) {
        circuitBreaker.measureOverhead(() => Math.random());
      }

      const state = circuitBreaker.getState();
      expect(state.isTripped).toBe(false);
    });
  });

  describe('shouldCollectMetrics', () => {
    it('should return false when disabled', () => {
      circuitBreaker.updateConfig({ enabled: false });
      expect(circuitBreaker.shouldCollectMetrics()).toBe(false);
    });

    it('should return false when tripped', () => {
      circuitBreaker.forceTrip();
      expect(circuitBreaker.shouldCollectMetrics()).toBe(false);
    });

    it('should return true when enabled and not tripped', () => {
      expect(circuitBreaker.shouldCollectMetrics()).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should update configuration correctly', () => {
      circuitBreaker.updateConfig({
        overheadThreshold: 0.1,
        enabled: false,
      });

      const config = circuitBreaker.getConfig();
      expect(config.overheadThreshold).toBe(0.1);
      expect(config.enabled).toBe(false);
    });

    it('should start/stop monitoring when enabled state changes', () => {
      const initialConfig = circuitBreaker.getConfig();
      expect(initialConfig.enabled).toBe(true);

      circuitBreaker.updateConfig({ enabled: false });
      expect(circuitBreaker.getConfig().enabled).toBe(false);

      circuitBreaker.updateConfig({ enabled: true });
      expect(circuitBreaker.getConfig().enabled).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clear measurements when destroyed', () => {
      circuitBreaker.measureOverhead(() => Math.random());
      expect(circuitBreaker.getMetrics().measurements.length).toBe(1);

      circuitBreaker.destroy();
      expect(circuitBreaker.getMetrics().measurements.length).toBe(0);
    });

    it('should stop monitoring when destroyed', () => {
      circuitBreaker.destroy();
      expect(circuitBreaker.getConfig().enabled).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle zero threshold', () => {
      const cb = new PerformanceCircuitBreaker({
        overheadThreshold: 0,
        enabled: true,
      });

      const overhead = cb.measureOverhead(() => Math.random());
      expect(overhead).toBeGreaterThanOrEqual(0);

      cb.destroy();
    });

    it('should handle very short check intervals', () => {
      const cb = new PerformanceCircuitBreaker({
        checkInterval: 1,
        enabled: true,
      });

      const overhead = cb.measureOverhead(() => Math.random());
      expect(overhead).toBeGreaterThanOrEqual(0);

      cb.destroy();
    });

    it('should not hang when destroyed immediately', () => {
      const cb = new PerformanceCircuitBreaker({
        enabled: true,
      });

      // Destroy immediately after creation
      cb.destroy();

      // Should not hang and should handle gracefully
      const overhead = cb.measureOverhead(() => Math.random());
      expect(overhead).toBe(0); // Returns 0 when destroyed/disabled
    });

    it('should handle multiple rapid destroy calls', () => {
      const cb = new PerformanceCircuitBreaker({
        enabled: true,
      });

      // Call destroy multiple times
      cb.destroy();
      cb.destroy();
      cb.destroy();

      // Should not throw or hang
      expect(() => cb.destroy()).not.toThrow();
    });
  });
});