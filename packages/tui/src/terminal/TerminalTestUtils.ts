/**
 * Utility functions for Terminal Test Harness
 */

import type { TerminalCapabilities } from '../framework/UIFramework';
import type { TestResult, TestTerminal } from './TerminalTestHarness';
import { extendedToFlatCapabilities } from './types';

/**
 * Create default capabilities for error cases
 */
export function createDefaultCapabilities(): TerminalCapabilities {
  return {
    color: false,
    color256: false,
    trueColor: false,
    unicode: false,
    mouse: false,
    altScreen: false,
    cursorShape: false,
  };
}

/**
 * Create error result for failed terminal tests
 */
export function createErrorResult(
  terminal: TestTerminal,
  error: unknown,
  duration: number,
  warnings: string[] = []
): TestResult {
  const defaultCapabilities = createDefaultCapabilities();

  return {
    terminal,
    success: false,
    duration,
    capabilities: defaultCapabilities,
    errors: [
      `Test failed with error: ${error instanceof Error ? error.message : String(error)}`,
    ],
    warnings,
    performance: {
      startupTime: 0,
      detectionTime: 0,
      renderTime: 0,
    },
  };
}

/**
 * Test result parameters
 */
export interface TestResultParams {
  terminal: TestTerminal;
  capabilities: TerminalCapabilities;
  timing: {
    duration: number;
    detectionTime: number;
    renderTime: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Create successful test result
 */
export function createSuccessfulResult(params: TestResultParams): TestResult {
  const { terminal, capabilities, timing, errors, warnings } = params;

  return {
    terminal,
    success: errors.length === 0,
    duration: timing.duration,
    capabilities,
    errors,
    warnings,
    performance: {
      startupTime: timing.duration - timing.detectionTime - timing.renderTime,
      detectionTime: timing.detectionTime,
      renderTime: timing.renderTime,
    },
  };
}

/**
 * Test runner interface
 */
export interface TestRunner {
  setupTerminalEnvironment: (terminal: TestTerminal) => void;
  restoreTerminalEnvironment: () => void;
  capabilityDetector: {
    detect: () => Promise<{
      capabilities: import('./types').ExtendedTerminalCapabilities;
    }>;
  };
  testColorSupport: (terminal: TestTerminal) => Promise<void>;
  testSizeValidation: () => void;
  testFallbackRendering: () => Promise<void>;
  validateCapabilities: (
    terminal: TestTerminal,
    capabilities: import('./types').ExtendedTerminalCapabilities
  ) => string[];
  checkPerformance: (detectionTime: number, renderTime: number) => string[];
}

/**
 * Run test suite components
 */
async function runTestSuite(terminal: TestTerminal, testRunner: TestRunner) {
  // Test capability detection
  const detectionStart = Date.now();
  const detectionResult = await testRunner.capabilityDetector.detect();
  const detectionTime = Date.now() - detectionStart;

  // Test color support
  await testRunner.testColorSupport(terminal);

  // Test size validation
  testRunner.testSizeValidation();

  // Test fallback rendering
  const renderStart = Date.now();
  await testRunner.testFallbackRendering();
  const renderTime = Date.now() - renderStart;

  // Validate capabilities
  const errors = testRunner.validateCapabilities(
    terminal,
    detectionResult.capabilities
  );

  // Check performance
  const warnings = testRunner.checkPerformance(detectionTime, renderTime);

  return {
    capabilities: detectionResult.capabilities,
    detectionTime,
    renderTime,
    errors,
    warnings,
  };
}

/**
 * Extract terminal test execution logic
 */
export async function executeTerminalTest(
  terminal: TestTerminal,
  testRunner: TestRunner
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Set up environment
    testRunner.setupTerminalEnvironment(terminal);

    const results = await runTestSuite(terminal, testRunner);
    const duration = Date.now() - startTime;

    return createSuccessfulResult({
      terminal,
      capabilities: extendedToFlatCapabilities(results.capabilities),
      timing: {
        duration,
        detectionTime: results.detectionTime,
        renderTime: results.renderTime,
      },
      errors: results.errors,
      warnings: results.warnings,
    });
  } catch (error) {
    return createErrorResult(terminal, error, Date.now() - startTime, []);
  } finally {
    // Restore environment
    testRunner.restoreTerminalEnvironment();
  }
}
