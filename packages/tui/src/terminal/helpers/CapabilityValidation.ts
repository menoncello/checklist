/**
 * Terminal Capability Validation Helpers
 */

import type { TerminalCapabilities } from '../../framework/UIFramework';
import type { TestTerminal } from '../TerminalTestHarness';
import type {
  ExtendedTerminalCapabilities,
  ColorCapabilities,
  UnicodeCapabilities,
  MouseCapabilities,
} from '../types';

/**
 * Validate terminal capabilities against expected values
 */
export function validateCapabilities(
  terminal: TestTerminal,
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities
): string[] {
  const errors: string[] = [];

  validateColorCapabilities(terminal, capabilities, errors);
  validateUnicodeCapabilities(terminal, capabilities, errors);
  validateMouseCapabilities(terminal, capabilities, errors);
  validateExpectedFeatures(terminal, capabilities, errors);

  return errors;
}

/**
 * Check if capabilities have extended format
 */
function hasExtendedFormat(
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities,
  field: string
): boolean {
  return (
    field in capabilities &&
    typeof (capabilities as unknown as Record<string, unknown>)[field] ===
      'object'
  );
}

/**
 * Validate color capabilities
 */
export function validateColorCapabilities(
  terminal: TestTerminal,
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities,
  errors: string[]
): void {
  const colorCaps = terminal.capabilities.color;
  if (
    colorCaps === undefined ||
    colorCaps === null ||
    typeof colorCaps !== 'object'
  )
    return;

  const extColorCaps = colorCaps as ColorCapabilities;
  const hasExtended = hasExtendedFormat(capabilities, 'color');

  validateColorSupport(extColorCaps, capabilities, hasExtended, errors);
}

interface CapabilityCheckParams {
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities;
  hasExtended: boolean;
  errors: string[];
}

/**
 * Validate individual color support
 */
function validateColorSupport(
  extColorCaps: ColorCapabilities,
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities,
  hasExtended: boolean,
  errors: string[]
): void {
  const params: CapabilityCheckParams = { capabilities, hasExtended, errors };
  checkColorCapability('basic', extColorCaps.basic, params);
  checkColorCapability('color256', extColorCaps.color256, params);
  checkColorCapability('trueColor', extColorCaps.trueColor, params);
}

/**
 * Check single color capability
 */
function checkColorCapability(
  type: 'basic' | 'color256' | 'trueColor',
  expected: boolean,
  params: CapabilityCheckParams
): void {
  if (expected !== true) return;

  const supported = getColorSupport(type, params);
  if (supported !== true) {
    const name = getColorName(type);
    params.errors.push(`Expected ${name} support but not detected`);
  }
}

/**
 * Get color support status
 */
function getColorSupport(
  type: 'basic' | 'color256' | 'trueColor',
  params: CapabilityCheckParams
): boolean {
  if (params.hasExtended) {
    const extCaps = params.capabilities as ExtendedTerminalCapabilities;
    return type === 'basic'
      ? extCaps.color.basic
      : type === 'color256'
        ? extCaps.color.color256
        : extCaps.color.trueColor;
  } else {
    const stdCaps = params.capabilities as TerminalCapabilities;
    return type === 'basic'
      ? stdCaps.color
      : type === 'color256'
        ? stdCaps.color256
        : stdCaps.trueColor;
  }
}

/**
 * Get color capability name
 */
function getColorName(type: 'basic' | 'color256' | 'trueColor'): string {
  return type === 'color256'
    ? '256-color'
    : type === 'trueColor'
      ? 'true color'
      : 'basic color';
}

/**
 * Validate unicode capabilities
 */
export function validateUnicodeCapabilities(
  terminal: TestTerminal,
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities,
  errors: string[]
): void {
  const unicodeCaps = terminal.capabilities.unicode;
  if (
    unicodeCaps === undefined ||
    unicodeCaps === null ||
    typeof unicodeCaps !== 'object'
  )
    return;

  const extUnicodeCaps = unicodeCaps as UnicodeCapabilities;
  const hasExtended = hasExtendedFormat(capabilities, 'unicode');

  validateUnicodeSupport(extUnicodeCaps, capabilities, hasExtended, errors);
}

/**
 * Validate individual unicode support
 */
