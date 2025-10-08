import { describe, test, expect, beforeEach} from 'bun:test';
import { ChromeDevToolsIntegration, chromeDevTools} from '../../src/performance/ChromeDevToolsIntegration';
describe('ChromeDevToolsIntegration', () => {
  let integration: ChromeDevToolsIntegration;

  beforeEach(() => {
    integration = new ChromeDevToolsIntegration();
  });

  describe('initialization', () => {
    test('should create instance without errors', () => {
      expect(integration).toBeInstanceOf(ChromeDevToolsIntegration);
    });

    test('should provide singleton instance', () => {
      expect(chromeDevTools).toBeInstanceOf(ChromeDevToolsIntegration);
    });
  });

  describe('availability detection', () => {
    test('should have isAvailable method', () => {
      expect(typeof integration.isAvailable).toBe('function');
      const available = integration.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    test('should handle unavailable inspector gracefully', () => {
      expect(() => integration.isAvailable()).not.toThrow();
    });
  });

  describe('debugger URL', () => {
    test('should return debugger URL or null', () => {
      const url = integration.getDebuggerUrl();
      expect(url === null || typeof url === 'string').toBe(true);
    });

    test('should not throw when getting URL', () => {
      expect(() => integration.getDebuggerUrl()).not.toThrow();
    });
  });

  describe('status report generation', () => {
    test('should generate status report', () => {
      const report = integration.generateReport();

      expect(typeof report).toBe('string');
      expect(report).toContain('Chrome DevTools Integration Report');
      expect(report).toContain('Status:');
    });

    test('should include availability status in report', () => {
      const report = integration.generateReport();

      expect(report).toMatch(/Status: (AVAILABLE|NOT AVAILABLE)/);
    });

    test('should include usage instructions', () => {
      const report = integration.generateReport();

      expect(report).toContain('chrome://inspect');
      expect(report).toContain('--inspect');
    });
  });

  describe('profiling methods error handling', () => {
    test('should handle unavailable DevTools gracefully', async () => {
      // These should either work or throw meaningful errors, not crash
      await expect(async () => {
        try {
          await integration.startCPUProfiling();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Chrome DevTools');
        }
      }).not.toThrow();
    });

    test('should handle unavailable heap profiler gracefully', async () => {
      await expect(async () => {
        try {
          await integration.takeHeapSnapshot();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Chrome DevTools');
          }
      }).not.toThrow();
    });

    test('should handle GC data collection gracefully', async () => {
      await expect(async () => {
        try {
          await integration.collectGCData();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          // Should mention either DevTools or expose-gc
          expect((error as Error).message).toMatch(/(Chrome DevTools|expose-gc)/);
          }
      }).not.toThrow();
    });
  });

  describe('method existence', () => {
    test('should have all required async methods', () => {
      expect(typeof integration.enableProfiler).toBe('function');
      expect(typeof integration.enableHeapProfiler).toBe('function');
      expect(typeof integration.startCPUProfiling).toBe('function');
      expect(typeof integration.stopCPUProfiling).toBe('function');
      expect(typeof integration.takeHeapSnapshot).toBe('function');
      expect(typeof integration.collectGCData).toBe('function');
      expect(typeof integration.startHeapProfiling).toBe('function');
      expect(typeof integration.stopHeapProfiling).toBe('function');
    });

    test('should have sync utility methods', () => {
      expect(typeof integration.isAvailable).toBe('function');
      expect(typeof integration.getDebuggerUrl).toBe('function');
      expect(typeof integration.generateReport).toBe('function');
    });
  });

  describe('error messages', () => {
    test('should provide helpful error messages', async () => {
      try {
        await integration.startCPUProfiling();
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message.length).toBeGreaterThan(10);
          expect(error.message).not.toContain('undefined');
        }
      }
    });
  });

  describe('report content validation', () => {
    test('should include basic report structure', () => {
      const report = integration.generateReport();

      expect(report).toContain('Chrome DevTools Integration Report');
      expect(report).toContain('Status:');
    });

    test('should include setup instructions when not available', () => {
      const report = integration.generateReport();

      if (report.includes('NOT AVAILABLE')) {
        expect(report).toContain('--inspect');
        expect(report).toContain('chrome://inspect');
      }
    });

    test('should mention required flags', () => {
      const report = integration.generateReport();

      expect(report).toContain('--inspect');
      expect(report).toContain('--expose-gc');
    });
  });

  describe('singleton behavior', () => {
    test('should maintain consistent state across singleton access', () => {
      const instance1 = chromeDevTools;
      const instance2 = chromeDevTools;

      expect(instance1).toBe(instance2);
      expect(instance1.isAvailable()).toBe(instance2.isAvailable());
    });
  });
});