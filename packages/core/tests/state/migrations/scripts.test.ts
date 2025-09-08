import { describe, it, expect } from 'bun:test';
import { 
  migration_v0_0_0_to_v0_1_0,
  migration_v0_1_0_to_v0_2_0,
  migration_v0_2_0_to_v1_0_0
} from '../../../src/state/migrations/scripts/index';

describe('Migration Scripts', () => {
  describe('v0.0.0 to v0.1.0', () => {
    const migration = migration_v0_0_0_to_v0_1_0;

    it('should add metadata to state', () => {
      const oldState = {
        checklists: [],
        version: '0.0.0'
      };

      const newState = migration.up(oldState) as any;
      
      expect(newState.version).toBe('0.1.0');
      expect(newState.metadata).toBeDefined();
      expect((newState as any).metadata.created).toBeDefined();
      expect((newState as any).metadata.modified).toBeDefined();
    });

    it('should validate migrated state', () => {
      const state = {
        version: '0.1.0',
        checklists: [],
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      };

      expect(migration.validate!(state)).toBe(true);
    });

    it('should fail validation without metadata', () => {
      const state = {
        version: '0.1.0',
        checklists: []
      };

      expect(migration.validate!(state)).toBe(false);
    });

    it('should rollback by removing metadata', () => {
      const state = {
        version: '0.1.0',
        checklists: [],
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      };

      const rolledBack = migration.down!(state);
      
      expect(rolledBack.version).toBe('0.0.0');
      expect(rolledBack.metadata).toBeUndefined();
    });
  });

  describe('v0.1.0 to v0.2.0', () => {
    const migration = migration_v0_1_0_to_v0_2_0;

    it('should add templates and variables', () => {
      const oldState = {
        version: '0.1.0',
        checklists: [],
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        }
      };

      const newState = migration.up(oldState) as any;
      
      expect(newState.version).toBe('0.2.0');
      expect(newState.templates).toEqual([]);
      expect(newState.variables).toEqual({});
    });

    it('should validate migrated state', () => {
      const state = {
        version: '0.2.0',
        checklists: [],
        templates: [],
        variables: {},
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        }
      };

      expect(migration.validate!(state)).toBe(true);
    });

    it('should fail validation without templates', () => {
      const state = {
        version: '0.2.0',
        checklists: [],
        variables: {},
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        }
      };

      expect(migration.validate!(state)).toBe(false);
    });

    it('should rollback by removing templates and variables', () => {
      const state = {
        version: '0.2.0',
        checklists: [],
        templates: [],
        variables: {},
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        }
      };

      const rolledBack = migration.down!(state);
      
      expect(rolledBack.version).toBe('0.1.0');
      expect(rolledBack.templates).toBeUndefined();
      expect(rolledBack.variables).toBeUndefined();
    });
  });

  describe('v0.2.0 to v1.0.0', () => {
    const migration = migration_v0_2_0_to_v1_0_0;

    it('should add recovery and conflicts', () => {
      const oldState = {
        version: '0.2.0',
        checklists: [],
        templates: [],
        variables: {},
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        }
      };

      const newState = migration.up(oldState) as any;
      
      expect(newState.version).toBe('1.0.0');
      expect(newState.schemaVersion).toBe('1.0.0');
      expect(newState.recovery).toBeDefined();
      expect((newState as any).recovery.enabled).toBe(false);
      expect((newState as any).recovery.checkpoints).toEqual([]);
      expect(newState.conflicts).toEqual([]);
    });

    it('should handle existing recovery data', () => {
      const oldState = {
        version: '0.2.0',
        checklists: [],
        templates: [],
        variables: {},
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        },
        recovery: {
          enabled: true,
          checkpoints: [{
            id: 'cp-1',
            timestamp: new Date().toISOString(),
            state: {}
          }]
        }
      };

      const newState = migration.up(oldState) as any;
      
      expect((newState as any).recovery.enabled).toBe(true);
      expect((newState as any).recovery.checkpoints).toHaveLength(1);
    });

    it('should validate migrated state', () => {
      const state = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        checklists: [],
        templates: [],
        variables: {},
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        },
        recovery: {
          enabled: false,
          checkpoints: []
        },
        conflicts: []
      };

      expect(migration.validate!(state)).toBe(true);
    });

    it('should fail validation without recovery', () => {
      const state = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        checklists: [],
        templates: [],
        variables: {},
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        },
        conflicts: []
      };

      expect(migration.validate!(state)).toBe(false);
    });

    it('should rollback by removing recovery and conflicts', () => {
      const state = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        checklists: [],
        templates: [],
        variables: {},
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        },
        recovery: {
          enabled: false,
          checkpoints: []
        },
        conflicts: []
      };

      const rolledBack = migration.down!(state);
      
      expect(rolledBack.version).toBe('0.2.0');
      expect(rolledBack.schemaVersion).toBe('0.2.0');
      expect(rolledBack.recovery).toBeUndefined();
      expect(rolledBack.conflicts).toBeUndefined();
    });
  });
});