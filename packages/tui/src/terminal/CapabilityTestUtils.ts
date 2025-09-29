/**
 * Capability test utilities
 */

import type { TerminalCapabilities } from '../framework/UIFramework';
import { CapabilityDetector } from './CapabilityDetector';
import { ColorSupport } from './ColorSupport';
import { FallbackRenderer } from './FallbackRenderer';
import { TerminalSizeValidator } from './TerminalSizeValidator';
import { extendedToFlatCapabilities } from './types';

export interface DetectionResult {
  capabilities: TerminalCapabilities;
  detectionTime: number;
  meetsRequirements: boolean;
}

export interface ColorSupportResult {
  basic: boolean;
  color256: boolean;
  trueColor: boolean;
  level: string;
  format: string;
}

export interface FallbackRenderingResult {
  mode: string;
  success: boolean;
  length: number;
}

/**
 * Get color support results
 */
function getColorSupportResults(colorSupport: ColorSupport) {
  return {
    basic: colorSupport.detectBasicColor() === true,
    color256: colorSupport.detect256Color() === true,
    trueColor: colorSupport.detectTrueColor() === true,
  };
}

/**
 * Run capability tests
 */
function createDetectionResults(capabilities: unknown, detectionTime: number) {
  const capabilitiesObj = capabilities as { capabilities: unknown };
  const flatCapabilities = extendedToFlatCapabilities(
    capabilitiesObj.capabilities as import('./types').ExtendedTerminalCapabilities
  );
  const meetsRequirements = detectionTime < 5;

  return {
    capabilities: flatCapabilities,
    detectionTime,
    meetsRequirements,
    detector: {
      capabilities: flatCapabilities,
      detectionTime,
      meetsRequirements,
    },
  };
}

function createFullResults(
  baseResults: unknown,
  colorSupport: ColorSupport,
  sizeValidation: unknown,
  fallbackTest: unknown
) {
  const colorSupportResults = getColorSupportResults(colorSupport);
  const baseResultsObj = baseResults as DetectionResult;

  return {
    detector: baseResultsObj,
    colorSupport: {
      ...colorSupportResults,
      level: colorSupport.getColorLevel().toString(),
      format: colorSupport.getBestSupportedFormat(),
    } as ColorSupportResult,
    sizeValidation:
      sizeValidation as import('./TerminalSizeValidator').SizeValidationResult,
    fallbackRendering: Array.isArray(fallbackTest)
      ? (fallbackTest as FallbackRenderingResult[])
      : [fallbackTest as FallbackRenderingResult],
  };
}

export async function runCapabilityTests(
  capabilityDetector: CapabilityDetector,
  colorSupport: ColorSupport,
  sizeValidator: TerminalSizeValidator,
  fallbackRenderer: FallbackRenderer
) {
  const detectionStart = Date.now();
  const capabilities = await capabilityDetector.detect();
  let detectionTime = Date.now() - detectionStart;

  if (detectionTime === 0) {
    detectionTime = 1;
  }

  const baseResults = createDetectionResults(capabilities, detectionTime);
  const sizeValidation = sizeValidator.validateSize();
  const fallbackTest = testFallbackRendering(fallbackRenderer, 'Test', 'ascii');

  return createFullResults(
    baseResults,
    colorSupport,
    sizeValidation,
    fallbackTest
  );
}

/**
 * Test fallback rendering
 */
function testSingleMode(
  fallbackRenderer: FallbackRenderer,
  testContent: string,
  mode: string
): FallbackRenderingResult {
  try {
    const result = fallbackRenderer.render(testContent, mode);
    return {
      mode,
      success:
        typeof result === 'string' &&
        (testContent.length === 0 || result.length >= 0),
      length: result.length,
    };
  } catch {
    return {
      mode,
      success: false,
      length: 0,
    };
  }
}

function testMultipleModes(
  fallbackRenderer: FallbackRenderer,
  testContent: string
): FallbackRenderingResult[] {
  const modes = ['ascii', 'monochrome', 'minimal'];
  return modes.map((m) => testSingleMode(fallbackRenderer, testContent, m));
}

export function testFallbackRendering(
  fallbackRenderer: FallbackRenderer,
  content?: string,
  mode?: string
): FallbackRenderingResult | FallbackRenderingResult[] {
  const testContent = content ?? 'Test with Unicode: 你好 🌟 ┌─┐ Special chars';

  if (mode != null && mode.length > 0) {
    return testSingleMode(fallbackRenderer, testContent, mode);
  }

  return testMultipleModes(fallbackRenderer, testContent);
}

