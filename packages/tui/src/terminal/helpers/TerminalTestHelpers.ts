/**
 * Terminal Test Harness Helper Functions
 */

import type { TestResult } from '../TerminalTestHarness';

/**
 * Terminal summary calculation
 */
export interface TerminalSummary {
  colorSupport: {
    basic: number;
    color256: number;
    trueColor: number;
  };
  unicodeSupport: {
    basic: number;
    wide: number;
    emoji: number;
  };
  mouseSupport: {
    basic: number;
    advanced: number;
  };
  sizeCompliance: number;
}

/**
 * Generate test summary from results
 */
export function generateTestSummary(results: TestResult[]): TerminalSummary {
  return {
    colorSupport: calculateColorSupportSummary(results),
    unicodeSupport: calculateUnicodeSupportSummary(results),
    mouseSupport: calculateMouseSupportSummary(results),
    sizeCompliance: calculateSizeCompliance(results),
  };
}

/**
 * Calculate color support summary
 */
interface ExtendedColorCaps {
  color?: {
    basic?: boolean;
    color256?: boolean;
    trueColor?: boolean;
  };
}

export function calculateColorSupportSummary(results: TestResult[]) {
  const extResults = results.filter((r) => {
    const caps = r.capabilities as unknown as ExtendedColorCaps;
    return (
      caps !== undefined &&
      caps !== null &&
      typeof caps === 'object' &&
      'color' in caps &&
      typeof caps.color === 'object'
    );
  });

  return {
    basic: extResults.filter((r) => {
      const caps = r.capabilities as unknown as ExtendedColorCaps;
      return caps.color?.basic === true;
    }).length,
    color256: extResults.filter((r) => {
      const caps = r.capabilities as unknown as ExtendedColorCaps;
      return caps.color?.color256 === true;
    }).length,
    trueColor: extResults.filter((r) => {
      const caps = r.capabilities as unknown as ExtendedColorCaps;
      return caps.color?.trueColor === true;
    }).length,
  };
}

/**
 * Calculate unicode support summary
 */
interface ExtendedUnicodeCaps {
  unicode?: {
    basic?: boolean;
    wide?: boolean;
    emoji?: boolean;
  };
}

export function calculateUnicodeSupportSummary(results: TestResult[]) {
  const extResults = results.filter((r) => {
    const caps = r.capabilities as unknown as ExtendedUnicodeCaps;
    return (
      caps !== undefined &&
      caps !== null &&
      typeof caps === 'object' &&
      'unicode' in caps &&
      typeof caps.unicode === 'object'
    );
  });

  return {
    basic: extResults.filter((r) => {
      const caps = r.capabilities as unknown as ExtendedUnicodeCaps;
      return caps.unicode?.basic === true;
    }).length,
    wide: extResults.filter((r) => {
      const caps = r.capabilities as unknown as ExtendedUnicodeCaps;
      return caps.unicode?.wide === true;
    }).length,
    emoji: extResults.filter((r) => {
      const caps = r.capabilities as unknown as ExtendedUnicodeCaps;
      return caps.unicode?.emoji === true;
    }).length,
  };
}

/**
 * Calculate mouse support summary
 */
interface ExtendedMouseCaps {
  mouse?: {
    basic?: boolean;
    advanced?: boolean;
  };
}

export function calculateMouseSupportSummary(results: TestResult[]) {
  const extResults = results.filter((r) => {
    const caps = r.capabilities as unknown as ExtendedMouseCaps;
    return (
      caps !== undefined &&
      caps !== null &&
      typeof caps === 'object' &&
      'mouse' in caps &&
      typeof caps.mouse === 'object'
    );
  });

  return {
    basic: extResults.filter((r) => {
      const caps = r.capabilities as unknown as ExtendedMouseCaps;
      return caps.mouse?.basic === true;
    }).length,
    advanced: extResults.filter((r) => {
      const caps = r.capabilities as unknown as ExtendedMouseCaps;
      return caps.mouse?.advanced === true;
    }).length,
  };
}

/**
 * Calculate size compliance
 */
interface ExtendedSizeCaps {
  size?: {
    meetsMinimum?: boolean;
  };
}

export function calculateSizeCompliance(results: TestResult[]): number {
  const extResults = results.filter((r) => {
    const caps = r.capabilities as unknown as ExtendedSizeCaps;
    return (
      caps !== undefined &&
      caps !== null &&
      typeof caps === 'object' &&
      'size' in caps &&
      typeof caps.size === 'object'
    );
  });

  return extResults.filter((r) => {
    const caps = r.capabilities as unknown as ExtendedSizeCaps;
    return caps.size?.meetsMinimum === true;
  }).length;
}

/**
 * Check performance against requirements
 */
export function checkPerformance(
  detectionTime: number,
  renderTime: number
): string[] {
  const warnings: string[] = [];

  if (detectionTime > 5) {
    warnings.push(
      `Capability detection took ${detectionTime}ms (should be <5ms)`
    );
  }
  if (renderTime > 10) {
    warnings.push(`Fallback rendering took ${renderTime}ms (should be <10ms)`);
  }

  return warnings;
}
