import { describe, test, expect, beforeEach} from 'bun:test';
import { MigrationRegistry } from '../../../src/state/migrations/MigrationRegistry';
import type { Migration } from '../../../src/state/migrations/types';
describe('MigrationRegistry', () => {
  let registry: MigrationRegistry;

  beforeEach(() => {
    registry = new MigrationRegistry();
  });

  describe('registerMigration', () => {
    test('should register a migration', () => {
      const migration: Migration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        description: 'Test migration',
        up: (state: unknown) => state as Record<string, unknown>,
        down: (state: unknown) => state as Record<string, unknown>
      };

      registry.registerMigration(migration);
      const retrieved = registry.getMigration('1.0.0', '1.1.0');
      
      expect(retrieved).toEqual(migration);
    });

    test('should throw error for duplicate migration', () => {
      const migration: Migration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        description: 'Test migration',
        up: (state: unknown) => state as Record<string, unknown>,
        down: (state: unknown) => state as Record<string, unknown>
      };

      registry.registerMigration(migration);
      
      expect(() => registry.registerMigration(migration)).toThrow(
        'Migration 1.0.0->1.1.0 already registered'
      );
    });

    test('should emit migration:registered event', (done) => {
      const migration: Migration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        description: 'Test migration',
        up: (state: unknown) => state as Record<string, unknown>,
        down: (state: unknown) => state as Record<string, unknown>
      };

      registry.on('migration:registered', (m) => {
        expect(m).toEqual(migration);
        done();
      });

      registry.registerMigration(migration);
    });
  });

  describe('findPath', () => {
    beforeEach(() => {
      const migrations: Migration[] = [
        {
          fromVersion: '0.0.0',
          toVersion: '0.1.0',
          description: 'Initial migration',
          up: (state: unknown) => ({ ...(state as Record<string, unknown>), version: '0.1.0' }),
          down: (state: unknown) => ({ ...(state as Record<string, unknown>), version: '0.0.0' })
        },
        {
          fromVersion: '0.1.0',
          toVersion: '0.2.0',
          description: 'Add templates',
          up: (state: unknown) => ({ ...(state as Record<string, unknown>), version: '0.2.0', templates: [] }),
          down: (state: unknown) => {
            const { templates, ...rest } = state as Record<string, unknown> & { templates?: unknown };
            return { ...rest, version: '0.1.0' };
          }
        },
        {
          fromVersion: '0.2.0',
          toVersion: '1.0.0',
          description: 'Major release',
          up: (state: unknown) => ({ ...(state as Record<string, unknown>), version: '1.0.0' }),
          down: (state: unknown) => ({ ...(state as Record<string, unknown>), version: '0.2.0' })
        },
        {
          fromVersion: '0.1.0',
          toVersion: '1.0.0',
          description: 'Direct path to 1.0.0',
          up: (state: unknown) => ({ ...(state as Record<string, unknown>), version: '1.0.0', templates: [] }),
          down: (state: unknown) => ({ ...(state as Record<string, unknown>), version: '0.1.0' })
        }
      ];

      migrations.forEach(m => registry.registerMigration(m));
    });

    test('should find direct migration path', () => {
      const path = registry.findPath('0.0.0', '0.1.0');
      
      expect(path.migrations).toHaveLength(1);
      expect(path.migrations[0].fromVersion).toBe('0.0.0');
      expect(path.migrations[0].toVersion).toBe('0.1.0');
      expect(path.totalSteps).toBe(1);
    });

    test('should find multi-step migration path', () => {
      const path = registry.findPath('0.0.0', '1.0.0');
      
      expect(path.migrations.length).toBeGreaterThanOrEqual(2);
      expect(path.fromVersion).toBe('0.0.0');
      expect(path.toVersion).toBe('1.0.0');
    });

    test('should find shortest path when multiple paths exist', () => {
      const path = registry.findPath('0.1.0', '1.0.0');
      
      expect(path.migrations).toHaveLength(1);
      expect(path.migrations[0].fromVersion).toBe('0.1.0');
      expect(path.migrations[0].toVersion).toBe('1.0.0');
      expect(path.migrations[0].description).toBe('Direct path to 1.0.0');
    });

    test('should return empty path for same version', () => {
      const path = registry.findPath('1.0.0', '1.0.0');
      
      expect(path.migrations).toHaveLength(0);
      expect(path.totalSteps).toBe(0);
    });

    test('should throw error for backwards migration', () => {
      expect(() => registry.findPath('1.0.0', '0.1.0')).toThrow(
        'Cannot migrate backwards from 1.0.0 to 0.1.0'
      );
    });

    test('should throw error for non-existent path', () => {
      expect(() => registry.findPath('0.0.0', '2.0.0')).toThrow(
        'No migration path found from 0.0.0 to 2.0.0'
      );
    });
  });

  describe('canMigrate', () => {
    beforeEach(() => {
      registry.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        description: 'Test',
        up: (state: unknown) => state as Record<string, unknown>,
        down: (state: unknown) => state as Record<string, unknown>
      });
    });

    test('should return true for valid migration path', () => {
      expect(registry.canMigrate('1.0.0', '1.1.0')).toBe(true);
    });

    test('should return false for invalid migration path', () => {
      expect(registry.canMigrate('1.0.0', '2.0.0')).toBe(false);
    });

    test('should return false for backwards migration', () => {
      expect(registry.canMigrate('1.1.0', '1.0.0')).toBe(false);
    });

    test('should return true for same version', () => {
      expect(registry.canMigrate('1.0.0', '1.0.0')).toBe(true);
    });
  });

  describe('getAvailableTargets', () => {
    beforeEach(() => {
      const migrations: Migration[] = [
        {
          fromVersion: '1.0.0',
          toVersion: '1.1.0',
          description: 'Minor update',
          up: (state: unknown) => state as Record<string, unknown>,
          down: (state: unknown) => state as Record<string, unknown>
        },
        {
          fromVersion: '1.1.0',
          toVersion: '1.2.0',
          description: 'Another minor update',
          up: (state: unknown) => state as Record<string, unknown>,
          down: (state: unknown) => state as Record<string, unknown>
        },
        {
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          description: 'Major update',
          up: (state: unknown) => state as Record<string, unknown>,
          down: (state: unknown) => state as Record<string, unknown>
        }
      ];

      migrations.forEach(m => registry.registerMigration(m));
    });

    test('should return all reachable versions', () => {
      const targets = registry.getAvailableTargets('1.0.0');
      
      expect(targets).toContain('1.1.0');
      expect(targets).toContain('1.2.0');
      expect(targets).toContain('2.0.0');
    });

    test('should return versions in descending order', () => {
      const targets = registry.getAvailableTargets('1.0.0');
      
      expect(targets[0]).toBe('2.0.0');
      expect(targets[1]).toBe('1.2.0');
      expect(targets[2]).toBe('1.1.0');
    });

    test('should return empty array for isolated version', () => {
      const targets = registry.getAvailableTargets('3.0.0');
      
      expect(targets).toHaveLength(0);
    });
  });

  describe('clear', () => {
    test('should clear all migrations', () => {
      registry.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        description: 'Test',
        up: (state: unknown) => state as Record<string, unknown>,
        down: (state: unknown) => state as Record<string, unknown>
      });

      registry.clear();
      
      expect(registry.getAllMigrations()).toHaveLength(0);
      expect(registry.getMigration('1.0.0', '1.1.0')).toBeUndefined();
    });

    test('should emit registry:cleared event', (done) => {
      registry.on('registry:cleared', () => {
        done();
      });

      registry.clear();
    });
  });

  describe('toJSON', () => {
    test('should serialize registry state', () => {
      registry.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        description: 'Test migration',
        up: (state: unknown) => state as Record<string, unknown>,
        down: (state: unknown) => state as Record<string, unknown>
      });

      const json = registry.toJSON() as any;
      
      expect(json.migrations).toHaveLength(1);
      expect(json.migrations[0]).toEqual({
        key: '1.0.0->1.1.0',
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        description: 'Test migration'
      });
      
      expect(json.versionGraph).toHaveLength(1);
      expect(json.versionGraph[0]).toEqual({
        from: '1.0.0',
        to: ['1.1.0']
      });
    });
  });
});