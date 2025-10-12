/**
 * LoopEvaluator Tests
 * Tests for {{#each items}}...{{/each}} template syntax
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { LoopEvaluator } from '../../src/templates/LoopEvaluator';
import { TemplateSandbox } from '../../src/templates/TemplateSandbox';
import { VariableStore } from '../../src/variables/VariableStore';
import type { EvaluationContext } from '../../src/templates/advanced-types';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

describe('LoopEvaluator', () => {
  let evaluator: LoopEvaluator;
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
      `loop-${Date.now()}`
    );
    await mkdir(tempDir, { recursive: true });

    const stateFile = join(tempDir, 'variables.yaml');
    variableStore = new VariableStore(stateFile);
    sandbox = new TemplateSandbox();
    evaluator = new LoopEvaluator(variableStore, sandbox);

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

  describe('Array Iteration', () => {
    test('should iterate over array items', async () => {
      const items = ['apple', 'banana', 'orange'];
      variableStore.set('fruits', items);
      context.variables = variableStore.getAll();

      const template = '{{#each fruits}}{{this}} {{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('apple banana orange ');
      expect(result.iterations).toBe(3);
    });

    test('should handle empty arrays', async () => {
      variableStore.set('items', []);
      context.variables = variableStore.getAll();

      const template = '{{#each items}}{{this}}{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('');
      expect(result.iterations).toBe(0);
    });

    test('should handle arrays with numbers', async () => {
      variableStore.set('numbers', [1, 2, 3]);
      context.variables = variableStore.getAll();

      const template = '{{#each numbers}}{{this}},{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('1,2,3,');
    });
  });

  describe('Special Loop Variables', () => {
    test('should support @index variable', async () => {
      variableStore.set('items', ['a', 'b', 'c']);
      context.variables = variableStore.getAll();

      const template = '{{#each items}}{{@index}}:{{this}} {{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('0:a 1:b 2:c ');
    });

    test('should support @first variable', async () => {
      variableStore.set('items', ['a', 'b', 'c']);
      context.variables = variableStore.getAll();

      const template = '{{#each items}}{{@first}}{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('truefalsefalse');
    });

    test('should support @last variable', async () => {
      variableStore.set('items', ['a', 'b', 'c']);
      context.variables = variableStore.getAll();

      const template = '{{#each items}}{{@last}}{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('falsefalsetrue');
    });

    test('should support multiple special variables', async () => {
      variableStore.set('items', ['first', 'second']);
      context.variables = variableStore.getAll();

      const template =
        '{{#each items}}[{{@index}}] {{this}} (first={{@first}}, last={{@last}}) {{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe(
        '[0] first (first=true, last=false) [1] second (first=false, last=true) '
      );
    });
  });

  describe('Iteration Limits', () => {
    test('should enforce maximum iteration limit', async () => {
      const smallLimitEvaluator = new LoopEvaluator(
        variableStore,
        sandbox,
        5
      );

      variableStore.set('items', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      context.variables = variableStore.getAll();

      const template = '{{#each items}}{{this}}{{/each}}';
      const result = await smallLimitEvaluator.evaluate(template, context);

      expect(result.output).toBe('12345');
      expect(result.iterations).toBe(5);
      expect(result.limitReached).toBe(true);
    });

    test('should not reach limit for small arrays', async () => {
      variableStore.set('items', [1, 2, 3]);
      context.variables = variableStore.getAll();

      const template = '{{#each items}}{{this}}{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.limitReached).toBe(false);
    });
  });

  describe('Nested Loops', () => {
    test('should handle nested loops', async () => {
      variableStore.set('outer', ['A', 'B']);
      variableStore.set('inner', [1, 2]);
      context.variables = variableStore.getAll();

      const template =
        '{{#each outer}}{{this}}:{{#each inner}}{{this}} {{/each}}| {{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('A:1 2 | B:1 2 | ');
    });

    test('should track nesting depth', async () => {
      variableStore.set('items', [1, 2]);
      context.variables = variableStore.getAll();
      context.maxNestingDepth = 1;

      const template = '{{#each items}}{{#each items}}{{this}}{{/each}}{{/each}}';

      await expect(evaluator.evaluate(template, context)).rejects.toThrow(
        'Maximum nesting depth'
      );
    });
  });

  describe('Non-Array Handling', () => {
    test('should handle non-array variables gracefully', async () => {
      variableStore.set('notArray', 'string value');
      context.variables = variableStore.getAll();

      const template = '{{#each notArray}}{{this}}{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('');
      expect(result.iterations).toBe(0);
    });

    test('should handle undefined variables', async () => {
      context.variables = {};

      const template = '{{#each undefined_var}}{{this}}{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('');
      expect(result.iterations).toBe(0);
    });
  });

  describe('Complex Content', () => {
    test('should handle multiline content', async () => {
      variableStore.set('items', ['A', 'B']);
      context.variables = variableStore.getAll();

      const template = `{{#each items}}
Item: {{this}}
Index: {{@index}}
{{/each}}`;
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toContain('Item: A');
      expect(result.output).toContain('Index: 0');
      expect(result.output).toContain('Item: B');
      expect(result.output).toContain('Index: 1');
    });

    test('should handle HTML-like content', async () => {
      variableStore.set('items', ['Item 1', 'Item 2']);
      context.variables = variableStore.getAll();

      const template =
        '{{#each items}}<li>{{this}}</li>{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('<li>Item 1</li><li>Item 2</li>');
    });
  });

  describe('Performance', () => {
    test('should complete small loop in <10ms', async () => {
      variableStore.set('items', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      context.variables = variableStore.getAll();

      const startTime = performance.now();
      const template = '{{#each items}}{{this}}{{/each}}';
      await evaluator.evaluate(template, context);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10);
    });

    test('should track evaluation time', async () => {
      variableStore.set('items', [1, 2, 3]);
      context.variables = variableStore.getAll();

      const template = '{{#each items}}{{this}}{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.evaluationTime).toBeGreaterThan(0);
    });
  });

  describe('Multiple Loops', () => {
    test('should handle multiple independent loops', async () => {
      variableStore.set('letters', ['A', 'B']);
      variableStore.set('numbers', [1, 2]);
      context.variables = variableStore.getAll();

      const template =
        'Letters: {{#each letters}}{{this}}{{/each}} Numbers: {{#each numbers}}{{this}}{{/each}}';
      const result = await evaluator.evaluate(template, context);

      expect(result.output).toBe('Letters: AB Numbers: 12');
    });
  });
});
