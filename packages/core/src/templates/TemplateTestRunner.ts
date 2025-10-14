/**
 * Template testing framework
 * Runs test cases and validates template behavior
 */

import { createLogger } from '../utils/logger';
import { TemplateAssertions } from './TemplateAssertions';
import type {
  TemplateTestCase,
  TemplateTestResults,
  TestCaseResult,
  ChecklistTemplate,
} from './types';

const logger = createLogger('checklist:templates:testing');

/**
 * Test execution error
 */
export class TestExecutionError extends Error {
  constructor(
    message: string,
    public readonly testCase: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TestExecutionError';
  }
}

/**
 * Template test runner options
 */
export interface TestRunnerOptions {
  /**
   * Timeout for each test case (ms)
   */
  timeout?: number;
}

/**
 * Runs template test cases
 */
export class TemplateTestRunner {
  private readonly timeout: number;
  private readonly assertions: TemplateAssertions;

  constructor(options: TestRunnerOptions = {}) {
    this.timeout = options.timeout ?? 5000;
    this.assertions = new TemplateAssertions();
  }

  /**
   * Run all test cases
   * @param template - Template to test
   * @param testCases - Test cases to run
   * @returns Test results
   */
  async runTests(
    template: ChecklistTemplate,
    testCases: TemplateTestCase[]
  ): Promise<TemplateTestResults> {
    const startTime = Date.now();

    logger.info({
      msg: 'Running template tests',
      template: template.name,
      testCount: testCases.length,
    });

    const results = await this.executeAllTestCases(template, testCases);
    const duration = Date.now() - startTime;
    const testResults = this.createTestResults(
      results,
      testCases.length,
      duration
    );

    logger.info({
      msg: 'Template tests completed',
      passed: testResults.passed,
      failed: testResults.failed,
      totalTests: testCases.length,
      duration,
    });

    return testResults;
  }

  /**
   * Execute all test cases
   */
  private async executeAllTestCases(
    template: ChecklistTemplate,
    testCases: TemplateTestCase[]
  ): Promise<TestCaseResult[]> {
    const results: TestCaseResult[] = [];

    for (const testCase of testCases) {
      const result = await this.runTestCase(template, testCase);
      results.push(result);
    }

    return results;
  }

  /**
   * Create test results summary
   */
  private createTestResults(
    results: TestCaseResult[],
    totalTests: number,
    duration: number
  ): TemplateTestResults {
    let passed = 0;
    let failed = 0;

    for (const result of results) {
      if (result.passed) {
        passed++;
      } else {
        failed++;
      }
    }

    return { totalTests, passed, failed, duration, results };
  }

  /**
   * Run a single test case
   */
  private async runTestCase(
    template: ChecklistTemplate,
    testCase: TemplateTestCase
  ): Promise<TestCaseResult> {
    logger.debug({ msg: 'Running test case', name: testCase.name });

    const startTime = Date.now();

    try {
      const result = await this.executeTestWithTimeout(template, testCase);
      const duration = Date.now() - startTime;
      this.logTestSuccess(testCase.name, result.passed, duration);
      return { ...result, duration };
    } catch (error) {
      return this.handleTestError(testCase.name, error, Date.now() - startTime);
    }
  }

  /**
   * Log test success
   */
  private logTestSuccess(
    name: string,
    passed: boolean,
    duration: number
  ): void {
    logger.debug({
      msg: 'Test case completed',
      name,
      passed,
      duration,
    });
  }

  /**
   * Handle test execution error
   */
  private handleTestError(
    name: string,
    error: unknown,
    duration: number
  ): TestCaseResult {
    logger.error({
      msg: 'Test case failed with error',
      name,
      error: (error as Error).message,
    });

    return {
      name,
      passed: false,
      duration,
      error: `Test execution failed: ${(error as Error).message}`,
    };
  }

  /**
   * Execute test with timeout
   */
  private async executeTestWithTimeout(
    template: ChecklistTemplate,
    testCase: TemplateTestCase
  ): Promise<Omit<TestCaseResult, 'duration'>> {
    return await Promise.race([
      this.executeTest(template, testCase),
      this.createTimeoutPromise(testCase.name),
    ]);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(
    testName: string
  ): Promise<Omit<TestCaseResult, 'duration'>> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new TestExecutionError(
            `Test case timed out after ${this.timeout}ms`,
            testName
          )
        );
      }, this.timeout);
    });
  }

  /**
   * Execute test case
   */
  private async executeTest(
    template: ChecklistTemplate,
    testCase: TemplateTestCase
  ): Promise<Omit<TestCaseResult, 'duration'>> {
    // Run assertions on template
    const assertionFailures = testCase.assertions
      ? this.assertions.runAssertions(template, testCase.assertions)
      : [];

    return {
      name: testCase.name,
      passed: assertionFailures.length === 0,
      assertionFailures:
        assertionFailures.length > 0 ? assertionFailures : undefined,
    };
  }
}
