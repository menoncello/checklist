/**
 * Testing types for template validation
 * Types related to template testing framework
 */

/**
 * Template test case definition
 */
export interface TemplateTestCase {
  /** Test case name */
  name: string;
  /** Test description */
  description?: string;
  /** Variable inputs for the test */
  inputs: Record<string, unknown>;
  /** Expected test results */
  expectedOutputs?: {
    /** Expected number of steps */
    steps?: number;
    /** Expected variable values */
    variables?: Record<string, unknown>;
    /** Expected generated files */
    files?: string[];
  };
  /** Custom assertions */
  assertions?: TemplateAssertion[];
}

/**
 * Custom test assertion
 */
export interface TemplateAssertion {
  type: 'contains' | 'equals' | 'matches' | 'exists';
  path: string;
  value: unknown;
}

/**
 * Template test results
 */
export interface TemplateTestResults {
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestCaseResult[];
}

/**
 * Single test case result
 */
export interface TestCaseResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  assertionFailures?: AssertionFailure[];
}

/**
 * Assertion failure details
 */
export interface AssertionFailure {
  type: string;
  path: string;
  expected: unknown;
  actual: unknown;
  message: string;
}
