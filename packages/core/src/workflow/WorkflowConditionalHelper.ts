/**
 * Helper class for conditional evaluation in WorkflowEngine
 * Extracted to keep WorkflowEngine under 300 lines
 */

import { createLogger } from '../utils/logger';
import type { ConditionalEvaluationEngine } from './ConditionalEvaluationEngine';
import type {
  ChecklistTemplate,
  ConditionalEvaluationContext,
  Step,
  WorkflowState,
} from './types';

const logger = createLogger('checklist:workflow:conditional-helper');

export class WorkflowConditionalHelper {
  constructor(
    private readonly conditionalEngine?: ConditionalEvaluationEngine
  ) {}

  /**
   * Get visible steps (filter out hidden steps)
   */
  getVisibleSteps(template: ChecklistTemplate): Step[] {
    if (this.conditionalEngine === undefined) {
      return template.steps;
    }
    return template.steps.filter((step) => step.conditionResult !== false);
  }

  /**
   * Evaluate all step conditions (group conditions first, then individual)
   */
  async evaluateAll(
    template: ChecklistTemplate,
    state: WorkflowState
  ): Promise<void> {
    if (this.conditionalEngine === undefined) return;

    const startTime = performance.now();
    const context: ConditionalEvaluationContext = {
      variables: state.variables,
      workflowState: state,
      timestamp: Date.now(),
    };

    await this.evaluateGroupsAndSteps(template, context);

    const duration = performance.now() - startTime;
    this.logPerformanceMetrics(template, duration);
  }

  /**
   * Log performance metrics and warnings
   */
  private logPerformanceMetrics(
    template: ChecklistTemplate,
    duration: number
  ): void {
    const totalSteps = template.steps.length;
    const visibleSteps = this.getVisibleSteps(template).length;

    logger.info({
      msg: 'All conditions evaluated',
      totalSteps,
      visibleSteps,
      duration,
    });

    this.checkPerformanceThresholds(totalSteps, duration);
  }

  /**
   * Check performance thresholds and log warnings
   */
  private checkPerformanceThresholds(
    stepCount: number,
    duration: number
  ): void {
    if (stepCount >= 100 && duration > 100) {
      logger.warn({
        msg: 'Condition evaluation exceeded 100ms threshold for 100+ steps',
        stepCount,
        duration,
        threshold: 100,
      });
    } else if (stepCount >= 1000 && duration > 500) {
      logger.warn({
        msg: 'Condition evaluation exceeded 500ms threshold for 1000+ steps',
        stepCount,
        duration,
        threshold: 500,
      });
    }
  }

  /**
   * Re-evaluate with cache invalidation
   */
  async reevaluate(
    template: ChecklistTemplate,
    state: WorkflowState
  ): Promise<void> {
    if (this.conditionalEngine === undefined) return;

    logger.info({ msg: 'Manual condition re-evaluation triggered' });
    this.conditionalEngine.invalidateCache();
    await this.evaluateAll(template, state);
  }

  /**
   * Evaluate group conditions first, then individual step conditions
   */
  private async evaluateGroupsAndSteps(
    template: ChecklistTemplate,
    context: ConditionalEvaluationContext
  ): Promise<void> {
    const groupIds = this.getUniqueGroupIds(template.steps);
    const groupResults = await this.evaluateGroupConditions(
      groupIds,
      template.steps,
      context
    );

    await this.evaluateStepConditions(template.steps, groupResults, context);
  }

  /**
   * Get unique group IDs from steps
   */
  private getUniqueGroupIds(steps: Step[]): string[] {
    const groupIds = steps
      .filter((step) => step.groupId !== undefined)
      .map((step) => step.groupId as string);
    return [...new Set(groupIds)];
  }

  /**
   * Evaluate all group conditions in parallel
   */
  private async evaluateGroupConditions(
    groupIds: string[],
    steps: Step[],
    context: ConditionalEvaluationContext
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    await Promise.all(
      groupIds.map(async (groupId) => {
        const result = await this.conditionalEngine?.evaluateGroupCondition(
          groupId,
          steps,
          context
        );
        results.set(groupId, result ?? true);
      })
    );

    return results;
  }

  /**
   * Evaluate individual step conditions with group hierarchy
   */
  private async evaluateStepConditions(
    steps: Step[],
    groupResults: Map<string, boolean>,
    context: ConditionalEvaluationContext
  ): Promise<void> {
    await Promise.all(
      steps.map(async (step) => {
        if (step.groupId !== undefined) {
          const groupResult = groupResults.get(step.groupId);
          if (groupResult === false) {
            step.conditionResult = false;
            step.conditionEvaluatedAt = context.timestamp;
            return;
          }
        }

        await this.conditionalEngine?.evaluateStepCondition(step, context);
      })
    );
  }
}
