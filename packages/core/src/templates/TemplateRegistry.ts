/**
 * Template registry for marketplace discovery
 * Manages template index loading, caching, and searching
 */

import { createLogger } from '../utils/logger';
import type { TemplateIndex, TemplateIndexEntry } from './types';

const logger = createLogger('checklist:templates:registry');

/**
 * Template registry for discovering and searching templates
 * Supports both local and remote index files with caching
 */
export class TemplateRegistry {
  private index: TemplateIndex | null = null;
  private readonly indexCacheTTL = 3600000; // 1 hour in milliseconds
  private lastIndexLoad = 0;

  constructor(private readonly indexUrl: string) {}

  /**
   * Load template index from URL or cache
   * @returns Template index with all available templates
   */
  async loadIndex(): Promise<TemplateIndex> {
    const now = Date.now();

    if (this.isCacheValid(now)) {
      logger.debug({
        msg: 'Using cached template index',
        age: now - this.lastIndexLoad,
      });
      return this.index as TemplateIndex;
    }

    return await this.fetchAndCacheIndex(now);
  }

  /**
   * Check if cached index is still valid
   */
  private isCacheValid(now: number): boolean {
    return this.index !== null && now - this.lastIndexLoad < this.indexCacheTTL;
  }

  /**
   * Fetch index from URL and cache it
   */
  private async fetchAndCacheIndex(now: number): Promise<TemplateIndex> {
    logger.info({
      msg: 'Loading template index',
      url: this.indexUrl,
    });

    try {
      const indexContent = await this.fetchIndexFile();
      const index: TemplateIndex = JSON.parse(indexContent);

      this.index = index;
      this.lastIndexLoad = now;

      logger.info({
        msg: 'Template index loaded',
        templateCount: index.templates.length,
        version: index.version,
      });

      return index;
    } catch (error) {
      logger.error({
        msg: 'Failed to load template index',
        url: this.indexUrl,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Fetch index file content from URL
   */
  private async fetchIndexFile(): Promise<string> {
    if (this.indexUrl.startsWith('file://')) {
      return await this.fetchLocalFile();
    }

    if (this.indexUrl.startsWith('https://')) {
      return await this.fetchRemoteFile();
    }

    throw new Error(`Unsupported index URL protocol: ${this.indexUrl}`);
  }

  /**
   * Fetch local index file
   */
  private async fetchLocalFile(): Promise<string> {
    const path = this.indexUrl.replace('file://', '');
    return await Bun.file(path).text();
  }

  /**
   * Fetch remote index file
   */
  private async fetchRemoteFile(): Promise<string> {
    const response = await fetch(this.indexUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch index: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Search templates by query string
   * Searches in name, description, and tags
   * @param query - Search query string
   * @returns Matching templates
   */
  async searchTemplates(query: string): Promise<TemplateIndexEntry[]> {
    const index = await this.loadIndex();
    const lowerQuery = query.toLowerCase();

    return index.templates.filter((template) =>
      this.matchesQuery(template, lowerQuery)
    );
  }

  /**
   * Check if template matches query
   */
  private matchesQuery(template: TemplateIndexEntry, query: string): boolean {
    return (
      template.name.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query) ||
      template.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  /**
   * Filter templates by tags
   * @param tags - Array of tags to filter by
   * @returns Templates matching any of the tags
   */
  async filterByTags(tags: string[]): Promise<TemplateIndexEntry[]> {
    const index = await this.loadIndex();
    const lowerTags = tags.map((t) => t.toLowerCase());

    return index.templates.filter((template) =>
      this.hasMatchingTag(template, lowerTags)
    );
  }

  /**
   * Check if template has matching tags
   */
  private hasMatchingTag(
    template: TemplateIndexEntry,
    searchTags: string[]
  ): boolean {
    return template.tags.some((tag) => searchTags.includes(tag.toLowerCase()));
  }

  /**
   * Manually refresh index (bypass cache)
   */
  async refreshIndex(): Promise<void> {
    logger.info({ msg: 'Manually refreshing template index' });
    this.index = null;
    this.lastIndexLoad = 0;
    await this.loadIndex();
  }
}
