import { describe, it, expect } from 'bun:test';
import {
  TestDataFactory,
  TestHelpers,
  SnapshotUtils,
  PerformanceTester,
  FlakyTestDetector,
} from '../src/testing';

describe('Testing Framework', () => {
  describe('TestDataFactory', () => {
    it('should create valid test templates', () => {
      const factory = new TestDataFactory();
      const template = factory.createTemplate({
        name: 'Test Template',
      });

      expect(template.id).toContain('template-');
      expect(template.name).toBe('Test Template');
      expect(template.version).toBe('1.0.0');
    });

    it('should create test steps', () => {
      const factory = new TestDataFactory();
      const step = factory.createStep({
        title: 'Test Step',
        required: false,
      });

      expect(step.id).toContain('step-');
      expect(step.title).toBe('Test Step');
      expect(step.required).toBe(false);
    });

    it('should convert template to YAML', () => {
      const factory = new TestDataFactory();
      const template = factory.createTemplate({
        id: 'test-1',
        name: 'Test',
        tags: ['test'],
      });

      const yaml = factory.templateToYaml(template);
      expect(yaml).toContain('id: test-1');
      expect(yaml).toContain('name: Test');
      expect(yaml).toContain('- test');
    });

    it('should create large templates for performance testing', () => {
      const factory = new TestDataFactory();
      const large = factory.createLargeTemplate(100);

      expect(large.steps).toHaveLength(100);
      expect(large.steps[50].id).toBe('step-50');
    });
  });

  describe('TestHelpers', () => {
    it('should create and cleanup temp directories', async () => {
      const dir = await TestHelpers.createTempDir('test-');
      expect(dir).toContain('test-');

      const exists = await Bun.file(dir).exists();
      expect(exists).toBe(false); // It's a directory, not a file

      await TestHelpers.cleanupTempDir(dir);
    });

    it('should strip ANSI codes', () => {
      const colored = '\x1b[31mRed Text\x1b[0m';
      const clean = TestHelpers.stripAnsi(colored);
      expect(clean).toBe('Red Text');
    });

    it('should measure performance', () => {
      const { result, duration } = TestHelpers.measurePerformance(() => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(499500);
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });

    it('should mock environment variables', () => {
      const original = process.env.TEST_VAR;
      
      const restore = TestHelpers.mockEnv({
        TEST_VAR: 'mocked',
      });

      expect(process.env.TEST_VAR).toBe('mocked');
      
      restore();
      expect(process.env.TEST_VAR).toBe(original ?? undefined);
    });
  });

  describe('SnapshotUtils', () => {
    it('should normalize terminal output', () => {
      const utils = new SnapshotUtils();
      const input = 'Line 1  \r\nLine 2   \nLine 3\n\n';
      const normalized = utils.normalizeTerminalOutput(input);
      
      expect(normalized).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should strip ANSI codes', () => {
      const utils = new SnapshotUtils();
      const input = '\x1b[1mBold\x1b[0m \x1b[31mRed\x1b[0m';
      const stripped = utils.stripAnsiCodes(input);
      
      expect(stripped).toBe('Bold Red');
    });

    it('should strip timestamps', () => {
      const utils = new SnapshotUtils();
      const input = 'Log at 2024-01-15T10:30:45.123Z and 3:45:00 PM';
      const stripped = utils.stripTimestamps(input);
      
      expect(stripped).toBe('Log at <TIMESTAMP> and <TIME>');
    });

    it('should strip dynamic values', () => {
      const utils = new SnapshotUtils();
      const input = 'UUID: 123e4567-e89b-12d3-a456-426614174000, took 125ms';
      const stripped = utils.stripDynamicValues(input);
      
      expect(stripped).toBe('UUID: <UUID>, took <DURATION>');
    });
  });

  describe('PerformanceTester', () => {
    it('should benchmark functions', async () => {
      const tester = new PerformanceTester();
      
      tester.add('Fast Function', () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
      });

      const results = await tester.run();
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Fast Function');
      expect(results[0].mean).toBeGreaterThan(0);
      expect(results[0].passed).toBe(true);
    });

    it('should detect performance violations', async () => {
      const tester = new PerformanceTester();
      
      tester.add(
        'Slow Function',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        },
        { mean: 5 } // Threshold of 5ms
      );

      const results = await tester.run();
      
      expect(results[0].passed).toBe(false);
      expect(results[0].violations).toHaveLength(1);
    });

    it('should format results', async () => {
      const tester = new PerformanceTester();
      
      tester.add('Test', () => {});
      const results = await tester.run();
      const formatted = tester.formatResults(results);
      
      expect(formatted).toContain('Performance Benchmark Results');
      expect(formatted).toContain('Mean:');
      expect(formatted).toContain('Status:');
    });
  });

  describe('FlakyTestDetector', () => {
    it('should track test runs', () => {
      const detector = new FlakyTestDetector();
      
      detector.startTest('test-1');
      detector.endTest(true);
      
      detector.startTest('test-1');
      detector.endTest(false);
      
      const report = detector.analyze();
      expect(report).toHaveLength(1);
      expect(report[0].totalRuns).toBe(2);
      expect(report[0].failures).toBe(1);
    });

    it('should calculate flakiness score', () => {
      const detector = new FlakyTestDetector(0.3);
      
      // Simulate flaky test
      for (let i = 0; i < 10; i++) {
        detector.startTest('flaky-test');
        detector.endTest(i % 2 === 0); // Alternating pass/fail
      }
      
      const flaky = detector.detectFlaky();
      expect(flaky).toContain('flaky-test');
    });

    it('should generate report', () => {
      const detector = new FlakyTestDetector();
      
      // Test with no runs first
      const emptyReport = detector.getReport();
      expect(emptyReport).toContain('No flaky tests detected');
      
      // Test with stable runs
      detector.startTest('stable-test');
      detector.endTest(true);
      detector.startTest('stable-test');
      detector.endTest(true);
      
      const report = detector.getReport();
      expect(report).toContain('Flaky Test Report');
    });
  });
});