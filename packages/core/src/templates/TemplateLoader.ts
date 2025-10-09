/**
 * TemplateLoader - Loads and discovers templates from the filesystem
 * Uses Bun.file() for fast file operations
 */

import { join } from 'path';
import * as yaml from 'js-yaml';
import { TemplateCache } from './TemplateCache';
import { TemplateValidator } from './TemplateValidator';
import { TemplateLoadError } from './errors';
import type {
  ChecklistTemplate,
  TemplateDiscoveryResult,
  TemplateLoadOptions,
  TemplateMetadataResult,
} from './types';

/**
 * TemplateLoader handles loading templates from the filesystem
 */
export class TemplateLoader {
  private readonly validator: TemplateValidator;
  private readonly templatesDir: string;
  private readonly cache: TemplateCache;
  private fileWatcher?: ReturnType<typeof Bun.watch>;
  private readonly watchedFiles = new Set<string>();

  constructor(templatesDir: string = '/templates', cache?: TemplateCache, enableFileWatching: boolean = true) {
    this.validator = new TemplateValidator();
    this.templatesDir = templatesDir;
    this.cache = cache ?? new TemplateCache();

    // Enable file watching for automatic cache invalidation
    if (enableFileWatching) {
      this.startFileWatching();
    }
  }

  /**
   * Load a template from a file path
   */
  async load(
    filePath: string,
    options?: TemplateLoadOptions
  ): Promise<ChecklistTemplate> {
    try {
      // Check cache first
      const cachedTemplate = this.retrieveFromCache(filePath, options);
      if (cachedTemplate !== undefined) {
        return cachedTemplate;
      }

      // Load and process template
      const template = await this.loadAndValidateTemplate(filePath, options);

      // Store in cache
      this.storeInCache(filePath, template, options);

      return template;
    } catch (error) {
      return this.handleLoadError(error, filePath);
    }
  }

  /**
   * Retrieve template from cache if available
   */
  private retrieveFromCache(
    filePath: string,
    options?: TemplateLoadOptions
  ): ChecklistTemplate | undefined {
    if (options?.skipCache === true) {
      return undefined;
    }
    return this.cache.get(filePath)?.content;
  }

  /**
   * Load and validate template from filesystem
   */
  private async loadAndValidateTemplate(
    filePath: string,
    options?: TemplateLoadOptions
  ): Promise<ChecklistTemplate> {
    const content = await this.readTemplateFile(filePath);
    const parsed = this.parseYaml(content, filePath);

    if (options?.skipValidation !== true) {
      this.validator.validateOrThrow(parsed, filePath);
    }

    return parsed as ChecklistTemplate;
  }

  /**
   * Store template in cache
   */
  private storeInCache(
    filePath: string,
    template: ChecklistTemplate,
    options?: TemplateLoadOptions
  ): void {
    if (options?.skipCache !== true) {
      this.cache.set(filePath, template);
    }
  }

  /**
   * Handle load errors
   */
  private handleLoadError(error: unknown, filePath: string): never {
    if (error instanceof TemplateLoadError) {
      throw error;
    }

    throw new TemplateLoadError(
      filePath,
      'Failed to load template',
      error as Error
    );
  }

  /**
   * Read template file content
   */
  private async readTemplateFile(filePath: string): Promise<string> {
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
   * Discover all templates in the templates directory
   */
  async discover(): Promise<TemplateDiscoveryResult[]> {
    try {
      const files = this.findTemplateFiles();
      return await this.processTemplateFiles(files);
    } catch (error) {
      throw new TemplateLoadError(
        this.templatesDir,
        'Failed to discover templates',
        error as Error
      );
    }
  }

  /**
   * Find all template files in directory
   */
  private findTemplateFiles(): string[] {
    const glob = new Bun.Glob('**/*.{yaml,yml}');
    return Array.from(glob.scanSync({ cwd: this.templatesDir }));
  }

  /**
   * Process template files and extract metadata
   */
  private async processTemplateFiles(
    files: string[]
  ): Promise<TemplateDiscoveryResult[]> {
    const results: TemplateDiscoveryResult[] = [];

    for (const relativePath of files) {
      const fullPath = join(this.templatesDir, relativePath);

      try {
        const metadata = await this.extractMetadata(fullPath);
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

  /**
   * Extract metadata from a template file without full loading
   */
  async extractMetadata(
    filePath: string
  ): Promise<TemplateMetadataResult> {
    try {
      const file = await this.getTemplateFile(filePath);
      const stat = await this.getFileStats(file, filePath);
      const template = await this.parseTemplateFile(file, filePath);

      return this.buildMetadataResult(template, filePath, stat);
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
   * Get and validate template file
   */
  private async getTemplateFile(filePath: string): Promise<BunFile> {
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
   */
  private async getFileStats(
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
   * Parse template file
   */
  private async parseTemplateFile(
    file: BunFile,
    filePath: string
  ): Promise<ChecklistTemplate> {
    const content = await file.text();
    const parsed = this.parseYaml(content, filePath);
    return parsed as ChecklistTemplate;
  }

  /**
   * Build metadata result
   */
  private buildMetadataResult(
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
   * Parse YAML content
   */
  private parseYaml(content: string, filePath: string): unknown {
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
   * Get templates directory path
   */
  getTemplatesDirectory(): string {
    return this.templatesDir;
  }

  /**
   * Get cache instance
   */
  getCache(): TemplateCache {
    return this.cache;
  }

  /**
   * Invalidate cache entry for a file path
   */
  invalidateCacheEntry(filePath: string): boolean {
    return this.cache.delete(filePath);
  }

  /**
   * Clear entire template cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Start watching template files for changes
   */
  private startFileWatching(): void {
    try {
      // Use Bun.watch to monitor the templates directory
      this.fileWatcher = Bun.watch(this.templatesDir);

      // Handle file system events
      (async () => {
        if (this.fileWatcher === undefined) return;

        for await (const event of this.fileWatcher) {
          this.handleFileSystemEvent(event);
        }
      })().catch(() => {
        // File watching errors are non-critical - fail silently
        // In production, this would log to a proper logger
      });
    } catch {
      // File watching may not be available in all environments
      // Fail silently as this is not a critical feature
    }
  }

  /**
   * Handle file system events
   */
  private handleFileSystemEvent(event: { type: 'rename' | 'change'; path: string }): void {
    // Only handle YAML template files
    if (!event.path.match(/\.(yaml|yml)$/)) {
      return;
    }

    const fullPath = join(this.templatesDir, event.path);

    // Invalidate cache for changed files
    if (event.type === 'change' || event.type === 'rename') {
      const invalidated = this.cache.delete(fullPath);
      if (invalidated) {
        this.watchedFiles.delete(fullPath);
      }
    }
  }

  /**
   * Add a file to the watch list
   */
  addToWatchList(filePath: string): void {
    this.watchedFiles.add(filePath);
  }

  /**
   * Stop file watching
   */
  stopFileWatching(): void {
    if (this.fileWatcher !== undefined) {
      // Bun.watch doesn't have an explicit close method in the current API
      // The async iterator will stop when the watcher is no longer referenced
      this.fileWatcher = undefined;
      this.watchedFiles.clear();
    }
  }

  /**
   * Check if file watching is enabled
   */
  isFileWatchingEnabled(): boolean {
    return this.fileWatcher !== undefined;
  }
}
