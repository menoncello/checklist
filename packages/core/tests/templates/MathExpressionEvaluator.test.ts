/**
 * MathExpressionEvaluator Tests
 *
 * Validates math expression evaluation including:
 * - Arithmetic operators (+, -, *, /, %)
 * - Operator precedence
 * - Parentheses
 * - Variable substitution
 * - Division by zero protection
 * - Math functions
 * - Security (injection prevention)
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { MathExpressionEvaluator } from '../../src/templates/MathExpressionEvaluator';
import { TemplateSandbox } from '../../src/templates/TemplateSandbox';
import { VariableStore } from '../../src/variables/VariableStore';
import type { EvaluationContext } from '../../src/templates/advanced-types';

describe('MathExpressionEvaluator', () => {
  let evaluator: MathExpressionEvaluator;
  let sandbox: TemplateSandbox;
  let variableStore: VariableStore;
  let context: EvaluationContext;

  beforeEach(() => {
    sandbox = new TemplateSandbox();
    variableStore = new VariableStore();
    evaluator = new MathExpressionEvaluator(sandbox, variableStore);

    // Basic context
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

  describe('Basic Arithmetic Operators', () => {
    it('should evaluate addition', async () => {
      const template = '${5 + 3}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('8');
    });

    it('should evaluate subtraction', async () => {
      const template = '${10 - 4}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('6');
    });

    it('should evaluate multiplication', async () => {
      const template = '${6 * 7}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('42');
    });

    it('should evaluate division', async () => {
      const template = '${20 / 5}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('4');
    });

    it('should evaluate modulo', async () => {
      const template = '${10 % 3}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('1');
    });
  });

  describe('Operator Precedence', () => {
    it('should follow correct operator precedence (multiplication before addition)', async () => {
      const template = '${2 + 3 * 4}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('14'); // 2 + (3 * 4) = 14, not (2 + 3) * 4 = 20
    });

    it('should follow correct operator precedence (division before subtraction)', async () => {
      const template = '${20 - 10 / 2}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('15'); // 20 - (10 / 2) = 15, not (20 - 10) / 2 = 5
    });

    it('should respect parentheses for precedence override', async () => {
      const template = '${(2 + 3) * 4}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('20'); // (2 + 3) * 4 = 20
    });

    it('should handle nested parentheses', async () => {
      const template = '${((5 + 3) * 2) - 4}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('12'); // ((5 + 3) * 2) - 4 = (8 * 2) - 4 = 16 - 4 = 12
    });
  });

  describe('Variable Substitution', () => {
    it('should substitute single variable in expression', async () => {
      context.variables = { count: 10 };
      const template = '${count + 5}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('15');
    });

    it('should substitute multiple variables in expression', async () => {
      context.variables = { price: 25, quantity: 4 };
      const template = '${price * quantity}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('100');
    });

    it('should handle complex expression with multiple variables', async () => {
      context.variables = { a: 10, b: 20, c: 5 };
      const template = '${(a + b) * c}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('150'); // (10 + 20) * 5 = 150
    });

    it('should resolve variables from VariableStore', async () => {
      variableStore.set('globalCount', 42);
      const template = '${globalCount + 8}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('50');
    });

    it('should prioritize context variables over VariableStore', async () => {
      variableStore.set('value', 10);
      context.variables = { value: 20 };
      const template = '${value + 5}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('25'); // Uses context value (20), not store value (10)
    });
  });

  describe('Division by Zero Protection', () => {
    it('should handle division by zero gracefully', async () => {
      const template = '${10 / 0}';
      const result = await evaluator.evaluate(template, context);
      // Result is Infinity, but isFinite check should return original match
      expect(result).toBe('${10 / 0}');
    });

    it('should handle division by zero variable', async () => {
      context.variables = { divisor: 0 };
      const template = '${100 / divisor}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('${100 / divisor}'); // Fail-safe: returns original
    });

    it('should handle modulo by zero', async () => {
      const template = '${10 % 0}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('${10 % 0}'); // NaN results are not finite
    });
  });

  describe('Floating-Point Arithmetic', () => {
    it('should handle floating-point addition', async () => {
      const template = '${1.5 + 2.3}';
      const result = await evaluator.evaluate(template, context);
      expect(parseFloat(result)).toBeCloseTo(3.8, 1);
    });

    it('should handle floating-point multiplication', async () => {
      const template = '${2.5 * 3.2}';
      const result = await evaluator.evaluate(template, context);
      expect(parseFloat(result)).toBeCloseTo(8.0, 1);
    });

    it('should handle floating-point division', async () => {
      const template = '${7.5 / 2.5}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('3');
    });

    it('should handle decimal precision in expressions', async () => {
      context.variables = { price: 19.99, tax: 0.08 };
      const template = '${price * (1 + tax)}';
      const result = await evaluator.evaluate(template, context);
      expect(parseFloat(result)).toBeCloseTo(21.59, 2);
    });
  });

  describe('Math Functions', () => {
    it('should evaluate Math.min', async () => {
      const template = '${min(5, 3)}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('3');
    });

    it('should evaluate Math.max', async () => {
      const template = '${max(5, 3)}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('5');
    });

    it('should evaluate Math.round', async () => {
      const template = '${round(4.7)}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('5');
    });

    it('should evaluate Math.floor', async () => {
      const template = '${floor(4.7)}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('4');
    });

    it('should evaluate Math.ceil', async () => {
      const template = '${ceil(4.3)}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('5');
    });

    it('should evaluate Math.abs', async () => {
      const template = '${abs(-15)}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('15');
    });

    it('should use Math functions in complex expressions', async () => {
      context.variables = { a: 10, b: 20 };
      const template = '${max(a, b) + min(5, 3)}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('23'); // max(10, 20) + min(5, 3) = 20 + 3 = 23
    });
  });

  describe('Multiple Expressions in Single Template', () => {
    it('should evaluate multiple math expressions', async () => {
      context.variables = { a: 10, b: 5 };
      const template = 'Sum: ${a + b}, Product: ${a * b}, Difference: ${a - b}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('Sum: 15, Product: 50, Difference: 5');
    });

    it('should handle mix of expressions and text', async () => {
      context.variables = { price: 100, discount: 0.2 };
      // Note: ${price} alone is NOT a math expression (no operator), so it won't be substituted by MathExpressionEvaluator
      // That would be handled by variable substitution in the template pipeline
      const template = 'Total: $${price + 0}, Discounted: $${price * (1 - discount)}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('Total: $100, Discounted: $80');
    });
  });

  describe('Error Handling', () => {
    it('should return original match on invalid expression', async () => {
      const template = '${not_valid_syntax}';
      const result = await evaluator.evaluate(template, context);
      // No operator detected, not a math expression
      expect(result).toBe('${not_valid_syntax}');
    });

    it('should handle non-numeric variable gracefully', async () => {
      context.variables = { text: 'hello' };
      const template = '${text + 5}';
      const result = await evaluator.evaluate(template, context);
      // Non-numeric substitution results in invalid expression
      expect(result).toBe('${text + 5}'); // Returns original
    });

    it('should handle undefined variables gracefully', async () => {
      const template = '${undefinedVar + 5}';
      const result = await evaluator.evaluate(template, context);
      // Undefined variables not substituted, becomes invalid
      expect(result).toBe('${undefinedVar + 5}');
    });

    it('should handle malformed expressions', async () => {
      const template = '${5 + + 3}';
      const result = await evaluator.evaluate(template, context);
      // Note: '5 + + 3' is actually valid JavaScript (unary plus), evaluates to 8
      // This demonstrates that the evaluator correctly handles unary operators
      expect(result).toBe('8');
    });
  });

  describe('Security - Injection Prevention', () => {
    it('should block unsafe characters in expressions', async () => {
      const template = '${eval("alert(1)")}';
      const result = await evaluator.evaluate(template, context);
      // Unsafe characters blocked by isSafeMathExpression
      expect(result).toBe('${eval("alert(1)")}'); // Returns original
    });

    it('should block semicolons in expressions', async () => {
      const template = '${5 + 3; alert(1)}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('${5 + 3; alert(1)}'); // Returns original
    });

    it('should block function constructor attempts', async () => {
      const template = '${Function("return 1")()}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('${Function("return 1")()}'); // Returns original
    });

    it('should block dangerous property access', async () => {
      const template = '${__proto__}';
      const result = await evaluator.evaluate(template, context);
      // No operator, not a math expression
      expect(result).toBe('${__proto__}');
    });

    it('should only allow safe characters in expressions', async () => {
      const template = '${<script>alert(1)</script>}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('${<script>alert(1)</script>}'); // Returns original
    });
  });

  describe('Performance', () => {
    it('should evaluate simple math expression in <1ms', async () => {
      const template = '${5 + 3}';
      const start = performance.now();
      await evaluator.evaluate(template, context);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1); // AC#8: <1ms per expression
    });

    it('should handle multiple expressions efficiently', async () => {
      context.variables = { a: 10, b: 20, c: 30, d: 40 };
      const template = '${a + b} ${b * c} ${c - d} ${d / 2} ${a + b + c + d}';
      const start = performance.now();
      await evaluator.evaluate(template, context);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(5); // Multiple expressions should still be fast
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero values', async () => {
      context.variables = { zero: 0 };
      const template = '${zero + 5}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('5');
    });

    it('should handle negative numbers', async () => {
      const template = '${-5 + 10}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('5');
    });

    it('should handle large numbers', async () => {
      context.variables = { large: 1000000 };
      const template = '${large * 2}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('2000000');
    });

    it('should handle very small decimal numbers', async () => {
      const template = '${0.1 + 0.2}';
      const result = await evaluator.evaluate(template, context);
      expect(parseFloat(result)).toBeCloseTo(0.3, 1);
    });

    it('should handle expression with only variables', async () => {
      context.variables = { x: 15, y: 25 };
      const template = '${x + y}';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('40');
    });

    it('should handle empty template', async () => {
      const template = '';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('');
    });

    it('should handle template with no expressions', async () => {
      const template = 'This is just plain text';
      const result = await evaluator.evaluate(template, context);
      expect(result).toBe('This is just plain text');
    });
  });
});
