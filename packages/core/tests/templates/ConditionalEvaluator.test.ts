/**
 * ConditionalEvaluator Tests
 * Tests for {{#if}}, {{else if}}, {{else}} template syntax
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { ConditionalEvaluator } from '../../src/templates/ConditionalEvaluator';
import { TemplateSandbox } from '../../src/templates/TemplateSandbox';
import { VariableStore } from '../../src/variables/VariableStore';
import type { EvaluationContext } from '../../src/templates/advanced-types';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

describe('ConditionalEvaluator', () => {
  let evaluator: ConditionalEvaluator;
  let variableStore: VariableStore;
  let sandbox: TemplateSandbox;
  let context: EvaluationContext;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(
      import.meta.dir,
      '..',
      '..',
      'test-data',
      `conditional-${Date.now()}`
    );
    await mkdir(tempDir, { recursive: true });

    const stateFile = join(tempDir, 'variables.yaml');
    variableStore = new VariableStore(stateFile);
    sandbox = new TemplateSandbox();
    evaluator = new ConditionalEvaluator(variableStore, sandbox);

    context = {
      variables: {},
      nestingDepth: 0,
      maxNestingDepth: 10,
      performanceMetrics: {
        startTime: performance.now(),
        evaluations: 0,
        maxExecutionTime: 50,
      },
    };
  });

  describe('Simple If Conditions', () => {
    test('should evaluate simple if with true condition', async () => {
      variableStore.set('enabled', true);
      context.variables = variableStore.getAll();

      const template = '{{#if enabled}}Feature is enabled{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Feature is enabled');
      expect(result.conditionsMet).toBe(1);
    });

    test('should evaluate simple if with false condition', async () => {
      variableStore.set('enabled', false);
      context.variables = variableStore.getAll();

      const template = '{{#if enabled}}Feature is enabled{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('');
      expect(result.conditionsMet).toBe(0);
    });

    test('should handle variables not wrapped in ${}', async () => {
      variableStore.set('isActive', true);
      context.variables = variableStore.getAll();

      const template = '{{#if isActive}}Active{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Active');
    });
  });

  describe('If-Else Branches', () => {
    test('should execute if branch when condition is true', async () => {
      variableStore.set('status', 'active');
      context.variables = variableStore.getAll();

      const template =
        '{{#if status}}Status: active{{else}}Status: inactive{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Status: active');
    });

    test('should execute else branch when condition is false', async () => {
      variableStore.set('status', '');
      context.variables = variableStore.getAll();

      const template =
        '{{#if status}}Status: active{{else}}Status: inactive{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Status: inactive');
    });
  });

  describe('Else-If Chains', () => {
    test('should handle else-if chains', async () => {
      variableStore.set('value', 50);
      context.variables = variableStore.getAll();

      const template =
        '{{#if value > 75}}High{{else if value > 25}}Medium{{else}}Low{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Medium');
    });

    test('should execute first matching else-if', async () => {
      variableStore.set('score', 85);
      context.variables = variableStore.getAll();

      const template =
        '{{#if score >= 90}}A{{else if score >= 80}}B{{else if score >= 70}}C{{else}}F{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('B');
    });

    test('should fall through to else if no conditions match', async () => {
      variableStore.set('score', 50);
      context.variables = variableStore.getAll();

      const template =
        '{{#if score >= 90}}A{{else if score >= 80}}B{{else}}F{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('F');
    });
  });

  describe('Comparison Operators', () => {
    test('should support == operator', async () => {
      variableStore.set('status', 'active');
      context.variables = variableStore.getAll();

      const template = '{{#if status == \'active\'}}Active{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Active');
    });

    test('should support != operator', async () => {
      variableStore.set('status', 'inactive');
      context.variables = variableStore.getAll();

      const template = '{{#if status != \'active\'}}Not Active{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Not Active');
    });

    test('should support > operator', async () => {
      variableStore.set('count', 15);
      context.variables = variableStore.getAll();

      const template = '{{#if count > 10}}More than 10{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('More than 10');
    });

    test('should support < operator', async () => {
      variableStore.set('count', 5);
      context.variables = variableStore.getAll();

      const template = '{{#if count < 10}}Less than 10{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Less than 10');
    });

    test('should support >= operator', async () => {
      variableStore.set('age', 18);
      context.variables = variableStore.getAll();

      const template = '{{#if age >= 18}}Adult{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Adult');
    });

    test('should support <= operator', async () => {
      variableStore.set('age', 12);
      context.variables = variableStore.getAll();

      const template = '{{#if age <= 12}}Child{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Child');
    });
  });

  describe('Logical Operators', () => {
    test('should support && operator', async () => {
      variableStore.set('isActive', true);
      variableStore.set('isVerified', true);
      context.variables = variableStore.getAll();

      const template =
        '{{#if isActive && isVerified}}Verified and Active{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Verified and Active');
    });

    test('should support || operator', async () => {
      variableStore.set('isAdmin', false);
      variableStore.set('isModerator', true);
      context.variables = variableStore.getAll();

      const template =
        '{{#if isAdmin || isModerator}}Has Permissions{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Has Permissions');
    });

    test('should support ! operator', async () => {
      variableStore.set('disabled', false);
      context.variables = variableStore.getAll();

      const template = '{{#if !disabled}}Enabled{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Enabled');
    });
  });

  describe('Nested Conditionals', () => {
    test('should handle nested if statements', async () => {
      variableStore.set('outer', true);
      variableStore.set('inner', true);
      context.variables = variableStore.getAll();

      const template =
        '{{#if outer}}Outer {{#if inner}}and Inner{{/if}}{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Outer and Inner');
    });

    test('should track nesting depth', async () => {
      variableStore.set('a', true);
      variableStore.set('b', true);
      context.variables = variableStore.getAll();
      context.maxNestingDepth = 1;

      const template =
        '{{#if a}}{{#if b}}Too deep{{/if}}{{/if}}';

      await expect(evaluator.evaluate(template, context)).rejects.toThrow(
        'Maximum nesting depth'
      );
    });
  });

  describe('Error Handling', () => {
    test('should return empty string on evaluation error', async () => {
      context.variables = {};

      const template = '{{#if undefined_var}}Content{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('');
    });

    test('should not crash on malformed conditions', async () => {
      context.variables = {};

      const template = '{{#if}}Content{{/if}}';
      const result = await evaluator.evaluate(template, context);

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should complete simple conditional in <5ms', async () => {
      variableStore.set('enabled', true);
      context.variables = variableStore.getAll();

      const startTime = performance.now();
      const template = '{{#if enabled}}Content{{/if}}';
      await evaluator.evaluate(template, context);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(5);
    });

    test('should track evaluation time', async () => {
      variableStore.set('enabled', true);
      context.variables = variableStore.getAll();

      const template = '{{#if enabled}}Content{{/if}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.evaluationTime).toBeGreaterThan(0);
    });
  });
});
