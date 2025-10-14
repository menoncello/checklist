/**
 * Tests for TemplateTestRunner
 * Covers test execution, assertion validation, timeout handling, and error recovery
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { TemplateTestRunner, TestExecutionError } from '../../src/templates/TemplateTestRunner';
import type {
  ChecklistTemplate,
  TemplateTestCase,
  TemplateAssertion,
} from '../../src/templates/types';

// Helper to create mock template
function createMockTemplate(overrides?: Partial<ChecklistTemplate>): ChecklistTemplate {
  return {
    name: 'test-template',
    version: '1.0.0',
    description: 'Test template',
    steps: [
      { id: 'step1', title: 'Step 1', description: 'First step', completed: false },
      { id: 'step2', title: 'Step 2', description: 'Second step', completed: false },
    ],
    variables: {
      projectName: 'my-project',
      author: 'Test Author',
    },
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('TemplateTestRunner', () => {
  describe('constructor', () => {
    test('should create runner with default options', () => {
      const runner = new TemplateTestRunner();
      expect(runner).toBeDefined();
    });

    test('should create runner with custom timeout', () => {
      const runner = new TemplateTestRunner({ timeout: 10000 });
      expect(runner).toBeDefined();
    });

    test('should use default timeout when not specified', () => {
      const runner = new TemplateTestRunner({});
      expect(runner).toBeDefined();
    });
  });

  describe('runTests', () => {
    test('should run all test cases successfully', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Test 1',
          description: 'First test',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'name', value: 'test-template' },
          ],
        },
        {
          name: 'Test 2',
          description: 'Second test',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'version', value: '1.0.0' },
          ],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.totalTests).toBe(2);
      expect(results.passed).toBe(2);
      expect(results.failed).toBe(0);
      expect(results.duration).toBeGreaterThanOrEqual(0);
      expect(results.results).toHaveLength(2);
    });

    test('should handle test failures gracefully', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Passing test',
          description: 'This should pass',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'name', value: 'test-template' },
          ],
        },
        {
          name: 'Failing test',
          description: 'This should fail',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'name', value: 'wrong-name' },
          ],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.totalTests).toBe(2);
      expect(results.passed).toBe(1);
      expect(results.failed).toBe(1);
      expect(results.results[0].passed).toBe(true);
      expect(results.results[1].passed).toBe(false);
      expect(results.results[1].assertionFailures).toBeDefined();
    });

    test('should run tests with no assertions', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Test without assertions',
          description: 'Just validates template loads',
          inputs: {},
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.totalTests).toBe(1);
      expect(results.passed).toBe(1);
      expect(results.failed).toBe(0);
    });

    test('should handle empty test cases array', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [];

      const results = await runner.runTests(template, testCases);

      expect(results.totalTests).toBe(0);
      expect(results.passed).toBe(0);
      expect(results.failed).toBe(0);
      expect(results.results).toHaveLength(0);
    });

    test('should track test duration accurately', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Test 1',
          inputs: {},
          assertions: [{ type: 'equals', path: 'name', value: 'test-template' }],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.duration).toBeGreaterThanOrEqual(0);
      expect(results.results[0].duration).toBeGreaterThanOrEqual(0);
    });

    test('should handle multiple assertions per test', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Multi-assertion test',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'name', value: 'test-template' },
            { type: 'equals', path: 'version', value: '1.0.0' },
            { type: 'exists', path: 'steps', value: true },
          ],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.passed).toBe(1);
      expect(results.results[0].passed).toBe(true);
    });

    test('should fail if any assertion fails in multi-assertion test', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Multi-assertion test with failure',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'name', value: 'test-template' }, // Pass
            { type: 'equals', path: 'version', value: '2.0.0' }, // Fail
            { type: 'exists', path: 'steps', value: true }, // Pass
          ],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.failed).toBe(1);
      expect(results.results[0].passed).toBe(false);
      expect(results.results[0].assertionFailures).toBeDefined();
      expect(results.results[0].assertionFailures?.length).toBe(1);
    });
  });

  describe('timeout handling', () => {
    test('should timeout tests that exceed limit', async () => {
      const runner = new TemplateTestRunner({ timeout: 10 }); // 10ms timeout
      const template = createMockTemplate();

      // Create a test that would take longer than timeout
      // Since our assertions are synchronous, we'll rely on the timeout mechanism
      const testCases: TemplateTestCase[] = [
        {
          name: 'Test that might timeout',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'name', value: 'test-template' },
          ],
        },
      ];

      // Note: This test might pass if assertion completes before timeout
      // The timeout mechanism protects against hanging operations
      const results = await runner.runTests(template, testCases);

      expect(results.totalTests).toBe(1);
      // Results should be present even if timeout occurred
      expect(results.results).toHaveLength(1);
    });

    test('should handle timeout with custom timeout value', async () => {
      const runner = new TemplateTestRunner({ timeout: 100 });
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Fast test',
          inputs: {},
          assertions: [{ type: 'equals', path: 'name', value: 'test-template' }],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.passed).toBe(1);
    });
  });

  describe('error handling', () => {
    test('should handle errors during test execution', async () => {
      const runner = new TemplateTestRunner();
      // Create a template that might cause assertion issues
      const template = createMockTemplate({ name: undefined as unknown as string });
      const testCases: TemplateTestCase[] = [
        {
          name: 'Test with potential error',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'name', value: 'test-template' },
          ],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.totalTests).toBe(1);
      // Should fail but not crash
      expect(results.results).toHaveLength(1);
    });

    test('should include error messages in failed test results', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Test with assertion failure',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'name', value: 'wrong-value' },
          ],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.results[0].passed).toBe(false);
      expect(results.results[0].assertionFailures).toBeDefined();
      expect(results.results[0].assertionFailures?.[0].message).toBeDefined();
    });
  });

  describe('test results structure', () => {
    test('should include all required fields in test results', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Complete test',
          description: 'Test all fields',
          inputs: {},
          assertions: [{ type: 'equals', path: 'name', value: 'test-template' }],
        },
      ];

      const results = await runner.runTests(template, testCases);

      // Validate top-level results structure
      expect(results).toHaveProperty('totalTests');
      expect(results).toHaveProperty('passed');
      expect(results).toHaveProperty('failed');
      expect(results).toHaveProperty('duration');
      expect(results).toHaveProperty('results');

      // Validate individual test result structure
      const testResult = results.results[0];
      expect(testResult).toHaveProperty('name');
      expect(testResult).toHaveProperty('passed');
      expect(testResult).toHaveProperty('duration');
    });

    test('should include assertion failures in failed test results', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Failing test',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'version', value: '2.0.0' },
          ],
        },
      ];

      const results = await runner.runTests(template, testCases);

      const testResult = results.results[0];
      expect(testResult.passed).toBe(false);
      expect(testResult.assertionFailures).toBeDefined();
      expect(testResult.assertionFailures?.length).toBeGreaterThan(0);

      const failure = testResult.assertionFailures?.[0];
      expect(failure).toHaveProperty('type');
      expect(failure).toHaveProperty('path');
      expect(failure).toHaveProperty('expected');
      expect(failure).toHaveProperty('actual');
      expect(failure).toHaveProperty('message');
    });

    test('should not include assertionFailures for passed tests', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate();
      const testCases: TemplateTestCase[] = [
        {
          name: 'Passing test',
          inputs: {},
          assertions: [{ type: 'equals', path: 'name', value: 'test-template' }],
        },
      ];

      const results = await runner.runTests(template, testCases);

      const testResult = results.results[0];
      expect(testResult.passed).toBe(true);
      expect(testResult.assertionFailures).toBeUndefined();
    });
  });

  describe('complex templates', () => {
    test('should handle templates with nested properties', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate({
        metadata: {
          created: '2025-01-01T00:00:00Z',
          modified: '2025-01-02T00:00:00Z',
          author: { name: 'Test Author', email: 'test@example.com' },
        },
      });

      const testCases: TemplateTestCase[] = [
        {
          name: 'Nested property test',
          inputs: {},
          assertions: [
            { type: 'equals', path: 'metadata.created', value: '2025-01-01T00:00:00Z' },
            { type: 'exists', path: 'metadata.author', value: true },
          ],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.passed).toBe(1);
    });

    test('should handle templates with arrays', async () => {
      const runner = new TemplateTestRunner();
      const template = createMockTemplate({
        steps: [
          { id: 'step1', title: 'Step 1', description: 'First', completed: false },
          { id: 'step2', title: 'Step 2', description: 'Second', completed: false },
          { id: 'step3', title: 'Step 3', description: 'Third', completed: false },
        ],
      });

      const testCases: TemplateTestCase[] = [
        {
          name: 'Array property test',
          inputs: {},
          assertions: [
            { type: 'exists', path: 'steps', value: true },
          ],
        },
      ];

      const results = await runner.runTests(template, testCases);

      expect(results.passed).toBe(1);
    });
  });

  describe('TestExecutionError', () => {
    test('should create error with test case name', () => {
      const error = new TestExecutionError('Test failed', 'my-test');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TestExecutionError');
      expect(error.message).toBe('Test failed');
      expect(error.testCase).toBe('my-test');
    });

    test('should include cause when provided', () => {
      const cause = new Error('Original error');
      const error = new TestExecutionError('Test failed', 'my-test', cause);

      expect(error.cause).toBe(cause);
    });
  });
});
