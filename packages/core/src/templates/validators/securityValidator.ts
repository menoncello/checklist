/**
 * Security validation for template manifests
 * Detects and blocks path traversal attempts and other security threats
 */

import { createLogger } from '../../utils/logger';
import type { TemplateManifest } from '../types';

const logger = createLogger('checklist:templates:security-validator');

/**
 * Validates file paths for path traversal attempts
 * @param path - File path to validate
 * @returns True if path is dangerous, false if safe
 */
export function isPathTraversal(path: string): boolean {
  // Check for explicit path traversal patterns
  if (path.includes('../') || path.includes('..\\')) {
    return true;
  }

  // Check for absolute paths (Unix and Windows)
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    return true;
  }

  // Check for null bytes
  if (path.includes('\0')) {
    return true;
  }

  return false;
}

/**
 * Validates manifest security constraints
 * Checks for path traversal in name and files array
 * @param manifest - Manifest to validate
 * @throws Error if security validation fails
 */
export function validateManifestSecurity(manifest: TemplateManifest): void {
  // Validate name for path traversal
  if (isPathTraversal(manifest.name)) {
    logger.error({
      msg: 'Path traversal detected in manifest name',
      name: manifest.name,
    });
    throw new Error(
      `Security violation: Path traversal detected in name: ${manifest.name}`
    );
  }

  // Validate files array for path traversal
  for (const file of manifest.files) {
    if (isPathTraversal(file)) {
      logger.error({
        msg: 'Path traversal detected in manifest files',
        file,
      });
      throw new Error(
        `Security violation: Path traversal detected in file: ${file}`
      );
    }
  }

  logger.debug({
    msg: 'Manifest security validation passed',
    name: manifest.name,
    fileCount: manifest.files.length,
  });
}
