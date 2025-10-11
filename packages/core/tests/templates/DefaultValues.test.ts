/**
 * Tests for Default Value Fallback (AC: 3)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VariableSubstitutor } from '../../src/templates/VariableSubstitutor';
import { VariableStore } from '../../src/variables/VariableStore';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('VariableSubstitutor - Default Values (AC: 3)', () => {
  let variableStore: VariableStore;
  let substitutor: VariableSubstitutor;
  let tempDir: string;
  let stateFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-defaults-'));
    stateFile = join(tempDir, 'variables.yaml');

    variableStore = new VariableStore(stateFile);
    substitutor = new VariableSubstitutor(variableStore);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic default values', () => {
    it('should use default when variable is undefined', () => {
      const result = substitutor.substitute(
        'Environment: ${env:-development}'
      );

      expect(result.output).toBe('Environment: development');
    });

    it('should not use default when variable is defined', () => {
      variableStore.set('env', 'production');

      const result = substitutor.substitute(
        'Environment: ${env:-development}'
      );

      expect(result.output).toBe('Environment: production');
    });

    it('should handle multiple defaults', () => {
      variableStore.set('host', 'localhost');

      const result = substitutor.substitute(
        'Server: ${host:-localhost}:${port:-3000}'
      );

      expect(result.output).toBe('Server: localhost:3000');
    });
  });

  describe('Empty string vs undefined', () => {
    it('should not trigger default for empty string', () => {
      variableStore.set('name', '');

      const result = substitutor.substitute('Name: ${name:-default}');

      expect(result.output).toBe('Name: ');
    });

    it('should not trigger default for zero', () => {
      variableStore.set('count', 0);

      const result = substitutor.substitute('Count: ${count:-10}');

      expect(result.output).toBe('Count: 0');
    });

    it('should not trigger default for false', () => {
      variableStore.set('flag', false);

      const result = substitutor.substitute('Flag: ${flag:-true}');

      expect(result.output).toBe('Flag: false');
    });
  });

  describe('Special characters in defaults', () => {
    it('should handle spaces in default values', () => {
      const result = substitutor.substitute(
        'Message: ${msg:-Hello World}'
      );

      expect(result.output).toBe('Message: Hello World');
    });

    it('should handle URLs in default values', () => {
      const result = substitutor.substitute(
        'API: ${api:-https://api.example.com/v1}'
      );

      expect(result.output).toBe('API: https://api.example.com/v1');
    });

    it('should handle paths in default values', () => {
      const result = substitutor.substitute(
        'Path: ${path:-/usr/local/bin}'
      );

      expect(result.output).toBe('Path: /usr/local/bin');
    });
  });

  describe('Nested variables in defaults', () => {
    it('should support nested variables in defaults', () => {
      variableStore.set('fallback', 'backup-value');

      const result = substitutor.substitute(
        'Value: ${primary:-${fallback}}'
      );

      expect(result.output).toBe('Value: backup-value');
    });

    it('should cascade through nested defaults', () => {
      variableStore.set('tertiary', 'final-value');

      const result = substitutor.substitute(
        'Value: ${primary:-${secondary:-${tertiary}}}'
      );

      expect(result.output).toBe('Value: final-value');
    });
  });

  describe('Configuration options', () => {
    it('should respect useDefaultValues config', () => {
      const noDefaultsSubstitutor = new VariableSubstitutor(
        variableStore,
        {
          useDefaultValues: false,
          allowUndefinedVariables: true,
        }
      );

      const result = noDefaultsSubstitutor.substitute(
        'Value: ${missing:-default}'
      );

      expect(result.output).toBe('Value: ');
    });
  });
});
