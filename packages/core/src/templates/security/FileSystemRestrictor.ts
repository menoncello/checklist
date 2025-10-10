/**
 * File system access restriction for template security
 */

import { resolve, normalize, extname } from 'path';
import { createLogger } from '../../utils/logger';
import type { PathValidationResult } from './types';

const logger = createLogger(
  'checklist:templates:security:filesystem-restrictor'
);

/**
 * Configuration for FileSystemRestrictor
 */
export interface FileSystemRestrictorConfig {
  allowedPaths?: string[];
  deniedPaths?: string[];
  allowedExtensions?: string[];
  allowPathTraversal?: boolean;
}

/**
 * File system access restrictor for templates
 */
export class FileSystemRestrictor {
  private readonly allowedPaths: Set<string>;
  private readonly deniedPaths: Set<string>;
  private readonly allowedExtensions: Set<string>;
  private readonly allowPathTraversal: boolean;
  private readonly systemPaths: Set<string>;

  constructor(config: FileSystemRestrictorConfig = {}) {
    this.allowedPaths = new Set(config.allowedPaths ?? []);
    this.deniedPaths = new Set(config.deniedPaths ?? []);
    this.allowedExtensions = new Set(
      config.allowedExtensions ?? this.getDefaultExtensions()
    );
    this.allowPathTraversal = config.allowPathTraversal ?? false;
    this.systemPaths = this.getSystemPaths();

    logger.debug({
      msg: 'FileSystemRestrictor initialized',
      allowedPathsCount: this.allowedPaths.size,
      deniedPathsCount: this.deniedPaths.size,
      allowedExtensionsCount: this.allowedExtensions.size,
    });
  }

  /**
   * Validate path for file system access
   */
  validatePath(
    path: string,
    operation: 'read' | 'write'
  ): PathValidationResult {
    // Check path traversal BEFORE normalization
    const traversalCheck = this.checkPathTraversal(path);
    if (!traversalCheck.valid) return traversalCheck;

    const normalized = this.normalizePath(path);

    // Check system paths
    const systemCheck = this.checkSystemPaths(normalized);
    if (!systemCheck.valid) return systemCheck;

    // Check denied paths
    const deniedCheck = this.checkDeniedPaths(normalized);
    if (!deniedCheck.valid) return deniedCheck;

    // Check allowed paths
    const allowedCheck = this.checkAllowedPaths(normalized);
    if (!allowedCheck.valid) return allowedCheck;

    // Check file extension
    const extCheck = this.checkFileExtension(normalized);
    if (!extCheck.valid) return extCheck;

    // Check write-specific restrictions
    if (operation === 'write') {
      const writeCheck = this.checkWriteRestrictions(normalized);
      if (!writeCheck.valid) return writeCheck;
    }

    logger.debug({
      msg: 'Path validation passed',
      path: normalized,
      operation,
    });

    return { valid: true };
  }

  /**
   * Normalize path for consistent validation
   */
  private normalizePath(path: string): string {
    try {
      // Resolve to absolute path and normalize
      const normalized = normalize(resolve(path));
      return normalized;
    } catch (error) {
      logger.warn({
        msg: 'Path normalization failed',
        path,
        error,
      });
      return path;
    }
  }

  /**
   * Check for path traversal attempts
   */
  private checkPathTraversal(path: string): PathValidationResult {
    if (!this.allowPathTraversal && path.includes('..')) {
      return {
        valid: false,
        reason: 'Path traversal detected',
      };
    }
    return { valid: true };
  }

  /**
   * Check against system paths
   */
  private checkSystemPaths(path: string): PathValidationResult {
    for (const systemPath of this.systemPaths) {
      if (this.pathStartsWith(path, systemPath)) {
        return {
          valid: false,
          reason: `System path access denied: ${systemPath}`,
        };
      }
    }
    return { valid: true };
  }

  /**
   * Check against denied paths
   */
  private checkDeniedPaths(path: string): PathValidationResult {
    for (const deniedPath of this.deniedPaths) {
      if (this.pathStartsWith(path, deniedPath)) {
        return {
          valid: false,
          reason: `Access denied to path: ${deniedPath}`,
        };
      }
    }
    return { valid: true };
  }

  /**
   * Check against allowed paths
   */
  private checkAllowedPaths(path: string): PathValidationResult {
    if (this.allowedPaths.size === 0) {
      return { valid: true };
    }

    for (const allowedPath of this.allowedPaths) {
      if (this.pathStartsWith(path, allowedPath)) {
        return { valid: true };
      }
    }

    return {
      valid: false,
      reason: 'Path not in allowed list',
    };
  }

  /**
   * Check file extension
   */
  private checkFileExtension(path: string): PathValidationResult {
    const ext = extname(path).toLowerCase();

    if (ext === '') {
      return { valid: true };
    }

    if (!this.allowedExtensions.has(ext)) {
      return {
        valid: false,
        reason: `File extension '${ext}' not allowed`,
      };
    }

    return { valid: true };
  }

  /**
   * Check write-specific restrictions
   */
  private checkWriteRestrictions(path: string): PathValidationResult {
    // Prevent writing to hidden files
    const filename = path.split(/[/\\]/).pop() ?? '';
    if (filename.startsWith('.')) {
      return {
        valid: false,
        reason: 'Writing to hidden files not allowed',
      };
    }

    return { valid: true };
  }

  /**
   * Check if path starts with given prefix
   */
  private pathStartsWith(path: string, prefix: string): boolean {
    const normalizedPath = normalize(path).toLowerCase();
    const normalizedPrefix = normalize(prefix).toLowerCase();
    return normalizedPath.startsWith(normalizedPrefix);
  }

  /**
   * Get default allowed file extensions
   */
  private getDefaultExtensions(): string[] {
    return [
      '.md',
      '.txt',
      '.json',
      '.yaml',
      '.yml',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.css',
      '.scss',
      '.less',
      '.html',
      '.htm',
    ];
  }

  /**
   * Get system paths to block
   */
  private getSystemPaths(): Set<string> {
    const paths = new Set<string>();

    // Unix/Linux system paths
    paths.add('/etc');
    paths.add('/sys');
    paths.add('/proc');
    paths.add('/boot');
    paths.add('/dev');
    paths.add('/root');

    // Windows system paths
    if (process.platform === 'win32') {
      paths.add('C:\\Windows');
      paths.add('C:\\Program Files');
      paths.add('C:\\Program Files (x86)');
    }

    return paths;
  }

  /**
   * Add allowed path
   */
  addAllowedPath(path: string): void {
    this.allowedPaths.add(normalize(path));
    logger.debug({ msg: 'Added allowed path', path });
  }

  /**
   * Add denied path
   */
  addDeniedPath(path: string): void {
    this.deniedPaths.add(normalize(path));
    logger.debug({ msg: 'Added denied path', path });
  }

  /**
   * Add allowed extension
   */
  addAllowedExtension(ext: string): void {
    const normalized = ext.startsWith('.') ? ext : `.${ext}`;
    this.allowedExtensions.add(normalized.toLowerCase());
    logger.debug({ msg: 'Added allowed extension', ext: normalized });
  }

  /**
   * Get configuration
   */
  getConfig(): {
    allowedPaths: string[];
    deniedPaths: string[];
    allowedExtensions: string[];
    allowPathTraversal: boolean;
  } {
    return {
      allowedPaths: Array.from(this.allowedPaths),
      deniedPaths: Array.from(this.deniedPaths),
      allowedExtensions: Array.from(this.allowedExtensions),
      allowPathTraversal: this.allowPathTraversal,
    };
  }
}
