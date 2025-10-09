/**
 * TemplateCache - LRU cache for template storage
 * Provides fast template retrieval with automatic eviction
 */

import { TemplateCacheError } from './errors';
import type {
  ChecklistTemplate,
  CachedTemplate,
  CacheStatistics,
  CacheEntry,
} from './types';

interface CacheOptions {
  maxSize?: number;
  maxAge?: number; // milliseconds
}

/**
 * TemplateCache implements LRU caching for templates
 */
export class TemplateCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly maxAge: number;
  private stats: CacheStatistics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.maxAge = options.maxAge ?? 3600000; // 1 hour default
  }

  /**
   * Get template from cache
   */
  get(path: string): CachedTemplate | undefined {
    const entry = this.cache.get(path);

    if (entry === undefined) {
      this.stats.misses++;
      return undefined;
    }

    // Check if entry is expired
    if (this.isExpired(entry)) {
      this.cache.delete(path);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return undefined;
    }

    // Update access time (LRU)
    entry.lastAccessed = Date.now();

    // Move to end (most recently used)
    this.cache.delete(path);
    this.cache.set(path, entry);

    this.stats.hits++;
    return entry.template;
  }

  /**
   * Set template in cache
   */
  set(path: string, template: ChecklistTemplate): void {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(path)) {
      this.evictOldest();
    }

    // Create cache entry
    const entry: CacheEntry = {
      template: {
        content: template,
        loadedAt: Date.now(),
        filePath: path,
      },
      lastAccessed: Date.now(),
    };

    // Remove old entry if exists (to reinsert at end)
    if (this.cache.has(path)) {
      this.cache.delete(path);
    }

    // Add to cache
    this.cache.set(path, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.template.loadedAt;
    return age > this.maxAge;
  }

  /**
   * Evict oldest (least recently used) entry
   */
  private evictOldest(): void {
    // Map preserves insertion order, first key is oldest
    const firstKey = this.cache.keys().next().value;

    if (firstKey !== undefined) {
      this.cache.delete(firstKey as string);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  /**
   * Remove entry from cache
   */
  delete(path: string): boolean {
    const deleted = this.cache.delete(path);
    if (deleted) {
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  /**
   * Check if path is in cache
   */
  has(path: string): boolean {
    const entry = this.cache.get(path);

    if (entry === undefined) {
      return false;
    }

    // Check expiration
    if (this.isExpired(entry)) {
      this.cache.delete(path);
      this.stats.size = this.cache.size;
      return false;
    }

    return true;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    this.stats.evictions += previousSize;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidate(pattern: RegExp): number {
    let invalidated = 0;

    for (const [path] of this.cache) {
      if (pattern.test(path)) {
        this.cache.delete(path);
        invalidated++;
      }
    }

    this.stats.size = this.cache.size;
    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: this.cache.size,
    };
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Get max cache size
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Get max age in milliseconds
   */
  getMaxAge(): number {
    return this.maxAge;
  }

  /**
   * Get all cached paths
   */
  getPaths(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Prune expired entries
   */
  pruneExpired(): number {
    let pruned = 0;

    for (const [path, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(path);
        pruned++;
      }
    }

    this.stats.size = this.cache.size;
    return pruned;
  }

  /**
   * Get hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) {
      return 0;
    }
    return this.stats.hits / total;
  }

  /**
   * Validate cache integrity
   */
  validateIntegrity(): void {
    if (this.cache.size !== this.stats.size) {
      throw new TemplateCacheError('integrity check', 'Cache size mismatch', {
        actualSize: this.cache.size,
        recordedSize: this.stats.size,
      });
    }

    if (this.cache.size > this.maxSize) {
      throw new TemplateCacheError(
        'integrity check',
        'Cache exceeds max size',
        {
          size: this.cache.size,
          maxSize: this.maxSize,
        }
      );
    }
  }
}
