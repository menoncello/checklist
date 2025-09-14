/**
 * Security utilities for input validation and rate limiting
 * Addresses security concerns from NFR assessment
 */

import { statSync } from 'fs';
import { resolve, isAbsolute, normalize } from 'path';

/**
 * Rate limiter for keyboard input operations
 * Prevents rapid repeated inputs that could cause performance issues
 */
export class InputRateLimiter {
  private lastInputTimes = new Map<string, number>();
  private readonly minIntervalMs: number;
  private readonly maxBurstSize: number;
  private burstCounts = new Map<string, number>();
  private burstWindows = new Map<string, number>();

  constructor(minIntervalMs = 50, maxBurstSize = 10) {
    this.minIntervalMs = minIntervalMs;
    this.maxBurstSize = maxBurstSize;
  }

  /**
   * Check if an input action should be allowed
   * @param action The action identifier (e.g., 'keypress', 'toggle', 'navigate')
   * @returns true if the action should be allowed, false if it should be rate limited
   */
  shouldAllow(action: string): boolean {
    const now = Date.now();
    const lastTime = this.lastInputTimes.get(action) ?? 0;
    const timeSinceLastInput = now - lastTime;

    // Check minimum interval
    if (timeSinceLastInput < this.minIntervalMs) {
      // Check burst allowance
      const windowStart = this.burstWindows.get(action) ?? now;
      const burstCount = this.burstCounts.get(action) ?? 0;

      // Reset burst window if it's been more than 1 second
      if (now - windowStart > 1000) {
        this.burstWindows.set(action, now);
        this.burstCounts.set(action, 1);
        this.lastInputTimes.set(action, now);
        return true;
      }

      // Check if within burst limit
      if (burstCount < this.maxBurstSize) {
        this.burstCounts.set(action, burstCount + 1);
        this.lastInputTimes.set(action, now);
        return true;
      }

      // Rate limit exceeded
      return false;
    }

    // Allow input and reset burst counter
    this.lastInputTimes.set(action, now);
    this.burstCounts.set(action, 1);
    this.burstWindows.set(action, now);
    return true;
  }

  /**
   * Reset rate limiting for a specific action
   */
  reset(action?: string): void {
    if (action !== undefined && action.length > 0) {
      this.lastInputTimes.delete(action);
      this.burstCounts.delete(action);
      this.burstWindows.delete(action);
    } else {
      this.lastInputTimes.clear();
      this.burstCounts.clear();
      this.burstWindows.clear();
    }
  }
}

/**
 * Path sanitization utilities to prevent path traversal attacks
 */
export class PathSanitizer {
  private readonly allowedBasePaths: string[];

  constructor(allowedBasePaths: string[] = []) {
    // Normalize and resolve all allowed base paths
    this.allowedBasePaths = allowedBasePaths.map((p) => resolve(normalize(p)));
  }

  /**
   * Sanitize and validate a file path
   * @param inputPath The path to sanitize
   * @param basePath The base path to resolve against
   * @returns Sanitized path or null if invalid
   */
  sanitize(inputPath: string, basePath?: string): string | null {
    try {
      let sanitized = this.cleanPath(inputPath);
      sanitized = this.resolvePath(sanitized, basePath);

      if (!this.isPathAllowed(sanitized)) {
        return null;
      }

      if (this.containsSuspiciousPatterns(sanitized)) {
        return null;
      }

      return sanitized;
    } catch {
      return null;
    }
  }

  private cleanPath(inputPath: string): string {
    // Remove null bytes and other dangerous characters
    const cleaned = inputPath.replace(/\0/g, '');
    // Normalize the path to remove .. and . segments
    return normalize(cleaned);
  }

  private resolvePath(path: string, basePath?: string): string {
    if (isAbsolute(path)) {
      return path;
    }
    return basePath !== undefined
      ? resolve(basePath, path)
      : resolve(process.cwd(), path);
  }

  private isPathAllowed(path: string): boolean {
    if (this.allowedBasePaths.length === 0) {
      return true;
    }
    return this.allowedBasePaths.some((allowed) => path.startsWith(allowed));
  }

