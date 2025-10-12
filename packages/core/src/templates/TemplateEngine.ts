/**
 * Template Engine - Pipeline orchestrator for advanced template features
 * Coordinates variable substitution, math, functions, conditionals, and loops
 */

import { createLogger } from '../utils/logger';
import type { VariableStore } from '../variables/VariableStore';
import { ConditionalEvaluator } from './ConditionalEvaluator';
import { LoopEvaluator } from './LoopEvaluator';
import { MathExpressionEvaluator } from './MathExpressionEvaluator';
import { TemplateFunctions } from './TemplateFunctions';
import type { TemplateSandbox } from './TemplateSandbox';
import type { VariableSubstitutor } from './VariableSubstitutor';
import type { EvaluationContext } from './advanced-types';

const logger = createLogger('checklist:templates:engine');

/**
 * Main template processing engine
 */
export class TemplateEngine {
  private readonly mathEvaluator: MathExpressionEvaluator;
  private readonly functionEvaluator: TemplateFunctions;
  private readonly conditionalEvaluator: ConditionalEvaluator;
  private readonly loopEvaluator: LoopEvaluator;

  constructor(
    private readonly sandbox: TemplateSandbox,
    private readonly variableStore: VariableStore,
    private readonly substitutor: VariableSubstitutor
  ) {
    this.mathEvaluator = new MathExpressionEvaluator(sandbox, variableStore);
    this.functionEvaluator = new TemplateFunctions();
    this.conditionalEvaluator = new ConditionalEvaluator(
      variableStore,
      sandbox
    );
    this.loopEvaluator = new LoopEvaluator(variableStore, sandbox);
  }

  /**
   * Process template through complete pipeline
   */
  async processTemplate(template: string, stepId?: string): Promise<string> {
    const startTime = performance.now();
    const context = this.createContext(startTime, stepId);

    const { output, substResult, conditionalResult, loopResult } =
      await this.runPipeline(template, context, stepId);

    this.checkPerformance(performance.now() - startTime, context);
    this.logProcessingResult(
      performance.now() - startTime,
      substResult.variablesUsed.length,
      conditionalResult.conditionsMet,
      loopResult.iterations
    );

    return output;
  }

  /**
   * Create evaluation context
   */
  private createContext(startTime: number, stepId?: string): EvaluationContext {
    return {
      variables: this.variableStore.getAll(stepId),
      stepId,
      nestingDepth: 0,
      maxNestingDepth: 10,
      performanceMetrics: {
        startTime,
        evaluations: 0,
        maxExecutionTime: 50,
      },
    };
  }

  /**
   * Run processing pipeline
   */
  private async runPipeline(
    template: string,
    context: EvaluationContext,
    stepId?: string
  ) {
    const substResult = this.substitutor.substitute(template, stepId);
    let output = substResult.output;

    output = await this.mathEvaluator.evaluate(output, context);
    output = this.functionEvaluator.evaluate(output, context);

    const conditionalResult = await this.conditionalEvaluator.evaluate(
      output,
      context
    );
    output = conditionalResult.output;

    const loopResult = await this.loopEvaluator.evaluate(output, context);
    output = loopResult.output;

    return { output, substResult, conditionalResult, loopResult };
  }

  /**
   * Check performance
   */
  private checkPerformance(duration: number, context: EvaluationContext): void {
    if (duration > context.performanceMetrics.maxExecutionTime) {
      logger.warn({
        msg: 'Template processing exceeded performance target',
        duration,
        limit: context.performanceMetrics.maxExecutionTime,
      });
    }
  }

  /**
   * Log processing result
   */
  private logProcessingResult(
    duration: number,
    variableCount: number,
    conditionsMet: number,
    loopIterations: number
  ): void {
    logger.info({
      msg: 'Template processed with advanced features',
      duration,
      variableCount,
      conditionsMet,
      loopIterations,
    });
  }
}
