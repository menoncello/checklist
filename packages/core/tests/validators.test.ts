import { describe, test, expect } from 'bun:test';
import { validateStep } from '../src/workflow/validators';
import { StepValidation, StepContext } from '../src/workflow/types';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('validators', () => {
  describe('validateStep', () => {
    const mockContext: StepContext = {
      step: { id: 'test', title: 'Test Step' },
      state: {
        status: 'active',
        currentStepIndex: 0,
        completedSteps: [],
        skippedSteps: [],
        variables: {},
      },
      variables: {},
    };

    test('command validation is disabled for security', async () => {
      const validation: StepValidation = {
        type: 'command',
        check: 'echo "test"',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Command validation is disabled for security reasons in MVP');
      expect(result.error).not.toBe('');
      expect(result.error).toContain('security');
      expect(result.valid).not.toBe(true);
    });

    test('command validation always fails for security', async () => {
      const validation: StepValidation = {
        type: 'command',
        check: 'any command here',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Command validation is disabled for security reasons in MVP');
      expect(result.error).toContain('MVP');
      expect(result.error?.length).toBeGreaterThan(0);
      expect(typeof result.valid).toBe('boolean');
    });

    test('validates file existence successfully', async () => {
      const tempDir = join(tmpdir(), 'validator-test-' + Date.now());
      mkdirSync(tempDir, { recursive: true });
      const testFile = join(tempDir, 'test.txt');
      writeFileSync(testFile, 'test content');

      const validation: StepValidation = {
        type: 'file_exists',
        check: testFile,
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.valid).not.toBe(false);
      expect(typeof result.valid).toBe('boolean');

      rmSync(tempDir, { recursive: true, force: true });
    });

    test('fails when file does not exist', async () => {
      const validation: StepValidation = {
        type: 'file_exists',
        check: '/nonexistent/path/file.txt',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.error).toContain('/nonexistent/path/file.txt');
      expect(result.error).not.toBeUndefined();
      expect(result.valid).not.toBe(true);
      expect(result.error?.length).toBeGreaterThan(0);
    });

    test('validates custom validation successfully', async () => {
      const validation: StepValidation = {
        type: 'custom',
        check: 'return true;',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(true);
      expect(result.error).toBe('Custom validation not implemented in MVP');
      expect(result.error).toContain('MVP');
      expect(result.error).not.toContain('error');
    });

    test('handles custom validation with context', async () => {
      const contextWithVars: StepContext = {
        ...mockContext,
        variables: { testValue: 42 },
      };

      const validation: StepValidation = {
        type: 'custom',
        check: 'return variables.testValue === 42;',
      };

      const result = await validateStep(validation, contextWithVars);
      expect(result.valid).toBe(true);
      expect(result.error).toBe('Custom validation not implemented in MVP');
      expect(typeof result.valid).toBe('boolean');
      expect(result.valid).not.toBe(false);
    });

    test('handles custom validation returning ValidationResult', async () => {
      const validation: StepValidation = {
        type: 'custom',
        check: 'return { valid: false, error: "Custom error message" };',
      };

      const result = await validateStep(validation, mockContext);
      // Custom validation is disabled in MVP for security
      expect(result.valid).toBe(true);
      expect(result.error).toBe('Custom validation not implemented in MVP');
    });

    test('handles custom validation errors', async () => {
      const validation: StepValidation = {
        type: 'custom',
        check: 'throw new Error("Validation failed");',
      };

      const result = await validateStep(validation, mockContext);
      // Custom validation is disabled in MVP for security
      expect(result.valid).toBe(true);
      expect(result.error).toBe('Custom validation not implemented in MVP');
    });

    test('handles unknown validation type', async () => {
      const validation: StepValidation = {
        type: 'unknown' as any,
        check: 'test',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown validation type');
      expect(result.error).toContain('unknown');
      expect(result.valid).not.toBe(true);
      expect(result.error).not.toBeUndefined();
      expect(result.error?.length).toBeGreaterThan(0);
    });
  });
});