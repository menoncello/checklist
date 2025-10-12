/**
 * Loop Evaluator - Handles {{#each items}}...{{/each}} template syntax
 * Supports array iteration with special loop variables
 */

import { createLogger } from '../utils/logger';
import type { VariableStore } from '../variables/VariableStore';
import { LoopBlockParser } from './LoopBlockParser';
import type { LoopBlock } from './LoopBlockParser';
import { LoopContextFactory } from './LoopContextFactory';
import type { TemplateSandbox } from './TemplateSandbox';
import type { EvaluationContext, LoopResult } from './advanced-types';

const logger = createLogger('checklist:templates:loop');

/**
 * Default maximum iterations to prevent infinite loops
 */
const DEFAULT_MAX_ITERATIONS = 10000;

/**
 * Evaluates loop template syntax
 */
export class LoopEvaluator {
  private readonly maxIterations: number;
  private readonly parser: LoopBlockParser;
  private readonly contextFactory: LoopContextFactory;

  constructor(
    private readonly variableStore: VariableStore,
    private readonly sandbox: TemplateSandbox,
    maxIterations: number = DEFAULT_MAX_ITERATIONS
  ) {
    this.maxIterations = maxIterations;
    this.parser = new LoopBlockParser();
    this.contextFactory = new LoopContextFactory();
  }

  /**
   * Evaluate all loop blocks in template
   */
  async evaluate(
    template: string,
    context: EvaluationContext
  ): Promise<LoopResult> {
    const startTime = performance.now();
    const blocks = this.parser.parse(template);

    const { output, totalIterations, limitReached } =
      await this.evaluateAllBlocks(template, blocks, context);

    const evaluationTime = performance.now() - startTime;
    this.logResult(
      totalIterations,
      evaluationTime,
      limitReached,
      blocks.length
    );

    return {
      output,
      iterations: totalIterations,
      evaluationTime,
      limitReached,
    };
  }

  /**
   * Evaluate all blocks
   */
  private async evaluateAllBlocks(
    template: string,
    blocks: LoopBlock[],
    context: EvaluationContext
  ): Promise<{
    output: string;
    totalIterations: number;
    limitReached: boolean;
  }> {
    let output = template;
    let totalIterations = 0;
    let limitReached = false;

    for (const block of blocks) {
      const result = await this.evaluateBlock(block, context);
      output = output.replace(block.fullMatch, result.output);
      totalIterations += result.iterations;
      if (result.limitReached) {
        limitReached = true;
      }
    }

    return { output, totalIterations, limitReached };
  }

  /**
   * Log evaluation result
   */
  private logResult(
    totalIterations: number,
    evaluationTime: number,
    limitReached: boolean,
    blockCount: number
  ): void {
    logger.debug({
      msg: 'Loop evaluation completed',
      totalIterations,
      evaluationTime,
      limitReached,
      blockCount,
    });
  }

  /**
   * Evaluate a single loop block
   */
  private async evaluateBlock(
    block: LoopBlock,
    context: EvaluationContext
  ): Promise<{ output: string; iterations: number; limitReached: boolean }> {
    const items = this.getItems(block.itemsVar, context);

    if (!Array.isArray(items) || items.length === 0) {
      if (!Array.isArray(items)) this.logNonArrayWarning(block.itemsVar, items);
      return { output: '', iterations: 0, limitReached: false };
    }

    const { iterationLimit, limitReached } = this.calculateIterationLimit(
      items.length,
      block.itemsVar
    );
    const outputs = await this.processIterations(
      items,
      iterationLimit,
      block.content,
      context
    );

    return {
      output: outputs.join(''),
      iterations: iterationLimit,
      limitReached,
    };
  }

  /**
   * Get items from context or variable store
   */
  private getItems(itemsVar: string, context: EvaluationContext): unknown {
    return (
      context.variables[itemsVar] ??
      this.variableStore.get(itemsVar, context.stepId)
    );
  }

  /**
   * Log non-array warning
   */
  private logNonArrayWarning(itemsVar: string, items: unknown): void {
    logger.warn({
      msg: 'Loop items not an array',
      itemsVar,
      type: typeof items,
    });
  }

  /**
   * Calculate iteration limit
   */
  private calculateIterationLimit(
    itemsLength: number,
    itemsVar: string
  ): { iterationLimit: number; limitReached: boolean } {
    const iterationLimit = Math.min(itemsLength, this.maxIterations);
    const limitReached = itemsLength > this.maxIterations;

    if (limitReached) {
      logger.warn({
        msg: 'Loop iteration limit reached',
        itemsVar,
        itemCount: itemsLength,
        limit: this.maxIterations,
      });
    }

    return { iterationLimit, limitReached };
  }

  /**
   * Process all iterations
   */
  private async processIterations(
    items: unknown[],
    iterationLimit: number,
    content: string,
    context: EvaluationContext
  ): Promise<string[]> {
    const outputs: string[] = [];

    for (let i = 0; i < iterationLimit; i++) {
      const output = await this.processIteration(items, i, content, context);
      outputs.push(output);
    }

    return outputs;
  }

  /**
   * Process single iteration
   */
  private async processIteration(
    items: unknown[],
    index: number,
    content: string,
    context: EvaluationContext
  ): Promise<string> {
    const loopContext = this.contextFactory.createLoopContext(
      items,
      index,
      context
    );
    const loopVars = this.contextFactory.createLoopVariables(
      items[index],
      index,
      loopContext,
      context
    );
    const loopEvalContext = this.contextFactory.createLoopEvalContext(
      context,
      loopVars,
      loopContext
    );

    return await this.processContent(content, loopEvalContext);
  }

  /**
   * Process content (may contain nested structures)
   */
  private async processContent(
    content: string,
    context: EvaluationContext
  ): Promise<string> {
    this.checkNestingDepth(context);

    let output = content;

    if (this.hasLoops(output)) {
      const result = await this.evaluate(output, context);
      output = result.output;
    }

    return this.substituteLoopVariables(output, context);
  }

  /**
   * Check nesting depth
   */
  private checkNestingDepth(context: EvaluationContext): void {
    if (context.nestingDepth >= context.maxNestingDepth) {
      throw new Error(
        `Maximum nesting depth of ${context.maxNestingDepth} exceeded`
      );
    }
  }

  /**
   * Substitute loop variables
   */
  private substituteLoopVariables(
    content: string,
    context: EvaluationContext
  ): string {
    return content
      .replace(/\{\{this\}\}/g, String(context.variables.this ?? ''))
      .replace(/\{\{@index\}\}/g, String(context.variables['@index'] ?? ''))
      .replace(/\{\{@first\}\}/g, String(context.variables['@first'] ?? ''))
      .replace(/\{\{@last\}\}/g, String(context.variables['@last'] ?? ''));
  }

  /**
   * Check if content contains loop blocks
   */
  private hasLoops(content: string): boolean {
    return /\{\{#each\s/.test(content);
  }
}
