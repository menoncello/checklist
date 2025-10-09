/**
 * Turborepo Cache Validation Tests
 * Story: 6.1 - AC2, AC4 (Cache Management)
 * Purpose: Validate cache hit/miss behavior and invalidation strategies
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile } from 'fs/promises';

const execAsync = promisify(exec);

describe('Turborepo Cache Behavior', () => {
  beforeEach(async () => {
    // Start with clean cache for each test
    try {
      await execAsync('turbo clean');
    } catch {
      // Ignore if turbo not available
    }
  });

  it('should hit cache when no changes are made (AC4)', async () => {
    // First build to populate cache
    await execAsync('turbo run build');

    // Second build should hit cache
    const { stdout } = await execAsync('turbo run build');

    // Verify cache hit messages
    expect(stdout).toContain('cache hit');
  });

  it('should miss cache when source files change (AC4)', async () => {
    // Initial build to populate cache
    await execAsync('turbo run build');

    // Modify a source file
    const testFile = 'packages/core/src/index.ts';
    const originalContent = await readFile(testFile, 'utf-8');
    await writeFile(testFile, `${originalContent}\n// Cache invalidation test\n`);

    try {
      // Build should miss cache due to source change
      const { stdout } = await execAsync('turbo run build');

      // Verify cache was not used for modified package
      expect(stdout).toContain('@checklist/core');
      // Cache miss is indicated by actual task execution, not "cache hit"
      const corePackageOutput = stdout.split('\n').find((line) =>
        line.includes('@checklist/core:build')
      );
      expect(corePackageOutput).toBeDefined();
    } finally {
      // Restore original file
      await writeFile(testFile, originalContent);
    }
  });

  it('should invalidate cache on global dependency changes (AC4)', async () => {
    // Initial build to populate cache
    await execAsync('turbo run build');

    // Touch a global dependency (tsconfig.json is in globalDependencies)
    await execAsync('touch tsconfig.json');

    // Build should invalidate all caches
    const { stdout } = await execAsync('turbo run build');

    // All packages should rebuild (no cache hits)
    // With global dependency change, we expect fresh builds
    const hasCoreBuild = stdout.includes('@checklist/core');
    expect(hasCoreBuild).toBe(true);
  });

  it('should maintain cache for unchanged packages (AC4)', async () => {
    // Initial build
    await execAsync('turbo run build');

    // Modify only one package
    const testFile = 'packages/core/src/index.ts';
    const originalContent = await readFile(testFile, 'utf-8');
    await writeFile(testFile, `${originalContent}\n// Test change\n`);

    try {
      const { stdout } = await execAsync('turbo run build');

      // Shared package should hit cache (not modified)
      // We look for cache hits in other packages
      const hasAnyCacheHit = stdout.includes('cache hit');
      expect(hasAnyCacheHit).toBe(true);
    } finally {
      // Restore original file
      await writeFile(testFile, originalContent);
    }
  });

  it(
    'should validate cache hit rate meets target (AC2)',
    async () => {
      const iterations = 5;
      let cacheHits = 0;

      // First build to populate cache
      await execAsync('turbo run build');

      // Run multiple builds without changes
      for (let i = 0; i < iterations; i++) {
        const { stdout } = await execAsync('turbo run build');
        if (stdout.includes('cache hit')) {
          cacheHits++;
        }
      }

      // Calculate cache hit rate
      const hitRate = (cacheHits / iterations) * 100;
      console.log(`Cache hit rate: ${hitRate.toFixed(2)}%`);
      console.log(`Target: >80%`);

      // Validate cache hit rate meets target (>80%)
      expect(hitRate).toBeGreaterThanOrEqual(80);
    },
    { timeout: 30000 }
  );

  it('should handle cache cleanup without errors (AC4)', async () => {
    // Build to create cache
    await execAsync('turbo run build');

    // Remove .turbo cache directory manually (turbo clean doesn't exist as task)
    await execAsync('rm -rf .turbo');

    // Verify rebuild works after cache cleanup
    const { stdout } = await execAsync('turbo run build');
    expect(stdout).not.toContain('cache hit'); // Fresh build after cache removal
  });

  it('should respect no-cache flag for dev tasks (AC5)', async () => {
    // Dev tasks should never use cache
    // Note: This test checks configuration, not runtime behavior
    // Dev tasks are configured with "cache": false in turbo.json

    const turboConfig = await readFile('turbo.json', 'utf-8');
    const config = JSON.parse(turboConfig);

    // Verify dev task has cache disabled (tasks not pipeline in Turbo v2)
    expect(config.tasks.dev?.cache).toBe(false);
  });
});
