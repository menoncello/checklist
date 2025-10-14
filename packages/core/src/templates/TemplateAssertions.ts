/**
 * Template assertion helpers
 * Validates template execution results
 */

import { createLogger } from '../utils/logger';
import type {
  TemplateAssertion,
  AssertionFailure,
  ChecklistTemplate,
} from './types';

const logger = createLogger('checklist:templates:assertions');

/**
 * Runs template assertions
 */
export class TemplateAssertions {
  /**
   * Run all assertions for a test case
   */
  runAssertions(
    processed: ChecklistTemplate,
    assertions: TemplateAssertion[]
  ): AssertionFailure[] {
    const failures: AssertionFailure[] = [];

    for (const assertion of assertions) {
      const failure = this.runAssertion(processed, assertion);
      if (failure !== null) {
        failures.push(failure);
      }
    }

    return failures;
  }

  /**
   * Run a single assertion
   */
  private runAssertion(
    processed: ChecklistTemplate,
    assertion: TemplateAssertion
  ): AssertionFailure | null {
    logger.debug({
      msg: 'Running assertion',
      type: assertion.type,
      path: assertion.path,
    });

    switch (assertion.type) {
      case 'equals':
        return this.assertEquals(processed, assertion);
      case 'contains':
        return this.assertContains(processed, assertion);
      case 'exists':
        return this.assertExists(processed, assertion);
      default:
        return this.createUnknownAssertionFailure(assertion.type);
    }
  }

  /**
   * Create failure for unknown assertion type
   */
  private createUnknownAssertionFailure(type: string): AssertionFailure {
    return {
      type,
      path: '',
      expected: 'valid assertion type',
      actual: type,
      message: `Unknown assertion type: ${type}`,
    };
  }

  /**
   * Assert value equals expected
   */
  private assertEquals(
    processed: ChecklistTemplate,
    assertion: TemplateAssertion
  ): AssertionFailure | null {
    const actualValue = this.getValueAtPath(processed, assertion.path);

    if (actualValue !== assertion.value) {
      return {
        type: 'equals',
        path: assertion.path,
        expected: assertion.value,
        actual: actualValue,
        message: `Expected ${assertion.path} to equal ${JSON.stringify(assertion.value)}`,
      };
    }

    return null;
  }

  /**
   * Assert value contains expected
   */
  private assertContains(
    processed: ChecklistTemplate,
    assertion: TemplateAssertion
  ): AssertionFailure | null {
    const actualValue = this.getValueAtPath(processed, assertion.path);

    if (
      typeof actualValue === 'string' &&
      typeof assertion.value === 'string'
    ) {
      return this.checkStringContains(actualValue, assertion);
    }

    if (Array.isArray(actualValue)) {
      return this.checkArrayContains(actualValue, assertion);
    }

    return {
      type: 'contains',
      path: assertion.path,
      expected: assertion.value,
      actual: actualValue,
      message: 'Contains assertion requires string or array',
    };
  }

  /**
   * Check string contains value
   */
  private checkStringContains(
    actualValue: string,
    assertion: TemplateAssertion
  ): AssertionFailure | null {
    if (actualValue.includes(assertion.value as string)) {
      return null;
    }

    return {
      type: 'contains',
      path: assertion.path,
      expected: assertion.value,
      actual: actualValue,
      message: `Expected ${assertion.path} to contain ${JSON.stringify(assertion.value)}`,
    };
  }

  /**
   * Check array contains value
   */
  private checkArrayContains(
    actualValue: unknown[],
    assertion: TemplateAssertion
  ): AssertionFailure | null {
    if (actualValue.includes(assertion.value)) {
      return null;
    }

    return {
      type: 'contains',
      path: assertion.path,
      expected: assertion.value,
      actual: actualValue,
      message: `Expected ${assertion.path} to contain ${JSON.stringify(assertion.value)}`,
    };
  }

  /**
   * Assert path exists
   */
  private assertExists(
    processed: ChecklistTemplate,
    assertion: TemplateAssertion
  ): AssertionFailure | null {
    const actualValue = this.getValueAtPath(processed, assertion.path);
    const exists = actualValue !== undefined && actualValue !== null;

    if (assertion.value === true && !exists) {
      return {
        type: 'exists',
        path: assertion.path,
        expected: true,
        actual: false,
        message: `Expected ${assertion.path} to exist`,
      };
    }

    if (assertion.value === false && exists) {
      return {
        type: 'exists',
        path: assertion.path,
        expected: false,
        actual: true,
        message: `Expected ${assertion.path} not to exist`,
      };
    }

    return null;
  }

  /**
   * Get value at path in object
   */
  private getValueAtPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      const isObject = typeof current === 'object';
      const hasProperty =
        isObject && part in (current as Record<string, unknown>);

      if (hasProperty) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
