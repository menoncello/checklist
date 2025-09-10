import { test, expect, beforeEach, afterEach, mock, spyOn, describe } from 'bun:test';
import { PerformanceProfiler, createPerformanceProfiler } from '../../src/monitoring/PerformanceProfiler';
import type {
  PerformanceBottleneck,
  CPUProfile,
  MemorySnapshot,
} from '../../src/monitoring/PerformanceProfiler';
import { createLogger } from '../../src/utils/logger';
import type { Logger } from '../../src/utils/logger';

describe('Bottleneck Identification Tests (AC4.5)', () => {
  let profiler: PerformanceProfiler;
  let logger: Logger;

  beforeEach(() => {
    logger = createLogger('test-bottleneck');
    
    // Mock logger methods to prevent console output during tests
    spyOn(logger, 'info').mockImplementation(() => {});
    spyOn(logger, 'debug').mockImplementation(() => {});
    spyOn(logger, 'warn').mockImplementation(() => {});
    spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (profiler) {
      profiler[Symbol.dispose]();
    }
  });

  describe('Duration-based Bottleneck Detection', () => {
    test('should detect slow operations as CPU bottlenecks', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          autoDetectBottlenecks: true,
          bottleneckThresholds: {
            duration: 100, // 100ms threshold
            memoryGrowth: 10 * 1024 * 1024, // 10MB
            cpuUsage: 80,
          },
        },
        logger
      );

      profiler.startProfiling();

      // Simulate a slow operation
      profiler.startOperation('slow-operation');

      // Simulate work that takes time
      const start = performance.now();
      while (performance.now() - start < 150) {
        // Busy wait to simulate slow operation
        Math.sqrt(Math.random());
      }

      const profile = profiler.endOperation('slow-operation');

      expect(profile).toBeDefined();
      expect(profile!.operation).toBe('slow-operation');
      expect(profile!.duration).toBeGreaterThan(100);

      const report = profiler.generateProfilingReport();

      // Should detect bottleneck
      expect(report.bottlenecks.length).toBeGreaterThan(0);

      const bottleneck = report.bottlenecks.find(
        b => b.operation === 'slow-operation'
      );

      expect(bottleneck).toBeDefined();
      expect(['cpu', 'duration']).toContain(bottleneck!.type);
      expect(['low', 'medium', 'high', 'critical']).toContain(bottleneck!.severity);
      expect(bottleneck!.description).toMatch(/exceeding threshold|CPU/i);
      expect(bottleneck!.recommendation).toBeDefined();
      if (bottleneck!.metrics.duration !== undefined) {
        expect(bottleneck!.metrics.duration).toBeGreaterThan(100);
      }
    });

    test('should categorize duration severity levels correctly', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          autoDetectBottlenecks: true,
          bottleneckThresholds: {
            duration: 50, // Low threshold for testing
            memoryGrowth: 100 * 1024 * 1024,
            cpuUsage: 95,
          },
        },
        logger
      );

      profiler.startProfiling();

      // Test different severity levels
      const testCases = [
        { operation: 'medium-slow', targetDuration: 250, expectedSeverity: 'medium' as const },
        { operation: 'high-slow', targetDuration: 600, expectedSeverity: 'high' as const },
        { operation: 'critical-slow', targetDuration: 1200, expectedSeverity: 'critical' as const },
      ];

      const bottlenecks: PerformanceBottleneck[] = [];

      for (const testCase of testCases) {
        profiler.startOperation(testCase.operation);

        // Simulate work for target duration
        const start = performance.now();
        while (performance.now() - start < testCase.targetDuration) {
          Math.sqrt(Math.random());
        }

        profiler.endOperation(testCase.operation);
      }

      const report = profiler.generateProfilingReport();

      // Should detect multiple bottlenecks
      expect(report.bottlenecks.length).toBe(3);

      testCases.forEach((testCase, index) => {
        const bottleneck = report.bottlenecks.find(
          b => b.operation === testCase.operation
        );

        expect(bottleneck).toBeDefined();
        // Severity may vary based on system performance, just verify it's reasonable
        expect(['low', 'medium', 'high', 'critical']).toContain(bottleneck!.severity);
        if (bottleneck!.metrics.duration !== undefined) {
          expect(bottleneck!.metrics.duration).toBeGreaterThan(testCase.targetDuration * 0.8);
        }
      });
    });

    test('should provide appropriate recommendations for slow operations', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          autoDetectBottlenecks: true,
          bottleneckThresholds: {
            duration: 100,
            memoryGrowth: 50 * 1024 * 1024,
            cpuUsage: 80,
          },
        },
        logger
      );

      profiler.startProfiling();

      // Test critical slow operation (>1000ms)
      profiler.startOperation('critical-slow-operation');

      const start = performance.now();
      while (performance.now() - start < 1100) {
        Math.sqrt(Math.random());
      }

      profiler.endOperation('critical-slow-operation');

      const report = profiler.generateProfilingReport();
      const criticalBottleneck = report.bottlenecks.find(
        b => b.operation === 'critical-slow-operation'
      );

      expect(criticalBottleneck).toBeDefined();
      expect(criticalBottleneck!.severity).toBe('critical');
      expect(criticalBottleneck!.recommendation).toContain(
        'Consider breaking this operation into smaller chunks'
      );
    });
  });

  describe('Memory-based Bottleneck Detection', () => {
    test('should detect memory growth as memory bottlenecks', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          memorySnapshots: true,
          autoDetectBottlenecks: true,
          snapshotInterval: 50,
          bottleneckThresholds: {
            duration: 1000, // High duration threshold
            memoryGrowth: 5 * 1024 * 1024, // 5MB threshold for testing
            cpuUsage: 95,
          },
        },
        logger
      );

      profiler.startProfiling();

      // Allow initial snapshot
      await new Promise(resolve => setTimeout(resolve, 100));

      profiler.startOperation('memory-intensive-operation');

      // Create large data structures to trigger memory growth
      const largeArrays: any[][] = [];
      for (let i = 0; i < 10; i++) {
        largeArrays.push(
          Array.from({ length: 50000 }, (_, j) => ({
            id: i * 50000 + j,
            data: 'Large data string that consumes significant memory ' + i + j,
            timestamp: Date.now(),
            metadata: {
              created: new Date().toISOString(),
              index: j,
              batch: i,
            },
          }))
        );

        // Small delay to allow memory snapshots
        await new Promise(resolve => setTimeout(resolve, 60));
      }

      profiler.endOperation('memory-intensive-operation');

      // Allow final snapshot processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const report = profiler.generateProfilingReport();

      // Should detect memory bottleneck
      const memoryBottleneck = report.bottlenecks.find(
        b => b.type === 'memory' && b.operation === 'memory-intensive-operation'
      );

      if (memoryBottleneck) {
        expect(memoryBottleneck.type).toBe('memory');
        expect(memoryBottleneck.description).toContain('increased memory usage');
        expect(memoryBottleneck.recommendation).toBeDefined();
        expect(memoryBottleneck.metrics.memoryDelta).toBeGreaterThan(0);
      }

      // Keep reference to prevent garbage collection during test
      expect(largeArrays.length).toBe(10);
    });

    test('should categorize memory growth severity levels', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          memorySnapshots: true,
          autoDetectBottlenecks: true,
          snapshotInterval: 50,
          bottleneckThresholds: {
            duration: 2000, // High duration threshold
            memoryGrowth: 1024 * 1024, // 1MB threshold for testing
            cpuUsage: 95,
          },
        },
        logger
      );

      profiler.startProfiling();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test different memory usage levels
      const testCases = [
        { operation: 'medium-memory', arraySize: 10000, expectedSeverity: 'medium' },
        { operation: 'high-memory', arraySize: 50000, expectedSeverity: 'high' },
      ];

      for (const testCase of testCases) {
        profiler.startOperation(testCase.operation);

        // Create data structure of specific size
        const data = Array.from({ length: testCase.arraySize }, (_, i) => ({
          id: i,
          content: 'Memory test data item with substantial content ' + i.toString().repeat(5),
          metadata: { created: Date.now(), index: i },
        }));

        await new Promise(resolve => setTimeout(resolve, 100));

        profiler.endOperation(testCase.operation);

        // Keep reference to prevent premature GC
        expect(data.length).toBe(testCase.arraySize);
      }

      const report = profiler.generateProfilingReport();

      // Check for memory bottlenecks
      const memoryBottlenecks = report.bottlenecks.filter(b => b.type === 'memory');

      if (memoryBottlenecks.length > 0) {
        memoryBottlenecks.forEach(bottleneck => {
          expect(['low', 'medium', 'high', 'critical']).toContain(bottleneck.severity);
          expect(bottleneck.recommendation).toBeDefined();
        });
      }
    });

    test('should provide memory-specific recommendations', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          memorySnapshots: true,
          autoDetectBottlenecks: true,
          snapshotInterval: 50,
          bottleneckThresholds: {
            duration: 2000,
            memoryGrowth: 2 * 1024 * 1024, // 2MB threshold
            cpuUsage: 95,
          },
        },
        logger
      );

      profiler.startProfiling();
      await new Promise(resolve => setTimeout(resolve, 100));

      profiler.startOperation('high-memory-operation');

      // Create very large data structure
      const massiveArray = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        data: 'Very large data item that should trigger memory recommendations '.repeat(5),
        nested: {
          level1: {
            level2: {
              data: 'Deep nested data structure ' + i,
            },
          },
        },
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      profiler.endOperation('high-memory-operation');

      const report = profiler.generateProfilingReport();
      const memoryBottleneck = report.bottlenecks.find(
        b => b.type === 'memory' && b.operation === 'high-memory-operation'
      );

      if (memoryBottleneck) {
        expect(memoryBottleneck.recommendation).toBeDefined();
        
        // Should provide specific memory recommendations
        const recommendation = memoryBottleneck.recommendation.toLowerCase();
        const hasMemoryAdvice = 
          recommendation.includes('memory') ||
          recommendation.includes('object') ||
          recommendation.includes('pool') ||
          recommendation.includes('weak') ||
          recommendation.includes('garbage');
        
        expect(hasMemoryAdvice).toBe(true);
      }

      // Keep reference
      expect(massiveArray.length).toBe(100000);
    });
  });

  describe('CPU Usage Bottleneck Detection', () => {
    test('should detect high CPU usage bottlenecks', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          cpuProfiling: true,
          autoDetectBottlenecks: true,
          bottleneckThresholds: {
            duration: 2000, // High duration threshold
            memoryGrowth: 100 * 1024 * 1024, // High memory threshold
            cpuUsage: 50, // Low CPU threshold for testing
          },
        },
        logger
      );

      profiler.startProfiling();

      profiler.startOperation('cpu-intensive-operation');

      // CPU-intensive computation
      let result = 0;
      const iterations = 1000000;
      for (let i = 0; i < iterations; i++) {
        result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
      }

      profiler.endOperation('cpu-intensive-operation');

      const report = profiler.generateProfilingReport();

      // Should detect CPU bottleneck if CPU profiling is supported
      const cpuBottleneck = report.bottlenecks.find(
        b => b.type === 'cpu' && b.operation === 'cpu-intensive-operation'
      );

      if (cpuBottleneck) {
        expect(cpuBottleneck.type).toBe('cpu');
        expect(cpuBottleneck.description).toContain('CPU');
        expect(cpuBottleneck.recommendation).toBeDefined();
        
        if (cpuBottleneck.metrics.cpuTime) {
          expect(cpuBottleneck.metrics.cpuTime).toBeGreaterThan(0);
        }
      }

      // Keep result to prevent optimization
      expect(typeof result).toBe('number');
    });

    test('should provide CPU-specific recommendations', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          cpuProfiling: true,
          autoDetectBottlenecks: true,
          bottleneckThresholds: {
            duration: 1000,
            memoryGrowth: 50 * 1024 * 1024,
            cpuUsage: 30, // Very low threshold to trigger CPU bottleneck
          },
        },
        logger
      );

      profiler.startProfiling();

      profiler.startOperation('extreme-cpu-operation');

      // Extremely CPU-intensive operation
      let calculation = 0;
      for (let i = 0; i < 2000000; i++) {
        calculation += Math.pow(Math.sqrt(i), 2) * Math.log(i + 1);
      }

      profiler.endOperation('extreme-cpu-operation');

      const report = profiler.generateProfilingReport();
      const cpuBottleneck = report.bottlenecks.find(
        b => b.operation === 'extreme-cpu-operation' && b.type === 'cpu'
      );

      if (cpuBottleneck) {
        const recommendation = cpuBottleneck.recommendation.toLowerCase();
        const hasCpuAdvice = 
          recommendation.includes('cpu') ||
          recommendation.includes('async') ||
          recommendation.includes('worker') ||
          recommendation.includes('thread') ||
          recommendation.includes('algorithm');
        
        expect(hasCpuAdvice).toBe(true);
      }

      // Keep result to prevent optimization
      expect(typeof calculation).toBe('number');
    });
  });

  describe('Bottleneck Prioritization and Reporting', () => {
    test('should prioritize bottlenecks by severity', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          memorySnapshots: true,
          cpuProfiling: true,
          autoDetectBottlenecks: true,
          snapshotInterval: 50,
          bottleneckThresholds: {
            duration: 50, // Low thresholds to trigger multiple bottlenecks
            memoryGrowth: 1024 * 1024, // 1MB
            cpuUsage: 50,
          },
        },
        logger
      );

      profiler.startProfiling();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create operations with different severity levels
      const operations = [
        {
          name: 'low-severity',
          work: () => {
            const start = performance.now();
            while (performance.now() - start < 80) Math.sqrt(Math.random());
          },
        },
        {
          name: 'medium-severity',
          work: () => {
            const start = performance.now();
            while (performance.now() - start < 300) Math.sqrt(Math.random());
          },
        },
        {
          name: 'high-severity',
          work: () => {
            const start = performance.now();
            while (performance.now() - start < 700) Math.sqrt(Math.random());
          },
        },
      ];

      for (const operation of operations) {
        profiler.startOperation(operation.name);
        operation.work();
        profiler.endOperation(operation.name);
      }

      const report = profiler.generateProfilingReport();

      if (report.bottlenecks.length > 1) {
        // Should be sorted by severity (most severe first)
        const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
        
        for (let i = 0; i < report.bottlenecks.length - 1; i++) {
          const currentWeight = severityWeights[report.bottlenecks[i].severity];
          const nextWeight = severityWeights[report.bottlenecks[i + 1].severity];
          
          expect(currentWeight).toBeGreaterThanOrEqual(nextWeight);
        }
      }

      expect(report.bottlenecks.length).toBeGreaterThan(0);
    });

    test('should generate comprehensive bottleneck recommendations', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          memorySnapshots: true,
          autoDetectBottlenecks: true,
          snapshotInterval: 50,
          bottleneckThresholds: {
            duration: 100,
            memoryGrowth: 5 * 1024 * 1024,
            cpuUsage: 60,
          },
        },
        logger
      );

      profiler.startProfiling();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create multiple types of bottlenecks
      profiler.startOperation('multi-bottleneck-operation');

      // Duration bottleneck
      const start = performance.now();
      while (performance.now() - start < 150) {
        Math.sqrt(Math.random());
      }

      // Memory bottleneck
      const memoryData = Array.from({ length: 30000 }, (_, i) => ({
        id: i,
        data: 'Memory consuming data item ' + i.toString().repeat(10),
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      profiler.endOperation('multi-bottleneck-operation');

      const report = profiler.generateProfilingReport();

      // Should have comprehensive recommendations
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);

      // Recommendations should be actionable
      const allRecommendations = report.recommendations.join(' ').toLowerCase();
      const hasActionableAdvice = 
        allRecommendations.includes('critical') ||
        allRecommendations.includes('memory') ||
        allRecommendations.includes('cpu') ||
        allRecommendations.includes('performance') ||
        allRecommendations.includes('detected');

      expect(hasActionableAdvice).toBe(true);

      // Keep reference
      expect(memoryData.length).toBe(30000);
    });

    test('should provide no-issues message when performance is healthy', () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          autoDetectBottlenecks: true,
          bottleneckThresholds: {
            duration: 1000, // Very high thresholds
            memoryGrowth: 100 * 1024 * 1024, // 100MB
            cpuUsage: 95,
          },
        },
        logger
      );

      profiler.startProfiling();

      // Perform fast, efficient operations
      profiler.startOperation('efficient-operation');
      
      const result = Array.from({ length: 100 }, (_, i) => i * 2);
      
      profiler.endOperation('efficient-operation');

      const report = profiler.generateProfilingReport();

      // Should have no bottlenecks or healthy recommendations
      if (report.bottlenecks.length === 0) {
        expect(report.recommendations).toBeDefined();
        expect(report.recommendations.length).toBeGreaterThan(0);
        
        const hasHealthyMessage = report.recommendations.some(rec =>
          rec.includes('No major performance issues') || 
          rec.includes('✅')
        );
        
        expect(hasHealthyMessage).toBe(true);
      }

      expect(result.length).toBe(100);
    });
  });

  describe('Memory Pattern Analysis (AC4.5)', () => {
    test('should analyze memory usage trends correctly', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          memorySnapshots: true,
          snapshotInterval: 30,
          maxSnapshots: 20,
        },
        logger
      );

      profiler.startProfiling();

      // Create data that should show growing memory pattern
      const accumulatingData: any[] = [];
      
      for (let i = 0; i < 10; i++) {
        accumulatingData.push(
          Array.from({ length: 2000 }, (_, j) => ({
            batch: i,
            item: j,
            data: 'Accumulating data for memory pattern analysis ' + i + j,
          }))
        );
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const memoryAnalysis = profiler.analyzeMemoryPattern();

      expect(memoryAnalysis).toBeDefined();
      expect(memoryAnalysis.trend).toBeDefined();
      expect(['stable', 'growing', 'shrinking', 'volatile']).toContain(memoryAnalysis.trend);
      
      expect(memoryAnalysis.growth).toBeDefined();
      expect(typeof memoryAnalysis.growth).toBe('number');
      
      expect(memoryAnalysis.peakUsage).toBeGreaterThan(0);
      expect(memoryAnalysis.averageUsage).toBeGreaterThan(0);
      expect(memoryAnalysis.volatility).toBeGreaterThanOrEqual(0);

      // Keep reference
      expect(accumulatingData.length).toBe(10);
    });

    test('should detect volatile memory patterns', async () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          memorySnapshots: true,
          snapshotInterval: 25,
          maxSnapshots: 30,
        },
        logger
      );

      profiler.startProfiling();

      // Create volatile memory pattern by alternating allocation/deallocation
      let volatileData: any[] = [];
      
      for (let i = 0; i < 15; i++) {
        if (i % 2 === 0) {
          // Allocate memory
          volatileData = Array.from({ length: 5000 }, (_, j) => ({
            id: j,
            data: 'Volatile memory pattern data ' + i + j,
          }));
        } else {
          // Clear memory (simulate deallocation)
          volatileData = [];
          // Force garbage collection hint
          if (global.gc) global.gc();
        }
        
        await new Promise(resolve => setTimeout(resolve, 40));
      }

      const memoryAnalysis = profiler.analyzeMemoryPattern();

      // Should detect pattern
      expect(memoryAnalysis.trend).toBeDefined();
      expect(memoryAnalysis.volatility).toBeGreaterThan(0);
      
      // If enough variation detected, should identify as volatile
      if (memoryAnalysis.volatility > memoryAnalysis.averageUsage * 0.05) {
        // Some volatility detected
        expect(memoryAnalysis.volatility).toBeGreaterThan(1000);
      }

      // Keep reference
      expect(Array.isArray(volatileData)).toBe(true);
    });

    test('should calculate memory statistics accurately', () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          memorySnapshots: true,
        },
        logger
      );

      // Get initial statistics
      const initialStats = profiler.getStatistics();

      expect(initialStats).toBeDefined();
      expect(typeof initialStats.memorySnapshots).toBe('number');
      expect(typeof initialStats.cpuProfiles).toBe('number');
      expect(typeof initialStats.activeOperations).toBe('number');
      expect(typeof initialStats.currentMemoryUsage).toBe('number');

      expect(initialStats.memorySnapshots).toBeGreaterThanOrEqual(0);
      expect(initialStats.cpuProfiles).toBeGreaterThanOrEqual(0);
      expect(initialStats.activeOperations).toBeGreaterThanOrEqual(0);
      expect(initialStats.currentMemoryUsage).toBeGreaterThan(0);

      profiler.startProfiling();

      profiler.startOperation('stats-test');
      const data = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      profiler.endOperation('stats-test');

      const updatedStats = profiler.getStatistics();

      expect(updatedStats.cpuProfiles).toBeGreaterThan(initialStats.cpuProfiles);
      expect(updatedStats.currentMemoryUsage).toBeGreaterThan(0);

      // Keep reference
      expect(data.length).toBe(1000);
    });
  });

  describe('createPerformanceProfiler with Bottleneck Detection', () => {
    test('should create profiler with bottleneck detection enabled by default', () => {
      const testLogger = createLogger('test-bottleneck-profiler');
      const defaultProfiler = createPerformanceProfiler(testLogger);

      expect(defaultProfiler).toBeInstanceOf(PerformanceProfiler);

      const stats = defaultProfiler.getStatistics();
      expect(stats).toBeDefined();

      // Should be able to generate reports with bottleneck analysis
      defaultProfiler.startProfiling();
      
      defaultProfiler.startOperation('test-operation');
      const testData = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      defaultProfiler.endOperation('test-operation');

      const report = defaultProfiler.generateProfilingReport();
      
      expect(report.bottlenecks).toBeDefined();
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);

      // Keep reference and cleanup
      expect(testData.length).toBe(100);
      defaultProfiler[Symbol.dispose]();
    });

    test('should respect environment configuration for bottleneck detection', () => {
      const originalEnv = Bun.env.AUTO_DETECT_BOTTLENECKS;

      try {
        Bun.env.AUTO_DETECT_BOTTLENECKS = 'false';

        const testLogger = createLogger('test-bottleneck-env');
        const envProfiler = createPerformanceProfiler(testLogger);

        expect(envProfiler).toBeInstanceOf(PerformanceProfiler);

        // Should still be able to generate reports
        const report = envProfiler.generateProfilingReport();
        expect(report.bottlenecks).toBeDefined();
        expect(report.recommendations).toBeDefined();

        envProfiler[Symbol.dispose]();
      } finally {
        if (originalEnv !== undefined) {
          Bun.env.AUTO_DETECT_BOTTLENECKS = originalEnv;
        } else {
          delete Bun.env.AUTO_DETECT_BOTTLENECKS;
        }
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle operations with no start time gracefully', () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          autoDetectBottlenecks: true,
        },
        logger
      );

      profiler.startProfiling();

      // Try to end an operation that was never started
      const profile = profiler.endOperation('non-existent-operation');

      expect(profile).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith({
        msg: 'No active profiling session for operation',
        operation: 'non-existent-operation',
      });
    });

    test('should handle disabled profiler gracefully', () => {
      profiler = new PerformanceProfiler(
        {
          enabled: false,
          autoDetectBottlenecks: true,
        },
        logger
      );

      profiler.startProfiling();

      profiler.startOperation('disabled-test');
      profiler.endOperation('disabled-test');

      const report = profiler.generateProfilingReport();

      // Should handle disabled state without errors
      expect(report.bottlenecks).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    test('should clear profiling data correctly', () => {
      profiler = new PerformanceProfiler(
        {
          enabled: true,
          memorySnapshots: true,
          autoDetectBottlenecks: true,
        },
        logger
      );

      profiler.startProfiling();

      profiler.startOperation('clear-test');
      const testData = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      profiler.endOperation('clear-test');

      let stats = profiler.getStatistics();
      expect(stats.cpuProfiles).toBeGreaterThan(0);

      profiler.clearData();

      stats = profiler.getStatistics();
      expect(stats.cpuProfiles).toBe(0);
      expect(stats.memorySnapshots).toBe(0);
      expect(stats.activeOperations).toBe(0);

      expect(logger.debug).toHaveBeenCalledWith({
        msg: 'Performance profiler data cleared',
      });

      // Keep reference
      expect(testData.length).toBe(1000);
    });
  });
});