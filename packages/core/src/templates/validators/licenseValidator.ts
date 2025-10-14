/**
 * SPDX license validation for template manifests
 * Validates license identifiers against common SPDX standards
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('checklist:templates:license-validator');

/**
 * Common SPDX license identifiers
 * Source: https://spdx.org/licenses/
 */
export const COMMON_SPDX_LICENSES = [
  'MIT',
  'Apache-2.0',
  'GPL-3.0',
  'GPL-2.0',
  'BSD-3-Clause',
  'BSD-2-Clause',
  'ISC',
  'LGPL-3.0',
  'LGPL-2.1',
  'MPL-2.0',
  'AGPL-3.0',
  'Unlicense',
  'CC0-1.0',
  'CC-BY-4.0',
  'EPL-2.0',
  'UNLICENSED',
] as const;

/**
 * License validation result
 */
export interface LicenseValidationResult {
  valid: boolean;
  warning?: string;
}

/**
 * Validates a license identifier against SPDX standards
 * Warns on unrecognized licenses but doesn't fail validation
 *
 * @param license - License identifier to validate
 * @returns Validation result with optional warning
 *
 * @example
 * ```typescript
 * const result = validateLicense('MIT');
 * console.log(result.valid); // true
 *
 * const result2 = validateLicense('Custom-License');
 * console.log(result2.valid); // true (with warning)
 * console.log(result2.warning); // "Unrecognized license..."
 * ```
 */
export function validateLicense(license: string): LicenseValidationResult {
  // Check if it's a common SPDX identifier
  if (COMMON_SPDX_LICENSES.includes(license as never)) {
    return { valid: true };
  }

  // Check if it's a "SEE LICENSE IN <filename>" pattern
  if (/^SEE LICENSE IN .+/.test(license)) {
    return { valid: true };
  }

  // Unrecognized license - warn but don't fail
  const warning = `Unrecognized license: ${license}. Consider using a valid SPDX identifier.`;

  logger.warn({
    msg: 'Unrecognized license identifier',
    license,
    hint: 'Consider using a valid SPDX license identifier',
  });

  return {
    valid: true,
    warning,
  };
}

/**
 * Extract license warnings from validation
 * @param license - License identifier to validate
 * @returns Array of warning messages
 */
export function extractLicenseWarnings(license: string): string[] {
  const warnings: string[] = [];
  const licenseValidation = validateLicense(license);

  if (
    typeof licenseValidation.warning === 'string' &&
    licenseValidation.warning.length > 0
  ) {
    warnings.push(licenseValidation.warning);
  }

  return warnings;
}
