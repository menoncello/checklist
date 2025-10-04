import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { ApplicationShell } from '../../src/application/ApplicationShell';
import { ApplicationShellConfig } from '../../src/application/ApplicationShellConfig';
import { createMockDependencies } from '../mocks/ApplicationShellMocks';

// Performance Test IDs: NFR1, NFR2, NFR3, NFR4
describe('ApplicationShell Performance Tests', () => {
  let applicationShell: ApplicationShell;
  let config: ApplicationShellConfig;

  beforeEach(() => {
    config = {
      version: '1.0.0',
      splitRatio: 0.7,
    };

    // Create mock dependencies
    const mockDeps = createMockDependencies(config);

    // Mock the ApplicationShellInitializers to return our mock dependencies
    mock.module('../../src/application/ApplicationShellInitializers', () => ({
      ApplicationShellInitializers: class MockApplicationShellInitializers {
        createDependencies() {
          return mockDeps;
        }
      }
    }));
  });

  afterEach(async () => {
    if (applicationShell) {
      try {
        await applicationShell.shutdown();
      } catch (error) {
        // Ignore shutdown errors in test environment
      }
    }
    // Restore mocks
    mock.restore();
  });

  describe('Startup Performance (NFR1)', () => {
    // Test: Startup time < 100ms for version splash and initialization
    it('should complete startup within 100ms including version splash', async () => {
      // Given: ApplicationShell ready for startup
      applicationShell = new ApplicationShell(config);

      // When: Startup sequence is executed
      const startTime = performance.now();

      await applicationShell.onInitialize();
      await applicationShell.onStart();

      const endTime = performance.now();
      const startupDuration = endTime - startTime;

      // Then: Startup should complete within 100ms requirement
      expect(startupDuration).toBeLessThan(100);

      // Verify that version splash was displayed during startup
      const metrics = applicationShell.getMetrics();
      expect(metrics.startupTime).toBeDefined();
      expect(metrics.startupTime).toBeLessThan(100);
    });

    it('should display version splash within startup budget', async () => {
      // Given: ApplicationShell with version splash enabled
      applicationShell = new ApplicationShell(config);

      // When: Version splash is displayed during initialization
      applicationShell.startProfiling('version-splash');

      await applicationShell.onInitialize(); // This includes version splash display

      const splashDuration = applicationShell.endProfiling('version-splash');

      // Then: Version splash should not significantly impact startup time
      expect(splashDuration).toBeLessThan(50); // Half of total budget
    });

    it('should maintain startup performance under load', async () => {
      // Given: ApplicationShell with additional components
      const loadConfig = {
        ...config,
        enableDebug: true, // Add debugging overhead
        performanceConfig: {
          enableProfiling: true,
          alertThreshold: 50, // Lower threshold
        },
      };

      applicationShell = new ApplicationShell(loadConfig);

      // When: Startup occurs with additional load
      const startTime = performance.now();

      await applicationShell.onInitialize();
      await applicationShell.onStart();

      const endTime = performance.now();
      const loadedStartupDuration = endTime - startTime;

      // Then: Startup should still meet performance requirements
      expect(loadedStartupDuration).toBeLessThan(100);
    });

    it('should track startup performance metrics', async () => {
      // Given: ApplicationShell with performance monitoring
      applicationShell = new ApplicationShell(config);

      // When: Startup completes with metric tracking
      await applicationShell.onInitialize();
      await applicationShell.onStart();

      // Then: Performance metrics should be available
      const metrics = applicationShell.getMetrics();
      expect(metrics.startupTime).toBeDefined();
      expect(metrics.startupTime).toBeGreaterThan(0);
      expect(metrics.startupTime).toBeLessThan(100);

      const report = applicationShell.getPerformanceReport();
      expect(report).toBeDefined();
    });
  });

  describe('Layout Reflow Performance (NFR2)', () => {
    beforeEach(async () => {
      applicationShell = new ApplicationShell(config);
      await applicationShell.onInitialize();
      await applicationShell.onStart();
    });

    // Test: Layout reflow < 50ms during resize operations
    it('should complete layout reflow within 50ms', async () => {
      // Given: ApplicationShell with active layout
      const resizeSizes = [
        { width: 80, height: 24 },
        { width: 120, height: 40 },
        { width: 100, height: 30 },
        { width: 140, height: 50 },
      ];

      // When: Multiple resize operations occur
      for (const size of resizeSizes) {
        applicationShell.startProfiling('layout-reflow');

        // Simulate resize event triggering layout reflow
        applicationShell.emit('resize', size);

        const reflowDuration = applicationShell.endProfiling('layout-reflow');

        // Then: Each reflow should complete within 50ms
        expect(reflowDuration).toBeLessThan(50);
      }
    });

    it('should handle rapid resize events efficiently', async () => {
      // Given: ApplicationShell that may receive rapid resize events
      const startTime = performance.now();

      // When: Rapid resize events occur
      for (let i = 0; i < 10; i++) {
        const width = 80 + i * 5;
        const height = 24 + i * 2;
        applicationShell.emit('resize', { width, height });
      }

      const endTime = performance.now();
      const totalReflowTime = endTime - startTime;

      // Then: All reflows should complete efficiently
      expect(totalReflowTime).toBeLessThan(200); // 10 reflows * 20ms average
    });

    it('should optimize layout reflow for unchanged dimensions', async () => {
      // Given: ApplicationShell with established layout
      const fixedSize = { width: 100, height: 30 };
      applicationShell.emit('resize', fixedSize);

      // When: Same dimensions are set repeatedly
      applicationShell.startProfiling('optimized-reflow');

      for (let i = 0; i < 5; i++) {
        applicationShell.emit('resize', fixedSize);
      }

      const optimizedDuration = applicationShell.endProfiling('optimized-reflow');

      // Then: Optimized reflows should be very fast
      expect(optimizedDuration).toBeLessThan(25); // Should be optimized away
    });

    it('should maintain layout reflow performance with complex layouts', async () => {
      // Given: ApplicationShell with complex layout components
      // Simulate adding multiple components that affect layout
      for (let i = 0; i < 10; i++) {
        applicationShell.registerComponent(`complex-component-${i}`, {
          render: () => `Complex Component ${i}`,
          onResize: () => {
            // Simulate component resize handling
            return new Promise(resolve => setTimeout(resolve, 1));
          },
        });
      }

      // When: Layout reflow occurs with complex components
      applicationShell.startProfiling('complex-reflow');

      applicationShell.emit('resize', { width: 120, height: 40 });

      const complexReflowDuration = applicationShell.endProfiling('complex-reflow');

      // Then: Complex reflow should still meet performance requirements
      expect(complexReflowDuration).toBeLessThan(50);
    });
  });

  describe('Memory Usage Performance (NFR3)', () => {
    beforeEach(async () => {
      applicationShell = new ApplicationShell(config);
      await applicationShell.onInitialize();
      await applicationShell.onStart();
    });

    // Test: Memory usage stays within baseline limits
    it('should maintain memory usage within baseline limits', async () => {
      // Given: ApplicationShell with memory monitoring
      const initialMemory = process.memoryUsage();

      // When: Application runs for extended period with activity
      for (let i = 0; i < 100; i++) {
        // Simulate application activity
        applicationShell.emit('input', { key: 'test', timestamp: Date.now() });
        applicationShell.emit('resize', { width: 100 + i, height: 30 });

        // Small delay to allow processing
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Then: Memory increase should be within acceptable limits
      const maxMemoryIncrease = 10 * 1024 * 1024; // 10MB limit
      expect(memoryIncrease).toBeLessThan(maxMemoryIncrease);
    });

    it('should cleanup memory properly during lifecycle', async () => {
      // Given: ApplicationShell with potential memory leaks
      const memoryBeforeComponents = process.memoryUsage().heapUsed;

      // Create many components
      for (let i = 0; i < 50; i++) {
        applicationShell.registerComponent(`memory-test-${i}`, {
          render: () => new Array(1000).fill(`data-${i}`).join(''),
          destroy: () => {
            // Cleanup component data
          },
        });
      }

      const memoryAfterComponents = process.memoryUsage().heapUsed;

      // When: Application shuts down and cleans up
      await applicationShell.onStop();
      await applicationShell.onShutdown();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfterCleanup = process.memoryUsage().heapUsed;

      // Then: Memory should be substantially freed
      const memoryRetained = memoryAfterCleanup - memoryBeforeComponents;
      const memoryAllocated = memoryAfterComponents - memoryBeforeComponents;

      // Allow some memory retention but ensure it's reasonable
      // Check that we're not retaining significantly more than we started with
      expect(memoryRetained).toBeLessThan(Math.max(memoryAllocated * 0.3, 1024 * 1024)); // Retain less than 30% or 1MB
    });

    it('should track memory usage patterns', async () => {
      // Given: ApplicationShell with memory profiling
      const metrics = applicationShell.getMetrics();
      const initialMemoryMetric = metrics.memoryUsage;

      // When: Memory-intensive operations occur
      for (let i = 0; i < 20; i++) {
        const largeData = new Array(1000).fill(`memory-test-${i}`);
        applicationShell.emit('data-processed', { data: largeData });
      }

      // Then: Memory metrics should track changes
      const updatedMetrics = applicationShell.getMetrics();
      expect(updatedMetrics.memoryUsage).toBeDefined();
      expect(updatedMetrics.memoryUsage).toBeGreaterThanOrEqual(initialMemoryMetric);
    });
  });

  describe('Event Loop Performance (NFR4)', () => {
    beforeEach(async () => {
      applicationShell = new ApplicationShell(config);
      await applicationShell.onInitialize();
      await applicationShell.onStart();
    });

    // Test: Event loop must not block during layout operations
    it('should maintain event loop responsiveness during layout operations', async () => {
      // Given: ApplicationShell with event loop monitoring
      let eventLoopBlocked = false;
      let responseTime = 0;

      // Setup event loop responsiveness check
      const startTime = performance.now();
      const responsivenesCheck = setTimeout(() => {
        responseTime = performance.now() - startTime;
        if (responseTime > 100) { // 100ms threshold for blocking
          eventLoopBlocked = true;
        }
      }, 0);

      // When: Layout operations are performed
      for (let i = 0; i < 20; i++) {
        applicationShell.emit('resize', { width: 100 + i * 2, height: 30 + i });
        applicationShell.render();
      }

      // Wait for responsiveness check
      await new Promise(resolve => setTimeout(resolve, 50));
      clearTimeout(responsivenesCheck);

      // Then: Event loop should remain responsive
      expect(eventLoopBlocked).toBe(false);
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle concurrent operations without blocking', async () => {
      // Given: ApplicationShell with multiple concurrent operations
      const operations = [];

      // When: Multiple operations run concurrently
      operations.push(
        new Promise(resolve => {
          for (let i = 0; i < 10; i++) {
            applicationShell.emit('input', { key: `key-${i}` });
          }
          resolve(undefined);
        })
      );

      operations.push(
        new Promise(resolve => {
          for (let i = 0; i < 10; i++) {
            applicationShell.emit('resize', { width: 80 + i, height: 24 + i });
          }
          resolve(undefined);
        })
      );

      operations.push(
        new Promise(resolve => {
          for (let i = 0; i < 10; i++) {
            applicationShell.render();
          }
          resolve(undefined);
        })
      );

      const startTime = performance.now();
      await Promise.all(operations);
      const concurrentDuration = performance.now() - startTime;

      // Then: Concurrent operations should complete efficiently
      expect(concurrentDuration).toBeLessThan(200); // Reasonable concurrent execution time
    });

    it('should process input events without significant delay', async () => {
      // Given: ApplicationShell ready to process input
      const inputDelays: number[] = [];

      // When: Multiple input events are processed
      for (let i = 0; i < 10; i++) {
        const inputStartTime = performance.now();

        applicationShell.emit('input', {
          key: `test-key-${i}`,
          timestamp: Date.now(),
        });

        const inputEndTime = performance.now();
        inputDelays.push(inputEndTime - inputStartTime);
      }

      // Then: Input processing should be consistently fast
      const averageDelay = inputDelays.reduce((a, b) => a + b, 0) / inputDelays.length;
      const maxDelay = Math.max(...inputDelays);

      expect(averageDelay).toBeLessThan(5); // Average < 5ms
      expect(maxDelay).toBeLessThan(20); // Max delay < 20ms
    });
  });

  describe('Overall Performance Integration', () => {
    it('should meet all performance requirements simultaneously', async () => {
      // Given: ApplicationShell with all performance monitoring enabled
      applicationShell = new ApplicationShell({
        ...config,
        performanceConfig: {
          enableProfiling: true,
          alertThreshold: 50,
        },
      });

      const overallStartTime = performance.now();

      // When: Complete application lifecycle with performance requirements
      await applicationShell.onInitialize(); // <100ms startup
      await applicationShell.onStart();

      const startupTime = performance.now() - overallStartTime;

      // Perform layout operations
      const layoutStartTime = performance.now();
      for (let i = 0; i < 5; i++) {
        applicationShell.emit('resize', { width: 100 + i * 10, height: 30 + i * 5 });
      }
      const layoutTime = performance.now() - layoutStartTime;

      // Check memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      // Process inputs
      const inputStartTime = performance.now();
      for (let i = 0; i < 20; i++) {
        applicationShell.emit('input', { key: `perf-test-${i}` });
      }
      const inputTime = performance.now() - inputStartTime;

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      await applicationShell.onStop();
      await applicationShell.onShutdown();

      const overallTime = performance.now() - overallStartTime;

      // Then: All performance requirements should be met
      expect(startupTime).toBeLessThan(100); // NFR1: Startup < 100ms
      expect(layoutTime / 5).toBeLessThan(50); // NFR2: Layout reflow < 50ms each
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // NFR3: Memory < 5MB increase
      expect(inputTime / 20).toBeLessThan(10); // NFR4: Input processing < 10ms each

      // Overall performance should be reasonable
      expect(overallTime).toBeLessThan(1000); // Complete cycle < 1 second
    });
  });
});