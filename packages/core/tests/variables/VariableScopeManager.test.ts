/**
 * VariableScopeManager Tests
 * Tests for variable scope management and inheritance
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { VariableScopeManager } from '../../src/variables/VariableScopeManager';
import { VariableStore } from '../../src/variables/VariableStore';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('VariableScopeManager', () => {
  let scopeManager: VariableScopeManager;
  let store: VariableStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'scope-test-'));
    const stateFile = join(tempDir, 'test-state.yaml');
    store = new VariableStore(stateFile);
    scopeManager = new VariableScopeManager(store);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Global Scope Resolution', () => {
    it('should resolve variable from global scope', () => {
      scopeManager.setGlobal('globalVar', 'global-value');

      const result = scopeManager.resolve('globalVar');

      expect(result).toBe('global-value');
    });

    it('should return undefined for non-existent global variable', () => {
      const result = scopeManager.resolve('nonExistent');

      expect(result).toBeUndefined();
    });

    it('should resolve global variable when no stepId provided', () => {
      scopeManager.setGlobal('setting', 'global-setting');

      const result = scopeManager.resolve('setting', undefined);

      expect(result).toBe('global-setting');
    });
  });

  describe('Step Scope Resolution', () => {
    it('should resolve variable from step scope', () => {
      scopeManager.setStep('step1', 'stepVar', 'step-value');

      const result = scopeManager.resolve('stepVar', 'step1');

      expect(result).toBe('step-value');
    });

    it('should return undefined for non-existent step variable', () => {
      const result = scopeManager.resolve('nonExistent', 'step1');

      expect(result).toBeUndefined();
    });

    it('should resolve different values for different steps', () => {
      scopeManager.setStep('step1', 'var', 'value1');
      scopeManager.setStep('step2', 'var', 'value2');

      expect(scopeManager.resolve('var', 'step1')).toBe('value1');
      expect(scopeManager.resolve('var', 'step2')).toBe('value2');
    });
  });

  describe('Scope Priority (Step overrides Global)', () => {
    it('should prioritize step scope over global', () => {
      scopeManager.setGlobal('var', 'global');
      scopeManager.setStep('step1', 'var', 'step');

      const result = scopeManager.resolve('var', 'step1');

      expect(result).toBe('step');
    });

    it('should fall back to global if not in step scope', () => {
      scopeManager.setGlobal('var', 'global');

      const result = scopeManager.resolve('var', 'step1');

      expect(result).toBe('global');
    });

    it('should resolve from global when step is empty string', () => {
      scopeManager.setGlobal('var', 'global');

      const result = scopeManager.resolve('var', '');

      expect(result).toBe('global');
    });
  });

  describe('Step Hierarchy and Inheritance', () => {
    it('should resolve from parent step', () => {
      scopeManager.setStep('parent', 'parentVar', 'parent-value');
      scopeManager.setParentStep('child', 'parent');

      const result = scopeManager.resolve('parentVar', 'child');

      expect(result).toBe('parent-value');
    });

    it('should override parent value in child step', () => {
      scopeManager.setStep('parent', 'var', 'parent-value');
      scopeManager.setStep('child', 'var', 'child-value');
      scopeManager.setParentStep('child', 'parent');

      const result = scopeManager.resolve('var', 'child');

      expect(result).toBe('child-value');
    });

    it('should resolve through multi-level hierarchy', () => {
      scopeManager.setStep('grandparent', 'var', 'gp-value');
      scopeManager.setParentStep('parent', 'grandparent');
      scopeManager.setParentStep('child', 'parent');

      const result = scopeManager.resolve('var', 'child');

      expect(result).toBe('gp-value');
    });

    it('should prioritize closer ancestors', () => {
      scopeManager.setStep('grandparent', 'var', 'gp-value');
      scopeManager.setStep('parent', 'var', 'p-value');
      scopeManager.setParentStep('parent', 'grandparent');
      scopeManager.setParentStep('child', 'parent');

      const result = scopeManager.resolve('var', 'child');

      expect(result).toBe('p-value');
    });

    it('should fall back to global from hierarchy', () => {
      scopeManager.setGlobal('var', 'global-value');
      scopeManager.setParentStep('child', 'parent');

      const result = scopeManager.resolve('var', 'child');

      expect(result).toBe('global-value');
    });
  });

  describe('resolveAll Method', () => {
    it('should return all global variables', () => {
      scopeManager.setGlobal('var1', 'value1');
      scopeManager.setGlobal('var2', 'value2');

      const result = scopeManager.resolveAll();

      expect(result.var1).toBe('value1');
      expect(result.var2).toBe('value2');
      expect(Object.keys(result).length).toBe(2);
    });

    it('should merge global and step variables', () => {
      scopeManager.setGlobal('global', 'g-value');
      scopeManager.setStep('step1', 'step', 's-value');

      const result = scopeManager.resolveAll('step1');

      expect(result.global).toBe('g-value');
      expect(result.step).toBe('s-value');
    });

    it('should override global with step values', () => {
      scopeManager.setGlobal('var', 'global');
      scopeManager.setStep('step1', 'var', 'step');

      const result = scopeManager.resolveAll('step1');

      expect(result.var).toBe('step');
    });

    it('should include parent step variables in hierarchy', () => {
      scopeManager.setGlobal('g', 'global');
      scopeManager.setStep('parent', 'p', 'parent');
      scopeManager.setStep('child', 'c', 'child');
      scopeManager.setParentStep('child', 'parent');

      const result = scopeManager.resolveAll('child');

      expect(result.g).toBe('global');
      expect(result.p).toBe('parent');
      expect(result.c).toBe('child');
    });

    it('should apply overrides in correct order', () => {
      scopeManager.setGlobal('var', 'global');
      scopeManager.setStep('parent', 'var', 'parent');
      scopeManager.setStep('child', 'var', 'child');
      scopeManager.setParentStep('child', 'parent');

      const result = scopeManager.resolveAll('child');

      expect(result.var).toBe('child');
    });

    it('should handle empty step ID', () => {
      scopeManager.setGlobal('var', 'value');

      const result = scopeManager.resolveAll('');

      expect(result.var).toBe('value');
    });
  });

  describe('Parent Step Management', () => {
    it('should set parent step relationship', () => {
      scopeManager.setParentStep('child', 'parent');

      const parent = scopeManager.getParentStep('child');

      expect(parent).toBe('parent');
    });

    it('should return undefined for step with no parent', () => {
      const parent = scopeManager.getParentStep('orphan');

      expect(parent).toBeUndefined();
    });

    it('should clear hierarchy', () => {
      scopeManager.setParentStep('child', 'parent');
      scopeManager.clearHierarchy();

      const parent = scopeManager.getParentStep('child');

      expect(parent).toBeUndefined();
    });

    it('should handle updating parent relationship', () => {
      scopeManager.setParentStep('child', 'parent1');
      scopeManager.setParentStep('child', 'parent2');

      const parent = scopeManager.getParentStep('child');

      expect(parent).toBe('parent2');
    });
  });

  describe('has Method', () => {
    it('should return true for existing global variable', () => {
      scopeManager.setGlobal('var', 'value');

      expect(scopeManager.has('var')).toBe(true);
    });

    it('should return false for non-existent variable', () => {
      expect(scopeManager.has('nonExistent')).toBe(false);
    });

    it('should return true for step variable', () => {
      scopeManager.setStep('step1', 'var', 'value');

      expect(scopeManager.has('var', 'step1')).toBe(true);
    });

    it('should return true when variable exists in parent', () => {
      scopeManager.setStep('parent', 'var', 'value');
      scopeManager.setParentStep('child', 'parent');

      expect(scopeManager.has('var', 'child')).toBe(true);
    });

    it('should return true when variable exists in global', () => {
      scopeManager.setGlobal('var', 'value');

      expect(scopeManager.has('var', 'anyStep')).toBe(true);
    });
  });

  describe('Hierarchy Depth Protection', () => {
    it('should prevent infinite loops in hierarchy', () => {
      // Create circular reference
      scopeManager.setParentStep('step1', 'step2');
      scopeManager.setParentStep('step2', 'step1');
      scopeManager.setStep('step1', 'var', 'value');

      // Should not hang (protected by depth limit)
      const result = scopeManager.resolveAll('step1');

      expect(result).toBeDefined();
    });

    it('should handle very deep hierarchy (100 levels)', () => {
      // Create a 100-level hierarchy
      for (let i = 1; i < 100; i++) {
        scopeManager.setParentStep(`step${i}`, `step${i + 1}`);
      }
      scopeManager.setStep('step100', 'deepVar', 'deep-value');

      // Should reach the top
      const result = scopeManager.resolve('deepVar', 'step1');

      expect(result).toBe('deep-value');
    });

    it('should break at 100 steps to prevent hanging', () => {
      // Create a 150-level hierarchy
      for (let i = 1; i < 150; i++) {
        scopeManager.setParentStep(`step${i}`, `step${i + 1}`);
      }
      scopeManager.setStep('step150', 'farVar', 'far-value');

      // Should stop at 100 steps
      const result = scopeManager.resolveAll('step1');

      // The depth limit should prevent reaching step150
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined stepId', () => {
      scopeManager.setGlobal('var', 'value');

      const result = scopeManager.resolve('var', undefined);

      expect(result).toBe('value');
    });

    it('should handle empty string stepId', () => {
      scopeManager.setGlobal('var', 'value');

      const result = scopeManager.resolve('var', '');

      expect(result).toBe('value');
    });

    it('should handle empty string as parent', () => {
      scopeManager.setParentStep('child', '');
      scopeManager.setGlobal('var', 'value');

      const result = scopeManager.resolve('var', 'child');

      expect(result).toBe('value');
    });

    it('should handle numeric values', () => {
      scopeManager.setGlobal('num', 42);

      expect(scopeManager.resolve('num')).toBe(42);
    });

    it('should handle boolean values', () => {
      scopeManager.setGlobal('flag', true);

      expect(scopeManager.resolve('flag')).toBe(true);
    });

    it('should handle array values', () => {
      scopeManager.setGlobal('arr', [1, 2, 3]);

      const result = scopeManager.resolve('arr');

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle multiple variables in same step', () => {
      scopeManager.setStep('step1', 'var1', 'value1');
      scopeManager.setStep('step1', 'var2', 'value2');
      scopeManager.setStep('step1', 'var3', 'value3');

      expect(scopeManager.resolve('var1', 'step1')).toBe('value1');
      expect(scopeManager.resolve('var2', 'step1')).toBe('value2');
      expect(scopeManager.resolve('var3', 'step1')).toBe('value3');
    });
  });

  describe('getStore Method', () => {
    it('should return underlying VariableStore', () => {
      const returnedStore = scopeManager.getStore();

      expect(returnedStore).toBe(store);
    });

    it('should allow direct store access', () => {
      const returnedStore = scopeManager.getStore();
      returnedStore.set('direct', 'value');

      const result = scopeManager.resolve('direct');

      expect(result).toBe('value');
    });
  });

  describe('Complex Scenarios', () => {
    it('should resolve from 3-level hierarchy', () => {
      // Setup: grandparent -> parent -> child
      scopeManager.setStep('grandparent', 'gp', 'gp-value');
      scopeManager.setParentStep('parent', 'grandparent');
      scopeManager.setStep('parent', 'p', 'p-value');
      scopeManager.setParentStep('child', 'parent');
      scopeManager.setStep('child', 'c', 'c-value');

      const all = scopeManager.resolveAll('child');

      expect(all.gp).toBe('gp-value');
      expect(all.p).toBe('p-value');
      expect(all.c).toBe('c-value');
    });

    it('should handle workflow with multiple nested steps', () => {
      // Global config
      scopeManager.setGlobal('apiUrl', 'https://api.example.com');

      // Workflow step (set variables)
      scopeManager.setStep('workflow', 'workflowId', 'wf-123');

      // Task step (child of workflow)
      scopeManager.setParentStep('task', 'workflow');
      scopeManager.setStep('task', 'taskId', 'task-456');

      // Subtask step (child of task)
      scopeManager.setParentStep('subtask', 'task');
      scopeManager.setStep('subtask', 'subtaskId', 'sub-789');

      // Resolve from deepest level
      const all = scopeManager.resolveAll('subtask');

      expect(all.apiUrl).toBe('https://api.example.com'); // From global
      expect(all.workflowId).toBe('wf-123'); // From workflow
      expect(all.taskId).toBe('task-456'); // From task
      expect(all.subtaskId).toBe('sub-789'); // From subtask
    });

    it('should handle siblings with same parent', () => {
      scopeManager.setStep('parent', 'shared', 'parent-value');
      scopeManager.setParentStep('child1', 'parent');
      scopeManager.setParentStep('child2', 'parent');
      scopeManager.setStep('child1', 'child1Var', 'c1');
      scopeManager.setStep('child2', 'child2Var', 'c2');

      const result1 = scopeManager.resolveAll('child1');
      const result2 = scopeManager.resolveAll('child2');

      expect(result1.shared).toBe('parent-value');
      expect(result2.shared).toBe('parent-value');
      expect(result1.child1Var).toBe('c1');
      expect(result1.child2Var).toBeUndefined();
      expect(result2.child2Var).toBe('c2');
      expect(result2.child1Var).toBeUndefined();
    });
  });
});
