import { describe, it, expect, beforeEach } from 'bun:test';
import { CapabilityDetector } from '../../src/terminal/CapabilityDetector';
import { TerminalInfo } from '../../src/terminal/TerminalInfo';
import { ColorSupport } from '../../src/terminal/ColorSupport';
import { CapabilityTester } from '../../src/terminal/CapabilityTester';
import { TestRunner } from '../../src/terminal/TestRunner';
import { FallbackRenderer } from '../../src/terminal/FallbackRenderer';
import type { DetectionResult } from '../../src/terminal/types';
import { TerminalCapabilities } from '../../src/framework/UIFramework';

describe('Terminal Compatibility Suite', () => {
  let capabilityDetector: CapabilityDetector;
  let terminalInfo: TerminalInfo;
  let colorSupport: ColorSupport;
  let fallbackRenderer: FallbackRenderer;

  beforeEach(() => {
    terminalInfo = new TerminalInfo();
    colorSupport = new ColorSupport();
    capabilityDetector = new CapabilityDetector();
    fallbackRenderer = new FallbackRenderer();
  });

  describe('CapabilityDetector', () => {
    it('should detect basic capabilities', async () => {
      const result = await capabilityDetector.detect();

      expect(result).toBeDefined();
      expect(result.capabilities).toBeDefined();
      expect(result.detectionTime).toBeGreaterThan(0);
      expect(result.testResults).toBeInstanceOf(Map);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.fallbacksUsed)).toBe(true);
    });

    it('should cache detection results', async () => {
      const firstResult = await capabilityDetector.detect();
      const secondResult = await capabilityDetector.detect();

      expect(firstResult).toEqual(secondResult);
    });

    it('should force refresh detection', async () => {
      const firstResult = await capabilityDetector.detect();
      const secondResult = await capabilityDetector.detect(true);

      // The detection time should be different when forced
      expect(firstResult.detectionTime).not.toBe(secondResult.detectionTime);
    });

    it('should clear cache', () => {
      capabilityDetector.clearCache();
      const cached = capabilityDetector.getCachedCapabilities();

      expect(cached).toBeNull();
    });

    it('should generate capability report', () => {
      const report = capabilityDetector.generateReport();

      expect(report).toBeDefined();
      expect(report.terminalType).toBeDefined();
      expect(report.platform).toBeDefined();
      expect(report.capabilities).toBeDefined();
      expect(report.cacheInfo).toBeDefined();
    });
  });

  describe('TerminalInfo', () => {
    it('should provide terminal information', () => {
      const terminalType = terminalInfo.getTerminalType();
      const platform = terminalInfo.getPlatform();
      const size = terminalInfo.getSize();

      expect(typeof terminalType).toBe('string');
      expect(typeof platform).toBe('string');
      expect(size).toHaveProperty('width');
      expect(size).toHaveProperty('height');
    });

    it('should detect TTY status', () => {
      const isTTY = terminalInfo.isTTY();
      const ttyInfo = terminalInfo.getTTYInfo();

      expect(typeof isTTY).toBe('boolean');
      expect(ttyInfo).toHaveProperty('isTTY');
      expect(ttyInfo).toHaveProperty('columns');
      expect(ttyInfo).toHaveProperty('rows');
    });

    it('should generate report', () => {
      const report = terminalInfo.generateReport();

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain('Terminal Information Report');
    });
  });

  describe('ColorSupport', () => {
    it('should detect basic color support', () => {
      const basicSupport = colorSupport.detectBasicColor();
      expect(typeof basicSupport).toBe('boolean');
    });

    it('should detect 256 color support', () => {
      const color256Support = colorSupport.detect256Color();
      expect(typeof color256Support).toBe('boolean');
    });

    it('should detect true color support', () => {
      const trueColorSupport = colorSupport.detectTrueColor();
      expect(typeof trueColorSupport).toBe('boolean');
    });

    it('should get color level', () => {
      const level = colorSupport.getColorLevel();
      expect(typeof level).toBe('number');
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(3);
    });

    it('should format colors safely', () => {
      const format = colorSupport.formatColor(255, 0, 0);
      expect(typeof format).toBe('string');
    });

    it('should clear cache', () => {
      colorSupport.clearCache();
      // Should not throw any errors
    });
  });

  describe('CapabilityTester', () => {
    let tester: CapabilityTester;

    beforeEach(() => {
      tester = new CapabilityTester(terminalInfo, colorSupport);
    });

    it('should create capability tests', () => {
      const tests = tester.createCapabilityTests();

      expect(Array.isArray(tests)).toBe(true);
      expect(tests.length).toBeGreaterThan(0);

      tests.forEach(test => {
        expect(test).toHaveProperty('name');
        expect(test).toHaveProperty('test');
        expect(test).toHaveProperty('description');
        expect(typeof test.test).toBe('function');
      });
    });

    it('should run tests with timeout', async () => {
      const tests = tester.createCapabilityTests();
      const test = tests[0];

      const result = await tester.runTestWithTimeout(test);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('TestRunner', () => {
    let tester: CapabilityTester;
    let runner: TestRunner;

    beforeEach(() => {
      tester = new CapabilityTester(terminalInfo, colorSupport);
      runner = new TestRunner(tester);
    });

    it('should run all tests', async () => {
      const results = await runner.runAllTests();

      expect(results.testResults).toBeInstanceOf(Map);
      expect(Array.isArray(results.warnings)).toBe(true);
      expect(Array.isArray(results.fallbacksUsed)).toBe(true);
    });

    it('should test specific capability', async () => {
      // Test with a known capability name
      const result = await runner.testSpecificCapability('color');
      expect(typeof result).toBe('boolean');
    });

    it('should handle unknown capability', async () => {
      await expect(runner.testSpecificCapability('unknown')).rejects.toThrow();
    });

    it('should filter supported capabilities', () => {
      const supported = runner.getSupportedCapabilities();
      const unsupported = runner.getUnsupportedCapabilities();

      expect(Array.isArray(supported)).toBe(true);
      expect(Array.isArray(unsupported)).toBe(true);
    });

    it('should clear results', () => {
      runner.clearResults();
      // Should not throw any errors
    });
  });

  describe('FallbackRenderer', () => {
    it('should create with default options', () => {
      const renderer = new FallbackRenderer();
      const options = renderer.getOptions();

      expect(options).toBeDefined();
      expect(options.useAsciiOnly).toBe(false);
      expect(options.stripColors).toBe(false);
    });

    it('should create minimal renderer', () => {
      const renderer = FallbackRenderer.createMinimalRenderer();
      const options = renderer.getOptions();

      expect(options.useAsciiOnly).toBe(true);
      expect(options.stripColors).toBe(true);
      expect(options.maxWidth).toBe(80);
    });

    it('should create modern renderer', () => {
      const renderer = FallbackRenderer.createModernRenderer();
      const options = renderer.getOptions();

      expect(options.useAsciiOnly).toBe(false);
      expect(options.stripColors).toBe(false);
      expect(options.maxWidth).toBe(120);
    });

    it('should render content with fallbacks', () => {
      const content = 'Test content';
      const mockCapabilities = { color: false, unicode: false };

      const result = fallbackRenderer.render(content, mockCapabilities);

      expect(typeof result).toBe('string');
    });

    it('should check compatibility', () => {
      const mockCapabilities = { color: false, unicode: false };
      const report = fallbackRenderer.checkCompatibility(mockCapabilities);

      expect(report).toBeDefined();
      expect(report).toHaveProperty('compatible');
      expect(report).toHaveProperty('issues');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('fallbacksUsed');
    });

    it('should test render with specific capabilities', () => {
      const content = 'Test content with unicode: ┌──┐';
      const testCapabilities = { color: false, unicode: false };

      const result = fallbackRenderer.testRender(content, testCapabilities);

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('fallbacksApplied');
      expect(result).toHaveProperty('compatibilityReport');
    });

    it('should update options', () => {
      const newOptions = { useAsciiOnly: true };
      fallbackRenderer.updateOptions(newOptions);

      const options = fallbackRenderer.getOptions();
      expect(options.useAsciiOnly).toBe(true);
    });

    it('should add and remove fallbacks', () => {
      const mockFallback = {
        name: 'test',
        condition: () => true,
        transform: (content: string) => content,
        priority: 100,
      };

      fallbackRenderer.addFallback(mockFallback);
      const fallbacks = fallbackRenderer.getFallbacks();

      expect(fallbacks.some(f => f.name === 'test')).toBe(true);

      const removed = fallbackRenderer.removeFallback('test');
      expect(removed).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should work together as a complete system', async () => {
      // Get detection results
      const detectionResult = await capabilityDetector.detect();

      // Create renderer based on capabilities
      const renderer = FallbackRenderer.createMinimalRenderer();

      // Test compatibility
      const compatibilityReport = renderer.checkCompatibility(detectionResult.capabilities);

      // Test rendering
      const testContent = 'Test with unicode: ┌──┐ and colors: \x1b[31mRed\x1b[0m';
      const renderResult = renderer.testRender(testContent, detectionResult.capabilities as unknown as Partial<Record<string, unknown>>);

      expect(detectionResult.capabilities).toBeDefined();
      expect(compatibilityReport).toBeDefined();
      expect(renderResult.result).toBeDefined();
      expect(renderResult.fallbacksApplied.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle error conditions gracefully', async () => {
      // Test with invalid capabilities
      const invalidCapabilities = null;
      const compatibilityReport = fallbackRenderer.checkCompatibility(invalidCapabilities);

      expect(compatibilityReport).toBeDefined();
      expect(Array.isArray(compatibilityReport.issues)).toBe(true);
    });

    it('should provide fallback for minimal terminals', () => {
      const minimalCapabilities = {
        color: false,
        unicode: false,
        mouse: false,
        trueColor: false,
        color256: false,
      };

      const renderer = FallbackRenderer.createMinimalRenderer();
      const result = renderer.render('Complex content: ┌──┐ \x1b[31mColor\x1b[0m', minimalCapabilities);

      expect(typeof result).toBe('string');
      // Should not contain complex unicode or ANSI codes
      expect(result).not.toContain('┌');
      expect(result).not.toContain('\x1b');
    });
  });

  describe('Performance Tests', () => {
    it('should complete detection within reasonable time', async () => {
      const startTime = performance.now();
      await capabilityDetector.detect();
      const endTime = performance.now();

      const detectionTime = endTime - startTime;
      // Detection involves terminal queries which can take time, especially in CI/test environments
      expect(detectionTime).toBeLessThan(5000); // 5 seconds is a reasonable timeout
    });

    it('should handle rapid detection calls', async () => {
      const promises = Array.from({ length: 10 }, () => capabilityDetector.detect());
      const results = await Promise.all(promises);

      expect(results.length).toBe(10);
      // All results should be identical due to caching (except detectionTime)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].capabilities).toEqual(results[0].capabilities);
        expect(results[i].fallbacksUsed).toEqual(results[0].fallbacksUsed);
        expect(results[i].detectionTime).toBeGreaterThan(0);
      }
    });
  });
});