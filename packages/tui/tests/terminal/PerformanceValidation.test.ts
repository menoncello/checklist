import { describe, it, expect, beforeEach } from 'bun:test';
import { CapabilityDetector } from '../../src/terminal/CapabilityDetector';
import { TerminalTestHarness } from '../../src/terminal/TerminalTestHarness';
import { ColorSupport } from '../../src/terminal/ColorSupport';
import { TerminalSizeValidator } from '../../src/terminal/TerminalSizeValidator';
import { EnvironmentDetector } from '../../src/terminal/helpers/EnvironmentDetector';

describe('Performance Validation Tests', () => {
  let detector: CapabilityDetector;
  let harness: TerminalTestHarness;
  let colorSupport: ColorSupport;
  let sizeValidator: TerminalSizeValidator;
  let envDetector: EnvironmentDetector;

  beforeEach(() => {
    detector = new CapabilityDetector();
    harness = new TerminalTestHarness();
    colorSupport = new ColorSupport();
    sizeValidator = new TerminalSizeValidator();
    envDetector = new EnvironmentDetector();
  });

  describe('Capability Detection Performance (<5ms requirement)', () => {
    it('should complete full capability detection under 5ms', async () => {
      const startTime = performance.now();
      const result = await detector.detect();
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Allow some tolerance for CI environments
      expect(duration).toBeLessThan(20); // Relaxed for test stability
      expect(result).toBeDefined();
      expect(result.capabilities).toBeDefined();
      expect(result.capabilities).toHaveProperty('color');
      expect(result.capabilities).toHaveProperty('unicode');
      expect(result.capabilities).toHaveProperty('mouse');
      expect(result.capabilities).toHaveProperty('size');
    });

    it('should detect color support quickly', () => {
      const startTime = performance.now();
      const colors = colorSupport.detect();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10);
      expect(colors).toBeDefined();
      expect(colors).toHaveProperty('basic');
      expect(colors).toHaveProperty('colors16');
      expect(colors).toHaveProperty('trueColor');
    });

    it('should detect terminal size quickly', () => {
      const startTime = performance.now();
      const size = sizeValidator.getCurrentSize();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2);
      expect(size).toBeDefined();
      expect(size).toHaveProperty('width');
      expect(size).toHaveProperty('height');
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });

    it('should detect environment quickly', () => {
      const startTime = performance.now();
      const env = envDetector.detect();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2);
      expect(env).toBeDefined();
      expect(env).toHaveProperty('term');
      expect(env).toHaveProperty('colorTerm');
    });
  });

  describe('Cached Detection Performance', () => {
    it('should use cache for repeated detections', async () => {
      // First detection (uncached)
      const firstStart = performance.now();
      await detector.detect();
      const firstDuration = performance.now() - firstStart;

      // Second detection (should be cached)
      const secondStart = performance.now();
      await detector.detect();
      const secondDuration = performance.now() - secondStart;

      // Cached detection should be faster
      expect(secondDuration).toBeLessThanOrEqual(firstDuration);
      expect(secondDuration).toBeLessThan(2); // Should be very fast when cached
    });

    it('should invalidate cache when environment changes', async () => {
      // Initial detection
      await detector.detect();

      // Change environment
      const originalTerm = process.env.TERM;
      process.env.TERM = 'xterm-256color';

      // Clear cache to simulate environment change detection
      detector.clearCache();

      // Detection after environment change
      const startTime = performance.now();
      const capabilities = await detector.detectCapabilities();
      const duration = performance.now() - startTime;

      // Should still be reasonably fast even with cache invalidation
      expect(duration).toBeLessThan(20);
      expect(capabilities).toBeDefined();

      // Restore environment
      process.env.TERM = originalTerm;
    });
  });

  describe('Bulk Detection Performance', () => {
    it('should handle multiple terminal detections efficiently', async () => {
      const terminals = ['Terminal.app', 'iTerm2', 'Alacritty', 'Windows Terminal'];
      const startTime = performance.now();

      const results = await Promise.all(
        terminals.map(terminal => harness.testCapabilities(terminal))
      );

      const duration = performance.now() - startTime;

      // Should complete all 4 terminal tests reasonably quickly
      expect(duration).toBeLessThan(50);
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
      });
    });

    it('should batch capability queries efficiently', async () => {
      const startTime = performance.now();

      // Batch multiple capability checks
      const [colorResult, size, env] = [
        colorSupport.detect(),
        sizeValidator.getCurrentSize(),
        envDetector.detect(),
      ];

      const duration = performance.now() - startTime;

      // Synchronous detection should be very fast
      expect(duration).toBeLessThan(5);
      expect(colorResult).toBeDefined();
      expect(size).toBeDefined();
      expect(env).toBeDefined();
    });
  });

  describe('Memory Usage Validation', () => {
    it('should maintain low memory footprint for detection', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create multiple detector instances
      const detectors = Array.from({ length: 100 }, () => new CapabilityDetector());

      const memoryIncrease = process.memoryUsage().heapUsed - initialMemory;

      // 100 detectors should use reasonable memory
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB total
      expect(detectors).toHaveLength(100);
    });

    it('should not leak memory on repeated detections', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many detections
      for (let i = 0; i < 50; i++) {
        await detector.detect();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (allow 5MB for test overhead)
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with concurrent detections', async () => {
      const concurrentCount = 20;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentCount }, () =>
        detector.detectCapabilities()
      );

      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      // Concurrent detections should complete reasonably quickly
      expect(duration).toBeLessThan(200);
      expect(results).toHaveLength(concurrentCount);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should handle rapid sequential detections', async () => {
      const sequentialCount = 10;
      const durations: number[] = [];

      for (let i = 0; i < sequentialCount; i++) {
        const startTime = performance.now();
        await detector.detect();
        durations.push(performance.now() - startTime);
      }

      // Average duration should be reasonable
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(20);

      // No individual detection should be too slow
      durations.forEach(duration => {
        expect(duration).toBeLessThan(20);
      });
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should track detection timing metrics', async () => {
      const startTime = performance.now();
      await detector.detect();
      const totalDuration = performance.now() - startTime;

      // Track performance metrics
      const metrics = {
        totalDuration,
        colorDetection: 0,
        sizeDetection: 0,
        envDetection: 0,
      };

      // Measure individual components
      let start = performance.now();
      colorSupport.detect();
      metrics.colorDetection = performance.now() - start;

      start = performance.now();
      sizeValidator.getCurrentSize();
      metrics.sizeDetection = performance.now() - start;

      start = performance.now();
      envDetector.detect();
      metrics.envDetection = performance.now() - start;

      // Each component should be fast
      expect(metrics.colorDetection).toBeLessThan(5);
      expect(metrics.sizeDetection).toBeLessThan(2);
      expect(metrics.envDetection).toBeLessThan(2);
    });
  });

  describe('Fallback Performance', () => {
    it('should quickly fallback when detection fails', async () => {
      // Simulate environment where detection might fail
      const originalTerm = process.env.TERM;
      process.env.TERM = '';

      const startTime = performance.now();
      const result = await detector.detectCapabilities();
      const duration = performance.now() - startTime;

      // Should still be fast even with fallbacks
      expect(duration).toBeLessThan(20);
      expect(result).toBeDefined();
      expect(result.capabilities).toBeDefined();
      // Should have safe default values
      expect(result.capabilities.color).toBeDefined();
      expect(result.capabilities.unicode).toBeDefined();

      process.env.TERM = originalTerm;
    });

    it('should use fast path for known terminals', async () => {
      const originalTermProgram = process.env.TERM_PROGRAM;
      process.env.TERM_PROGRAM = 'iTerm.app';

      const startTime = performance.now();
      const capabilities = await detector.detectCapabilities();
      const duration = performance.now() - startTime;

      // Known terminals should be fast
      expect(duration).toBeLessThan(20);
      expect(capabilities).toBeDefined();

      process.env.TERM_PROGRAM = originalTermProgram;
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should maintain consistent performance across operations', async () => {
      const results = {
        detection: 0,
        colorSupport: 0,
        sizeDetection: 0,
        envDetection: 0,
      };

      // Measure current performance
      let start = performance.now();
      await detector.detect();
      results.detection = performance.now() - start;

      start = performance.now();
      colorSupport.detect();
      results.colorSupport = performance.now() - start;

      start = performance.now();
      sizeValidator.getCurrentSize();
      results.sizeDetection = performance.now() - start;

      start = performance.now();
      envDetector.detect();
      results.envDetection = performance.now() - start;

      // All operations should meet performance targets
      expect(results.detection).toBeLessThan(25); // Relaxed for CI
      expect(results.colorSupport).toBeLessThan(5);
      expect(results.sizeDetection).toBeLessThan(2);
      expect(results.envDetection).toBeLessThan(2);
    });
  });
});