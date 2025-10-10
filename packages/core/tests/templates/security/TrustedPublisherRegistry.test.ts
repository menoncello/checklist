/**
 * Tests for TrustedPublisherRegistry
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  TrustedPublisherRegistry,
  type PublisherEntry,
} from '../../../src/templates/security/TrustedPublisherRegistry';

describe('TrustedPublisherRegistry', () => {
  let registry: TrustedPublisherRegistry;

  beforeEach(() => {
    registry = new TrustedPublisherRegistry();
  });

  describe('publisher management', () => {
    test('should add publisher to registry', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test Publisher',
        trustLevel: 'verified',
        verified: true,
      });

      const publisher = registry.getPublisher('pub-1');

      expect(publisher).toBeDefined();
      expect(publisher?.name).toBe('Test Publisher');
      expect(publisher?.trustLevel).toBe('verified');
    });

    test('should remove publisher from registry', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test Publisher',
        trustLevel: 'community',
        verified: false,
      });

      const removed = registry.removePublisher('pub-1');

      expect(removed).toBe(true);
      expect(registry.getPublisher('pub-1')).toBeUndefined();
    });

    test('should return false when removing nonexistent publisher', () => {
      const removed = registry.removePublisher('nonexistent');

      expect(removed).toBe(false);
    });

    test('should get publisher by ID', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test Publisher',
        trustLevel: 'official',
        verified: true,
      });

      const publisher = registry.getPublisher('pub-1');

      expect(publisher?.id).toBe('pub-1');
    });

    test('should return undefined for nonexistent publisher', () => {
      const publisher = registry.getPublisher('nonexistent');

      expect(publisher).toBeUndefined();
    });

    test('should set addedAt timestamp', () => {
      const before = new Date();

      registry.addPublisher({
        id: 'pub-1',
        name: 'Test Publisher',
        trustLevel: 'community',
        verified: false,
      });

      const after = new Date();
      const publisher = registry.getPublisher('pub-1');

      expect(publisher?.addedAt).toBeInstanceOf(Date);
      expect(publisher?.addedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(publisher?.addedAt.getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });
  });

  describe('trust levels', () => {
    test('should support untrusted level', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Untrusted',
        trustLevel: 'untrusted',
        verified: false,
      });

      expect(registry.getTrustLevel('pub-1')).toBe('untrusted');
    });

    test('should support community level', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Community',
        trustLevel: 'community',
        verified: false,
      });

      expect(registry.getTrustLevel('pub-1')).toBe('community');
    });

    test('should support verified level', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Verified',
        trustLevel: 'verified',
        verified: true,
      });

      expect(registry.getTrustLevel('pub-1')).toBe('verified');
    });

    test('should support official level', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Official',
        trustLevel: 'official',
        verified: true,
      });

      expect(registry.getTrustLevel('pub-1')).toBe('official');
    });

    test('should update trust level', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'community',
        verified: false,
      });

      const updated = registry.updateTrustLevel('pub-1', 'verified');

      expect(updated).toBe(true);
      expect(registry.getTrustLevel('pub-1')).toBe('verified');
    });

    test('should return false when updating nonexistent publisher', () => {
      const updated = registry.updateTrustLevel('nonexistent', 'verified');

      expect(updated).toBe(false);
    });

    test('should get trust hierarchy', () => {
      const hierarchy = registry.getTrustHierarchy();

      expect(hierarchy).toEqual([
        'untrusted',
        'community',
        'verified',
        'official',
      ]);
    });

    test('should compare trust levels', () => {
      expect(registry.compareTrustLevels('untrusted', 'community')).toBeLessThan(
        0
      );
      expect(registry.compareTrustLevels('verified', 'community')).toBeGreaterThan(
        0
      );
      expect(registry.compareTrustLevels('official', 'official')).toBe(0);
    });

    test('should check if trust level requirement is met', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'verified',
        verified: true,
      });

      expect(registry.requiresTrustLevel('pub-1', 'community')).toBe(true);
      expect(registry.requiresTrustLevel('pub-1', 'verified')).toBe(true);
      expect(registry.requiresTrustLevel('pub-1', 'official')).toBe(false);
    });
  });

  describe('publisher verification', () => {
    test('should verify publisher with public key', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'community',
        publicKey: 'public-key-here',
        verified: false,
      });

      const verified = registry.verifyPublisher('pub-1', 'signature');

      expect(verified).toBe(true);
    });

    test('should fail verification without public key', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'community',
        verified: false,
      });

      const verified = registry.verifyPublisher('pub-1', 'signature');

      expect(verified).toBe(false);
    });

    test('should fail verification for nonexistent publisher', () => {
      const verified = registry.verifyPublisher('nonexistent', 'signature');

      expect(verified).toBe(false);
    });

    test('should mark publisher as verified', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'community',
        publicKey: 'key',
        verified: false,
      });

      registry.verifyPublisher('pub-1', 'signature');

      const publisher = registry.getPublisher('pub-1');
      expect(publisher?.verified).toBe(true);
    });
  });

  describe('trusted check', () => {
    test('should trust verified publishers', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'verified',
        verified: true,
      });

      expect(registry.isTrusted('pub-1')).toBe(true);
    });

    test('should not trust untrusted publishers by default', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'untrusted',
        verified: false,
      });

      expect(registry.isTrusted('pub-1')).toBe(false);
    });

    test('should trust untrusted when configured', () => {
      const permissive = new TrustedPublisherRegistry({
        allowUntrusted: true,
      });

      permissive.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'untrusted',
        verified: false,
      });

      expect(permissive.isTrusted('pub-1')).toBe(true);
    });

    test('should not trust unknown publishers by default', () => {
      expect(registry.isTrusted('unknown')).toBe(false);
    });

    test('should trust unknown publishers when allowUntrusted', () => {
      const permissive = new TrustedPublisherRegistry({
        allowUntrusted: true,
      });

      expect(permissive.isTrusted('unknown')).toBe(true);
    });
  });

  describe('query functionality', () => {
    beforeEach(() => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Publisher One',
        trustLevel: 'community',
        verified: false,
      });

      registry.addPublisher({
        id: 'pub-2',
        name: 'Publisher Two',
        trustLevel: 'verified',
        verified: true,
      });

      registry.addPublisher({
        id: 'pub-3',
        name: 'Another Publisher',
        trustLevel: 'official',
        verified: true,
      });
    });

    test('should query all publishers', () => {
      const results = registry.query();

      expect(results.length).toBe(3);
    });

    test('should filter by trust level', () => {
      const results = registry.query({ trustLevel: 'verified' });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('pub-2');
    });

    test('should filter by verified status', () => {
      const results = registry.query({ verified: true });

      expect(results.length).toBe(2);
    });

    test('should filter by name', () => {
      const results = registry.query({ name: 'Publisher' });

      expect(results.length).toBe(3);
    });

    test('should filter by partial name match', () => {
      const results = registry.query({ name: 'Two' });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('pub-2');
    });

    test('should combine multiple filters', () => {
      const results = registry.query({
        trustLevel: 'verified',
        verified: true,
      });

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('pub-2');
    });

    test('should be case-insensitive for name search', () => {
      const results = registry.query({ name: 'publisher' });

      expect(results.length).toBe(3);
    });
  });

  describe('registry operations', () => {
    test('should get all publishers', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test 1',
        trustLevel: 'community',
        verified: false,
      });

      registry.addPublisher({
        id: 'pub-2',
        name: 'Test 2',
        trustLevel: 'verified',
        verified: true,
      });

      const all = registry.getAllPublishers();

      expect(all.length).toBe(2);
    });

    test('should get publisher count', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'community',
        verified: false,
      });

      expect(registry.getCount()).toBe(1);
    });

    test('should clear registry', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'community',
        verified: false,
      });

      registry.clear();

      expect(registry.getCount()).toBe(0);
    });

    test('should export registry data', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'community',
        verified: false,
      });

      const exported = registry.export();

      expect(exported.length).toBe(1);
      expect(exported[0].id).toBe('pub-1');
    });

    test('should import registry data', () => {
      const data: PublisherEntry[] = [
        {
          id: 'pub-1',
          name: 'Test 1',
          trustLevel: 'community',
          verified: false,
          addedAt: new Date(),
        },
        {
          id: 'pub-2',
          name: 'Test 2',
          trustLevel: 'verified',
          verified: true,
          addedAt: new Date(),
        },
      ];

      registry.import(data);

      expect(registry.getCount()).toBe(2);
      expect(registry.getPublisher('pub-1')).toBeDefined();
      expect(registry.getPublisher('pub-2')).toBeDefined();
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test 1',
        trustLevel: 'community',
        verified: false,
      });

      registry.addPublisher({
        id: 'pub-2',
        name: 'Test 2',
        trustLevel: 'verified',
        verified: true,
      });

      registry.addPublisher({
        id: 'pub-3',
        name: 'Test 3',
        trustLevel: 'verified',
        verified: true,
      });
    });

    test('should return total count', () => {
      const stats = registry.getStatistics();

      expect(stats.total).toBe(3);
    });

    test('should return verified count', () => {
      const stats = registry.getStatistics();

      expect(stats.verified).toBe(2);
    });

    test('should group by trust level', () => {
      const stats = registry.getStatistics();
      const byLevel = stats.byTrustLevel as Record<string, number>;

      expect(byLevel.community).toBe(1);
      expect(byLevel.verified).toBe(2);
    });
  });

  describe('trust inheritance', () => {
    test('should inherit trust from verified publisher', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'verified',
        verified: true,
      });

      const inherited = registry.inheritTrust({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'verified',
        templates: [],
      });

      expect(inherited).toBe('verified');
    });

    test('should downgrade unverified in strict mode', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'verified',
        verified: false,
      });

      const inherited = registry.inheritTrust({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'verified',
        templates: [],
      });

      expect(inherited).toBe('community');
    });

    test('should use default for unknown publisher', () => {
      const inherited = registry.inheritTrust({
        id: 'unknown-id',
        name: 'Unknown',
        trustLevel: 'verified',
        templates: [],
      });

      expect(inherited).toBe('untrusted');
    });

    test('should allow unverified in permissive mode', () => {
      const permissive = new TrustedPublisherRegistry({
        strictMode: false,
      });

      permissive.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'verified',
        verified: false,
      });

      const inherited = permissive.inheritTrust({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'verified',
        templates: [],
      });

      expect(inherited).toBe('verified');
    });
  });

  describe('configuration', () => {
    test('should use default configuration', () => {
      const config = registry.getConfig();

      expect(config.allowUntrusted).toBe(false);
      expect(config.defaultTrustLevel).toBe('untrusted');
      expect(config.strictMode).toBe(true);
    });

    test('should apply custom configuration', () => {
      const custom = new TrustedPublisherRegistry({
        allowUntrusted: true,
        defaultTrustLevel: 'community',
        strictMode: false,
      });

      const config = custom.getConfig();

      expect(config.allowUntrusted).toBe(true);
      expect(config.defaultTrustLevel).toBe('community');
      expect(config.strictMode).toBe(false);
    });
  });

  describe('validation', () => {
    test('should reject empty publisher ID', () => {
      expect(() => {
        registry.addPublisher({
          id: '',
          name: 'Test',
          trustLevel: 'community',
          verified: false,
        });
      }).toThrow('Publisher ID cannot be empty');
    });

    test('should reject empty publisher name', () => {
      expect(() => {
        registry.addPublisher({
          id: 'pub-1',
          name: '',
          trustLevel: 'community',
          verified: false,
        });
      }).toThrow('Publisher name cannot be empty');
    });

    test('should reject invalid trust level', () => {
      expect(() => {
        registry.addPublisher({
          id: 'pub-1',
          name: 'Test',
          trustLevel: 'invalid' as any,
          verified: false,
        });
      }).toThrow('Invalid trust level');
    });
  });

  describe('metadata support', () => {
    test('should store publisher metadata', () => {
      registry.addPublisher({
        id: 'pub-1',
        name: 'Test',
        trustLevel: 'community',
        verified: false,
        metadata: {
          website: 'https://example.com',
          description: 'Test publisher',
        },
      });

      const publisher = registry.getPublisher('pub-1');

      expect(publisher?.metadata).toBeDefined();
      expect(publisher?.metadata?.website).toBe('https://example.com');
    });
  });
});
