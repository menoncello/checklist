/**
 * Configuration for Git repository operations
 */

/**
 * Configuration options for Git repository operations
 */
export interface GitRepositoryConfig {
  /** Clone timeout in milliseconds (default: 60000ms) */
  cloneTimeout?: number;
  /** Maximum repository size in bytes (default: 104857600 = 100MB) */
  maxRepoSize?: number;
  /** Maximum clones per minute per user (default: 10) */
  maxClonesPerMinute?: number;
  /** Maximum cache size in bytes (default: 1073741824 = 1GB) */
  maxCacheSize?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (default: 1000ms) */
  retryDelay?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<GitRepositoryConfig> = {
  cloneTimeout: 60000,
  maxRepoSize: 104857600,
  maxClonesPerMinute: 10,
  maxCacheSize: 1073741824,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Create config with defaults applied
 */
export function createConfig(
  config?: GitRepositoryConfig
): Required<GitRepositoryConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}
