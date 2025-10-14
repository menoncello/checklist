/**
 * Template version management using semantic versioning
 * Handles version resolution, comparison, and compatibility checking
 */

import * as semver from 'semver';
import { createLogger } from '../utils/logger';
import type { GitTemplateRepository } from './repositories/GitTemplateRepository';

const logger = createLogger('checklist:templates:version');

/**
 * Version resolution options
 */
export interface VersionResolutionOptions {
  /**
   * Include pre-release versions in resolution
   */
  includePrerelease?: boolean;

  /**
   * Preferred tag prefix (e.g., 'v' for 'v1.0.0')
   */
  tagPrefix?: string;
}

/**
 * Version comparison result
 */
export type VersionComparison = -1 | 0 | 1;

/**
 * Manages semantic versioning for templates
 */
export class TemplateVersionManager {
  constructor(private readonly options: VersionResolutionOptions = {}) {
    this.options = {
      includePrerelease: false,
      tagPrefix: 'v',
      ...options,
    };
  }

  /**
   * Resolve version from constraint and available versions
   * @param constraint - Semver constraint (e.g., '^1.0.0', '~2.1.0', '>=1.0.0 <2.0.0')
   * @param availableVersions - List of available versions
   * @returns Best matching version or null if no match
   */
  resolveVersion(
    constraint: string,
    availableVersions: string[]
  ): string | null {
    logger.debug({
      msg: 'Resolving version',
      constraint,
      availableCount: availableVersions.length,
    });

    const validVersions = this.filterValidVersions(availableVersions);

    if (validVersions.length === 0) {
      logger.warn({ msg: 'No valid versions available' });
      return null;
    }

    const resolved = this.findBestMatch(constraint, validVersions);

    if (resolved !== null) {
      logger.info({ msg: 'Version resolved', constraint, resolved });
    } else {
      logger.warn({ msg: 'No version matches constraint', constraint });
    }

    return resolved;
  }

  /**
   * Filter and clean version strings
   */
  private filterValidVersions(versions: string[]): string[] {
    return versions
      .map((v) => this.cleanVersion(v))
      .filter((v): v is string => v !== null && semver.valid(v) !== null)
      .filter((v) => {
        if (this.options.includePrerelease === true) {
          return true;
        }
        return !semver.prerelease(v);
      });
  }

  /**
   * Find best matching version for constraint
   */
  private findBestMatch(constraint: string, versions: string[]): string | null {
    try {
      const options = { includePrerelease: this.options.includePrerelease };
      const range = new semver.Range(constraint, options);
      const matching = versions.filter((v) => range.test(v));

      if (matching.length === 0) {
        return null;
      }

      return semver.maxSatisfying(matching, constraint, options);
    } catch (error) {
      logger.error({
        msg: 'Invalid version constraint',
        constraint,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Clean version string by removing tag prefix
   */
  private cleanVersion(version: string): string | null {
    const cleaned = this.stripTagPrefix(version);
    return semver.valid(cleaned);
  }

  /**
   * Strip configured tag prefix from version
   */
  private stripTagPrefix(version: string): string {
    const prefix = this.options.tagPrefix ?? 'v';
    if (version.startsWith(prefix)) {
      return version.slice(prefix.length);
    }
    return version;
  }

  /**
   * List all versions from repository
   * @param repository - Git repository to query
   * @returns List of valid semantic versions
   */
  async listVersions(repository: GitTemplateRepository): Promise<string[]> {
    logger.debug({ msg: 'Listing repository versions' });

    try {
      const tags = await repository.listVersions();
      const versions = this.filterValidVersions(tags);

      // Sort in descending order (newest first)
      versions.sort((a, b) => semver.rcompare(a, b));

      logger.info({
        msg: 'Versions listed',
        count: versions.length,
        latest: versions[0],
      });

      return versions;
    } catch (error) {
      logger.error({
        msg: 'Failed to list versions',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Compare two versions
   * @param v1 - First version
   * @param v2 - Second version
   * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  compareVersions(v1: string, v2: string): VersionComparison {
    const cleaned1 = this.cleanVersion(v1);
    const cleaned2 = this.cleanVersion(v2);

    if (cleaned1 === null || cleaned2 === null) {
      logger.warn({
        msg: 'Invalid versions for comparison',
        v1,
        v2,
      });
      const invalidVersion = cleaned1 === null ? v1 : v2;
      throw new Error(`Invalid version for comparison: ${invalidVersion}`);
    }

    const result = semver.compare(cleaned1, cleaned2);

    logger.debug({
      msg: 'Versions compared',
      v1: cleaned1,
      v2: cleaned2,
      result,
    });

    return result as VersionComparison;
  }

  /**
   * Check if version satisfies constraint
   * @param version - Version to check
   * @param constraint - Semver constraint
   * @returns True if version satisfies constraint
   */
  isVersionCompatible(version: string, constraint: string): boolean {
    const cleaned = this.cleanVersion(version);

    if (cleaned === null) {
      logger.warn({ msg: 'Invalid version', version });
      return false;
    }

    try {
      const compatible = semver.satisfies(cleaned, constraint);

      logger.debug({
        msg: 'Version compatibility checked',
        version: cleaned,
        constraint,
        compatible,
      });

      return compatible;
    } catch (error) {
      logger.error({
        msg: 'Invalid constraint',
        constraint,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get latest version from list
   * @param versions - List of versions
   * @returns Latest version or null if empty
   */
  getLatestVersion(versions: string[]): string | null {
    const validVersions = this.filterValidVersions(versions);

    if (validVersions.length === 0) {
      return null;
    }

    const options = { includePrerelease: this.options.includePrerelease };
    return semver.maxSatisfying(validVersions, '*', options);
  }

  /**
   * Check if version is pre-release
   * @param version - Version to check
   * @returns True if version is pre-release
   */
  isPrerelease(version: string): boolean {
    const cleaned = this.cleanVersion(version);

    if (cleaned === null) {
      return false;
    }

    return semver.prerelease(cleaned) !== null;
  }

  /**
   * Increment version by release type
   * @param version - Current version
   * @param release - Release type
   * @returns Incremented version
   */
  incrementVersion(
    version: string,
    release: 'major' | 'minor' | 'patch'
  ): string | null {
    const cleaned = this.cleanVersion(version);

    if (cleaned === null) {
      logger.warn({ msg: 'Invalid version for increment', version });
      return null;
    }

    const incremented = semver.inc(cleaned, release);

    logger.debug({
      msg: 'Version incremented',
      from: cleaned,
      to: incremented,
      release,
    });

    return incremented;
  }
}
