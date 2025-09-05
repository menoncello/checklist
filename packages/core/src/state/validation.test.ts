import { describe, it, expect, beforeEach } from 'vitest';
import { StateValidator } from './validation';
import { ChecklistState } from './types';
import { StateCorruptedError } from './errors';

describe('StateValidator', () => {
  let validator: StateValidator;
  let validState: ChecklistState;

  beforeEach(() => {
    validator = new StateValidator();
    validState = {
      schemaVersion: '1.0.0',
      checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      activeInstance: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        templateId: 'test-template',
        templateVersion: '1.0.0',
        projectPath: '/test/path',
        status: 'active',
        currentStepId: 'step-1',
        startedAt: '2025-01-01T00:00:00Z',
        lastModifiedAt: '2025-01-01T00:00:00Z',
      },
      completedSteps: [],
      recovery: {
        dataLoss: false,
      },
      conflicts: {},
    };
  });

  describe('Schema Validation', () => {
    it('should validate a correct state', async () => {
      const result = await validator.validateStateSchema(validState);
      expect(result).toEqual(validState);
    });

    it('should reject state with missing required fields', async () => {
      const invalidState = {
        schemaVersion: '1.0.0',
      };

      await expect(validator.validateStateSchema(invalidState)).rejects.toThrow(
        StateCorruptedError
      );
    });

    it('should reject state with invalid schema version format', async () => {
      const invalidState = {
        ...validState,
        schemaVersion: 'invalid',
      };

      await expect(validator.validateStateSchema(invalidState)).rejects.toThrow(
        StateCorruptedError
      );
    });

    it('should reject state with invalid status', async () => {
      const invalidState = {
        ...validState,
        activeInstance: {
          ...validState.activeInstance!,
          status: 'invalid' as unknown as 'active' | 'paused' | 'completed' | 'failed',
        },
      };

      await expect(validator.validateStateSchema(invalidState)).rejects.toThrow(
        StateCorruptedError
      );
    });

    it('should accept state without activeInstance', async () => {
      const stateWithoutInstance = {
        ...validState,
        activeInstance: undefined,
      };

      const result = await validator.validateStateSchema(stateWithoutInstance);
      expect(result.activeInstance).toBeUndefined();
    });

    it('should validate completed steps', async () => {
      const stateWithSteps = {
        ...validState,
        completedSteps: [
          {
            stepId: 'step-1',
            completedAt: '2025-01-01T00:00:00Z',
            executionTime: 1234,
            result: 'success' as const,
            commandResults: [
              {
                command: 'test',
                exitCode: 0,
                stdout: 'output',
                stderr: '',
                duration: 100,
              },
            ],
          },
        ],
      };

      const result = await validator.validateStateSchema(stateWithSteps);
      expect(result.completedSteps).toHaveLength(1);
    });
  });

  describe('Checksum Validation', () => {
    it('should calculate checksum correctly', () => {
      const checksum = validator.calculateChecksum(validState);
      expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should verify valid checksum', async () => {
      const checksum = validator.calculateChecksum(validState);
      const stateWithChecksum = {
        ...validState,
        checksum,
      };

      await expect(validator.verifyChecksum(stateWithChecksum)).resolves.toBeUndefined();
    });

    it('should reject invalid checksum', async () => {
      const stateWithBadChecksum = {
        ...validState,
        checksum: 'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      };

      await expect(validator.verifyChecksum(stateWithBadChecksum)).rejects.toThrow(
        StateCorruptedError
      );
    });

    it('should produce different checksums for different states', () => {
      const checksum1 = validator.calculateChecksum(validState);
      const modifiedState = {
        ...validState,
        activeInstance: {
          ...validState.activeInstance!,
          status: 'paused' as const,
        },
      };
      const checksum2 = validator.calculateChecksum(modifiedState);

      expect(checksum1).not.toEqual(checksum2);
    });
  });

  describe('Full Validation', () => {
    it('should validate state with schema and checksum', async () => {
      const checksum = validator.calculateChecksum(validState);
      const completeState = {
        ...validState,
        checksum,
      };

      const result = await validator.validate(completeState);
      expect(result).toEqual(completeState);
    });

    it('should skip checksum validation for initial state', async () => {
      const result = await validator.validate(validState);
      expect(result).toEqual(validState);
    });

    it('should detect corrupted state', async () => {
      const stateWithBadData = {
        ...validState,
        checksum: 'sha256:badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb',
      };

      await expect(validator.validate(stateWithBadData)).rejects.toThrow(
        StateCorruptedError
      );
    });
  });

  describe('Version Management', () => {
    it('should validate supported schema versions', () => {
      const supported = ['1.0.0', '1.1.0', '2.0.0'];
      
      expect(validator.isValidSchemaVersion('1.0.0', supported)).toBe(true);
      expect(validator.isValidSchemaVersion('1.1.0', supported)).toBe(true);
      expect(validator.isValidSchemaVersion('3.0.0', supported)).toBe(false);
    });

    it('should determine migration compatibility', () => {
      expect(validator.canMigrate('1.0.0', '1.1.0')).toBe(true);
      expect(validator.canMigrate('1.2.0', '2.0.0')).toBe(true);
      expect(validator.canMigrate('1.0.0', '3.0.0')).toBe(false);
    });
  });
});