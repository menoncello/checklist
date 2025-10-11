/**
 * Tests for Clear Error Messages (AC: 6)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VariableSubstitutor } from '../../src/templates/VariableSubstitutor';
import { VariableStore } from '../../src/variables/VariableStore';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('VariableSubstitutor - Error Messages (AC: 6)', () => {
  let variableStore: VariableStore;
  let substitutor: VariableSubstitutor;
  let tempDir: string;
  let stateFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-errors-'));
    stateFile = join(tempDir, 'variables.yaml');

    variableStore = new VariableStore(stateFile);
    substitutor = new VariableSubstitutor(variableStore);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Undefined variable errors', () => {
    it('should provide clear error for undefined variables', () => {
      const result = substitutor.substitute('Value: ${missing}');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].variableName).toBe('missing');
      expect(result.errors[0].message).toContain('not defined');
    });

    it('should include variable name in error', () => {
      const result = substitutor.substitute(
        '${undefinedVar1} ${undefinedVar2}'
      );

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].variableName).toBe('undefinedVar1');
      expect(result.errors[1].variableName).toBe('undefinedVar2');
    });
  });

  describe('Fuzzy matching suggestions', () => {
    it('should suggest similar variable names', () => {
      variableStore.set('userName', 'Alice');
      variableStore.set('userEmail', 'alice@example.com');

      const result = substitutor.substitute('${userNam}');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].suggestions).toBeDefined();
      expect(result.errors[0].suggestions).toContain('userName');
    });

    it('should suggest up to 3 similar names', () => {
      variableStore.set('name1', 'a');
      variableStore.set('name2', 'b');
      variableStore.set('name3', 'c');
      variableStore.set('name4', 'd');

      const result = substitutor.substitute('${nam}');

      expect(result.errors[0].suggestions).toBeDefined();
      expect(result.errors[0].suggestions!.length).toBeLessThanOrEqual(3);
    });

    it('should only suggest close matches', () => {
      variableStore.set('totallyDifferent', 'value');

      const result = substitutor.substitute('${name}');

      expect(result.errors[0].suggestions).toBeDefined();
      expect(result.errors[0].suggestions).not.toContain(
        'totallyDifferent'
      );
    });

    it('should handle typos with transposition', () => {
      variableStore.set('config', 'value');

      const result = substitutor.substitute('${conifg}');

      expect(result.errors[0].suggestions).toContain('config');
    });

    it('should handle missing characters', () => {
      variableStore.set('database', 'value');

      const result = substitutor.substitute('${databas}');

      expect(result.errors[0].suggestions).toContain('database');
    });

    it('should handle extra characters', () => {
      variableStore.set('port', 'value');

      const result = substitutor.substitute('${portt}');

      expect(result.errors[0].suggestions).toContain('port');
    });
  });

  describe('Available variables in context', () => {
    it('should consider all available variables for suggestions', () => {
      variableStore.set('apiKey', 'key1');
      variableStore.set('apiUrl', 'url1');
      variableStore.set('apiTimeout', '5000');

      const result = substitutor.substitute('${apiKy}');

      expect(result.errors[0].suggestions).toContain('apiKey');
    });

    it('should consider step-scoped variables', () => {
      variableStore.set('global', 'globalValue');
      variableStore.set('stepVar', 'stepValue', 'step-1');

      const result = substitutor.substitute('${stepVa}', 'step-1');

      expect(result.errors[0].suggestions).toContain('stepVar');
    });
  });

  describe('Malformed syntax errors', () => {
    it('should leave invalid variable syntax as literal', () => {
      // Variables with spaces don't match the pattern and stay literal
      const result = substitutor.substitute('${invalid name}');

      // Not matched by regex, so stays as-is
      expect(result.output).toBe('${invalid name}');
      expect(result.errors).toHaveLength(0);
    });

    it('should leave special characters as literal', () => {
      // Variables with invalid characters don't match pattern
      const result = substitutor.substitute('${bad-@-name}');

      // Not matched by regex, so stays as-is
      expect(result.output).toBe('${bad-@-name}');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Error output preservation', () => {
    it('should preserve original syntax on error', () => {
      const result = substitutor.substitute('Test ${missing} value');

      expect(result.output).toBe('Test ${missing} value');
      expect(result.errors).toHaveLength(1);
    });

    it('should show multiple errors', () => {
      const result = substitutor.substitute(
        '${missing1} ${missing2} ${missing3}'
      );

      expect(result.errors).toHaveLength(3);
      expect(result.output).toContain('${missing1}');
      expect(result.output).toContain('${missing2}');
      expect(result.output).toContain('${missing3}');
    });
  });
});
