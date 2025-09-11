import { describe, test, expect } from 'bun:test';
import { validateStep } from '../src/workflow/validators';
import { StepValidation, StepContext } from '../src/workflow/types';
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('validators - edge cases and boundary conditions', () => {
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

  describe('boundary conditions', () => {
    test('handles empty string path for file_exists', async () => {
      const validation: StepValidation = {
        type: 'file_exists',
        check: '',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.error).toBeDefined();
      expect(result.error?.length).toBeGreaterThan(0);
    });

    test('handles whitespace-only path for file_exists', async () => {
      const validation: StepValidation = {
        type: 'file_exists',
        check: '   ',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.error).not.toBeNull();
    });

    test('handles very long path for file_exists', async () => {
      const longPath = '/a'.repeat(500) + '/file.txt';
      const validation: StepValidation = {
        type: 'file_exists',
        check: longPath,
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
      expect(typeof result.valid).toBe('boolean');
      expect(result.valid).not.toBe(true);
    });

    test('handles special characters in path', async () => {
      const validation: StepValidation = {
        type: 'file_exists',
        check: '/path/with/special!@#$%^&*()chars.txt',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.error).toContain('special!@#$%^&*()chars');
    });

    test('handles directory path instead of file', async () => {
      const tempDir = join(tmpdir(), 'validator-edge-test-' + Date.now());
      mkdirSync(tempDir, { recursive: true });

      const validation: StepValidation = {
        type: 'file_exists',
        check: tempDir,
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.valid).not.toBe(false);

      rmSync(tempDir, { recursive: true, force: true });
    });

    test('handles symlink to existing file', async () => {
      const tempDir = join(tmpdir(), 'validator-symlink-test-' + Date.now());
      mkdirSync(tempDir, { recursive: true });
      
      const realFile = join(tempDir, 'real.txt');
      const linkFile = join(tempDir, 'link.txt');
      
      writeFileSync(realFile, 'content');
      symlinkSync(realFile, linkFile);

      const validation: StepValidation = {
        type: 'file_exists',
        check: linkFile,
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();

      rmSync(tempDir, { recursive: true, force: true });
    });

    test('handles null as validation type', async () => {
      const validation: StepValidation = {
        type: null as any,
        check: 'test',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown validation type');
      expect(result.error).toContain('null');
      expect(result.error?.length).toBeGreaterThan(0);
    });

    test('handles undefined as validation type', async () => {
      const validation: StepValidation = {
        type: undefined as any,
        check: 'test',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown validation type');
      expect(result.valid).not.toBe(true);
    });

    test('handles numeric validation type', async () => {
      const validation: StepValidation = {
        type: 123 as any,
        check: 'test',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown validation type');
      expect(result.error).toContain('123');
    });

    test('handles empty object as context', async () => {
      const validation: StepValidation = {
        type: 'custom',
        check: 'return true;',
      };

      const emptyContext = {} as StepContext;
      const result = await validateStep(validation, emptyContext);
      expect(result.valid).toBe(true);
      expect(result.error).toBe('Custom validation not implemented in MVP');
    });

    test('handles context with null variables', async () => {
      const validation: StepValidation = {
        type: 'custom',
        check: 'return variables !== null;',
      };

      const contextWithNull: StepContext = {
        ...mockContext,
        variables: null as any,
      };

      const result = await validateStep(validation, contextWithNull);
      expect(result.valid).toBe(true);
      expect(result.error).toBe('Custom validation not implemented in MVP');
      expect(typeof result.valid).toBe('boolean');
    });

    test('handles empty custom validation code', async () => {
      const validation: StepValidation = {
        type: 'custom',
        check: '',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(true);
      expect(result.error).toBe('Custom validation not implemented in MVP');
      expect(result.valid).not.toBe(false);
    });

    test('handles very long custom validation code', async () => {
      const longCode = 'return true;'.repeat(1000);
      const validation: StepValidation = {
        type: 'custom',
        check: longCode,
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(true);
      expect(result.error).toBe('Custom validation not implemented in MVP');
    });

    test('handles command with null check', async () => {
      const validation: StepValidation = {
        type: 'command',
        check: null as any,
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Command validation is disabled for security reasons in MVP');
      expect(result.error).toContain('security');
    });

    test('handles command with empty check', async () => {
      const validation: StepValidation = {
        type: 'command',
        check: '',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Command validation is disabled for security reasons in MVP');
      expect(result.valid).not.toBe(true);
    });

    test('handles file_exists with null check', async () => {
      const validation: StepValidation = {
        type: 'file_exists',
        check: null as any,
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.error).toBeDefined();
    });

    test('handles file_exists with relative path', async () => {
      const validation: StepValidation = {
        type: 'file_exists',
        check: './relative/path/file.txt',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.error).toContain('./relative/path/file.txt');
    });

    test('handles file_exists with home directory path', async () => {
      const validation: StepValidation = {
        type: 'file_exists',
        check: '~/nonexistent/file.txt',
      };

      const result = await validateStep(validation, mockContext);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.error?.length).toBeGreaterThan(0);
    });
  });
});