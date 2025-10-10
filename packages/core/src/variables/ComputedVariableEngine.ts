/**
 * Variable Management System - Computed Variable Engine
 * Evaluates computed variables with safe expression evaluation
 */

import { TemplateSandbox } from '../templates/TemplateSandbox';
import { createLogger } from '../utils/logger';
import { ComputedVariableError, CircularDependencyError } from './errors';
import type { VariableDefinition, VariableValue } from './types';

const logger = createLogger('checklist:variables:computed');

/**
 * Cache entry for computed variable
 */
interface CacheEntry {
  value: VariableValue;
  dependencies: string[];
  timestamp: number;
}

/**
 * Evaluates computed variables with caching and dependency management
 */
export class ComputedVariableEngine {
  private readonly sandbox: TemplateSandbox;
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly evaluationStack: Set<string> = new Set();

  constructor() {
    this.sandbox = new TemplateSandbox();
  }

  /**
   * Evaluate computed variable
   */
  async evaluate(
    definition: VariableDefinition,
    getVariable: (name: string) => VariableValue | undefined
  ): Promise<VariableValue> {
    this.validateComputedVariable(definition);

    const cached = this.getCached(definition.name);
    if (cached !== null) {
      logger.debug({
        msg: 'Computed variable retrieved from cache',
        name: definition.name,
      });
      return cached.value;
    }

    return this.evaluateComputed(definition, getVariable);
  }

  /**
   * Validate that definition has computed configuration
   */
  private validateComputedVariable(definition: VariableDefinition): void {
    if (definition.computed === undefined) {
      throw new ComputedVariableError(
        definition.name,
        '',
        'Variable is not computed'
      );
    }
  }

  /**
   * Execute computed variable evaluation
   */
  private async evaluateComputed(
    definition: VariableDefinition,
    getVariable: (name: string) => VariableValue | undefined
  ): Promise<VariableValue> {
    this.checkCircularDependency(definition.name);
    const computed = this.getComputedConfig(definition);

    try {
      this.evaluationStack.add(definition.name);
      const result = await this.executeEvaluation(
        definition.name,
        computed,
        getVariable
      );
      return result;
    } finally {
      this.evaluationStack.delete(definition.name);
    }
  }

  /**
   * Get computed configuration or throw error
   */
  private getComputedConfig(
    definition: VariableDefinition
  ): NonNullable<VariableDefinition['computed']> {
    if (definition.computed === undefined) {
      throw new ComputedVariableError(
        definition.name,
        '',
        'Variable is not computed'
      );
    }
    return definition.computed;
  }

  /**
   * Execute evaluation with context and caching
   */
  private async executeEvaluation(
    name: string,
    computed: NonNullable<VariableDefinition['computed']>,
    getVariable: (name: string) => VariableValue | undefined
  ): Promise<VariableValue> {
    const context = this.buildContext(computed.dependencies, getVariable);
    const result = await this.evaluateExpression(
      computed.expression,
      context,
      name
    );

    this.cacheResult(name, result, computed.dependencies);
    logger.debug({ msg: 'Computed variable evaluated', name });

    return result;
  }

  /**
   * Build context object from dependencies
   */
  private buildContext(
    dependencies: string[],
    getVariable: (name: string) => VariableValue | undefined
  ): Record<string, VariableValue> {
    const context: Record<string, VariableValue> = {};

    for (const dep of dependencies) {
      const value = getVariable(dep);
      if (value === undefined) {
        throw new ComputedVariableError(
          'unknown',
          '',
          `Dependency '${dep}' not found`
        );
      }
      context[dep] = value;
    }

    return context;
  }

  /**
   * Evaluate expression with sandbox
   */
  private async evaluateExpression(
    expression: string,
    context: Record<string, VariableValue>,
    variableName: string
  ): Promise<VariableValue> {
    try {
      // Use sandbox for variable substitution
      const result = this.sandbox.substituteVariables(
        expression,
        context as Record<string, unknown>,
        variableName
      );

      // TODO: Add arithmetic evaluation using a safe parser library
      // Currently, arithmetic expressions will return as strings
      // Consider using a library like mathjs or implement a proper parser

      return result;
    } catch (error) {
      throw new ComputedVariableError(
        variableName,
        expression,
        (error as Error).message
      );
    }
  }

  /**
   * Check for circular dependency
   */
  private checkCircularDependency(variableName: string): void {
    if (this.evaluationStack.has(variableName)) {
      const chain = Array.from(this.evaluationStack);
      chain.push(variableName);

      throw new CircularDependencyError(variableName, chain);
    }
  }

  /**
   * Get cached value if valid
   */
  private getCached(name: string): CacheEntry | null {
    const entry = this.cache.get(name);
    if (!entry) return null;

    // Cache is valid for 5 seconds
    const age = Date.now() - entry.timestamp;
    if (age > 5000) {
      this.cache.delete(name);
      return null;
    }

    return entry;
  }

  /**
   * Cache computed result
   */
  private cacheResult(
    name: string,
    value: VariableValue,
    dependencies: string[]
  ): void {
    this.cache.set(name, {
      value,
      dependencies,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache for variable
   */
  invalidate(name: string): void {
    this.cache.delete(name);
    logger.debug({
      msg: 'Cache invalidated',
      name,
    });
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info({
      msg: 'All cache cleared',
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}