function validateUnicodeSupport(
  extUnicodeCaps: UnicodeCapabilities,
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities,
  hasExtended: boolean,
  errors: string[]
): void {
  const params: CapabilityCheckParams = { capabilities, hasExtended, errors };
  checkUnicodeCapability('basic', extUnicodeCaps.basic, params);
  checkUnicodeCapability('wide', extUnicodeCaps.wide, params);
  checkUnicodeCapability('emoji', extUnicodeCaps.emoji, params);
}

/**
 * Check single unicode capability
 */
function checkUnicodeCapability(
  type: 'basic' | 'wide' | 'emoji',
  expected: boolean,
  params: CapabilityCheckParams
): void {
  if (expected !== true) return;

  let supported = false;
  if (params.hasExtended) {
    const extCaps = params.capabilities as ExtendedTerminalCapabilities;
    supported =
      type === 'basic'
        ? extCaps.unicode.basic
        : type === 'wide'
          ? extCaps.unicode.wide
          : extCaps.unicode.emoji;
  } else {
    const stdCaps = params.capabilities as TerminalCapabilities;
    supported = type === 'basic' ? stdCaps.unicode : false;
  }

  if (supported !== true) {
    const name =
      type === 'wide'
        ? 'wide character'
        : type === 'emoji'
          ? 'emoji'
          : 'basic Unicode';
    params.errors.push(`Expected ${name} support but not detected`);
  }
}

/**
 * Validate mouse capabilities
 */
export function validateMouseCapabilities(
  terminal: TestTerminal,
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities,
  errors: string[]
): void {
  const mouseCaps = terminal.capabilities.mouse;
  if (
    mouseCaps === undefined ||
    mouseCaps === null ||
    typeof mouseCaps !== 'object'
  )
    return;

  const extMouseCaps = mouseCaps as MouseCapabilities;
  const hasExtended = hasExtendedFormat(capabilities, 'mouse');

  validateMouseSupport(extMouseCaps, capabilities, hasExtended, errors);
}

/**
 * Validate individual mouse support
 */
function validateMouseSupport(
  extMouseCaps: MouseCapabilities,
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities,
  hasExtended: boolean,
  errors: string[]
): void {
  if (extMouseCaps.basic === true) {
    const supported = hasExtended
      ? (capabilities as ExtendedTerminalCapabilities).mouse.basic
      : (capabilities as TerminalCapabilities).mouse;
    if (!supported) {
      errors.push('Expected basic mouse support but not detected');
    }
  }
  if (extMouseCaps.advanced === true) {
    const supported = hasExtended
      ? (capabilities as ExtendedTerminalCapabilities).mouse.advanced
      : false;
    if (!supported) {
      errors.push('Expected advanced mouse support but not detected');
    }
  }
}

/**
 * Validate expected features
 */
export function validateExpectedFeatures(
  terminal: TestTerminal,
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities,
  errors: string[]
): void {
  if (
    terminal.expectedFeatures === undefined ||
    terminal.expectedFeatures === null ||
    terminal.expectedFeatures.length === 0
  ) {
    return;
  }

  const hasExtended = hasExtendedFormat(capabilities, 'color');
  const featureChecks = getFeatureChecks(capabilities, hasExtended);

  checkExpectedFeatures(terminal.expectedFeatures, featureChecks, errors);
}

/**
 * Get feature check mapping
 */
function getFeatureChecks(
  capabilities: ExtendedTerminalCapabilities | TerminalCapabilities,
  hasExtended: boolean
): Record<string, boolean> {
  if (hasExtended) {
    const extCaps = capabilities as ExtendedTerminalCapabilities;
    return {
      trueColor: extCaps.color.trueColor === true,
      unicode: extCaps.unicode.basic === true,
      mouse: extCaps.mouse.basic === true,
      altScreen: extCaps.altScreen === true,
      cursorShape: extCaps.cursorShape === true,
    };
  } else {
    const stdCaps = capabilities as TerminalCapabilities;
    return {
      trueColor: stdCaps.trueColor === true,
      unicode: stdCaps.unicode !== false,
      mouse: stdCaps.mouse === true,
      altScreen: stdCaps.altScreen === true,
      cursorShape: stdCaps.cursorShape === true,
    };
  }
}

/**
 * Check if expected features are present
 */
function checkExpectedFeatures(
  expectedFeatures: string[],
  featureChecks: Record<string, boolean>,
  errors: string[]
): void {
  for (const feature of expectedFeatures) {
    if (featureChecks[feature] === false) {
      errors.push(`Missing expected feature: ${feature}`);
    }
  }
}
