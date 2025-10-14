/**
 * Tests for TemplateRegistry
 * Covers index loading, caching, searching, and filtering
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { TemplateRegistry } from '../../src/templates/TemplateRegistry';

const fixturesDir = join(__dirname, 'fixtures');
const testIndexPath = `file://${join(fixturesDir, 'test-index.json')}`;

describe('TemplateRegistry', () => {
  describe('constructor', () => {
    test('should create registry with file URL', () => {
      const registry = new TemplateRegistry(testIndexPath);
      expect(registry).toBeDefined();
    });

    test('should create registry with https URL', () => {
      const registry = new TemplateRegistry('https://example.com/index.json');
      expect(registry).toBeDefined();
    });
  });

  describe('loadIndex', () => {
    test('should load index from local file', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const index = await registry.loadIndex();

      expect(index).toBeDefined();
      expect(index.version).toBe('1.0.0');
      expect(index.templates).toHaveLength(3);
    });

    test('should cache index for subsequent calls', async () => {
      const registry = new TemplateRegistry(testIndexPath);

      const index1 = await registry.loadIndex();
      const index2 = await registry.loadIndex();

      expect(index1).toBe(index2); // Same object reference = cached
    });

    test('should reject invalid file URL', async () => {
      const registry = new TemplateRegistry('file:///nonexistent/file.json');

      await expect(registry.loadIndex()).rejects.toThrow();
    });

    test('should reject unsupported protocol', async () => {
      const registry = new TemplateRegistry('ftp://example.com/index.json');

      await expect(registry.loadIndex()).rejects.toThrow(/unsupported.*protocol/i);
    });

    test('should handle malformed JSON', async () => {
      // Create a temporary file with invalid JSON
      const invalidJson = join(fixturesDir, 'invalid.json');
      await Bun.write(invalidJson, '{ invalid json }');

      const registry = new TemplateRegistry(`file://${invalidJson}`);

      await expect(registry.loadIndex()).rejects.toThrow();

      // Cleanup
      await Bun.spawn(['rm', invalidJson]).exited;
    });
  });

  describe('searchTemplates', () => {
    test('should find template by exact name match', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.searchTemplates('basic-checklist');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('basic-checklist');
    });

    test('should find templates by partial name match', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.searchTemplates('project');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('project-setup');
    });

    test('should find templates by description', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.searchTemplates('workflow');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((t) => t.name === 'deployment-workflow')).toBe(true);
    });

    test('should find templates by tag', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.searchTemplates('starter');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('basic-checklist');
    });

    test('should be case insensitive', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results1 = await registry.searchTemplates('BASIC');
      const results2 = await registry.searchTemplates('basic');

      expect(results1).toHaveLength(results2.length);
      expect(results1[0].name).toBe(results2[0].name);
    });

    test('should return empty array for no matches', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.searchTemplates('nonexistent-xyz-123');

      expect(results).toEqual([]);
    });

    test('should find multiple templates with common keyword', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.searchTemplates('template');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('filterByTags', () => {
    test('should filter templates by single tag', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.filterByTags(['deployment']);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('deployment-workflow');
    });

    test('should filter templates by multiple tags', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.filterByTags(['basic', 'deployment']);

      expect(results.length).toBe(2);
      expect(results.some((t) => t.name === 'basic-checklist')).toBe(true);
      expect(results.some((t) => t.name === 'deployment-workflow')).toBe(true);
    });

    test('should be case insensitive', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results1 = await registry.filterByTags(['BASIC']);
      const results2 = await registry.filterByTags(['basic']);

      expect(results1).toHaveLength(results2.length);
    });

    test('should return empty array for no matching tags', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.filterByTags(['nonexistent-tag']);

      expect(results).toEqual([]);
    });

    test('should handle empty tag array', async () => {
      const registry = new TemplateRegistry(testIndexPath);
      const results = await registry.filterByTags([]);

      expect(results).toEqual([]);
    });
  });

  describe('refreshIndex', () => {
    test('should reload index bypassing cache', async () => {
      const registry = new TemplateRegistry(testIndexPath);

      // Load once to cache
      await registry.loadIndex();

      // Refresh should reload
      await registry.refreshIndex();

      // Should still work
      const index = await registry.loadIndex();
      expect(index).toBeDefined();
      expect(index.templates).toHaveLength(3);
    });

    test('should handle refresh with invalid file', async () => {
      const registry = new TemplateRegistry('file:///nonexistent.json');

      await expect(registry.refreshIndex()).rejects.toThrow();
    });
  });

  describe('cache behavior', () => {
    test('should use cached index within TTL', async () => {
      const registry = new TemplateRegistry(testIndexPath);

      const index1 = await registry.loadIndex();
      const index2 = await registry.loadIndex();

      // Second call should return same cached object
      expect(index1).toBe(index2); // Same reference = cached
      expect(index1.templates).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    test('should provide clear error for network failures', async () => {
      const registry = new TemplateRegistry(
        'https://nonexistent-domain-xyz-123.com/index.json'
      );

      await expect(registry.loadIndex()).rejects.toThrow();
    });

    test('should handle file read permissions errors', async () => {
      const registry = new TemplateRegistry('file:///root/forbidden.json');

      await expect(registry.loadIndex()).rejects.toThrow();
    });
  });
});
