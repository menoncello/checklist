/**
 * ConditionalEvaluationEngine - Evaluates step conditions for conditional workflow branching
 * Story 3.6: Conditional Workflow Branching (Task 2)
 */

import type { TemplateSandbox } from '../templates/TemplateSandbox';
import { createLogger } from '../utils/logger';
import type { VariableStore } from '../variables/VariableStore';
import type {
  Step,
  ConditionalEvaluationContext,
  ConditionEvaluationResult,
} from './types';

const logger = createLogger('checklist:workflow:conditional');

/**
 * Engine for evaluating step conditions with caching and performance tracking
 */
export class ConditionalEvaluationEngine {
  private cache = new Map<string, ConditionEvaluationResult>();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private readonly sandbox: TemplateSandbox,
    private readonly variableStore: VariableStore
  ) {}

  /**
   * Evaluate a single step's condition
   * Returns true if step should be visible, false if hidden
   */
  async evaluateStepCondition(
    step: Step,
    context: ConditionalEvaluationContext
  ): Promise<boolean> {
    // No condition = always visible (fail-safe behavior)
    if (step.condition === undefined || step.condition === '') {
      return true;
    }

    // Check cache
    const cachedResult = this.checkCache(step, context);
    if (cachedResult !== null) {
      return cachedResult;
    }

    // Evaluate and cache
    return await this.evaluateAndCache(step, context);
  }

  /**
   * Check cache for existing evaluation result
   */
  private checkCache(
    step: Step,
    context: ConditionalEvaluationContext
  ): boolean | null {
    const cacheKey = this.getCacheKey(step, context);
    const cached = this.cache.get(cacheKey);

    if (cached !== undefined && this.isCacheValid(cached, context)) {
      this.cacheHits++;
      this.logCacheHit(step, cached.result);
      return cached.result;
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Evaluate condition and cache the result
   */
  private async evaluateAndCache(
    step: Step,
    context: ConditionalEvaluationContext
  ): Promise<boolean> {
    const startTime = performance.now();

    try {
      const result = await this.evaluateCondition(step, context);
      const evaluationTime = performance.now() - startTime;

      this.cacheResult(step, result, evaluationTime, context);
      this.updateStep(step, result, context.timestamp);
      this.logEvaluation(step, result, evaluationTime);

      return result;
    } catch (error) {
      this.logError(step, error as Error);
      return true; // Fail-safe: show step on error
    }
  }

  /**
   * Evaluate condition using sandbox
   */
  private async evaluateCondition(
    step: Step,
    context: ConditionalEvaluationContext
  ): Promise<boolean> {
    const variables = this.variableStore.getAll(context.stepId);
    return await this.sandbox.evaluateCondition(
      step.condition ?? '',
      variables,
      `step-${step.id}`
    );
  }

  /**
   * Cache evaluation result
   */
  private cacheResult(
    step: Step,
    result: boolean,
    evaluationTime: number,
    context: ConditionalEvaluationContext
  ): void {
    const cacheKey = this.getCacheKey(step, context);
    const evaluationResult: ConditionEvaluationResult = {
      stepId: step.id,
      condition: step.condition ?? '',
      result,
      evaluationTime,
      variablesUsed: this.extractVariables(step.condition ?? ''),
      cached: false,
    };
    this.cache.set(cacheKey, evaluationResult);
  }

  /**
   * Update step with evaluation result
   */
  private updateStep(step: Step, result: boolean, timestamp: number): void {
    step.conditionResult = result;
    step.conditionEvaluatedAt = timestamp;
  }

  /**
   * Log cache hit
   */
  private logCacheHit(step: Step, result: boolean): void {
    logger.debug({
      msg: 'Condition cache hit',
      stepId: step.id,
      condition: step.condition,
      result,
    });
  }

  /**
   * Log successful evaluation
   */
  private logEvaluation(
    step: Step,
    result: boolean,
    evaluationTime: number
  ): void {
    logger.info({
      msg: 'Condition evaluated',
      stepId: step.id,
      condition: step.condition,
      result,
      evaluationTime,
    });
  }

  /**
   * Log evaluation error
   */
  private logError(step: Step, error: Error): void {
    logger.error({
      msg: 'Condition evaluation failed',
      stepId: step.id,
      condition: step.condition,
      error: error.message,
    });
  }

  /**
   * Evaluate group-level condition for all steps in a group
   */
  async evaluateGroupCondition(
    groupId: string,
    steps: Step[],
    context: ConditionalEvaluationContext
  ): Promise<boolean> {
    const groupSteps = steps.filter((s) => s.groupId === groupId);
    if (groupSteps.length === 0) return true;

    const groupCondition = groupSteps[0]?.groupCondition;
    if (groupCondition === undefined || groupCondition === '') return true;

    return await this.evaluateGroup(
      groupId,
      groupCondition,
      groupSteps.length,
      context
    );
  }

  /**
   * Evaluate group condition with error handling
   */
  private async evaluateGroup(
    groupId: string,
    groupCondition: string,
    stepCount: number,
    context: ConditionalEvaluationContext
  ): Promise<boolean> {
    try {
      const variables = this.variableStore.getAll(context.stepId);
      const result = await this.sandbox.evaluateCondition(
        groupCondition,
        variables,
        `group-${groupId}`
      );

      this.logGroupEvaluation(groupId, groupCondition, result, stepCount);
      return result;
    } catch (error) {
      this.logGroupError(groupId, groupCondition, error as Error);
      return true; // Fail-safe: show group on error
    }
  }

  /**
   * Log successful group evaluation
   */
  private logGroupEvaluation(
    groupId: string,
    condition: string,
    result: boolean,
    affectedSteps: number
  ): void {
    logger.info({
      msg: 'Group condition evaluated',
      groupId,
      condition,
      result,
      affectedSteps,
    });
  }

  /**
   * Log group evaluation error
   */
  private logGroupError(
    groupId: string,
    condition: string,
    error: Error
  ): void {
    logger.error({
      msg: 'Group condition evaluation failed',
      groupId,
      condition,
      error: error.message,
    });
  }

  /**
   * Invalidate all cached condition results
   */
  invalidateCache(): void {
    const stats = this.getCacheStats();
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.debug({
      msg: 'Condition cache invalidated',
      previousSize: stats.size,
      hitRate: stats.hitRate,
    });
  }

  /**
   * Generate cache key for a step condition evaluation
   */
  private getCacheKey(
    step: Step,
    context: ConditionalEvaluationContext
  ): string {
    const variables = this.variableStore.getAll(context.stepId);
    const variablesHash = this.hashVariables(variables);
    return `${step.id}:${variablesHash}`;
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(
    cached: ConditionEvaluationResult,
    context: ConditionalEvaluationContext
  ): boolean {
    // Get current variable values
    const currentVariables = this.variableStore.getAll(context.stepId);

    // Extract only the variables used in the condition
    const relevantVars: Record<string, unknown> = {};
    for (const varName of cached.variablesUsed) {
      relevantVars[varName] = currentVariables[varName];
    }

    const currentHash = this.hashVariables(relevantVars);
    const cachedHash = this.hashVariables(
      Object.fromEntries(
        cached.variablesUsed.map((v) => [v, currentVariables[v]])
      )
    );

    return currentHash === cachedHash;
  }

  /**
   * Simple hash function for variable values
   */
  private hashVariables(variables: Record<string, unknown>): string {
    // Simple JSON stringify for now - could be optimized with a proper hash function
    return JSON.stringify(variables);
  }

  /**
   * Extract variable names from condition expression
   */
  private extractVariables(condition: string): string[] {
    // Extract variable names using regex pattern
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const matches = condition.match(varPattern) ?? [];

    // Filter out JavaScript keywords and boolean literals
    const keywords = new Set([
      'true',
      'false',
      'null',
      'undefined',
      'typeof',
      'instanceof',
      'new',
      'delete',
      'void',
      'return',
      'if',
      'else',
      'for',
      'while',
      'switch',
      'case',
      'break',
      'continue',
    ]);

    return [...new Set(matches)].filter((v) => !keywords.has(v));
  }

  /**
   * Get cache statistics for performance monitoring
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    hits: number;
    misses: number;
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      size: this.cache.size,
      hitRate,
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }
}
