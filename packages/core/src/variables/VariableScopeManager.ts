/**
 * Variable Management System - Scope Manager
 * Manages variable scoping with global and step-level resolution
 */

import { createLogger } from '../utils/logger';
import { VariableStore } from './VariableStore';
import type { VariableValue } from './types';

const logger = createLogger('checklist:variables:scope');

/**
 * Manages variable scoping with support for global and step-level scopes
 */
export class VariableScopeManager {
  private stepHierarchy: Map<string, string> = new Map();

  constructor(private readonly store: VariableStore) {}

  /**
   * Resolve variable value with scope chain
   */
  resolve(name: string, stepId?: string): VariableValue | undefined {
    // Try current step scope
    if (stepId !== undefined && stepId !== '') {
      const value = this.store.get(name, stepId);
      if (value !== undefined) {
        logger.debug({
          msg: 'Variable resolved in step scope',
          name,
          stepId,
        });
        return value;
      }

      // Try parent step scopes (inheritance)
      const parentValue = this.resolveFromParent(name, stepId);
      if (parentValue !== undefined) {
        return parentValue;
      }
    }

    // Fall back to global scope
    return this.resolveFromGlobal(name);
  }

  /**
   * Resolve variable from parent step scopes
   */
  private resolveFromParent(
    name: string,
    stepId: string
  ): VariableValue | undefined {
    const parentStepId = this.stepHierarchy.get(stepId);
    if (parentStepId !== undefined && parentStepId !== '') {
      const parentValue = this.resolve(name, parentStepId);
      if (parentValue !== undefined) {
        logger.debug({
          msg: 'Variable resolved in parent step scope',
          name,
          stepId,
          parentStepId,
        });
        return parentValue;
      }
    }
    return undefined;
  }

  /**
   * Resolve variable from global scope
   */
  private resolveFromGlobal(name: string): VariableValue | undefined {
    const globalValue = this.store.get(name);
    if (globalValue !== undefined) {
      logger.debug({
        msg: 'Variable resolved in global scope',
        name,
      });
    }
    return globalValue;
  }

  /**
   * Resolve all variables for a scope with inheritance
   */
  resolveAll(stepId?: string): Record<string, VariableValue> {
    const result: Record<string, VariableValue> = {};

    // Start with global scope
    const globalVars = this.store.getAll();
    Object.assign(result, globalVars);

    // Apply parent step scopes (in order)
    if (stepId !== undefined && stepId !== '') {
      const hierarchy = this.getHierarchyChain(stepId);
      for (const ancestorStepId of hierarchy) {
        const stepVars = this.store.getAll(ancestorStepId);
        Object.assign(result, stepVars);
      }
    }

    logger.debug({
      msg: 'Variables resolved for scope',
      stepId,
      count: Object.keys(result).length,
    });

    return result;
  }

  /**
   * Set variable in global scope
   */
  setGlobal(name: string, value: VariableValue): void {
    this.store.set(name, value);
    logger.debug({
      msg: 'Variable set in global scope via ScopeManager',
      name,
    });
  }

  /**
   * Set variable in step scope
   */
  setStep(stepId: string, name: string, value: VariableValue): void {
    this.store.set(name, value, stepId);
    logger.debug({
      msg: 'Variable set in step scope via ScopeManager',
      name,
      stepId,
    });
  }

  /**
   * Define step inheritance relationship
   */
  setParentStep(stepId: string, parentStepId: string): void {
    this.stepHierarchy.set(stepId, parentStepId);
    logger.debug({
      msg: 'Step inheritance defined',
      stepId,
      parentStepId,
    });
  }

  /**
   * Get parent step ID
   */
  getParentStep(stepId: string): string | undefined {
    return this.stepHierarchy.get(stepId);
  }

  /**
   * Get complete hierarchy chain for a step
   */
  private getHierarchyChain(stepId: string): string[] {
    const chain: string[] = [];
    let currentStepId: string | undefined = stepId;

    while (currentStepId !== undefined && currentStepId !== '') {
      chain.unshift(currentStepId);
      currentStepId = this.stepHierarchy.get(currentStepId);

      // Prevent infinite loops
      if (chain.length > 100) {
        logger.warn({
          msg: 'Step hierarchy too deep, breaking loop',
          stepId,
          chainLength: chain.length,
        });
        break;
      }
    }

    return chain;
  }

  /**
   * Clear step inheritance
   */
  clearHierarchy(): void {
    this.stepHierarchy.clear();
    logger.info({
      msg: 'Step hierarchy cleared',
    });
  }

  /**
   * Check if variable exists in scope chain
   */
  has(name: string, stepId?: string): boolean {
    return this.resolve(name, stepId) !== undefined;
  }

  /**
   * Get underlying store (for advanced operations)
   */
  getStore(): VariableStore {
    return this.store;
  }
}
