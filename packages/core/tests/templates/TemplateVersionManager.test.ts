/**
 * Tests for TemplateVersionManager
 * Covers version resolution, comparison, and compatibility
 */

import { describe, expect, test, mock } from 'bun:test';
import { TemplateVersionManager } from '../../src/templates/TemplateVersionManager';
import type { GitTemplateRepository } from '../../src/templates/repositories/GitTemplateRepository';

describe('TemplateVersionManager', () => {
  describe('constructor', () => {
    test('should create manager with default options', () => {
      const manager = new TemplateVersionManager();
      expect(manager).toBeDefined();
    });

    test('should create manager with custom options', () => {
      const manager = new TemplateVersionManager({
        includePrerelease: true,
        tagPrefix: 'version-',
      });
      expect(manager).toBeDefined();
    });
  });

  describe('resolveVersion', () => {
    test('should resolve exact version match', () => {
      const manager = new TemplateVersionManager();
      const versions = ['1.0.0', '1.1.0', '2.0.0'];

      const result = manager.resolveVersion('1.1.0', versions);

      expect(result).toBe('1.1.0');
    });

    test('should resolve caret constraint', () => {
      const manager = new TemplateVersionManager();
      const versions = ['1.0.0', '1.1.0', '1.2.0', '2.0.0'];

      const result = manager.resolveVersion('^1.0.0', versions);

      expect(result).toBe('1.2.0'); // Latest 1.x version
    });

    test('should resolve tilde constraint', () => {
      const manager = new TemplateVersionManager();
      const versions = ['1.0.0', '1.0.5', '1.1.0', '2.0.0'];

      const result = manager.resolveVersion('~1.0.0', versions);

      expect(result).toBe('1.0.5'); // Latest 1.0.x version
    });

    test('should resolve range constraint', () => {
      const manager = new TemplateVersionManager();
      const versions = ['1.0.0', '1.5.0', '2.0.0', '3.0.0'];

      const result = manager.resolveVersion('>=1.0.0 <2.0.0', versions);

      expect(result).toBe('1.5.0');
    });

    test('should handle versions with v prefix', () => {
      const manager = new TemplateVersionManager();
      const versions = ['v1.0.0', 'v1.1.0', 'v2.0.0'];

      const result = manager.resolveVersion('^1.0.0', versions);

      expect(result).toBe('1.1.0');
    });

    test('should handle custom tag prefix', () => {
      const manager = new TemplateVersionManager({ tagPrefix: 'version-' });
      const versions = ['version-1.0.0', 'version-1.1.0', 'version-2.0.0'];

      const result = manager.resolveVersion('^1.0.0', versions);

      expect(result).toBe('1.1.0');
    });

    test('should exclude pre-release versions by default', () => {
      const manager = new TemplateVersionManager();
      const versions = ['1.0.0', '1.1.0-beta.1', '1.2.0'];

      const result = manager.resolveVersion('^1.0.0', versions);

      expect(result).toBe('1.2.0'); // Skip beta
    });

    test('should include pre-release when configured', () => {
      const manager = new TemplateVersionManager({
        includePrerelease: true,
      });
      const versions = ['1.0.0', '1.1.0-beta.1', '1.0.5'];

      const result = manager.resolveVersion('>=1.0.0', versions);

      expect(result).toBe('1.1.0-beta.1');
    });

    test('should return null for no matching versions', () => {
      const manager = new TemplateVersionManager();
      const versions = ['1.0.0', '1.1.0'];

      const result = manager.resolveVersion('^2.0.0', versions);

      expect(result).toBeNull();
    });

    test('should return null for empty version list', () => {
      const manager = new TemplateVersionManager();

      const result = manager.resolveVersion('^1.0.0', []);

      expect(result).toBeNull();
    });

    test('should return null for invalid versions', () => {
      const manager = new TemplateVersionManager();
      const versions = ['invalid', 'not-a-version', 'abc'];

      const result = manager.resolveVersion('^1.0.0', versions);

      expect(result).toBeNull();
    });

    test('should handle invalid constraint gracefully', () => {
      const manager = new TemplateVersionManager();
      const versions = ['1.0.0', '1.1.0'];

      const result = manager.resolveVersion('invalid-constraint', versions);

      expect(result).toBeNull();
    });
  });

  describe('listVersions', () => {
    test('should list versions from repository', async () => {
      const manager = new TemplateVersionManager();
      const mockRepo = {
        listVersions: mock(() => Promise.resolve(['v1.0.0', 'v1.1.0', 'v2.0.0'])),
      } as unknown as GitTemplateRepository;

      const versions = await manager.listVersions(mockRepo);

      expect(versions).toHaveLength(3);
      expect(versions[0]).toBe('2.0.0'); // Sorted descending
      expect(versions[1]).toBe('1.1.0');
      expect(versions[2]).toBe('1.0.0');
    });

    test('should filter invalid versions', async () => {
      const manager = new TemplateVersionManager();
      const mockRepo = {
        listVersions: mock(() =>
          Promise.resolve(['v1.0.0', 'invalid', 'v1.1.0', 'not-a-version'])
        ),
      } as unknown as GitTemplateRepository;

      const versions = await manager.listVersions(mockRepo);

      expect(versions).toHaveLength(2);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('1.1.0');
    });

    test('should sort versions in descending order', async () => {
      const manager = new TemplateVersionManager();
      const mockRepo = {
        listVersions: mock(() =>
          Promise.resolve(['v1.0.0', 'v2.5.0', 'v1.5.0', 'v3.0.0'])
        ),
      } as unknown as GitTemplateRepository;

      const versions = await manager.listVersions(mockRepo);

      expect(versions).toEqual(['3.0.0', '2.5.0', '1.5.0', '1.0.0']);
    });

    test('should exclude pre-release by default', async () => {
      const manager = new TemplateVersionManager();
      const mockRepo = {
        listVersions: mock(() =>
          Promise.resolve(['v1.0.0', 'v1.1.0-beta', 'v1.2.0'])
        ),
      } as unknown as GitTemplateRepository;

      const versions = await manager.listVersions(mockRepo);

      expect(versions).toHaveLength(2);
      expect(versions).not.toContain('1.1.0-beta');
    });

    test('should include pre-release when configured', async () => {
      const manager = new TemplateVersionManager({
        includePrerelease: true,
      });
      const mockRepo = {
        listVersions: mock(() =>
          Promise.resolve(['v1.0.0', 'v1.1.0-beta', 'v1.2.0'])
        ),
      } as unknown as GitTemplateRepository;

      const versions = await manager.listVersions(mockRepo);

      expect(versions).toHaveLength(3);
      expect(versions).toContain('1.1.0-beta');
    });

    test('should propagate repository errors', async () => {
      const manager = new TemplateVersionManager();
      const mockRepo = {
        listVersions: mock(() =>
          Promise.reject(new Error('Repository not found'))
        ),
      } as unknown as GitTemplateRepository;

      await expect(manager.listVersions(mockRepo)).rejects.toThrow(
        'Repository not found'
      );
    });
  });

  describe('compareVersions', () => {
    test('should compare v1 < v2', () => {
      const manager = new TemplateVersionManager();

      const result = manager.compareVersions('1.0.0', '2.0.0');

      expect(result).toBe(-1);
    });

    test('should compare v1 === v2', () => {
      const manager = new TemplateVersionManager();

      const result = manager.compareVersions('1.0.0', '1.0.0');

      expect(result).toBe(0);
    });

    test('should compare v1 > v2', () => {
      const manager = new TemplateVersionManager();

      const result = manager.compareVersions('2.0.0', '1.0.0');

      expect(result).toBe(1);
    });

    test('should handle versions with v prefix', () => {
      const manager = new TemplateVersionManager();

      const result = manager.compareVersions('v1.0.0', 'v2.0.0');

      expect(result).toBe(-1);
    });

    test('should compare pre-release versions', () => {
      const manager = new TemplateVersionManager();

      const result = manager.compareVersions('1.0.0-beta', '1.0.0');

      expect(result).toBe(-1);
    });

    test('should throw for invalid first version', () => {
      const manager = new TemplateVersionManager();

      expect(() => manager.compareVersions('invalid', '1.0.0')).toThrow(
        /invalid version/i
      );
    });

    test('should throw for invalid second version', () => {
      const manager = new TemplateVersionManager();

      expect(() => manager.compareVersions('1.0.0', 'invalid')).toThrow(
        /invalid version/i
      );
    });
  });

  describe('isVersionCompatible', () => {
    test('should check exact version compatibility', () => {
      const manager = new TemplateVersionManager();

      const result = manager.isVersionCompatible('1.0.0', '1.0.0');

      expect(result).toBe(true);
    });

    test('should check caret constraint compatibility', () => {
      const manager = new TemplateVersionManager();

      expect(manager.isVersionCompatible('1.1.0', '^1.0.0')).toBe(true);
      expect(manager.isVersionCompatible('2.0.0', '^1.0.0')).toBe(false);
    });

    test('should check tilde constraint compatibility', () => {
      const manager = new TemplateVersionManager();

      expect(manager.isVersionCompatible('1.0.5', '~1.0.0')).toBe(true);
      expect(manager.isVersionCompatible('1.1.0', '~1.0.0')).toBe(false);
    });

    test('should check range constraint compatibility', () => {
      const manager = new TemplateVersionManager();

      expect(manager.isVersionCompatible('1.5.0', '>=1.0.0 <2.0.0')).toBe(
        true
      );
      expect(manager.isVersionCompatible('2.0.0', '>=1.0.0 <2.0.0')).toBe(
        false
      );
    });

    test('should handle versions with v prefix', () => {
      const manager = new TemplateVersionManager();

      const result = manager.isVersionCompatible('v1.1.0', '^1.0.0');

      expect(result).toBe(true);
    });

    test('should return false for invalid version', () => {
      const manager = new TemplateVersionManager();

      const result = manager.isVersionCompatible('invalid', '^1.0.0');

      expect(result).toBe(false);
    });

    test('should return false for invalid constraint', () => {
      const manager = new TemplateVersionManager();

      const result = manager.isVersionCompatible('1.0.0', 'invalid-constraint');

      expect(result).toBe(false);
    });
  });

  describe('getLatestVersion', () => {
    test('should get latest version from list', () => {
      const manager = new TemplateVersionManager();
      const versions = ['1.0.0', '2.5.0', '1.5.0', '3.0.0'];

      const result = manager.getLatestVersion(versions);

      expect(result).toBe('3.0.0');
    });

    test('should handle versions with v prefix', () => {
      const manager = new TemplateVersionManager();
      const versions = ['v1.0.0', 'v2.0.0', 'v1.5.0'];

      const result = manager.getLatestVersion(versions);

      expect(result).toBe('2.0.0');
    });

    test('should exclude pre-release by default', () => {
      const manager = new TemplateVersionManager();
      const versions = ['1.0.0', '2.0.0-beta', '1.5.0'];

      const result = manager.getLatestVersion(versions);

      expect(result).toBe('1.5.0');
    });

    test('should include pre-release when configured', () => {
      const manager = new TemplateVersionManager({
        includePrerelease: true,
      });
      const versions = ['1.0.0', '2.0.0-beta', '1.5.0'];

      const result = manager.getLatestVersion(versions);

      expect(result).toBe('2.0.0-beta');
    });

    test('should return null for empty list', () => {
      const manager = new TemplateVersionManager();

      const result = manager.getLatestVersion([]);

      expect(result).toBeNull();
    });

    test('should return null for invalid versions', () => {
      const manager = new TemplateVersionManager();

      const result = manager.getLatestVersion(['invalid', 'not-a-version']);

      expect(result).toBeNull();
    });
  });

  describe('isPrerelease', () => {
    test('should identify pre-release version', () => {
      const manager = new TemplateVersionManager();

      expect(manager.isPrerelease('1.0.0-beta')).toBe(true);
      expect(manager.isPrerelease('1.0.0-alpha.1')).toBe(true);
      expect(manager.isPrerelease('2.0.0-rc.1')).toBe(true);
    });

    test('should identify stable version', () => {
      const manager = new TemplateVersionManager();

      expect(manager.isPrerelease('1.0.0')).toBe(false);
      expect(manager.isPrerelease('2.5.3')).toBe(false);
    });

    test('should handle versions with v prefix', () => {
      const manager = new TemplateVersionManager();

      expect(manager.isPrerelease('v1.0.0-beta')).toBe(true);
      expect(manager.isPrerelease('v1.0.0')).toBe(false);
    });

    test('should return false for invalid version', () => {
      const manager = new TemplateVersionManager();

      expect(manager.isPrerelease('invalid')).toBe(false);
    });
  });

  describe('incrementVersion', () => {
    test('should increment major version', () => {
      const manager = new TemplateVersionManager();

      const result = manager.incrementVersion('1.2.3', 'major');

      expect(result).toBe('2.0.0');
    });

    test('should increment minor version', () => {
      const manager = new TemplateVersionManager();

      const result = manager.incrementVersion('1.2.3', 'minor');

      expect(result).toBe('1.3.0');
    });

    test('should increment patch version', () => {
      const manager = new TemplateVersionManager();

      const result = manager.incrementVersion('1.2.3', 'patch');

      expect(result).toBe('1.2.4');
    });

    test('should handle versions with v prefix', () => {
      const manager = new TemplateVersionManager();

      const result = manager.incrementVersion('v1.2.3', 'patch');

      expect(result).toBe('1.2.4');
    });

    test('should return null for invalid version', () => {
      const manager = new TemplateVersionManager();

      const result = manager.incrementVersion('invalid', 'patch');

      expect(result).toBeNull();
    });
  });
});
