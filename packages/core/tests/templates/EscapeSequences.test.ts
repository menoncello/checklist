/**
 * Tests for Escape Sequence Handling (AC: 4)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VariableSubstitutor } from '../../src/templates/VariableSubstitutor';
import { VariableStore } from '../../src/variables/VariableStore';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('VariableSubstitutor - Escape Sequences (AC: 4)', () => {
  let variableStore: VariableStore;
  let substitutor: VariableSubstitutor;
  let tempDir: string;
  let stateFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-escape-'));
    stateFile = join(tempDir, 'variables.yaml');

    variableStore = new VariableStore(stateFile);
    substitutor = new VariableSubstitutor(variableStore);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Single escape sequences', () => {
    it('should escape variable syntax', () => {
      const result = substitutor.substitute('Literal: \\${variable}');

      expect(result.output).toBe('Literal: ${variable}');
      expect(result.variablesUsed).toHaveLength(0);
    });

    it('should escape multiple variables', () => {
      const result = substitutor.substitute(
        'Literals: \\${foo} and \\${bar}'
      );

      expect(result.output).toBe('Literals: ${foo} and ${bar}');
    });
  });

  describe('Double escape sequences', () => {
    it('should handle double escape with substitution', () => {
      variableStore.set('variable', 'value');

      // Double backslash: first \ escapes the second \, leaving \${variable}
      // The escape pattern matches \${variable}, preserving it as literal
      const result = substitutor.substitute('\\\\${variable}');

      // Result is the escaped literal
      expect(result.output).toBe('\\${variable}');
    });
  });

  describe('Mixed escaped and unescaped', () => {
    it('should handle both escaped and unescaped variables', () => {
      variableStore.set('name', 'Alice');

      const result = substitutor.substitute(
        'Hello ${name}, use \\${variable} syntax'
      );

      expect(result.output).toBe('Hello Alice, use ${variable} syntax');
      expect(result.variablesUsed).toEqual(['name']);
    });

    it('should handle complex patterns', () => {
      variableStore.set('value1', 'A');
      variableStore.set('value2', 'B');

      const result = substitutor.substitute(
        '${value1} \\${literal} ${value2} \\${another}'
      );

      expect(result.output).toBe('A ${literal} B ${another}');
      expect(result.variablesUsed).toContain('value1');
      expect(result.variablesUsed).toContain('value2');
    });
  });

  describe('Edge cases', () => {
    it('should handle consecutive escapes', () => {
      const result = substitutor.substitute(
        '\\${var1}\\${var2}\\${var3}'
      );

      expect(result.output).toBe('${var1}${var2}${var3}');
    });

    it('should handle escape at end of string', () => {
      variableStore.set('var', 'value');

      const result = substitutor.substitute('${var} \\${literal}');

      expect(result.output).toBe('value ${literal}');
    });

    it('should handle escape with default values', () => {
      const result = substitutor.substitute(
        '\\${var:-default}'
      );

      expect(result.output).toBe('${var:-default}');
    });
  });
});
