/**
 * VariablePrompter Tests
 * Tests for variable prompting logic
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { VariablePrompter } from '../../src/variables/VariablePrompter';
import { VariableStore } from '../../src/variables/VariableStore';
import { EnvironmentVariableResolver } from '../../src/variables/EnvironmentVariableResolver';
import type { VariableDefinition } from '../../src/variables/types';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('VariablePrompter', () => {
  let prompter: VariablePrompter;
  let store: VariableStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'prompter-test-'));
    const stateFile = join(tempDir, 'test-state.yaml');
    store = new VariableStore(stateFile);
    prompter = new VariablePrompter();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Required Variable Identification', () => {
    it('should not prompt for optional variables', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'optional',
          type: 'string',
          required: false,
          description: 'Optional',
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.has('optional')).toBe(false);
    });

    it('should not prompt for variables with existing values', async () => {
      store.set('existing', 'value');

      const defs: VariableDefinition[] = [
        {
          name: 'existing',
          type: 'string',
          required: true,
          description: 'Existing',
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('existing')).toBe('value');
    });

    it('should not prompt for computed variables', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'computed',
          type: 'string',
          required: true,
          description: 'Computed',
          computed: {
            expression: '${base}',
            dependencies: ['base'],
          },
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.has('computed')).toBe(false);
    });

    it('should identify required variables that need prompting', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'required1',
          type: 'string',
          required: true,
          description: 'Required 1',
          default: 'default1',
        },
        {
          name: 'required2',
          type: 'string',
          required: true,
          description: 'Required 2',
          default: 'default2',
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('required1')).toBe('default1');
      expect(store.get('required2')).toBe('default2');
    });
  });

  describe('Default Value Handling', () => {
    it('should use default value for required variable', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'withDefault',
          type: 'string',
          required: true,
          description: 'With default',
          default: 'my-default',
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('withDefault')).toBe('my-default');
    });

    it('should use numeric default', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'port',
          type: 'number',
          required: true,
          description: 'Port',
          default: 3000,
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('port')).toBe(3000);
    });

    it('should use boolean default', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'enabled',
          type: 'boolean',
          required: true,
          description: 'Enabled',
          default: true,
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('enabled')).toBe(true);
    });

    it('should use array default', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'items',
          type: 'array',
          required: true,
          description: 'Items',
          default: ['a', 'b', 'c'],
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('items')).toEqual(['a', 'b', 'c']);
    });

    it('should throw for required variable with no default', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'noDefault',
          type: 'string',
          required: true,
          description: 'No default',
        },
      ];

      await expect(prompter.promptRequired(defs, store)).rejects.toThrow();
    });
  });

  describe('Environment Variable Defaults', () => {
    it('should resolve $ENV: default values', async () => {
      Bun.env.HOME = '/home/test';

      const defs: VariableDefinition[] = [
        {
          name: 'homeDir',
          type: 'string',
          required: true,
          description: 'Home directory',
          default: '$ENV:HOME',
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('homeDir')).toBe('/home/test');
    });

    it('should fallback to regular default if env var not found', async () => {
      delete Bun.env.NONEXISTENT;

      const defs: VariableDefinition[] = [
        {
          name: 'var',
          type: 'string',
          required: true,
          description: 'Variable',
          default: '$ENV:NONEXISTENT',
        },
      ];

      // Should use the string literal as fallback when env var not found
      await prompter.promptRequired(defs, store);

      expect(store.get('var')).toBe('$ENV:NONEXISTENT');
    });

    it('should handle blocked env var gracefully', async () => {
      Bun.env.SECRET = 'secret-value';

      const defs: VariableDefinition[] = [
        {
          name: 'secret',
          type: 'string',
          required: true,
          description: 'Secret',
          default: '$ENV:SECRET',
        },
      ];

      // Should catch the error and fall back to the literal string
      await prompter.promptRequired(defs, store);

      expect(store.get('secret')).toBe('$ENV:SECRET');
    });

    it('should use custom EnvironmentVariableResolver', async () => {
      const customResolver = new EnvironmentVariableResolver(['CUSTOM_VAR']);
      Bun.env.CUSTOM_VAR = 'custom-value';

      const customPrompter = new VariablePrompter(customResolver);

      const defs: VariableDefinition[] = [
        {
          name: 'custom',
          type: 'string',
          required: true,
          description: 'Custom',
          default: '$ENV:CUSTOM_VAR',
        },
      ];

      await customPrompter.promptRequired(defs, store);

      expect(store.get('custom')).toBe('custom-value');
    });
  });

  describe('Validation', () => {
    it('should validate default value against definition', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'invalid',
          type: 'number',
          required: true,
          description: 'Invalid',
          default: 'not-a-number' as any,
        },
      ];

      await expect(prompter.promptRequired(defs, store)).rejects.toThrow(
        'after 3 attempts'
      );
    });

    it('should validate against pattern', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'email',
          type: 'string',
          required: true,
          description: 'Email',
          default: 'valid@example.com',
          validation: {
            pattern: '^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$',
          },
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('email')).toBe('valid@example.com');
    });

    it('should reject invalid pattern', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'email',
          type: 'string',
          required: true,
          description: 'Email',
          default: 'invalid-email',
          validation: {
            pattern: '^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$',
          },
        },
      ];

      await expect(prompter.promptRequired(defs, store)).rejects.toThrow();
    });

    it('should validate min/max for numbers', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'age',
          type: 'number',
          required: true,
          description: 'Age',
          default: 25,
          validation: {
            min: 18,
            max: 100,
          },
        },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('age')).toBe(25);
    });

    it('should reject value below minimum', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'age',
          type: 'number',
          required: true,
          description: 'Age',
          default: 10,
          validation: {
            min: 18,
          },
        },
      ];

      await expect(prompter.promptRequired(defs, store)).rejects.toThrow();
    });
  });

  describe('validateValue Method', () => {
    const stringDef: VariableDefinition = {
      name: 'test',
      type: 'string',
      required: false,
      description: 'Test',
    };

    it('should return true for valid value', () => {
      expect(prompter.validateValue(stringDef, 'valid')).toBe(true);
    });

    it('should return false for invalid value', () => {
      expect(prompter.validateValue(stringDef, 123)).toBe(false);
    });

    it('should validate against pattern', () => {
      const emailDef: VariableDefinition = {
        name: 'email',
        type: 'string',
        required: false,
        description: 'Email',
        validation: {
          pattern: '^[a-z]+@[a-z]+\\.[a-z]+$',
        },
      };

      expect(prompter.validateValue(emailDef, 'user@example.com')).toBe(true);
      expect(prompter.validateValue(emailDef, 'invalid')).toBe(false);
    });

    it('should validate min/max', () => {
      const numberDef: VariableDefinition = {
        name: 'num',
        type: 'number',
        required: false,
        description: 'Number',
        validation: {
          min: 0,
          max: 10,
        },
      };

      expect(prompter.validateValue(numberDef, 5)).toBe(true);
      expect(prompter.validateValue(numberDef, -1)).toBe(false);
      expect(prompter.validateValue(numberDef, 11)).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should persist after prompting all variables', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'var1',
          type: 'string',
          required: true,
          description: 'Variable 1',
          default: 'value1',
        },
        {
          name: 'var2',
          type: 'string',
          required: true,
          description: 'Variable 2',
          default: 'value2',
        },
      ];

      await prompter.promptRequired(defs, store);

      // Create new store instance to load from file
      const newStore = new VariableStore(join(tempDir, 'test-state.yaml'));
      await newStore.load();

      expect(newStore.get('var1')).toBe('value1');
      expect(newStore.get('var2')).toBe('value2');
    });

    it('should not persist if no variables to prompt', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'optional',
          type: 'string',
          required: false,
          description: 'Optional',
        },
      ];

      await prompter.promptRequired(defs, store);

      // Create new store to verify nothing was persisted
      const newStore = new VariableStore(join(tempDir, 'test-state.yaml'));
      await newStore.load();

      expect(newStore.getAll()).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty definitions array', async () => {
      await prompter.promptRequired([], store);

      expect(store.getAll()).toEqual({});
    });

    it('should handle multiple required variables', async () => {
      const defs: VariableDefinition[] = [
        { name: 'v1', type: 'string', required: true, description: 'V1', default: '1' },
        { name: 'v2', type: 'number', required: true, description: 'V2', default: 2 },
        { name: 'v3', type: 'boolean', required: true, description: 'V3', default: true },
      ];

      await prompter.promptRequired(defs, store);

      expect(store.get('v1')).toBe('1');
      expect(store.get('v2')).toBe(2);
      expect(store.get('v3')).toBe(true);
    });

    it('should handle validation error message', async () => {
      const defs: VariableDefinition[] = [
        {
          name: 'bad',
          type: 'string',
          required: true,
          description: 'Bad variable',
          default: 123 as any,
        },
      ];

      try {
        await prompter.promptRequired(defs, store);
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect((error as Error).message).toContain('after 3 attempts');
        expect((error as Error).message).toContain('bad');
      }
    });
  });
});
