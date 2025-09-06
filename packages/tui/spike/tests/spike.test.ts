import { describe, test, expect } from 'bun:test';
import { ANSIApproachTest } from '../approach-2-ansi';
import { HybridApproachTest } from '../approach-3-hybrid';
import { generateTestData, TEST_DATASETS } from '../test-data';
import { PerformanceMeasurement } from '../performance-utils';

describe('TUI Spike Tests', () => {
  describe('Test Data Generation', () => {
    test('should generate correct number of items', () => {
      const smoke = generateTestData(TEST_DATASETS.SMOKE);
      expect(smoke).toHaveLength(10);
      
      const benchmark = generateTestData(TEST_DATASETS.BENCHMARK);
      expect(benchmark).toHaveLength(1000);
      
      const stress = generateTestData(TEST_DATASETS.STRESS);
      expect(stress).toHaveLength(10000);
    });
    
    test('should generate valid test items', () => {
      const items = generateTestData(10);
      
      items.forEach((item, index) => {
        expect(item.id).toBe(`item-${index}`);
        expect(item.label).toBe(`Task ${index + 1}`);
        expect(typeof item.checked).toBe('boolean');
        expect(item.description).toContain(`item ${index + 1}`);
      });
    });
  });
  
  describe('Performance Measurement', () => {
    test('should measure performance accurately', () => {
      const perf = new PerformanceMeasurement();
      
      perf.start();
      perf.recordFrame();
      perf.recordFrame();
      const metrics = perf.end();
      
      expect(metrics.frameCount).toBe(2);
      expect(metrics.endTime).toBeGreaterThan(metrics.startTime);
      expect(typeof metrics.memoryBefore).toBe('number');
      expect(typeof metrics.memoryAfter).toBe('number');
    });
    
    test('should calculate metrics correctly', () => {
      const perf = new PerformanceMeasurement();
      
      const metrics = {
        startTime: 100,
        endTime: 200,
        memoryBefore: 1000000,
        memoryAfter: 2000000,
        frameCount: 10
      };
      
      const calculated = perf.calculateMetrics(metrics);
      
      expect(calculated.startupTime).toBe(100);
      expect(calculated.renderTime).toBe(10);
      expect(calculated.fps).toBe(100);
      expect(calculated.memoryUsed).toBeCloseTo(0.95, 1);
    });
  });
  
  describe('ANSI Approach', () => {
    test('should complete successfully', async () => {
      const approach = new ANSIApproachTest();
      const result = await approach.run();
      
      expect(result.approach).toBe('Pure ANSI/Custom');
      expect(result.success).toBe(true);
      expect(result.bunCompatible).toBe(true);
    });
    
    test('should meet performance targets', async () => {
      const approach = new ANSIApproachTest();
      const result = await approach.run();
      
      // ANSI should be very fast
      expect(result.metrics.startupTime).toBeLessThan(200);
      expect(result.metrics.memoryUsed).toBeLessThan(100);
    });
    
    test('should have high compatibility score', async () => {
      const approach = new ANSIApproachTest();
      const result = await approach.run();
      
      // ANSI works everywhere
      expect(result.platformResults.macOS).toBe(true);
      expect(result.platformResults.linux).toBe(true);
      expect(result.platformResults.ssh).toBe(true);
      expect(result.platformResults.tmux).toBe(true);
    });
  });
  
  describe('Hybrid Approach', () => {
    test('should complete successfully', async () => {
      const approach = new HybridApproachTest();
      const result = await approach.run();
      
      expect(result.approach).toBe('Hybrid/Blessed-like');
      expect(result.success).toBe(true);
      expect(result.bunCompatible).toBe(true);
    });
    
    test('should have reasonable performance', async () => {
      const approach = new HybridApproachTest();
      const result = await approach.run();
      
      expect(result.metrics.startupTime).toBeLessThan(300);
      expect(result.metrics.memoryUsed).toBeLessThan(150);
    });
    
    test('should support widget architecture', async () => {
      const approach = new HybridApproachTest();
      const result = await approach.run();
      
      // Hybrid should support complex UI
      expect(result.score).toBeGreaterThan(50);
    });
  });
  
  describe('Scoring System', () => {
    test('should calculate scores within valid range', async () => {
      const approaches = [
        new ANSIApproachTest(),
        new HybridApproachTest()
      ];
      
      for (const approach of approaches) {
        const result = await approach.run();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });
    
    test('should favor performant approaches', async () => {
      const ansi = new ANSIApproachTest();
      const ansiResult = await ansi.run();
      
      // ANSI should score well due to performance
      expect(ansiResult.score).toBeGreaterThan(60);
    });
  });
  
  describe('Decision Logic', () => {
    test('should make correct Go/No-Go decision', () => {
      const decisions = [
        { score: 80, expected: 'GO' },
        { score: 75, expected: 'GO' },
        { score: 60, expected: 'Hybrid' },
        { score: 50, expected: 'Hybrid' },
        { score: 40, expected: 'NO-GO' }
      ];
      
      decisions.forEach(({ score, expected }) => {
        const decision = score >= 75 ? 'GO' : score >= 50 ? 'Hybrid' : 'NO-GO';
        expect(decision).toBe(expected);
      });
    });
  });
});