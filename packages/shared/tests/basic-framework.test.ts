import { describe, it, expect } from 'bun:test';
import {
  TestDataFactory,
  TestHelpers,
  SnapshotUtils,
  PerformanceTester,
  FlakyTestDetector,
  AccessibilityTester,
} from '../src/testing';

describe('Testing Framework Validation', () => {
  describe('Core Testing Utilities', () => {
    it('TestDataFactory creates valid test data', () => {
      const factory = new TestDataFactory();
      
      const template = factory.createTemplate({ name: 'Test' });
      expect(template.name).toBe('Test');
      expect(template.version).toBe('1.0.0');
      
      const step = factory.createStep({ title: 'Step 1' });
      expect(step.title).toBe('Step 1');
      
      const state = factory.createWorkflowState();
      expect(state.instances).toEqual([]);
    });

    it('TestHelpers provides utility functions', () => {
      const ansiText = '\x1b[31mRed\x1b[0m';
      const clean = TestHelpers.stripAnsi(ansiText);
      expect(clean).toBe('Red');

      const { result, duration } = TestHelpers.measurePerformance(() => {
        return 1 + 1;
      });
      expect(result).toBe(2);
      expect(duration).toBeGreaterThan(0);
    });

    it('SnapshotUtils normalizes output', () => {
      const utils = new SnapshotUtils();
      
      const normalized = utils.normalizeTerminalOutput('line1  \r\nline2   \n');
      expect(normalized).toBe('line1\nline2');
      
      const stripped = utils.stripAnsiCodes('\x1b[1mBold\x1b[0m');
      expect(stripped).toBe('Bold');
    });

    it('PerformanceTester benchmarks functions', async () => {
      const tester = new PerformanceTester();
      
      tester.add('test', () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) sum += i;
      });
      
      const results = await tester.run();
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('test');
      expect(results[0].mean).toBeGreaterThan(0);
    });

    it('FlakyTestDetector tracks test stability', () => {
      const detector = new FlakyTestDetector();
      
      detector.startTest('test1');
      detector.endTest(true);
      
      const report = detector.getReport();
      expect(report).toContain('No flaky tests detected');
    });

    it('AccessibilityTester validates WCAG compliance', () => {
      const tester = new AccessibilityTester();
      
      const ratio = tester.calculateContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 0);
      
      const lowContrast = tester.calculateContrastRatio('#777777', '#999999');
      expect(lowContrast).toBeLessThan(3);
    });
  });
});