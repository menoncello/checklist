/**
 * TemplateFunctions Tests
 * Tests for ${fn:functionName(args)} template syntax
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { TemplateFunctions } from '../../src/templates/TemplateFunctions';
import type { EvaluationContext } from '../../src/templates/advanced-types';

describe('TemplateFunctions', () => {
  let functions: TemplateFunctions;
  let context: EvaluationContext;

  beforeEach(() => {
    functions = new TemplateFunctions();
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

  describe('String Functions', () => {
    test('uppercase should convert to uppercase', () => {
      const template = '${fn:uppercase("hello")}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('HELLO');
    });

    test('lowercase should convert to lowercase', () => {
      const template = '${fn:lowercase("HELLO")}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('hello');
    });

    test('trim should remove whitespace', () => {
      const template = '${fn:trim("  hello  ")}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('hello');
    });

    test('replace should replace text', () => {
      const template = '${fn:replace("hello world", "world", "universe")}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('hello universe');
    });

    test('substring should extract substring', () => {
      const template = '${fn:substring("hello world", 0, 5)}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('hello');
    });
  });

  describe('Array Functions', () => {
    test('length should return array length', () => {
      context.variables.items = ['a', 'b', 'c'];
      const template = '${fn:length(items)}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('3');
    });

    test('join should join array elements', () => {
      context.variables.items = ['a', 'b', 'c'];
      const template = '${fn:join(items, "-")}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('a-b-c');
    });

    test('first should return first element', () => {
      context.variables.items = ['first', 'second', 'third'];
      const template = '${fn:first(items)}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('first');
    });

    test('last should return last element', () => {
      context.variables.items = ['first', 'second', 'third'];
      const template = '${fn:last(items)}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('third');
    });
  });

  describe('Utility Functions', () => {
    test('default should use fallback for undefined', () => {
      const template = '${fn:default(missing, "fallback")}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('fallback');
    });

    test('isEmpty should detect empty strings', () => {
      context.variables.empty = '';
      const template = '${fn:isEmpty(empty)}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('true');
    });

    test('isNotEmpty should detect non-empty values', () => {
      context.variables.text = 'hello';
      const template = '${fn:isNotEmpty(text)}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('true');
    });
  });

  describe('Date Functions', () => {
    test('now should return current ISO date', () => {
      const template = '${fn:now()}';
      const result = functions.evaluate(template, context);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('formatDate should format date', () => {
      const template = '${fn:formatDate("2024-01-15", "YYYY-MM-DD")}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('2024-01-15');
    });
  });

  // NOTE: Function chaining is mentioned in Story 3.5 Task 4 but not yet implemented
  // TODO: Implement function chaining support: ${fn:uppercase(fn:trim(name))}
  // This would require recursive evaluation in parseArg() method

  describe('Error Handling', () => {
    test('should handle unknown functions', () => {
      const template = '${fn:unknown("test")}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('${fn:unknown("test")}');
    });

    test('should handle invalid arguments', () => {
      const template = '${fn:uppercase()}';
      const result = functions.evaluate(template, context);
      expect(result).toBe('${fn:uppercase()}');
    });
  });
});
