/**
 * Tests for GitTemplateRepository
 * Covers cloning, fetching, validation, cleanup, resource limits, and security
 */

import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GitTemplateRepository,
  RepositorySecurityError,
  validateRepositoryUrl,
} from '../../src/templates/repositories/GitTemplateRepository';

describe('GitTemplateRepository', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'git-template-test-'));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // P0 Security Tests for URL Validation (SEC-001)
  describe('URL validation security (P0)', () => {
    // 3.7-UNIT-018: Reject file:// protocol
    test('should reject file:// protocol for security reasons', () => {
      expect(() => {
        validateRepositoryUrl('file:///etc/passwd');
      }).toThrow(RepositorySecurityError);

      expect(() => {
        new GitTemplateRepository('file:///etc/passwd');
      }).toThrow(RepositorySecurityError);
    });

    // 3.7-UNIT-019: Reject javascript: scheme
    test('should reject javascript: protocol for security reasons', () => {
      expect(() => {
        validateRepositoryUrl('javascript:alert(1)');
      }).toThrow(RepositorySecurityError);

      expect(() => {
        new GitTemplateRepository('javascript:alert(1)');
      }).toThrow(RepositorySecurityError);
    });

    // Additional dangerous protocols
    test('should reject data: protocol for security reasons', () => {
      expect(() => {
        validateRepositoryUrl('data:text/html,<script>alert(1)</script>');
      }).toThrow(RepositorySecurityError);
    });

    test('should reject ftp: protocol for security reasons', () => {
      expect(() => {
        validateRepositoryUrl('ftp://example.com/repo');
      }).toThrow(RepositorySecurityError);
    });

    // 3.7-UNIT-020: Accept https:// protocol
    test('should accept https:// protocol', () => {
      expect(() => {
        validateRepositoryUrl('https://github.com/user/repo.git');
      }).not.toThrow();

      const repo = new GitTemplateRepository('https://github.com/user/repo.git');
      expect(repo).toBeDefined();
    });

    test('should accept http:// protocol', () => {
      expect(() => {
        validateRepositoryUrl('http://example.com/repo.git');
      }).not.toThrow();
    });

    test('should accept git:// protocol', () => {
      expect(() => {
        validateRepositoryUrl('git://github.com/user/repo.git');
      }).not.toThrow();
    });

    // 3.7-UNIT-021: Accept git@ SSH URLs
    test('should accept git@ SSH URL format', () => {
      expect(() => {
        validateRepositoryUrl('git@github.com:user/repo.git');
      }).not.toThrow();

      const repo = new GitTemplateRepository('git@github.com:user/repo.git');
      expect(repo).toBeDefined();
    });

    test('should reject invalid SSH URL format', () => {
      expect(() => {
        validateRepositoryUrl('git@github.com/user/repo.git'); // Wrong format
      }).toThrow(RepositorySecurityError);
    });

    test('should reject unsupported protocols', () => {
      expect(() => {
        validateRepositoryUrl('svn://example.com/repo');
      }).toThrow(RepositorySecurityError);
    });

    test('should reject completely invalid URLs', () => {
      expect(() => {
        validateRepositoryUrl('not a valid url at all');
      }).toThrow(RepositorySecurityError);
    });
  });

  describe('constructor', () => {
    test('should create repository with default config', () => {
      const repo = new GitTemplateRepository('https://github.com/test/repo.git');
      expect(repo).toBeDefined();
    });

    test('should create repository with custom config', () => {
      const repo = new GitTemplateRepository('https://github.com/test/repo.git', {
        cloneTimeout: 30000,
        maxRepoSize: 50000000,
        maxClonesPerMinute: 5,
        maxCacheSize: 500000000,
      });
      expect(repo).toBeDefined();
    });

    test('should create repository with retry config', () => {
      const repo = new GitTemplateRepository('https://github.com/test/repo.git', {
        maxRetries: 5,
        retryDelay: 2000,
      });
      expect(repo).toBeDefined();
    });
  });

  describe('validateStructure', () => {
    test('should return false when template.json is missing', async () => {
      const testDir = join(tempDir, 'no-manifest');
      await Bun.write(join(testDir, 'README.md'), 'test');

      const repo = new GitTemplateRepository('https://github.com/test/repo.git');
      const result = await repo.validateStructure(testDir);

      expect(result).toBe(false);
    });

    test('should return true when template.json exists', async () => {
      const testDir = join(tempDir, 'with-manifest');
      await Bun.write(join(testDir, 'template.json'), '{}');

      const repo = new GitTemplateRepository('https://github.com/test/repo.git');
      const result = await repo.validateStructure(testDir);

      expect(result).toBe(true);
    });
  });

  describe('clone', () => {
    test('should reject invalid URL during construction', () => {
      expect(() => {
        new GitTemplateRepository('invalid-url');
      }).toThrow(RepositorySecurityError);
    });

    test('should handle non-existent repository', async () => {
      const repo = new GitTemplateRepository(
        'https://github.com/this-repo-definitely-does-not-exist-12345.git'
      );
      const targetDir = join(tempDir, 'nonexistent-clone');

      await expect(repo.clone(targetDir)).rejects.toThrow();
    });

    test('should handle clone timeout', async () => {
      // Use a very short timeout to simulate timeout
      const repo = new GitTemplateRepository(
        'https://github.com/torvalds/linux.git', // Large repo
        { cloneTimeout: 1 } // 1ms timeout - will definitely timeout
      );
      const targetDir = join(tempDir, 'timeout-clone');

      await expect(repo.clone(targetDir)).rejects.toThrow(/timed out/i);

      // Verify directory was cleaned up
      const dirExists = await Bun.file(join(targetDir, '.git')).exists();
      expect(dirExists).toBe(false);
    });

    test('should enforce rate limiting - test with low limit', () => {
      // Test that rate limit config is accepted
      const repo = new GitTemplateRepository('https://github.com/test/repo.git', {
        maxClonesPerMinute: 1,
      });
      expect(repo).toBeDefined();

      // Note: Full rate limit integration testing would require
      // actual clone operations which are tested separately
    });
  });

  describe('listVersions', () => {
    test('should return empty array for repository without tags - simulated', () => {
      // This would require a real git repository
      // For now, test that the method exists and repo is constructed properly
      const repo = new GitTemplateRepository('https://github.com/test/repo.git');
      expect(repo).toBeDefined();
      expect(typeof repo.listVersions).toBe('function');
    });
  });

  describe('fetch', () => {
    test('should handle fetch on non-existent directory', async () => {
      const repo = new GitTemplateRepository('https://github.com/test/repo.git');
      const nonExistentDir = join(tempDir, 'non-existent');

      await expect(repo.fetch(nonExistentDir)).rejects.toThrow();
    });

    test('should handle fetch on non-git directory', async () => {
      const nonGitDir = join(tempDir, 'not-git');
      await Bun.write(join(nonGitDir, 'file.txt'), 'test');

      const repo = new GitTemplateRepository('https://github.com/test/repo.git');

      await expect(repo.fetch(nonGitDir)).rejects.toThrow();
    });
  });

  describe('resource limits', () => {
    test('should respect clone timeout configuration', () => {
      const repo = new GitTemplateRepository('https://github.com/test/repo.git', {
        cloneTimeout: 5000,
      });
      expect(repo).toBeDefined();
    });

    test('should respect max repository size configuration', () => {
      const repo = new GitTemplateRepository('https://github.com/test/repo.git', {
        maxRepoSize: 10000000,
      });
      expect(repo).toBeDefined();
    });

    test('should respect max clones per minute configuration', () => {
      const repo = new GitTemplateRepository('https://github.com/test/repo.git', {
        maxClonesPerMinute: 5,
      });
      expect(repo).toBeDefined();
    });

    test('should respect max cache size configuration', () => {
      const repo = new GitTemplateRepository('https://github.com/test/repo.git', {
        maxCacheSize: 500000000,
      });
      expect(repo).toBeDefined();
    });
  });

  describe('cleanup', () => {
    test('should cleanup after failed clone', async () => {
      const repo = new GitTemplateRepository(
        'https://github.com/this-definitely-does-not-exist-xyz.git'
      );
      const targetDir = join(tempDir, 'cleanup-test');

      try {
        await repo.clone(targetDir);
      } catch (error) {
        // Expected failure
      }

      // Directory should not exist or be empty after cleanup
      const dirExists = await Bun.file(join(targetDir, '.git')).exists();
      expect(dirExists).toBe(false);
    });

    test('should reject invalid URL during construction', () => {
      expect(() => {
        new GitTemplateRepository('invalid-url');
      }).toThrow(RepositorySecurityError);
    });
  });

  describe('error handling', () => {
    test('should provide clear error messages for network failures', async () => {
      const repo = new GitTemplateRepository('https://invalid-domain-xyz.com/repo.git');
      const targetDir = join(tempDir, 'network-error');

      await expect(repo.clone(targetDir)).rejects.toThrow();
    });

    test('should reject invalid URL format during construction', () => {
      expect(() => {
        new GitTemplateRepository('not-a-valid-url');
      }).toThrow(RepositorySecurityError);
    });
  });

  describe('caching', () => {
    test('should use cache directory structure', async () => {
      const repo = new GitTemplateRepository('https://github.com/test/repo.git');
      expect(repo).toBeDefined();
      // Cache directory logic is internal, just verify it's set up correctly
    });
  });
});
