/**
 * Template manifest validation using JSON Schema and SPDX license validation
 * Provides validation for template.json files in the marketplace
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createLogger } from '../utils/logger';
import { manifestSchema } from './schemas/manifestSchema';
import type { TemplateManifest } from './types';
import {
  validateLicense,
  extractLicenseWarnings,
} from './validators/licenseValidator';
import { validateManifestSecurity } from './validators/securityValidator';

const logger = createLogger('checklist:templates:manifest-validator');

// Re-export commonly used functions and constants
export { manifestSchema } from './schemas/manifestSchema';
export {
  COMMON_SPDX_LICENSES,
  validateLicense,
} from './validators/licenseValidator';
export type { LicenseValidationResult } from './validators/licenseValidator';
export { isPathTraversal } from './validators/securityValidator';

/**
 * Performs additional license validation on a manifest
 * @param manifest - The manifest to validate the license for
 */
function validateManifestLicense(manifest: TemplateManifest): void {
  const licenseValidation = validateLicense(manifest.license);
  if (
    typeof licenseValidation.warning === 'string' &&
    licenseValidation.warning.length > 0
  ) {
    logger.warn({
      msg: 'License validation warning',
      warning: licenseValidation.warning,
    });
  }
}

/**
 * Validates a template manifest against the JSON schema
 * Also performs additional validation like license checking and security checks
 *
 * @param manifest - Manifest object to validate
 * @returns True if valid, false otherwise
 * @throws Error if validation fails with details or security violations detected
 *
 * @example
 * ```typescript
 * const manifest = {
 *   name: 'my-template',
 *   version: '1.0.0',
 *   // ... other required fields
 * };
 *
 * if (validateManifest(manifest)) {
 *   console.log('Manifest is valid!');
 * }
 * ```
 */
export function validateManifest(
  manifest: unknown
): manifest is TemplateManifest {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);

  const validate = ajv.compile(manifestSchema);
  const valid = validate(manifest);

  if (!valid) {
    logger.error({
      msg: 'Manifest validation failed',
      errors: validate.errors ?? [],
    });
    return false;
  }

  // Additional validations on typed manifest
  const typedManifest = manifest as TemplateManifest;

  // Security validation (path traversal checks)
  validateManifestSecurity(typedManifest);

  // License validation (warnings only)
  validateManifestLicense(typedManifest);

  logger.info({
    msg: 'Manifest validation successful',
    name: typedManifest.name,
    version: typedManifest.version,
  });

  return valid;
}

/**
 * Validates a manifest and returns detailed error information
 * Useful for providing user feedback about validation failures
 *
 * @param manifest - Manifest object to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateManifestWithDetails(manifest);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Validation warnings:', result.warnings);
 * }
 * ```
 */
export function validateManifestWithDetails(manifest: unknown): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);

  const validate = ajv.compile(manifestSchema);
  const valid = validate(manifest);

  if (!valid && Array.isArray(validate.errors)) {
    errors.push(
      ...validate.errors.map(
        (err) => `${err.instancePath} ${err.message ?? 'validation error'}`
      )
    );
  }

  // Additional validations for valid manifests
  if (valid) {
    const typedManifest = manifest as TemplateManifest;

    // Security validation
    try {
      validateManifestSecurity(typedManifest);
    } catch (error) {
      errors.push((error as Error).message);
      return { valid: false, errors, warnings };
    }

    // License validation (warnings only)
    warnings.push(...extractLicenseWarnings(typedManifest.license));
  }

  return { valid, errors, warnings };
}
