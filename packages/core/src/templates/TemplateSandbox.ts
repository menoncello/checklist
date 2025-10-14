/**
 * TemplateSandbox - Provides sandboxed execution environment for templates
 * Blocks dangerous operations and enforces resource limits
 */

import { ASTValidator } from './ASTValidator';
import { BooleanExpressionEvaluator } from './BooleanExpressionEvaluator';
import { ResourceLimiter } from './ResourceLimiter';
import { SandboxViolationError, TimeoutError } from './errors';
import {
  BLOCKED_GLOBALS,
  DANGEROUS_PATTERNS,
  ALLOWED_MODULES,
} from './sandbox/sandboxConstants';
import {
  createSandboxContext,
  evaluateExpressionSafely,
} from './sandbox/sandboxFactory';
import {
  substituteVariables,
  substituteVariablesInCondition,
  getSimpleVariableReference,
} from './sandbox/variableSubstitutor';
import type { SandboxContext } from './types';

// Re-export for backwards compatibility
export {
  BLOCKED_GLOBALS,
  DANGEROUS_PATTERNS,
} from './sandbox/sandboxConstants';

/**
 * TemplateSandbox provides secure execution environment for templates
 */
export class TemplateSandbox {
  private readonly resourceLimiter: ResourceLimiter;
  private readonly astValidator: ASTValidator;
  private readonly booleanEvaluator: BooleanExpressionEvaluator;
  private readonly allowedModules = ALLOWED_MODULES;

  constructor(resourceLimiter?: ResourceLimiter) {
    this.resourceLimiter = resourceLimiter ?? new ResourceLimiter();
    this.astValidator = new ASTValidator();
    this.booleanEvaluator = new BooleanExpressionEvaluator();
  }

  /**
   * Execute a template expression in sandboxed environment
   */
  async executeExpression(
    expression: string,
    context: Record<string, unknown>,
    templateId: string,
    timeout: number = 5000
  ): Promise<unknown> {
    // Validate expression for dangerous patterns
    this.validateExpression(expression, templateId);

    // Execute with resource limits
    return await this.resourceLimiter.executeWithLimits(
      async () => {
        // For template expressions, perform variable substitution
        return substituteVariables(expression, context);
      },
      templateId,
      { executionTime: timeout }
    );
  }

  /**
   * Evaluate JavaScript expression safely (for math, etc)
   */
  async evaluateSafeExpression(
    expression: string,
    context: Record<string, unknown>,
    templateId: string,
    timeout: number = 5000
  ): Promise<unknown> {
    // Validate expression for dangerous patterns
    this.validateExpression(expression, templateId);

    // Create sandbox context
    const sandboxContext = this.createSandbox(context);

    // Execute with resource limits
    return await this.resourceLimiter.executeWithLimits(
      async (signal) => {
        return this.executeInSandbox(
          expression,
          sandboxContext,
          templateId,
          signal
        );
      },
      templateId,
      { executionTime: timeout }
    );
  }

  /**
   * Validate expression for security violations
   */
  private validateExpression(expression: string, templateId: string): void {
    // First pass: Check for dangerous patterns with regex (fast)
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(expression)) {
        throw new SandboxViolationError(
          templateId,
          `Dangerous pattern detected: ${pattern.source}`,
          { expression }
        );
      }
    }

    // Second pass: Check for blocked globals with regex
    for (const global of BLOCKED_GLOBALS) {
      const globalPattern = new RegExp(`\\b${global}\\b`);
      if (globalPattern.test(expression)) {
        throw new SandboxViolationError(
          templateId,
          `Access to blocked global: ${global}`,
          { expression }
        );
      }
    }

    // Third pass: AST-based validation (catches obfuscated attacks)
    this.astValidator.validateExpression(expression, templateId);
  }

  /**
   * Create sandboxed execution context
   */
  private createSandbox(context: Record<string, unknown>): SandboxContext {
    return createSandboxContext(context, this.log.bind(this));
  }

  /**
   * Execute expression in sandbox
   */
  private async executeInSandbox(
    expression: string,
    sandbox: SandboxContext,
    templateId: string,
    signal: AbortSignal
  ): Promise<unknown> {
    try {
      // Check if operation was aborted
      if (signal.aborted) {
        throw new TimeoutError(templateId, 5000, 'sandbox execution');
      }

      // Parse and execute expression safely
      const result = this.evaluateExpression(expression, sandbox);

      return result;
    } catch (error) {
      if (error instanceof SandboxViolationError) {
        throw error;
      }
      if (error instanceof TimeoutError) {
        throw error;
      }

      throw new SandboxViolationError(
        templateId,
        'Expression execution failed',
        {
          expression,
          error: (error as Error).message,
        }
      );
    }
  }

  /**
   * Evaluate expression safely
   */
  private evaluateExpression(
    expression: string,
    sandbox: SandboxContext
  ): unknown {
    return evaluateExpressionSafely(expression, sandbox);
  }

  /**
   * Evaluate boolean condition
   */
  async evaluateCondition(
    condition: string,
    context: Record<string, unknown>,
    templateId: string
  ): Promise<boolean> {
    // Validate condition
    this.validateExpression(condition, templateId);

    // Strip ${} wrapper if present for simple variable checks
    const processedCondition = condition.trim();
    const varName = getSimpleVariableReference(processedCondition);

    if (varName !== null) {
      // Simple variable check - just evaluate truthiness
      const value = context[varName];
      return Boolean(value);
    }

    // Complex condition - substitute variables and evaluate
    const substituted = substituteVariablesInCondition(
      processedCondition,
      context
    );

    // Evaluate the condition using boolean evaluator
    return this.booleanEvaluator.evaluate(substituted);
  }

  /**
   * Substitute variables in template string (public method for external use)
   */
  substituteVariables(
    template: string,
    variables: Record<string, unknown>,
    templateId: string
  ): string {
    // Validate template for dangerous patterns
    this.validateExpression(template, templateId);

    // Perform variable substitution
    return substituteVariables(template, variables);
  }

  /**
   * Log message from sandbox
   */
  private log(_level: string, _args: unknown[]): void {
    // In production, this would use the actual logger
    // For now, logs are suppressed to maintain security boundaries
    // TODO: Integrate with Pino logger for production use
  }

  /**
   * Get resource limiter
   */
  getResourceLimiter(): ResourceLimiter {
    return this.resourceLimiter;
  }
}
