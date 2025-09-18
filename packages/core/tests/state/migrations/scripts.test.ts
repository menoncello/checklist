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
      expect(newState.conflicts).toEqual({ resolutions: [] });
    });

    it('should handle activeInstance upgrade with completedSteps', () => {
      const oldState = {
        version: '0.2.0',
        activeInstance: {
          id: 'instance-1',
          templateId: 'template-1',
          completedSteps: ['step1', 'step2', { id: 'step3', result: 'failure' }]
        }
      };

      const newState = migration.up(oldState) as any;

      expect(newState.activeInstance).toBeDefined();
      expect(newState.activeInstance.id).toBe('instance-1');
      expect(newState.activeInstance.completedSteps).toHaveLength(3);

      // Check string step conversion
      expect(newState.activeInstance.completedSteps[0].id).toBe('step1');
      expect(newState.activeInstance.completedSteps[0].result).toBe('success');
      expect(newState.activeInstance.completedSteps[0].notes).toBe('');

      // Check object step upgrade
      expect(newState.activeInstance.completedSteps[2].id).toBe('step3');
      expect(newState.activeInstance.completedSteps[2].result).toBe('failure');
      expect(newState.activeInstance.completedSteps[2].notes).toBe('');
    });

    it('should handle null activeInstance', () => {
      const oldState = {
        version: '0.2.0',
        activeInstance: null
      };

      const newState = migration.up(oldState) as any;

      expect(newState.activeInstance).toBeNull();
    });

    it('should handle undefined activeInstance', () => {
      const oldState = {
        version: '0.2.0'
      };

      const newState = migration.up(oldState) as any;

      expect(newState.activeInstance).toBeUndefined();
    });

    it('should upgrade checklists with conditions and commandResults', () => {
      const oldState = {
        version: '0.2.0',
        checklists: [
          {
            id: 'checklist-1',
            title: 'Test Checklist',
            items: []
          },
          {
            id: 'checklist-2',
            title: 'Test Checklist 2',
            conditions: 'existing-condition',
            commandResults: { existing: 'result' }
          }
        ]
      };

      const newState = migration.up(oldState) as any;

      expect(newState.checklists).toHaveLength(2);
      expect(newState.checklists[0].conditions).toBe('');
      expect(newState.checklists[0].commandResults).toEqual({});
      expect(newState.checklists[1].conditions).toBe('existing-condition');
      expect(newState.checklists[1].commandResults).toEqual({ existing: 'result' });
    });

    it('should handle null checklists', () => {
      const oldState = {
        version: '0.2.0',
        checklists: null
      };

      const newState = migration.up(oldState) as any;

      expect(newState.checklists).toBeNull();
    });

    it('should handle undefined checklists', () => {
      const oldState = {
        version: '0.2.0'
      };

      const newState = migration.up(oldState) as any;

      expect(newState.checklists).toBeUndefined();
    });

    it('should handle non-array checklists', () => {
      const oldState = {
        version: '0.2.0',
        checklists: 'not-an-array'
      };

      const newState = migration.up(oldState) as any;

      expect(newState.checklists).toBe('not-an-array');
    });

    it('should handle completedSteps edge cases', () => {
      const oldState = {
        version: '0.2.0',
        activeInstance: {
          id: 'instance-1',
          completedSteps: [
            'simple-string',
            { id: 'with-id', completedAt: '2024-01-01', result: 'skipped', notes: 'existing' },
            { someOtherField: 'value' }, // Object without standard fields
            42 // Edge case number
          ]
        }
      };

      const newState = migration.up(oldState) as any;

      const steps = newState.activeInstance.completedSteps;
      expect(steps).toHaveLength(4);

      // String conversion
      expect(steps[0].id).toBe('simple-string');
      expect(steps[0].result).toBe('success');

      // Existing fields preserved
      expect(steps[1].id).toBe('with-id');
      expect(steps[1].completedAt).toBe('2024-01-01');
      expect(steps[1].result).toBe('skipped');
      expect(steps[1].notes).toBe('existing');

      // Object without standard fields gets defaults
      expect(steps[2].someOtherField).toBe('value');
      expect(steps[2].result).toBe('success');
      expect(steps[2].notes).toBe('');

      // Number handling - the code treats non-string, non-object as object
      expect(steps[3].result).toBe('success');
      expect(steps[3].notes).toBe('');
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
        conflicts: { resolutions: [] }
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
        conflicts: { resolutions: [] }
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
        conflicts: { resolutions: [] }
      };

      const rolledBack = migration.down!(state);

      expect(rolledBack.version).toBe('0.2.0');
      expect(rolledBack.schemaVersion).toBe('0.2.0');
      expect(rolledBack.recovery).toBeUndefined();
      expect(rolledBack.conflicts).toBeUndefined();
    });

    it('should downgrade activeInstance completedSteps to simple format', () => {
      const state = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        activeInstance: {
          id: 'instance-1',
          completedSteps: [
            { id: 'step1', completedAt: '2024-01-01', result: 'success', notes: 'test' },
            { id: 'step2', completedAt: '2024-01-02', result: 'failure', notes: '' },
            { someOtherField: 'value', id: 'step3' }, // Object with id
            { someOtherField: 'value' }, // Object without id
            'string-step', // String (edge case)
            null // Null (edge case)
          ]
        }
      };

      const rolledBack = migration.down!(state) as any;

      expect(rolledBack.activeInstance.completedSteps).toHaveLength(6);
      expect(rolledBack.activeInstance.completedSteps[0]).toBe('step1'); // Object with id -> id
      expect(rolledBack.activeInstance.completedSteps[1]).toBe('step2'); // Object with id -> id
      expect(rolledBack.activeInstance.completedSteps[2]).toBe('step3'); // Object with id -> id
      expect(rolledBack.activeInstance.completedSteps[3]).toEqual({ someOtherField: 'value' }); // Object without id -> object
      expect(rolledBack.activeInstance.completedSteps[4]).toBe('string-step'); // String -> string
      expect(rolledBack.activeInstance.completedSteps[5]).toBeNull(); // Null -> null
    });

    it('should handle downgrade when activeInstance has no completedSteps', () => {
      const state = {
        version: '1.0.0',
        activeInstance: {
          id: 'instance-1'
        }
      };

      const rolledBack = migration.down!(state) as any;

      expect(rolledBack.activeInstance.id).toBe('instance-1');
      // Should not crash when completedSteps is undefined
    });

    it('should handle downgrade when activeInstance completedSteps is not array', () => {
      const state = {
        version: '1.0.0',
        activeInstance: {
          id: 'instance-1',
          completedSteps: 'not-an-array'
        }
      };

      const rolledBack = migration.down!(state) as any;

      expect(rolledBack.activeInstance.completedSteps).toBe('not-an-array');
      // Should not crash when completedSteps is not an array
    });

    it('should downgrade checklists by removing conditions and commandResults', () => {
      const state = {
        version: '1.0.0',
        checklists: [
          {
            id: 'checklist-1',
            title: 'Test Checklist',
            conditions: 'some-condition',
            commandResults: { result: 'data' },
            checksum: 'some-checksum',
            keepThis: 'value'
          },
          {
            id: 'checklist-2',
            title: 'Another Checklist',
            conditions: '',
            commandResults: {},
            otherField: 'preserve'
          }
        ]
      };

      const rolledBack = migration.down!(state) as any;

      expect(rolledBack.checklists).toHaveLength(2);
      expect(rolledBack.checklists[0].conditions).toBeUndefined();
      expect(rolledBack.checklists[0].commandResults).toBeUndefined();
      expect(rolledBack.checklists[0].checksum).toBeUndefined();
      expect(rolledBack.checklists[0].keepThis).toBe('value');

      expect(rolledBack.checklists[1].conditions).toBeUndefined();
      expect(rolledBack.checklists[1].commandResults).toBeUndefined();
      expect(rolledBack.checklists[1].otherField).toBe('preserve');
    });

    it('should handle downgrade when checklists is undefined', () => {
      const state = {
        version: '1.0.0'
      };

      const rolledBack = migration.down!(state) as any;

      expect(rolledBack.checklists).toBeUndefined();
      // Should not crash when checklists is undefined
    });

    it('should handle downgrade when checklists is not array', () => {
      const state = {
        version: '1.0.0',
        checklists: 'not-an-array'
      };

      const rolledBack = migration.down!(state) as any;

      expect(rolledBack.checklists).toBe('not-an-array');
      // Should not crash when checklists is not an array
    });

    it('should handle validation edge cases', () => {
      // Test invalid recovery field types
      expect(migration.validate!({ recovery: null, conflicts: { resolutions: [] }, version: '1.0.0', schemaVersion: '1.0.0' })).toBe(false);
      expect(migration.validate!({ recovery: 'string', conflicts: { resolutions: [] }, version: '1.0.0', schemaVersion: '1.0.0' })).toBe(false);
      expect(migration.validate!({ recovery: { enabled: true }, conflicts: { resolutions: [] }, version: '1.0.0', schemaVersion: '1.0.0' })).toBe(false); // Missing checkpoints
      expect(migration.validate!({ recovery: { checkpoints: [] }, conflicts: { resolutions: [] }, version: '1.0.0', schemaVersion: '1.0.0' })).toBe(false); // Missing enabled

      // Test invalid conflicts field types
      expect(migration.validate!({ recovery: { enabled: true, checkpoints: [] }, conflicts: null, version: '1.0.0', schemaVersion: '1.0.0' })).toBe(false);
      expect(migration.validate!({ recovery: { enabled: true, checkpoints: [] }, conflicts: 'string', version: '1.0.0', schemaVersion: '1.0.0' })).toBe(false);
      expect(migration.validate!({ recovery: { enabled: true, checkpoints: [] }, conflicts: { other: 'field' }, version: '1.0.0', schemaVersion: '1.0.0' })).toBe(false); // Missing resolutions

      // Test invalid version fields
      expect(migration.validate!({ recovery: { enabled: true, checkpoints: [] }, conflicts: { resolutions: [] }, version: '0.9.0', schemaVersion: '1.0.0' })).toBe(false);
      expect(migration.validate!({ recovery: { enabled: true, checkpoints: [] }, conflicts: { resolutions: [] }, version: '1.0.0', schemaVersion: '0.9.0' })).toBe(false);
    });
  });
});