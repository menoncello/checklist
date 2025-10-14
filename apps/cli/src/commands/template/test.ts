/**
 * Template Test Command
 * Tests templates using TemplateTestRunner
 */

import { TemplateLoader } from '@checklist/core/templates/TemplateLoader';
import { TemplateTestRunner } from '@checklist/core/templates/TemplateTestRunner';
import { createLogger } from '@checklist/core/utils/logger';
import type { ParsedOptions } from '../../types';
import { BaseCommand } from '../base';

const logger = createLogger('checklist:cli:template:test');

export class TemplateTestCommand extends BaseCommand {
  name = 'template test';
  description = 'Run tests for a template';
  options = [
    {
      flag: 'path',
      description: 'Path to template directory',
      required: true,
    },
    {
      flag: 'verbose',
      description: 'Show detailed test output',
      required: false,
      default: false,
    },
    {
      flag: 'format',
      description: 'Output format (text, json, html)',
      required: false,
      default: 'text',
    },
  ];

  async action(options: ParsedOptions): Promise<void> {
    this.validateOptions(options);

    const templatePath = this.getOption<string>(options, 'path');
    const verbose = this.getOption<boolean>(options, 'verbose', false);
    const format = this.getOption<string>(options, 'format', 'text');

    logger.info({
      msg: 'Running template tests',
      templatePath,
      verbose,
      format,
    });

    try {
      await this.runTemplateTests(templatePath, verbose, format);
    } catch (error) {
      logger.error({
        msg: 'Template tests failed',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async runTemplateTests(
    templatePath: string,
    verbose: boolean,
    format: string
  ): Promise<void> {
    // Load template
    const loader = new TemplateLoader();
    const template = await loader.load(templatePath);

    // Load test cases from template directory
    const testCasesPath = `${templatePath}/tests.json`;
    const testFile = Bun.file(testCasesPath);

    if (!(await testFile.exists())) {
      console.log(`No tests found at ${testCasesPath}`);
      return;
    }

    const testCases = await testFile.json();

    // Run tests
    const runner = new TemplateTestRunner({
      timeout: 5000,
    });

    const results = await runner.runTests(template, testCases);

    // Output results
    this.outputResults(results, format, verbose);

    // Exit with error if tests failed
    if (results.failed > 0) {
      throw new Error(`${results.failed} test(s) failed`);
    }
  }

  private outputResults(
    results: {
      passed: number;
      failed: number;
      totalTests: number;
      duration: number;
      results: Array<{
        name: string;
        passed: boolean;
        duration: number;
        error?: string;
        assertionFailures?: Array<{
          type: string;
          path: string;
          expected: unknown;
          actual: unknown;
          message: string;
        }>;
      }>;
    },
    format: string,
    verbose: boolean
  ): void {
    if (format === 'json') {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    this.outputTextResults(results, verbose);
  }

  private outputTextResults(
    results: {
      passed: number;
      failed: number;
      totalTests: number;
      results: Array<{
        name: string;
        passed: boolean;
        duration: number;
        error?: string;
        assertionFailures?: Array<{
          type: string;
          path: string;
          expected: unknown;
          actual: unknown;
          message: string;
        }>;
      }>;
    },
    verbose: boolean
  ): void {
    console.log(
      `\nTemplate Tests: ${results.passed}/${results.totalTests} passed`
    );
    console.log('');

    for (const result of results.results) {
      this.outputTestResult(result, verbose);
    }

    this.outputSummary(results.failed);
  }

  private outputTestResult(
    result: {
      name: string;
      passed: boolean;
      duration: number;
      error?: string;
      assertionFailures?: Array<{
        type: string;
        path: string;
        expected: unknown;
        actual: unknown;
        message: string;
      }>;
    },
    verbose: boolean
  ): void {
    const status = result.passed ? '✓' : '✗';
    console.log(`${status} ${result.name} (${result.duration.toFixed(0)}ms)`);

    if (!result.passed) {
      if (result.error !== undefined && result.error !== null) {
        console.log(`  Error: ${result.error}`);
      }
      if (result.assertionFailures !== undefined) {
        this.outputFailures(result.assertionFailures, verbose);
      }
    }
  }

  private outputFailures(
    failures: Array<{
      type: string;
      path: string;
      expected: unknown;
      actual: unknown;
      message: string;
    }>,
    verbose: boolean
  ): void {
    for (const failure of failures) {
      console.log(`  - ${failure.message}`);
      if (verbose) {
        console.log(`    Path: ${failure.path}`);
        console.log(`    Expected: ${JSON.stringify(failure.expected)}`);
        console.log(`    Actual: ${JSON.stringify(failure.actual)}`);
      }
    }
  }

  private outputSummary(failed: number): void {
    if (failed > 0) {
      console.log(`\n${failed} test(s) failed`);
    } else {
      console.log('\nAll tests passed!');
    }
  }
}
