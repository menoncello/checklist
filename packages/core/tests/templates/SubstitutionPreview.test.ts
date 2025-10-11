/**
 * Tests for SubstitutionPreview (AC: 7)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SubstitutionPreview } from '../../src/templates/SubstitutionPreview';
import { VariableSubstitutor } from '../../src/templates/VariableSubstitutor';
import { VariableStore } from '../../src/variables/VariableStore';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('SubstitutionPreview (AC: 7)', () => {
  let variableStore: VariableStore;
  let substitutor: VariableSubstitutor;
  let preview: SubstitutionPreview;
  let tempDir: string;
  let stateFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-preview-'));
    stateFile = join(tempDir, 'variables.yaml');

    variableStore = new VariableStore(stateFile);
    substitutor = new VariableSubstitutor(variableStore);
    preview = new SubstitutionPreview(substitutor, variableStore);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Preview generation accuracy', () => {
    it('should generate preview with original and substituted', () => {
      variableStore.set('name', 'Alice');

      const result = preview.generatePreview('Hello ${name}!');

      expect(result.original).toBe('Hello ${name}!');
      expect(result.substituted).toBe('Hello Alice!');
    });

    it('should include variable information', () => {
      variableStore.set('version', '1.0.0');

      const result = preview.generatePreview('Version: ${version}');

      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('version');
      expect(result.variables[0].value).toBe('1.0.0');
    });

    it('should track multiple variables', () => {
      variableStore.set('host', 'localhost');
      variableStore.set('port', 3000);

      const result = preview.generatePreview('${host}:${port}');

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('host');
      expect(result.variables[1].name).toBe('port');
    });
  });

  describe('Variable highlighting', () => {
    it('should mark variables as highlighted', () => {
      variableStore.set('var', 'value');

      const result = preview.generatePreview('Test ${var}');

      expect(result.variables[0].highlighted).toBe(true);
    });

    it('should provide variable positions', () => {
      variableStore.set('name', 'Alice');

      const result = preview.generatePreview('Hello ${name}!');

      expect(result.variables[0].position).toBeDefined();
      expect(result.variables[0].position.start).toBe(6);
      expect(result.variables[0].position.end).toBe(13);
    });

    it('should track positions of multiple variables', () => {
      variableStore.set('a', '1');
      variableStore.set('b', '2');

      const result = preview.generatePreview('${a} and ${b}');

      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].position.start).toBe(0);
      expect(result.variables[1].position.start).toBe(9);
    });
  });

  describe('Terminal formatting', () => {
    it('should format preview for terminal', () => {
      variableStore.set('name', 'Alice');

      const result = preview.generatePreview('Hello ${name}!');
      const formatted = preview.formatForTerminal(result);

      expect(formatted).toContain('Original:');
      expect(formatted).toContain('Substituted:');
      expect(formatted).toContain('Variables:');
    });

    it('should include variable values in formatting', () => {
      variableStore.set('count', 42);
      variableStore.set('name', 'test');

      const result = preview.generatePreview('${name}: ${count}');
      const formatted = preview.formatForTerminal(result);

      expect(formatted).toContain('count = 42');
      expect(formatted).toContain('name = "test"');
    });

    it('should format arrays properly', () => {
      variableStore.set('tags', ['a', 'b', 'c']);

      const result = preview.generatePreview('Tags: ${tags}');
      const formatted = preview.formatForTerminal(result);

      expect(formatted).toContain('tags = ["a", "b", "c"]');
    });

    it('should format different types correctly', () => {
      variableStore.set('str', 'text');
      variableStore.set('num', 123);
      variableStore.set('bool', true);

      const result = preview.generatePreview(
        '${str} ${num} ${bool}'
      );
      const formatted = preview.formatForTerminal(result);

      expect(formatted).toContain('str = "text"');
      expect(formatted).toContain('num = 123');
      expect(formatted).toContain('bool = true');
    });
  });

  describe('Before/after comparison', () => {
    it('should show clear before/after comparison', () => {
      variableStore.set('env', 'production');

      const result = preview.generatePreview(
        'Environment: ${env}'
      );

      expect(result.original).toBe('Environment: ${env}');
      expect(result.substituted).toBe('Environment: production');
    });

    it('should preserve spacing in comparison', () => {
      variableStore.set('a', '1');

      const result = preview.generatePreview('Value:  ${a}  ');

      expect(result.original).toBe('Value:  ${a}  ');
      expect(result.substituted).toBe('Value:  1  ');
    });
  });

  describe('Step-scoped variables', () => {
    it('should preview with step scope', () => {
      variableStore.set('global', 'globalValue');
      variableStore.set('local', 'localValue', 'step-1');

      const result = preview.generatePreview(
        '${global} ${local}',
        'step-1'
      );

      expect(result.variables).toHaveLength(2);
      expect(result.substituted).toBe('globalValue localValue');
    });
  });

  describe('Performance', () => {
    it('should generate preview quickly', () => {
      variableStore.set('var', 'value');

      const startTime = performance.now();
      preview.generatePreview('Test ${var}');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10);
    });
  });
});