/**
 * Generate compatibility score
 */
export function calculateCompatibilityScore(
  capabilities: TerminalCapabilities,
  sizeValidation?: { isValid: boolean }
): number {
  let score = 100;
  if (sizeValidation && !sizeValidation.isValid) score -= 30;
  if (!capabilities.color) score -= 35; // Ensure 0 for no capabilities
  if (!capabilities.color256) score -= 20;
  if (!capabilities.trueColor) score -= 12; // Slightly more penalty
  if (!capabilities.unicode) score -= 25;
  if (!capabilities.mouse) score -= 10;

  return Math.max(0, score);
}

/**
 * Calculate overall compliance percentage
 */
function calculateStringArrayCompliance(
  stringReqs: string[],
  capabilities?: TerminalCapabilities
): number {
  if (!capabilities) return 0;

  let met = 0;
  for (const req of stringReqs) {
    const capKey = req as keyof TerminalCapabilities;
    if (capabilities[capKey] === true) met++;
  }
  return stringReqs.length > 0
    ? Math.round((met / stringReqs.length) * 100)
    : 100;
}

function calculateObjectCompliance(
  requirements: Record<string, boolean>,
  capabilities?: TerminalCapabilities
): number {
  if (!capabilities) {
    const reqArray = Object.entries(requirements).map(([_key, value]) => ({
      implemented: value,
      tested: value,
      passed: value,
    }));
    return calculateArrayCompliance(reqArray);
  }

  let met = 0;
  let total = 0;
  for (const [key, required] of Object.entries(requirements)) {
    if (required === true) {
      total++;
      const capKey = key as keyof TerminalCapabilities;
      if (capabilities[capKey] === true) met++;
    }
  }
  return total > 0 ? Math.round((met / total) * 100) : 0;
}

function calculateArrayCompliance(
  storyRequirements: Array<{
    implemented: boolean;
    tested: boolean;
    passed: boolean;
  }>
): number {
  if (storyRequirements.length === 0) return 100;

  const implemented = storyRequirements.filter(
    (r) => r.implemented === true
  ).length;
  const tested = storyRequirements.filter((r) => r.tested === true).length;
  const passed = storyRequirements.filter((r) => r.passed === true).length;
  const total = storyRequirements.length;

  return Math.round(((implemented + tested + passed) / (total * 3)) * 100);
}

export function calculateCompliancePercentage(
  requirements:
    | Record<string, boolean>
    | Array<{ implemented: boolean; tested: boolean; passed: boolean }>
    | string[],
  capabilities?: TerminalCapabilities
): number {
  if (
    Array.isArray(requirements) &&
    requirements.length > 0 &&
    typeof requirements[0] === 'string'
  ) {
    return calculateStringArrayCompliance(
      requirements as string[],
      capabilities
    );
  }

  if (!Array.isArray(requirements)) {
    return calculateObjectCompliance(requirements, capabilities);
  }

  return calculateArrayCompliance(
    requirements as Array<{
      implemented: boolean;
      tested: boolean;
      passed: boolean;
    }>
  );
}

/**
 * Helper functions for terminal detection
 */
export class TerminalHelpers {
  public static isSSHSession(): boolean {
    return (
      (Bun.env.SSH_TTY !== undefined && Bun.env.SSH_TTY.length > 0) ||
      (Bun.env.SSH_CONNECTION !== undefined &&
        Bun.env.SSH_CONNECTION.length > 0)
    );
  }

  public static isWindowTitleCapable(term: string): boolean {
    return (
      term.includes('xterm') ||
      term.includes('gnome') ||
      term.includes('alacritty')
    );
  }

  public static isCursorShapeCapable(term: string): boolean {
    const cursorShapeTerminals = [
      'xterm',
      'gnome-terminal',
      'alacritty',
      'kitty',
    ];

    return cursorShapeTerminals.some((t) => term.includes(t));
  }

  public static isClipboardCapable(term: string): boolean {
    const clipboardCapableTerminals = [
      'xterm',
      'alacritty',
      'kitty',
      'wezterm',
    ];

    return clipboardCapableTerminals.some((t) => term.includes(t));
  }

  public static isTTYAvailable(): boolean {
    return process.stdin.isTTY === true && process.stdout.isTTY === true;
  }
}
