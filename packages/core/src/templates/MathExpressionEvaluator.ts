/**
 * Math Expression Evaluator - Handles ${expression} math operations
 * Supports arithmetic operators and math functions
 */

import { createLogger } from '../utils/logger';
import type { VariableStore } from '../variables/VariableStore';
import type { TemplateSandbox } from './TemplateSandbox';
import type { EvaluationContext } from './advanced-types';

const logger = createLogger('checklist:templates:math');

/**
 * Evaluates math expressions in templates
 */
export class MathExpressionEvaluator {
  // Match expressions with arithmetic operators OR math functions
  // Matches ${expr} if expr contains +, -, *, /, % OR min, max, round, floor, ceil, abs followed by (
  private static readonly MATH_PATTERN =
    /\$\{((?:[^}]*[+\-*/%][^}]*)|(?:[^}]*(?:min|max|round|floor|ceil|abs)\([^}]*))\}/g;

  constructor(
    private readonly sandbox: TemplateSandbox,
    private readonly variableStore: VariableStore
  ) {}

  /**
   * Evaluate all math expressions in template
   */
  async evaluate(
    template: string,
    context: EvaluationContext
  ): Promise<string> {
    const matches: Array<{ match: string; expression: string }> = [];
    const pattern = new RegExp(
      MathExpressionEvaluator.MATH_PATTERN.source,
      MathExpressionEvaluator.MATH_PATTERN.flags
    );

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(template)) !== null) {
      matches.push({ match: match[0], expression: match[1] });
    }

    let output = template;
    for (const { match, expression } of matches) {
      const result = await this.evaluateExpression(match, expression, context);
      output = output.replace(match, result);
    }

    return output;
  }

  /**
   * Evaluate a single math expression
   */
  private async evaluateExpression(
    match: string,
    expression: string,
    context: EvaluationContext
  ): Promise<string> {
    try {
      if (!this.isSafeMathExpression(expression)) {
        return this.logUnsafeExpression(expression, match);
      }

      const result = await this.executeExpression(expression, context);
      return this.validateResult(result, expression, match);
    } catch (error) {
      return this.logExecutionError(error, expression, match);
    }
  }

  /**
   * Log unsafe expression
   */
  private logUnsafeExpression(expression: string, match: string): string {
    logger.warn({ msg: 'Unsafe math expression', expression });
    return match;
  }

  /**
   * Execute expression
   */
  private async executeExpression(
    expression: string,
    context: EvaluationContext
  ): Promise<unknown> {
    const substituted = this.substituteVariables(expression, context);
    return await this.sandbox.evaluateSafeExpression(
      substituted,
      {},
      'math-evaluator',
      50
    );
  }

  /**
   * Validate result
   */
  private validateResult(
    result: unknown,
    expression: string,
    match: string
  ): string {
    const numResult = Number(result);
    if (!isFinite(numResult)) {
      logger.warn({
        msg: 'Invalid math result',
        expression,
        result,
      });
      return match;
    }

    return String(numResult);
  }

  /**
   * Log execution error
   */
  private logExecutionError(
    error: unknown,
    expression: string,
    match: string
  ): string {
    logger.error({
      msg: 'Math expression evaluation failed',
      expression,
      error: (error as Error).message,
    });
    return match;
  }

  /**
   * Check if expression is safe math
   */
  private isSafeMathExpression(expression: string): boolean {
    // Allow: digits, word chars, spaces, operators, parentheses, commas (for function args), dots (for decimals)
    const safePattern = /^[\d\w\s+\-*/%().,]+$/;
    return safePattern.test(expression);
  }

  /**
   * Substitute variables in expression
   */
  private substituteVariables(
    expression: string,
    context: EvaluationContext
  ): string {
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const mathFunctions = ['min', 'max', 'round', 'floor', 'ceil', 'abs'];

    return expression.replace(varPattern, (match, varName) => {
      if (mathFunctions.includes(varName)) {
        return `Math.${match}`;
      }

      const value =
        context.variables[varName] ??
        this.variableStore.get(varName, context.stepId);

      if (typeof value === 'number') {
        return String(value);
      }

      return match;
    });
  }
}
