/**
 * TemplateSandbox - Provides sandboxed execution environment for templates
 * Blocks dangerous operations and enforces resource limits
 */

import { ASTValidator } from './ASTValidator';
import { BooleanExpressionEvaluator } from './BooleanExpressionEvaluator';
import { ResourceLimiter } from './ResourceLimiter';
import {
  SandboxViolationError,
  TimeoutError,
  NetworkAccessError,
} from './errors';
import type { SandboxContext } from './types';

/**
 * Blocked globals that should not be accessible in sandbox
 */
const BLOCKED_GLOBALS = new Set([
  'process',
  'require',
  'eval',
  'Function',
  'import',
  'exports',
  'module',
  '__dirname',
  '__filename',
  'global',
  'globalThis',
  // Network access globals
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'navigator',
  'location',
]);

/**
 * Blocked network-related modules (reserved for module import blocking)
 */
const _BLOCKED_NETWORK_MODULES = new Set([
  'http',
  'https',
  'net',
  'dgram',
  'tls',
  'dns',
]);

/**
 * Dangerous patterns to detect in template expressions
 */
const DANGEROUS_PATTERNS = [
  /eval\s*\(/,
  /Function\s*\(/,
  /require\s*\(/,
  /import\s*\(/,
  /\.constructor\s*\(/,
  /__proto__/,
  /prototype\s*\[/,
];

/**
 * TemplateSandbox provides secure execution environment for templates
 */
export class TemplateSandbox {
  private readonly resourceLimiter: ResourceLimiter;
  private readonly astValidator: ASTValidator;
  private readonly booleanEvaluator: BooleanExpressionEvaluator;
  private readonly allowedModules = new Set(['path', 'url']);

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
        return this.substituteVariables(expression, context, templateId);
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
    const sandbox: SandboxContext = {
      variables: context,
      console: {
        log: (...args: unknown[]) => this.log('info', args),
        error: (...args: unknown[]) => this.log('error', args),
      },
      Math,
      Date: {
        now: Date.now,
        parse: Date.parse,
      },
      JSON: {
        parse: JSON.parse,
        stringify: JSON.stringify,
      },
    };

    // Block network globals by defining error-throwing getters
    this.blockNetworkGlobals(sandbox);

    // Freeze the sandbox to prevent modifications
    return Object.freeze(sandbox);
  }

  /**
   * Block network-related globals in sandbox
   */
  private blockNetworkGlobals(sandbox: SandboxContext): void {
    const networkGlobals = [
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
    ];

    for (const global of networkGlobals) {
      Object.defineProperty(sandbox, global, {
        get() {
          throw new NetworkAccessError(
            'unknown',
            `Network access via '${global}' is blocked in templates`
          );
        },
        configurable: false,
        enumerable: false,
      });
    }
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
    // Use Function constructor with limited scope for safe evaluation
    // This is safer than eval() because we control the scope
    try {
      // Create function parameters from sandbox variables
      const varNames = Object.keys(sandbox.variables);
      const varValues = Object.values(sandbox.variables);

      // Also include Math object
      varNames.push('Math');
      varValues.push(sandbox.Math ?? Math);

      // Create a function that evaluates the expression with available variables
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        ...varNames,
        `'use strict'; return (${expression});`
      );

      // Execute the function with the variable values
      return fn(...varValues);
    } catch (error) {
      throw new Error(
        `Expression evaluation failed: ${(error as Error).message}`
      );
    }
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
    const simpleVarPattern = /^\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/;
    const simpleMatch = processedCondition.match(simpleVarPattern);

    if (simpleMatch !== null) {
      // Simple variable check - just evaluate truthiness
      const varName = simpleMatch[1];
      const value = context[varName];
      return Boolean(value);
    }

    // Complex condition - substitute variables and evaluate
    const substituted = this.substituteVariablesInCondition(
      processedCondition,
      context
    );

    // Evaluate the condition using boolean evaluator
    return this.booleanEvaluator.evaluate(substituted);
  }

  /**
   * Substitute variables in condition expression
   */
  private substituteVariablesInCondition(
    condition: string,
    context: Record<string, unknown>
  ): string {
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

    return condition.replace(varPattern, (match) => {
      const value = context[match];
      if (value === undefined) {
        return match;
      }

      if (typeof value === 'string') {
        return `'${value.replace(/'/g, "\\'")}'`;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }

      return match;
    });
  }

  /**
   * Substitute variables in template string
   */
  substituteVariables(
    template: string,
    variables: Record<string, unknown>,
    templateId: string
  ): string {
    // Validate template for dangerous patterns
    this.validateExpression(template, templateId);

    // Perform variable substitution
    const varPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

    return template.replace(varPattern, (match, varName) => {
      const value = variables[varName];
      if (value === undefined) {
        return match; // Keep original if variable not found
      }

      // Sanitize the value to prevent command injection
      return this.sanitizeValue(String(value));
    });
  }

  /**
   * Sanitize value for safe substitution
   */
  private sanitizeValue(value: string): string {
    // Remove shell metacharacters
    const dangerous = /[;|&$(){}[\]<>`\\]/g;
    return value.replace(dangerous, '');
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
