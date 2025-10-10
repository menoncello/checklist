import { describe, expect, test, beforeEach } from 'bun:test';
import { TemplateCache } from '../../src/templates/TemplateCache';
import { TemplateCacheError } from '../../src/templates/errors';
import type { ChecklistTemplate } from '../../src/templates/types';

describe('TemplateCache', () => {
  let cache: TemplateCache;

  const createTemplate = (name: string): ChecklistTemplate => ({
    id: `template-${name}`,
    name,
    version: '1.0.0',
    description: `Template ${name}`,
    metadata: {
      author: 'test',
      tags: [],
      visibility: 'public',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },
    variables: [],
    steps: [],
  });

  beforeEach(() => {
    cache = new TemplateCache();
  });

  describe('Constructor', () => {
    test('should create cache with default options', () => {
      expect(cache.getMaxSize()).toBe(100);
      expect(cache.getMaxAge()).toBe(3600000); // 1 hour
      expect(cache.getSize()).toBe(0);
    });

    test('should create cache with custom options', () => {
      const customCache = new TemplateCache({
        maxSize: 50,
        maxAge: 60000, // 1 minute
      });

      expect(customCache.getMaxSize()).toBe(50);
      expect(customCache.getMaxAge()).toBe(60000);
    });
  });

  describe('Basic Operations', () => {
    test('should set and get template', () => {
      const template = createTemplate('test');
      cache.set('test.yaml', template);

      const cached = cache.get('test.yaml');
      expect(cached).toBeDefined();
      expect(cached?.content.name).toBe('test');
    });

    test('should return undefined for missing template', () => {
      const cached = cache.get('missing.yaml');
      expect(cached).toBeUndefined();
    });

    test('should check if template exists', () => {
      const template = createTemplate('test');
      cache.set('test.yaml', template);

      expect(cache.has('test.yaml')).toBe(true);
      expect(cache.has('missing.yaml')).toBe(false);
    });

    test('should delete template', () => {
      const template = createTemplate('test');
      cache.set('test.yaml', template);

      expect(cache.has('test.yaml')).toBe(true);
      const deleted = cache.delete('test.yaml');
      expect(deleted).toBe(true);
      expect(cache.has('test.yaml')).toBe(false);
    });

    test('should return false when deleting non-existent template', () => {
      const deleted = cache.delete('missing.yaml');
      expect(deleted).toBe(false);
    });

    test('should update size when setting', () => {
      expect(cache.getSize()).toBe(0);

      cache.set('t1.yaml', createTemplate('t1'));
      expect(cache.getSize()).toBe(1);

      cache.set('t2.yaml', createTemplate('t2'));
      expect(cache.getSize()).toBe(2);
    });
  });

  describe('LRU Eviction', () => {
    test('should evict oldest entry when cache is full', () => {
      const smallCache = new TemplateCache({ maxSize: 3 });

      smallCache.set('t1.yaml', createTemplate('t1'));
      smallCache.set('t2.yaml', createTemplate('t2'));
      smallCache.set('t3.yaml', createTemplate('t3'));

      expect(smallCache.getSize()).toBe(3);
      expect(smallCache.has('t1.yaml')).toBe(true);

      // Adding 4th should evict t1 (oldest)
      smallCache.set('t4.yaml', createTemplate('t4'));

      expect(smallCache.getSize()).toBe(3);
      expect(smallCache.has('t1.yaml')).toBe(false);
      expect(smallCache.has('t2.yaml')).toBe(true);
      expect(smallCache.has('t3.yaml')).toBe(true);
      expect(smallCache.has('t4.yaml')).toBe(true);
    });

    test('should move accessed entry to end (most recent)', () => {
      const smallCache = new TemplateCache({ maxSize: 3 });

      smallCache.set('t1.yaml', createTemplate('t1'));
      smallCache.set('t2.yaml', createTemplate('t2'));
      smallCache.set('t3.yaml', createTemplate('t3'));

      // Access t1, making it most recent
      smallCache.get('t1.yaml');

      // Add t4, should evict t2 (now oldest)
      smallCache.set('t4.yaml', createTemplate('t4'));

      expect(smallCache.has('t1.yaml')).toBe(true);
      expect(smallCache.has('t2.yaml')).toBe(false);
      expect(smallCache.has('t3.yaml')).toBe(true);
      expect(smallCache.has('t4.yaml')).toBe(true);
    });

    test('should not evict when updating existing entry', () => {
      const smallCache = new TemplateCache({ maxSize: 2 });

      smallCache.set('t1.yaml', createTemplate('t1'));
      smallCache.set('t2.yaml', createTemplate('t2'));

      // Update t1, should not evict
      smallCache.set('t1.yaml', createTemplate('t1-updated'));

      expect(smallCache.getSize()).toBe(2);
      expect(smallCache.has('t1.yaml')).toBe(true);
      expect(smallCache.has('t2.yaml')).toBe(true);
    });

    test('should track evictions in statistics', () => {
      const smallCache = new TemplateCache({ maxSize: 2 });

      smallCache.set('t1.yaml', createTemplate('t1'));
      smallCache.set('t2.yaml', createTemplate('t2'));
      smallCache.set('t3.yaml', createTemplate('t3'));

      const stats = smallCache.getStatistics();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('Expiration', () => {
    test('should not return expired entries', () => {
      const shortCache = new TemplateCache({ maxAge: 100 }); // 100ms

      shortCache.set('test.yaml', createTemplate('test'));
      expect(shortCache.has('test.yaml')).toBe(true);

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(shortCache.has('test.yaml')).toBe(false);
          expect(shortCache.get('test.yaml')).toBeUndefined();
          resolve(true);
        }, 150);
      });
    });

    test('should remove expired entry on access', () => {
      const shortCache = new TemplateCache({ maxAge: 50 });

      shortCache.set('test.yaml', createTemplate('test'));
      expect(shortCache.getSize()).toBe(1);

      return new Promise((resolve) => {
        setTimeout(() => {
          shortCache.get('test.yaml');
          expect(shortCache.getSize()).toBe(0);
          resolve(true);
        }, 100);
      });
    });

    test('should prune expired entries', () => {
      const shortCache = new TemplateCache({ maxAge: 50 });

      shortCache.set('t1.yaml', createTemplate('t1'));
      shortCache.set('t2.yaml', createTemplate('t2'));
      shortCache.set('t3.yaml', createTemplate('t3'));

      return new Promise((resolve) => {
        setTimeout(() => {
          const pruned = shortCache.pruneExpired();
          expect(pruned).toBe(3);
          expect(shortCache.getSize()).toBe(0);
          resolve(true);
        }, 100);
      });
    });

    test('should only prune expired entries', () => {
      const shortCache = new TemplateCache({ maxAge: 100 });

      shortCache.set('t1.yaml', createTemplate('t1'));

      return new Promise((resolve) => {
        setTimeout(() => {
          // Add fresh entry
          shortCache.set('t2.yaml', createTemplate('t2'));

          // Wait for t1 to expire
          setTimeout(() => {
            const pruned = shortCache.pruneExpired();
            expect(pruned).toBe(1);
            expect(shortCache.getSize()).toBe(1);
            expect(shortCache.has('t2.yaml')).toBe(true);
            resolve(true);
          }, 80);
        }, 50);
      });
    });
  });

  describe('Statistics', () => {
    test('should track cache hits', () => {
      cache.set('test.yaml', createTemplate('test'));

      cache.get('test.yaml');
      cache.get('test.yaml');
      cache.get('test.yaml');

      const stats = cache.getStatistics();
      expect(stats.hits).toBe(3);
    });

    test('should track cache misses', () => {
      cache.get('missing1.yaml');
      cache.get('missing2.yaml');

      const stats = cache.getStatistics();
      expect(stats.misses).toBe(2);
    });

    test('should track cache size', () => {
      cache.set('t1.yaml', createTemplate('t1'));
      cache.set('t2.yaml', createTemplate('t2'));

      const stats = cache.getStatistics();
      expect(stats.size).toBe(2);
    });

    test('should calculate hit rate', () => {
      cache.set('test.yaml', createTemplate('test'));

      cache.get('test.yaml'); // hit
      cache.get('test.yaml'); // hit
      cache.get('missing.yaml'); // miss

      expect(cache.getHitRate()).toBeCloseTo(0.6667, 4);
    });

    test('should return 0 hit rate when no accesses', () => {
      expect(cache.getHitRate()).toBe(0);
    });

    test('should reset statistics', () => {
      cache.set('test.yaml', createTemplate('test'));
      cache.get('test.yaml');
      cache.get('missing.yaml');

      cache.resetStatistics();

      const stats = cache.getStatistics();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.size).toBe(1); // Size persists
    });
  });

  describe('Cache Operations', () => {
    test('should clear entire cache', () => {
      cache.set('t1.yaml', createTemplate('t1'));
      cache.set('t2.yaml', createTemplate('t2'));
      cache.set('t3.yaml', createTemplate('t3'));

      expect(cache.getSize()).toBe(3);

      cache.clear();

      expect(cache.getSize()).toBe(0);
      expect(cache.has('t1.yaml')).toBe(false);
    });

    test('should track evictions on clear', () => {
      cache.set('t1.yaml', createTemplate('t1'));
      cache.set('t2.yaml', createTemplate('t2'));

      cache.clear();

      const stats = cache.getStatistics();
      expect(stats.evictions).toBe(2);
    });

    test('should get all cached paths', () => {
      cache.set('t1.yaml', createTemplate('t1'));
      cache.set('t2.yaml', createTemplate('t2'));
      cache.set('t3.yaml', createTemplate('t3'));

      const paths = cache.getPaths();
      expect(paths).toHaveLength(3);
      expect(paths).toContain('t1.yaml');
      expect(paths).toContain('t2.yaml');
      expect(paths).toContain('t3.yaml');
    });

    test('should invalidate entries by pattern', () => {
      cache.set('templates/user/t1.yaml', createTemplate('t1'));
      cache.set('templates/user/t2.yaml', createTemplate('t2'));
      cache.set('templates/admin/t3.yaml', createTemplate('t3'));

      const invalidated = cache.invalidate(/^templates\/user\//);

      expect(invalidated).toBe(2);
      expect(cache.has('templates/user/t1.yaml')).toBe(false);
      expect(cache.has('templates/user/t2.yaml')).toBe(false);
      expect(cache.has('templates/admin/t3.yaml')).toBe(true);
    });

    test('should return 0 when no entries match pattern', () => {
      cache.set('test.yaml', createTemplate('test'));

      const invalidated = cache.invalidate(/^missing\//);

      expect(invalidated).toBe(0);
      expect(cache.getSize()).toBe(1);
    });
  });

  describe('Cache Integrity', () => {
    test('should validate cache integrity', () => {
      cache.set('t1.yaml', createTemplate('t1'));
      cache.set('t2.yaml', createTemplate('t2'));

      expect(() => cache.validateIntegrity()).not.toThrow();
    });

    test('should detect size mismatch', () => {
      cache.set('t1.yaml', createTemplate('t1'));

      // Manually corrupt stats (simulating bug)
      const stats = cache.getStatistics();
      (cache as unknown as { stats: typeof stats }).stats.size = 999;

      expect(() => cache.validateIntegrity()).toThrow(TemplateCacheError);
    });
  });

  describe('Edge Cases', () => {
    test('should handle setting same key multiple times', () => {
      cache.set('test.yaml', createTemplate('test-1'));
      cache.set('test.yaml', createTemplate('test-2'));
      cache.set('test.yaml', createTemplate('test-3'));

      expect(cache.getSize()).toBe(1);
      const cached = cache.get('test.yaml');
      expect(cached?.content.name).toBe('test-3');
    });

    test('should handle empty cache operations', () => {
      expect(cache.getSize()).toBe(0);
      expect(cache.getPaths()).toHaveLength(0);
      expect(cache.getHitRate()).toBe(0);

      cache.clear(); // Should not throw
      expect(cache.pruneExpired()).toBe(0);
      expect(cache.invalidate(/.*/)). toBe(0);
    });

    test('should handle max size of 1', () => {
      const tinyCache = new TemplateCache({ maxSize: 1 });

      tinyCache.set('t1.yaml', createTemplate('t1'));
      expect(tinyCache.getSize()).toBe(1);

      tinyCache.set('t2.yaml', createTemplate('t2'));
      expect(tinyCache.getSize()).toBe(1);
      expect(tinyCache.has('t1.yaml')).toBe(false);
      expect(tinyCache.has('t2.yaml')).toBe(true);
    });

    test('should preserve cached template data', () => {
      const template = createTemplate('test');
      cache.set('test.yaml', template);

      const cached = cache.get('test.yaml');
      expect(cached?.filePath).toBe('test.yaml');
      expect(cached?.loadedAt).toBeDefined();
      expect(typeof cached?.loadedAt).toBe('number');
      expect(cached?.content).toEqual(template);
    });
  });
});
