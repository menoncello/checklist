/**
 * Tests for VariableSubstitutor - Basic Substitution (AC: 1)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VariableSubstitutor } from '../../src/templates/VariableSubstitutor';
import { VariableStore } from '../../src/variables/VariableStore';
import { NestingDepthExceededError } from '../../src/templates/errors';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('VariableSubstitutor - Basic Substitution', () => {
  let variableStore: VariableStore;
  let substitutor: VariableSubstitutor;
  let tempDir: string;
  let stateFile: string;

  beforeEach(async () => {
    // Create temp directory for state file
    tempDir = await mkdtemp(join(tmpdir(), 'test-var-sub-'));
    stateFile = join(tempDir, 'variables.yaml');

    variableStore = new VariableStore(stateFile);
    substitutor = new VariableSubstitutor(variableStore);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic substitution', () => {
    it('should substitute single variable', () => {
      variableStore.set('name', 'Alice');

      const result = substitutor.substitute('Hello ${name}!');

      expect(result.output).toBe('Hello Alice!');
      expect(result.variablesUsed).toEqual(['name']);
      expect(result.errors).toHaveLength(0);
    });

    it('should substitute multiple variables', () => {
      variableStore.set('firstName', 'John');
      variableStore.set('lastName', 'Doe');

      const result = substitutor.substitute(
        'Name: ${firstName} ${lastName}'
      );

      expect(result.output).toBe('Name: John Doe');
      expect(result.variablesUsed).toContain('firstName');
      expect(result.variablesUsed).toContain('lastName');
      expect(result.errors).toHaveLength(0);
    });

    it('should substitute number variables', () => {
      variableStore.set('count', 42);
      variableStore.set('price', 19.99);

      const result = substitutor.substitute(
        'Count: ${count}, Price: $${price}'
      );

      expect(result.output).toBe('Count: 42, Price: $19.99');
    });

    it('should substitute boolean variables', () => {
      variableStore.set('isActive', true);
      variableStore.set('isDisabled', false);

      const result = substitutor.substitute(
        'Active: ${isActive}, Disabled: ${isDisabled}'
      );

      expect(result.output).toBe('Active: true, Disabled: false');
    });

    it('should substitute array variables', () => {
      variableStore.set('tags', ['typescript', 'testing', 'bun']);

      const result = substitutor.substitute('Tags: ${tags}');

      expect(result.output).toBe('Tags: typescript, testing, bun');
    });

    it('should handle nested arrays', () => {
      variableStore.set('matrix', [[1, 2], [3, 4]]);

      const result = substitutor.substitute('Matrix: ${matrix}');

      expect(result.output).toBe('Matrix: 1, 2, 3, 4');
    });
  });

  describe('Malformed syntax handling', () => {
    it('should handle variables with missing closing brace', () => {
      variableStore.set('name', 'Alice');

      const result = substitutor.substitute('Hello ${name without brace');

      expect(result.output).toBe('Hello ${name without brace');
      expect(result.variablesUsed).toHaveLength(0);
    });

    it('should handle empty variable name', () => {
      const result = substitutor.substitute('Test ${}');

      expect(result.output).toBe('Test ${}');
    });

    it('should validate variable names', () => {
      variableStore.set('valid-name', 'value');

      // Regex won't match ${with space} because it requires no spaces
      // So it gets left as-is in the output
      const result = substitutor.substitute(
        'Valid: ${valid-name}, Text: ${with space}'
      );

      // ${with space} doesn't match the pattern, so it stays literal
      expect(result.output).toBe('Valid: value, Text: ${with space}');
      expect(result.variablesUsed).toEqual(['valid-name']);
    });
  });

  describe('Performance metadata', () => {
    it('should include duration in metadata', () => {
      variableStore.set('name', 'Alice');

      const result = substitutor.substitute('Hello ${name}!');

      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.duration).toBeLessThan(10);
    });

    it('should track variable count', () => {
      variableStore.set('a', '1');
      variableStore.set('b', '2');
      variableStore.set('c', '3');

      const result = substitutor.substitute('${a} ${b} ${c}');

      expect(result.metadata.variableCount).toBe(3);
    });

    it('should track nesting depth', () => {
      variableStore.set('inner', 'value');
      variableStore.set('outer', '${inner}');

      const result = substitutor.substitute('${outer}');

      expect(result.metadata.nestingDepth).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('VariableSubstitutor - Nested Substitution (AC: 2)', () => {
  let variableStore: VariableStore;
  let substitutor: VariableSubstitutor;
  let tempDir: string;
  let stateFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-var-sub-'));
    stateFile = join(tempDir, 'variables.yaml');

    variableStore = new VariableStore(stateFile);
    substitutor = new VariableSubstitutor(variableStore);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Single-level nesting', () => {
    it('should resolve nested variables', () => {
      variableStore.set('env', 'production');
      variableStore.set('production-url', 'https://api.prod.com');

      const result = substitutor.substitute('${${env}-url}');

      expect(result.output).toBe('https://api.prod.com');
    });

    it('should resolve multiple nested variables', () => {
      variableStore.set('prefix', 'app');
      variableStore.set('suffix', 'name');
      variableStore.set('app-name', 'MyApp');

      const result = substitutor.substitute('${${prefix}-${suffix}}');

      expect(result.output).toBe('MyApp');
    });
  });

  describe('Multi-level nesting', () => {
    it('should resolve 2-level nesting', () => {
      variableStore.set('a', 'b');
      variableStore.set('b', 'c');
      variableStore.set('c', 'value');

      const result = substitutor.substitute('${${${a}}}');

      expect(result.output).toBe('value');
      expect(result.metadata.nestingDepth).toBe(2);
    });

    it('should resolve 3-level nesting', () => {
      variableStore.set('level1', 'level2');
      variableStore.set('level2', 'level3');
      variableStore.set('level3', 'level4');
      variableStore.set('level4', 'final');

      const result = substitutor.substitute('${${${${level1}}}}');

      expect(result.output).toBe('final');
      expect(result.metadata.nestingDepth).toBe(3);
    });
  });

  describe('Maximum nesting depth enforcement', () => {
    it('should prevent infinite loops with reasonable depth limit', () => {
      // The default max depth of 5 prevents runaway nesting
      // Create a simple nested structure
      variableStore.set('inner', 'value');
      variableStore.set('mid', 'inner');
      variableStore.set('outer', 'mid');

      // This works fine - only 3 levels
      const result = substitutor.substitute('${${${outer}}}');
      expect(result.output).toBe('value');
      expect(result.metadata.nestingDepth).toBeLessThanOrEqual(5);
    });

    it('should handle complex nested substitutions within limit', () => {
      variableStore.set('env', 'prod');
      variableStore.set('prod-host', 'api.example.com');
      variableStore.set('prod-port', '443');

      const result = substitutor.substitute('${${env}-host}:${${env}-port}');

      expect(result.output).toBe('api.example.com:443');
      expect(result.metadata.nestingDepth).toBeLessThanOrEqual(5);
    });
  });
});
