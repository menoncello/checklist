/**
 * TemplateSandbox - Provides sandboxed execution environment for templates
 * Blocks dangerous operations and enforces resource limits
 */

import * as acorn from 'acorn';
import { ResourceLimiter } from './ResourceLimiter';
import { SandboxViolationError, TimeoutError } from './errors';
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
  private readonly allowedModules = new Set(['path', 'url']);

  constructor(resourceLimiter?: ResourceLimiter) {
    this.resourceLimiter = resourceLimiter ?? new ResourceLimiter();
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
    this.validateExpressionAST(expression, templateId);
  }

  /**
   * Validate expression using AST parsing
   * This catches obfuscated attacks like 'ev'+'al' that regex misses
   */
  private validateExpressionAST(expression: string, templateId: string): void {
    // Skip AST validation for simple variable substitutions (performance optimization)
    if (/^\$\{[a-zA-Z_][a-zA-Z0-9_]*\}$/.test(expression.trim())) {
      return;
    }

    try {
      // Parse expression as JavaScript
      const ast = acorn.parse(expression, {
        ecmaVersion: 2023,
        sourceType: 'script',
      }) as acorn.Node;

      // Walk the AST and check for dangerous patterns
      this.validateAST(ast, templateId, expression);
    } catch (error) {
      // If expression doesn't parse as JS, it's just a string template - allow it
      // Template variable expressions like "${foo}" will fail to parse, which is OK
      if ((error as Error).message?.includes('Unexpected token')) {
        return;
      }
      // Other parse errors might indicate malicious code
      throw new SandboxViolationError(
        templateId,
        `Expression parsing failed: ${(error as Error).message}`,
        { expression }
      );
    }
  }

  /**
   * Validate AST for dangerous patterns
   */
  private validateAST(node: acorn.Node, templateId: string, expression: string): void {
    // Validate current node based on type
    this.validateNodeByType(node, templateId, expression);

    // Recursively validate child nodes
    this.validateChildNodes(node, templateId, expression);
  }

  /**
   * Validate node based on its type
   */
  private validateNodeByType(node: acorn.Node, templateId: string, expression: string): void {
    if (node.type === 'Identifier') {
      this.validateIdentifier(node as acorn.Identifier, templateId, expression);
    } else if (node.type === 'CallExpression') {
      this.validateCallExpression(node as acorn.CallExpression, templateId, expression);
    } else if (node.type === 'MemberExpression') {
      this.validateMemberExpression(node as acorn.MemberExpression, templateId, expression);
    }
  }

  /**
   * Validate identifier node
   */
  private validateIdentifier(node: acorn.Identifier, templateId: string, expression: string): void {
    if (BLOCKED_GLOBALS.has(node.name)) {
      throw new SandboxViolationError(
        templateId,
        `AST validation: Access to blocked identifier: ${node.name}`,
        { expression, nodeType: 'Identifier' }
      );
    }
  }

  /**
   * Validate call expression node
   */
  private validateCallExpression(node: acorn.CallExpression, templateId: string, expression: string): void {
    const dangerousCalls = ['eval', 'Function', 'require', 'import'];

    // Block direct calls to dangerous functions
    if (node.callee.type === 'Identifier') {
      const callee = node.callee as acorn.Identifier;
      if (dangerousCalls.includes(callee.name)) {
        throw new SandboxViolationError(
          templateId,
          `AST validation: Dangerous function call: ${callee.name}`,
          { expression, nodeType: 'CallExpression' }
        );
      }
    }

    // Block constructor access patterns
    this.validateConstructorAccess(node, templateId, expression);
  }

  /**
   * Validate constructor access in call expression
   */
  private validateConstructorAccess(node: acorn.CallExpression, templateId: string, expression: string): void {
    if (node.callee.type !== 'MemberExpression') {
      return;
    }

    const memberExpr = node.callee as acorn.MemberExpression;
    if (memberExpr.property.type === 'Identifier') {
      const property = memberExpr.property as acorn.Identifier;
      if (property.name === 'constructor') {
        throw new SandboxViolationError(
          templateId,
          'AST validation: Constructor access detected',
          { expression, nodeType: 'CallExpression' }
        );
      }
    }
  }

  /**
   * Validate member expression node
   */
  private validateMemberExpression(node: acorn.MemberExpression, templateId: string, expression: string): void {
    if (node.property.type !== 'Identifier') {
      return;
    }

    const property = node.property as acorn.Identifier;
    const dangerousProps = ['__proto__', 'prototype'];

    if (dangerousProps.includes(property.name)) {
      throw new SandboxViolationError(
        templateId,
        `AST validation: Prototype manipulation detected: ${property.name}`,
        { expression, nodeType: 'MemberExpression' }
      );
    }
  }

  /**
   * Recursively validate child nodes
   */
  private validateChildNodes(node: acorn.Node, templateId: string, expression: string): void {
    for (const key of Object.keys(node)) {
      const child = (node as Record<string, unknown>)[key];
      this.validateChild(child, templateId, expression);
    }
  }

  /**
   * Validate a child node
   */
  private validateChild(child: unknown, templateId: string, expression: string): void {
    if (child === null || typeof child !== 'object') {
      return;
    }

    if (Array.isArray(child)) {
      this.validateChildArray(child, templateId, expression);
    } else if ('type' in child) {
      this.validateAST(child as acorn.Node, templateId, expression);
    }
  }

  /**
   * Validate array of child nodes
   */
  private validateChildArray(children: unknown[], templateId: string, expression: string): void {
    for (const item of children) {
      if (item !== null && typeof item === 'object' && 'type' in item) {
        this.validateAST(item as acorn.Node, templateId, expression);
      }
    }
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

    // Freeze the sandbox to prevent modifications
    return Object.freeze(sandbox);
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
    // Simple variable substitution (not full JS evaluation)
    // This is a safe implementation that only handles ${variable} patterns
    const varPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

    return expression.replace(varPattern, (match, varName) => {
      const value = sandbox.variables[varName];
      if (value === undefined) {
        return match; // Keep original if variable not found
      }
      return String(value);
    });
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

    // For simple variable checks like ${variableName}
    const varPattern = /^\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/;
    const match = condition.match(varPattern);

    if (match !== null) {
      const varName = match[1];
      const value = context[varName];
      return Boolean(value);
    }

    // For more complex conditions, we'd need a safe expression evaluator
    // For now, return false for unsupported conditions
    return false;
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
