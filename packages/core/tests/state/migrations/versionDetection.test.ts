import { describe, it, expect } from 'bun:test';
import {
  detectVersion,
  isCompatibleVersion,
  parseVersionParts,
  needsMigration,
  getMigrationDirection,
  getVersionRange,
  inferStateStructure,
  validateStateIntegrity
} from '../../../src/state/migrations/versionDetection';

describe('versionDetection', () => {
  describe('detectVersion', () => {
    it('should detect version from schemaVersion field', async () => {
      const state = { schemaVersion: '1.0.0' };
      const version = await detectVersion(state);
      expect(version).toBe('1.0.0');
    });

    it('should detect version from version field', async () => {
      const state = { version: '0.2.0' };
      const version = await detectVersion(state);
      expect(version).toBe('0.2.0');
    });

    it('should detect v1.0.0 from structure with recovery and conflicts', async () => {
      const state = {
        templates: [],
        variables: {},
        recovery: null,
        conflicts: []
      };
      const version = await detectVersion(state);
      expect(version).toBe('1.0.0');
    });

    it('should detect v0.2.0 from structure with templates and variables', async () => {
      const state = {
        templates: [],
        variables: {}
      };
      const version = await detectVersion(state);
      expect(version).toBe('0.2.0');
    });

    it('should detect v0.1.0 from structure with metadata', async () => {
      const state = {
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        }
      };
      const version = await detectVersion(state);
      expect(version).toBe('0.1.0');
    });

    it('should detect v0.0.0 from structure with checklists', async () => {
      const state = {
        checklists: []
      };
      const version = await detectVersion(state);
      expect(version).toBe('0.0.0');
    });

    it('should detect v0.0.0 from workflow-related fields', async () => {
      const state = {
        activeInstance: {},
        currentStepId: 'step-1'
      };
      const version = await detectVersion(state);
      expect(version).toBe('0.0.0');
    });

    it('should default to v0.0.0 for unknown structure', async () => {
      const state = { unknown: 'field' };
      const version = await detectVersion(state);
      expect(version).toBe('0.0.0');
    });

    it('should throw error for invalid state', async () => {
      await expect(detectVersion(null)).rejects.toThrow('Invalid state object');
      await expect(detectVersion('invalid')).rejects.toThrow('Invalid state object');
    });
  });

  describe('isCompatibleVersion', () => {
    it('should return true for exact match', () => {
      expect(isCompatibleVersion('1.0.0', '1.0.0')).toBe(true);
    });

    it('should return true for newer patch version', () => {
      expect(isCompatibleVersion('1.0.1', '1.0.0')).toBe(true);
    });

    it('should return true for newer minor version', () => {
      expect(isCompatibleVersion('1.1.0', '1.0.0')).toBe(true);
    });

    it('should return true for newer major version with allowNewer=true', () => {
      expect(isCompatibleVersion('2.0.0', '1.0.0', true)).toBe(true);
    });

    it('should return false for newer major version with allowNewer=false', () => {
      expect(isCompatibleVersion('2.0.0', '1.0.0', false)).toBe(false);
    });

    it('should return false for older version', () => {
      expect(isCompatibleVersion('0.9.0', '1.0.0')).toBe(false);
      expect(isCompatibleVersion('1.0.0', '1.1.0')).toBe(false);
      expect(isCompatibleVersion('1.0.0', '1.0.1')).toBe(false);
    });
  });

  describe('parseVersionParts', () => {
    it('should parse standard version', () => {
      const parts = parseVersionParts('1.2.3');
      expect(parts).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined
      });
    });

    it('should parse version with prerelease', () => {
      const parts = parseVersionParts('1.0.0-alpha');
      expect(parts).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: 'alpha'
      });
    });

    it('should throw error for invalid format', () => {
      expect(() => parseVersionParts('1.2')).toThrow('Invalid version format');
      expect(() => parseVersionParts('invalid')).toThrow('Invalid version format');
    });
  });

  describe('needsMigration', () => {
    it('should return false for same version', () => {
      expect(needsMigration('1.0.0', '1.0.0')).toBe(false);
    });

    it('should return true for different major version', () => {
      expect(needsMigration('1.0.0', '2.0.0')).toBe(true);
    });

    it('should return true for different minor version', () => {
      expect(needsMigration('1.0.0', '1.1.0')).toBe(true);
    });

    it('should return true for different patch version', () => {
      expect(needsMigration('1.0.0', '1.0.1')).toBe(true);
    });
  });

  describe('getMigrationDirection', () => {
    it('should return upgrade for newer version', () => {
      expect(getMigrationDirection('1.0.0', '2.0.0')).toBe('upgrade');
      expect(getMigrationDirection('1.0.0', '1.1.0')).toBe('upgrade');
      expect(getMigrationDirection('1.0.0', '1.0.1')).toBe('upgrade');
    });

    it('should return downgrade for older version', () => {
      expect(getMigrationDirection('2.0.0', '1.0.0')).toBe('downgrade');
      expect(getMigrationDirection('1.1.0', '1.0.0')).toBe('downgrade');
      expect(getMigrationDirection('1.0.1', '1.0.0')).toBe('downgrade');
    });

    it('should return none for same version', () => {
      expect(getMigrationDirection('1.0.0', '1.0.0')).toBe('none');
    });
  });

  describe('getVersionRange', () => {
    it('should return min and max versions', () => {
      const range = getVersionRange(['1.0.0', '2.0.0', '0.5.0', '1.5.0']);
      expect(range).toEqual({
        min: '0.5.0',
        max: '2.0.0'
      });
    });

    it('should handle single version', () => {
      const range = getVersionRange(['1.0.0']);
      expect(range).toEqual({
        min: '1.0.0',
        max: '1.0.0'
      });
    });

    it('should throw error for empty array', () => {
      expect(() => getVersionRange([])).toThrow('No versions provided');
    });
  });

  describe('inferStateStructure', () => {
    it('should detect v1.0.0 structure', () => {
      const state = {
        checklists: [],
        templates: [],
        variables: {},
        metadata: {},
        recovery: null,
        conflicts: [],
        migrations: []
      };
      const structure = inferStateStructure(state);
      
      expect(structure.hasChecklists).toBe(true);
      expect(structure.hasTemplates).toBe(true);
      expect(structure.hasVariables).toBe(true);
      expect(structure.hasMetadata).toBe(true);
      expect(structure.hasRecovery).toBe(true);
      expect(structure.hasConflicts).toBe(true);
      expect(structure.hasMigrations).toBe(true);
      expect(structure.estimatedVersion).toBe('1.0.0');
    });

    it('should detect v0.2.0 structure', () => {
      const state = {
        templates: [],
        variables: {}
      };
      const structure = inferStateStructure(state);
      
      expect(structure.hasTemplates).toBe(true);
      expect(structure.hasVariables).toBe(true);
      expect(structure.estimatedVersion).toBe('0.2.0');
    });

    it('should detect v0.1.0 structure', () => {
      const state = {
        metadata: { created: '2024-01-01' }
      };
      const structure = inferStateStructure(state);
      
      expect(structure.hasMetadata).toBe(true);
      expect(structure.estimatedVersion).toBe('0.1.0');
    });

    it('should detect v0.0.0 structure', () => {
      const state = {
        checklists: []
      };
      const structure = inferStateStructure(state);
      
      expect(structure.hasChecklists).toBe(true);
      expect(structure.estimatedVersion).toBe('0.0.0');
    });
  });

  describe('validateStateIntegrity', () => {
    it('should validate valid state', async () => {
      const state: any = {
        schemaVersion: '1.0.0',
        version: '1.0.0',
        lastModified: '2024-01-01T00:00:00Z',
        checklists: [],
        templates: [],
        variables: {},
        conflicts: [],
        migrations: [],
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        }
      };
      
      const result = await validateStateIntegrity(state);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect missing version', async () => {
      const state: any = {};
      
      const result = await validateStateIntegrity(state);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('State file missing version information');
    });

    it('should detect version mismatch', async () => {
      const state: any = {
        version: '1.0.0',
        schemaVersion: '1.1.0',
        lastModified: '2024-01-01T00:00:00Z'
      };
      
      const result = await validateStateIntegrity(state);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Version mismatch: version=1.0.0, schemaVersion=1.1.0');
    });

    it('should detect invalid field types', async () => {
      const state: any = {
        version: '1.0.0',
        checklists: 'invalid',
        templates: {},
        variables: [],
        conflicts: 'invalid',
        metadata: 'invalid'
      };
      
      const result = await validateStateIntegrity(state);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid checklists field: must be an array');
      expect(result.errors).toContain('Invalid templates field: must be an array');
      expect(result.errors).toContain('Invalid variables field: must be an object');
      expect(result.errors).toContain('Invalid conflicts field: must be an array');
      expect(result.errors).toContain('Invalid metadata field: must be an object');
    });

    it('should detect invalid timestamps', async () => {
      const state: any = {
        version: '1.0.0',
        lastModified: '2024-01-01T00:00:00Z',
        metadata: {
          created: 'invalid-date',
          modified: 'also-invalid'
        }
      };
      
      const result = await validateStateIntegrity(state);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Invalid metadata.created timestamp');
      expect(result.warnings).toContain('Invalid metadata.modified timestamp');
    });
  });
});