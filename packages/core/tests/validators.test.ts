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

    test('validates command successfully', async () => {
      const validation: StepValidation = {
        type: 'command',
        check: 'echo "test"',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(true);
    });

    test('fails on invalid command', async () => {
      const validation: StepValidation = {
        type: 'command',
        check: 'nonexistentcommand123456',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
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
    });

    test('validates custom validation successfully', async () => {
      const validation: StepValidation = {
        type: 'custom',
        check: 'return true;',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(true);
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
    });
  });
});