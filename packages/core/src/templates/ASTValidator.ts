/**
 * ASTValidator - Abstract Syntax Tree validation for template security
 * Validates JavaScript expressions using AST parsing to detect dangerous patterns
 */

import * as acorn from 'acorn';
import { SandboxViolationError } from './errors';

/**
 * Blocked globals that should not be accessible
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
 * ASTValidator provides AST-based validation for template expressions
 */
export class ASTValidator {
  /**
   * Validate expression using AST parsing
   * This catches obfuscated attacks like 'ev'+'al' that regex misses
   */
  validateExpression(expression: string, templateId: string): void {
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
  private validateAST(
    node: acorn.Node,
    templateId: string,
    expression: string
  ): void {
    // Validate current node based on type
    this.validateNodeByType(node, templateId, expression);

    // Recursively validate child nodes
    this.validateChildNodes(node, templateId, expression);
  }

  /**
   * Validate node based on its type
   */
  private validateNodeByType(
    node: acorn.Node,
    templateId: string,
    expression: string
  ): void {
    if (node.type === 'Identifier') {
      this.validateIdentifier(node as acorn.Identifier, templateId, expression);
    } else if (node.type === 'CallExpression') {
      this.validateCallExpression(
        node as acorn.CallExpression,
        templateId,
        expression
      );
    } else if (node.type === 'MemberExpression') {
      this.validateMemberExpression(
        node as acorn.MemberExpression,
        templateId,
        expression
      );
    }
  }

  /**
   * Validate identifier node
   */
  private validateIdentifier(
    node: acorn.Identifier,
    templateId: string,
    expression: string
  ): void {
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
  private validateCallExpression(
    node: acorn.CallExpression,
    templateId: string,
    expression: string
  ): void {
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
  private validateConstructorAccess(
    node: acorn.CallExpression,
    templateId: string,
    expression: string
  ): void {
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
  private validateMemberExpression(
    node: acorn.MemberExpression,
    templateId: string,
    expression: string
  ): void {
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
  private validateChildNodes(
    node: acorn.Node,
    templateId: string,
    expression: string
  ): void {
    for (const key of Object.keys(node)) {
      const child = (node as unknown as Record<string, unknown>)[key];
      this.validateChild(child, templateId, expression);
    }
  }

  /**
   * Validate a child node
   */
  private validateChild(
    child: unknown,
    templateId: string,
    expression: string
  ): void {
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
  private validateChildArray(
    children: unknown[],
    templateId: string,
    expression: string
  ): void {
    for (const item of children) {
      if (item !== null && typeof item === 'object' && 'type' in item) {
        this.validateAST(item as acorn.Node, templateId, expression);
      }
    }
  }
}
