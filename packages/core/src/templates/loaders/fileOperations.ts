/**
 * File operations for template loading
 * Handles reading template files and YAML parsing
 */

import * as yaml from 'js-yaml';
import { TemplateLoadError } from '../errors';

// Type declarations for Bun-specific APIs
type BunFile = ReturnType<typeof Bun.file>;

/**
 * Read template file content
 * @param filePath - Path to template file
 * @returns File content as string
 * @throws TemplateLoadError if file not found
 */
export async function readTemplateFile(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (!exists) {
    throw new TemplateLoadError(
      filePath,
      'Template file not found',
      new Error('ENOENT')
    );
  }

  return await file.text();
}

/**
 * Parse YAML content
 * @param content - YAML content string
 * @param filePath - File path for error messages
 * @returns Parsed YAML object
 * @throws TemplateLoadError if parsing fails
 */
export function parseYaml(content: string, filePath: string): unknown {
  try {
    return yaml.load(content);
  } catch (error) {
    throw new TemplateLoadError(
      filePath,
      `YAML parsing failed: ${(error as Error).message}`,
      error as Error
    );
  }
}

/**
 * Get and validate template file
 * @param filePath - Path to template file
 * @returns Bun file object
 * @throws TemplateLoadError if file not found
 */
export async function getTemplateFile(filePath: string): Promise<BunFile> {
  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (!exists) {
    throw new TemplateLoadError(
      filePath,
      'Template file not found',
      new Error('ENOENT')
    );
  }

  return file;
}

/**
 * Get file statistics
 * @param file - Bun file object
 * @param filePath - File path for error messages
 * @returns File size and modification time
 * @throws TemplateLoadError if stats cannot be read
 */
export async function getFileStats(
  file: BunFile,
  filePath: string
): Promise<{ size: number; mtime: Date }> {
  const stat = await file.stat();
  if (stat === null) {
    throw new TemplateLoadError(
      filePath,
      'Failed to read file stats',
      new Error('ENOSTAT')
    );
  }

  return { size: stat.size, mtime: stat.mtime };
}

/**
 * Find all template files in directory
 * @param templatesDir - Directory to search
 * @returns Array of relative file paths
 */
export function findTemplateFiles(templatesDir: string): string[] {
  const glob = new Bun.Glob('**/*.{yaml,yml}');
  return Array.from(glob.scanSync({ cwd: templatesDir }));
}
