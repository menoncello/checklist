/**
 * Utility functions for compatibility test suite
 */

import type { ComprehensiveTestResult } from './CompatibilityTestSuite';

/**
 * Generate test summary
 */
export function generateSummary(results: Partial<ComprehensiveTestResult>) {
  let totalTests = 0;
  let passed = 0;
  let failed = 0;

  if (results.terminalTestResults) {
    totalTests += results.terminalTestResults.length;
    passed += results.terminalTestResults.filter((r) => r.success).length;
    failed += results.terminalTestResults.filter((r) => !r.success).length;
  }

  if (results.visualTestResults) {
    totalTests += results.visualTestResults.length;
    passed += results.visualTestResults.filter((r) => r.passed === true).length;
    failed += results.visualTestResults.filter((r) => r.passed !== true).length;
  }

  return {
    totalTests,
    passed,
    failed,
    skipped: 0,
    duration: 0,
    successRate: totalTests > 0 ? (passed / totalTests) * 100 : 0,
  };
}

/**
 * Generate recommendations based on results
 */
export function generateRecommendations(
  results: Partial<ComprehensiveTestResult>
): string[] {
  const recommendations: string[] = [];

  addTerminalTestRecommendations(results, recommendations);
  addVisualTestRecommendations(results, recommendations);
  addPerformanceRecommendations(results, recommendations);

  return recommendations;
}

function addTerminalTestRecommendations(
  results: Partial<ComprehensiveTestResult>,
  recommendations: string[]
): void {
  if (!results.terminalTestResults) return;

  const failedTerminals = results.terminalTestResults.filter((r) => !r.success);
  if (failedTerminals.length > 0) {
    recommendations.push(
      `${failedTerminals.length} terminal(s) failed compatibility tests`
    );
  }

  // Check performance warnings
  results.terminalTestResults.forEach((result) => {
    if (result.warnings.length > 0) {
      recommendations.push(
        `Performance issues detected: ${result.warnings.join(', ')}`
      );
    }
  });
}

function addVisualTestRecommendations(
  results: Partial<ComprehensiveTestResult>,
  recommendations: string[]
): void {
  if (!results.visualTestResults) return;

  const failedVisual = results.visualTestResults.filter(
    (r) => r.passed !== true
  );
  if (failedVisual.length > 0) {
    recommendations.push(
      `${failedVisual.length} visual regression test(s) failed`
    );
  }
}

function addPerformanceRecommendations(
  results: Partial<ComprehensiveTestResult>,
  recommendations: string[]
): void {
  if (!results.performanceMetrics) return;

  if (results.performanceMetrics.detectionOverhead > 5) {
    recommendations.push(
      'Capability detection is slow (>5ms), consider optimization'
    );
  }

  if (results.performanceMetrics.renderingSpeed > 10) {
    recommendations.push(
      'Fallback rendering is slow (>10ms), consider optimization'
    );
  }
}
