/**
 * Metadata extraction for templates
 * Handles extracting template metadata without full loading
 */

import { join } from 'path';
import { TemplateLoadError } from '../errors';
import type {
  ChecklistTemplate,
  TemplateMetadataResult,
  TemplateDiscoveryResult,
} from '../types';
import { getTemplateFile, getFileStats, parseYaml } from './fileOperations';

// Type declarations for Bun-specific APIs
type BunFile = ReturnType<typeof Bun.file>;

/**
 * Parse template file
 * @param file - Bun file object
 * @param filePath - File path for error messages
 * @returns Parsed template
 */
async function parseTemplateFile(
  file: BunFile,
  filePath: string
): Promise<ChecklistTemplate> {
  const content = await file.text();
  const parsed = parseYaml(content, filePath);
  return parsed as ChecklistTemplate;
}

/**
 * Build metadata result from template and file stats
 * @param template - Parsed template
 * @param filePath - Template file path
 * @param stat - File statistics
 * @returns Metadata result object
 */
function buildMetadataResult(
  template: ChecklistTemplate,
  filePath: string,
  stat: { size: number; mtime: Date }
): TemplateMetadataResult {
  return {
    id: template.id,
    name: template.name,
    version: template.version,
    description: template.description,
    path: filePath,
    size: stat.size,
    modifiedAt: stat.mtime.getTime(),
  };
}

/**
 * Extract metadata from a template file without full loading
 * @param filePath - Path to template file
 * @returns Template metadata
 * @throws TemplateLoadError if extraction fails
 */
export async function extractMetadata(
  filePath: string
): Promise<TemplateMetadataResult> {
  try {
    const file = await getTemplateFile(filePath);
    const stat = await getFileStats(file, filePath);
    const template = await parseTemplateFile(file, filePath);

    return buildMetadataResult(template, filePath, stat);
  } catch (error) {
    if (error instanceof TemplateLoadError) {
      throw error;
    }

    throw new TemplateLoadError(
      filePath,
      'Failed to extract metadata',
      error as Error
    );
  }
}

/**
 * Process template files and extract metadata
 * @param files - Array of relative file paths
 * @param templatesDir - Base templates directory
 * @returns Array of discovery results
 */
export async function processTemplateFiles(
  files: string[],
  templatesDir: string
): Promise<TemplateDiscoveryResult[]> {
  const results: TemplateDiscoveryResult[] = [];

  for (const relativePath of files) {
    const fullPath = join(templatesDir, relativePath);

    try {
      const metadata = await extractMetadata(fullPath);
      results.push({
        path: fullPath,
        id: metadata.id,
        name: metadata.name,
        version: metadata.version,
        size: metadata.size,
        modifiedAt: metadata.modifiedAt,
      });
    } catch (_error) {
      // Skip files that cannot be parsed
      continue;
    }
  }

  return results;
}
