/**
 * Utility functions for Visual Regression Tester
 */

import type {
  VisualTestScenario,
  VisualTestResult,
} from './VisualRegressionTester';

/**
 * Test result parameters for creating successful results
 */
export interface TestResultParams {
  scenario: VisualTestScenario;
  renderMode: string;
  output: string;
  terminalName: string;
  screenshot?: string;
  metrics: {
    characterCount: number;
    lineCount: number;
    ansiSequenceCount: number;
  };
  differences: {
    baseline?: string;
    diff?: string;
    similarityScore: number;
    hasRegressions: boolean;
  };
  startTime: number;
}

/**
 * Create successful visual test result
 */
export function createSuccessfulResult(
  params: TestResultParams
): VisualTestResult {
  const renderTime = Date.now() - params.startTime;

  return {
    scenario: params.scenario,
    terminal: params.terminalName,
    renderMode: params.renderMode,
    output: params.output,
    screenshot: params.screenshot,
    dimensions: {
      width: getOutputWidth(params.output),
      height: getOutputHeight(params.output),
    },
    metrics: {
      renderTime,
      characterCount: params.metrics.characterCount,
      lineCount: params.metrics.lineCount,
      ansiSequenceCount: params.metrics.ansiSequenceCount,
    },
    differences: params.differences,
    passed: params.differences.similarityScore > 0.95,
    errors: [],
  };
}

/**
 * Failed result parameters
 */
export interface FailedResultParams {
  scenario: VisualTestScenario;
  renderMode: string;
  error: unknown;
  startTime: number;
  terminalName?: string;
}

/**
 * Create failed visual test result
 */
export function createFailedResult(
  params: FailedResultParams
): VisualTestResult {
  const {
    scenario,
    renderMode,
    error,
    startTime,
    terminalName = 'unknown',
  } = params;
  const errorMessage = `Test failed: ${
    error instanceof Error ? error.message : String(error)
  }`;

  return buildFailedResult({
    scenario,
    terminal: terminalName,
    renderMode,
    renderTime: Date.now() - startTime,
    errorMessage,
  });
}

function buildFailedResult(params: {
  scenario: VisualTestScenario;
  terminal: string;
  renderMode: string;
  renderTime: number;
  errorMessage: string;
}): VisualTestResult {
  return {
    scenario: params.scenario,
    terminal: params.terminal,
    renderMode: params.renderMode,
    output: '',
    dimensions: { width: 0, height: 0 },
    metrics: {
      renderTime: params.renderTime,
      characterCount: 0,
      lineCount: 0,
      ansiSequenceCount: 0,
    },
    differences: {
      similarityScore: 0,
      hasRegressions: true,
    },
    passed: false,
    errors: [params.errorMessage],
  };
}

/**
 * Get output width from content
 */
export function getOutputWidth(output: string): number {
  const lines = output.split('\n');
  return Math.max(...lines.map((line) => line.length));
}

/**
 * Get output height from content
 */
export function getOutputHeight(output: string): number {
  return output.split('\n').length;
}