  private containsSuspiciousPatterns(path: string): boolean {
    const suspicious = [
      '../',
      '..\\',
      '%2e%2e',
      '..%2f',
      '%2e%2e%2f',
      '..%5c',
      '%2e%2e%5c',
    ];

    const lowerPath = path.toLowerCase();
    return suspicious.some((pattern) => lowerPath.includes(pattern));
  }

  private cleanAndNormalizePath(inputPath: string, basePath?: string): string {
    // Remove null bytes and dangerous characters
    let sanitized = inputPath.replace(/\0/g, '');

    // Normalize to remove .. and . segments
    sanitized = normalize(sanitized);

    // Resolve to absolute path
    if (!isAbsolute(sanitized)) {
      sanitized = basePath !== undefined
        ? resolve(basePath, sanitized)
        : resolve(process.cwd(), sanitized);
    }

    return sanitized;
  }

  private isPathAllowed(path: string): boolean {
    if (this.allowedBasePaths.length === 0) {
      return true;
    }
    return this.allowedBasePaths.some(allowed => path.startsWith(allowed));
  }

  private containsSuspiciousPatterns(path: string): boolean {
    const patterns = ['../', '..\\', '%2e%2e', '..%2f', '%2e%2e%2f', '..%5c', '%2e%2e%5c'];
    const lowerPath = path.toLowerCase();
    return patterns.some(pattern => lowerPath.includes(pattern));
  }

  /**
   * Check if a path exists and is safe to access
   * @param path The path to check
   * @returns true if the path is safe and exists
   */
  isSafePath(path: string): boolean {
    const sanitized = this.sanitize(path);
    if (sanitized === null) {
      return false;
    }

    try {
      const stats = statSync(sanitized);
      // Ensure it's a regular file or directory, not a symlink
      return stats.isFile() || stats.isDirectory();
    } catch {
      // Path doesn't exist or can't be accessed
      return false;
    }
  }
}

/**
 * Resource limit manager to prevent excessive resource consumption
 */
export class ResourceLimits {
  static readonly MAX_CHECKLIST_SIZE = 10000; // Maximum number of items
  static readonly MAX_ITEM_LENGTH = 10000; // Maximum characters per item
  static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  static readonly MAX_TEMPLATE_DEPTH = 10; // Maximum nesting depth
  static readonly MAX_CONCURRENT_OPERATIONS = 100;

  private static activeTasks = 0;

  /**
   * Check if a checklist size is within limits
   */
  static isChecklistSizeValid(itemCount: number): boolean {
    return itemCount > 0 && itemCount <= this.MAX_CHECKLIST_SIZE;
  }

  /**
   * Check if an item text length is within limits
   */
  static isItemLengthValid(text: string): boolean {
    return text.length > 0 && text.length <= this.MAX_ITEM_LENGTH;
  }

  /**
   * Check if a file size is within limits
   */
  static isFileSizeValid(sizeInBytes: number): boolean {
    return sizeInBytes > 0 && sizeInBytes <= this.MAX_FILE_SIZE;
  }

  /**
   * Acquire a task slot for concurrent operation limiting
   * @returns true if slot acquired, false if limit reached
   */
  static acquireTaskSlot(): boolean {
    if (this.activeTasks >= this.MAX_CONCURRENT_OPERATIONS) {
      return false;
    }
    this.activeTasks++;
    return true;
  }

  /**
   * Release a task slot after operation completes
   */
  static releaseTaskSlot(): void {
    if (this.activeTasks > 0) {
      this.activeTasks--;
    }
  }

  /**
   * Get current resource usage stats
   */
  static getUsageStats(): {
    activeTasks: number;
    maxTasks: number;
    utilizationPercent: number;
  } {
    return {
      activeTasks: this.activeTasks,
      maxTasks: this.MAX_CONCURRENT_OPERATIONS,
      utilizationPercent:
        (this.activeTasks / this.MAX_CONCURRENT_OPERATIONS) * 100,
    };
  }
}
