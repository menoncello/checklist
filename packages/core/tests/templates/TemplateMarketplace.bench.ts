/**
 * Template Marketplace Performance Benchmarks
 * Tests performance of template discovery, version resolution, and dependency resolution
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { TemplateDependencyResolver } from '../../src/templates/TemplateDependencyResolver';
import { TemplateRegistry } from '../../src/templates/TemplateRegistry';
import { TemplateVersionManager } from '../../src/templates/TemplateVersionManager';

/**
 * Performance assertion helper
 * Ensures operations complete within acceptable time limits
 */
function assertPerformance(
  operation: string,
  duration: number,
  maxMs: number
): void {
  if (duration > maxMs) {
    throw new Error(
      `Performance regression: ${operation} took ${duration.toFixed(2)}ms (max: ${maxMs}ms)`
    );
  }
}

const fixturesDir = join(__dirname, 'fixtures');
const testIndexPath = `file://${join(fixturesDir, 'test-index.json')}`;

describe('Template Marketplace Benchmarks', () => {
  describe('TemplateRegistry Performance', () => {
    test('loadIndex should complete within 100ms', async () => {
      const start = performance.now();
      const registry = new TemplateRegistry(testIndexPath);
      await registry.loadIndex();
      const duration = performance.now() - start;

      assertPerformance('loadIndex first load', duration, 100);
      expect(duration).toBeLessThan(100);
    });

    test('loadIndex cached should complete within 5ms', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      await registry.loadIndex(); // Prime cache

      const start = performance.now();
      await registry.loadIndex(); // Cached
      const duration = performance.now() - start;

      assertPerformance('loadIndex cached', duration, 5);
      expect(duration).toBeLessThan(5);
    });

    test('searchTemplates should complete within 10ms', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      await registry.loadIndex();

      const start = performance.now();
      const results = await registry.searchTemplates('basic');
      const duration = performance.now() - start;

      assertPerformance('searchTemplates', duration, 10);
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10);
    });

    test('searchTemplates with multiple results should complete within 20ms', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      await registry.loadIndex();

      const start = performance.now();
      await registry.searchTemplates('template');
      const duration = performance.now() - start;

      assertPerformance('searchTemplates multiple', duration, 20);
      expect(duration).toBeLessThan(20);
    });

    test('filterByTags should complete within 10ms', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      await registry.loadIndex();

      const start = performance.now();
      const results = await registry.filterByTags(['basic']);
      const duration = performance.now() - start;

      assertPerformance('filterByTags single', duration, 10);
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10);
    });

    test('filterByTags with multiple tags should complete within 15ms', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      await registry.loadIndex();

      const start = performance.now();
      await registry.filterByTags(['basic', 'deployment', 'project']);
      const duration = performance.now() - start;

      assertPerformance('filterByTags multiple', duration, 15);
      expect(duration).toBeLessThan(15);
    });
  });

  describe('TemplateVersionManager Performance', () => {
    const versions = [
      '1.0.0',
      '1.0.1',
      '1.1.0',
      '1.2.0',
      '2.0.0',
      '2.0.1',
      '2.1.0',
      '3.0.0',
    ];

    test('resolveVersion should complete within 2ms', () => {
      const manager = new TemplateVersionManager();

      const start = performance.now();
      const result = manager.resolveVersion('1.0.0', versions);
      const duration = performance.now() - start;

      assertPerformance('resolveVersion exact', duration, 2);
      expect(result).toBe('1.0.0');
      expect(duration).toBeLessThan(2);
    });

    test('resolveVersion with caret range should complete within 2ms', () => {
      const manager = new TemplateVersionManager();

      const start = performance.now();
      const result = manager.resolveVersion('^1.0.0', versions);
      const duration = performance.now() - start;

      assertPerformance('resolveVersion caret', duration, 2);
      expect(result).toBe('1.2.0');
      expect(duration).toBeLessThan(2);
    });

    test('resolveVersion with tilde range should complete within 2ms', () => {
      const manager = new TemplateVersionManager();

      const start = performance.now();
      const result = manager.resolveVersion('~1.0.0', versions);
      const duration = performance.now() - start;

      assertPerformance('resolveVersion tilde', duration, 2);
      expect(result).toBe('1.0.1');
      expect(duration).toBeLessThan(2);
    });

    test('resolveVersion latest should complete within 1ms', () => {
      const manager = new TemplateVersionManager();

      const start = performance.now();
      const result = manager.getLatestVersion(versions);
      const duration = performance.now() - start;

      assertPerformance('getLatestVersion', duration, 1);
      expect(result).toBe('3.0.0');
      expect(duration).toBeLessThan(1);
    });

    test('compareVersions should complete within 1ms', () => {
      const manager = new TemplateVersionManager();

      const start = performance.now();
      const result = manager.compareVersions('2.0.0', '1.0.0');
      const duration = performance.now() - start;

      assertPerformance('compareVersions', duration, 1);
      expect(result).toBe(1);
      expect(duration).toBeLessThan(1);
    });

    test('isVersionCompatible batch should complete within 5ms', () => {
      const manager = new TemplateVersionManager();

      const start = performance.now();
      for (const version of versions) {
        manager.isVersionCompatible(version, '^1.0.0');
      }
      const duration = performance.now() - start;

      assertPerformance('isVersionCompatible batch', duration, 5);
      expect(duration).toBeLessThan(5);
    });
  });

  describe('TemplateDependencyResolver Performance', () => {
    // Mock fetcher that returns no dependencies
    const mockFetcher = async () => Promise.resolve([]);

    test('buildDependencyTree with no dependencies should complete within 5ms', async () => {
      const resolver = new TemplateDependencyResolver();

      const start = performance.now();
      const result = await resolver.buildDependencyTree([], mockFetcher);
      const duration = performance.now() - start;

      assertPerformance('buildDependencyTree simple', duration, 5);
      expect(result.dependencies).toHaveLength(0);
      expect(duration).toBeLessThan(5);
    });

    test('flattenDependencyTree should complete within 1ms', () => {
      const resolver = new TemplateDependencyResolver();

      const tree = {
        dependencies: [],
        totalCount: 0,
      };

      const start = performance.now();
      const flattened = resolver.flattenDependencyTree(tree);
      const duration = performance.now() - start;

      assertPerformance('flattenDependencyTree', duration, 1);
      expect(flattened).toHaveLength(0);
      expect(duration).toBeLessThan(1);
    });
  });
});
