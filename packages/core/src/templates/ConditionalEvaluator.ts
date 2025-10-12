/**
 * Conditional Evaluator - Handles {{#if}}, {{else if}}, {{else}} template syntax
 * Supports boolean conditions, comparison operators, and logical operators
 */

import { createLogger } from '../utils/logger';
import type { VariableStore } from '../variables/VariableStore';
import {
  ConditionalBlockParser,
  type ConditionalBlock,
} from './ConditionalBlockParser';
import type { TemplateSandbox } from './TemplateSandbox';
import type { EvaluationContext, ConditionalResult } from './advanced-types';

const logger = createLogger('checklist:templates:conditional');

/**
 * Evaluates conditional template syntax
 */
export class ConditionalEvaluator {
  private readonly parser: ConditionalBlockParser;

  constructor(
    private readonly variableStore: VariableStore,
    private readonly sandbox: TemplateSandbox
  ) {
    this.parser = new ConditionalBlockParser();
  }

  /**
   * Evaluate all conditional blocks in template
   */
  async evaluate(
    template: string,
    context: EvaluationContext
  ): Promise<ConditionalResult> {
    const startTime = performance.now();
    this.checkNestingDepth(context);

    const blocks = this.parser.parse(template);
    const { output, conditionsMet } = await this.evaluateBlocks(
      template,
      blocks,
      context
    );

    const evaluationTime = performance.now() - startTime;
    this.logEvaluationResult(conditionsMet, evaluationTime, blocks.length);

    return { output, conditionsMet, evaluationTime };
  }

  /**
   * Check nesting depth limit
   */
  private checkNestingDepth(context: EvaluationContext): void {
    if (context.nestingDepth >= context.maxNestingDepth) {
      throw new Error(
        `Maximum nesting depth of ${context.maxNestingDepth} exceeded`
      );
    }
  }

  /**
   * Evaluate all blocks
   */
  private async evaluateBlocks(
    template: string,
    blocks: ConditionalBlock[],
    context: EvaluationContext
  ): Promise<{ output: string; conditionsMet: number }> {
    let output = template;
    let conditionsMet = 0;

    for (const block of blocks) {
      const result = await this.evaluateBlock(block, context);
      output = output.replace(block.fullMatch, result.output);
      if (result.conditionMet) {
        conditionsMet++;
      }
    }

    return { output, conditionsMet };
  }

  /**
   * Log evaluation result
   */
  private logEvaluationResult(
    conditionsMet: number,
    evaluationTime: number,
    blockCount: number
  ): void {
    logger.debug({
      msg: 'Conditional evaluation completed',
      conditionsMet,
      evaluationTime,
      blockCount,
    });
  }

  /**
   * Evaluate a single conditional block
   */
  private async evaluateBlock(
    block: ConditionalBlock,
    context: EvaluationContext
  ): Promise<{ output: string; conditionMet: boolean }> {
    const ifResult = await this.evaluateIfCondition(block, context);
    if (ifResult !== null) return ifResult;

    const elseIfResult = await this.evaluateElseIfConditions(block, context);
    if (elseIfResult !== null) return elseIfResult;

    return this.evaluateElseCondition(block, context);
  }

  /**
   * Evaluate if condition
   */
  private async evaluateIfCondition(
    block: {
      ifCondition: string;
      ifContent: string;
    },
    context: EvaluationContext
  ): Promise<{ output: string; conditionMet: boolean } | null> {
    const ifResult = await this.evaluateCondition(block.ifCondition, context);

    if (ifResult) {
      return {
        output: await this.processContent(block.ifContent, context),
        conditionMet: true,
      };
    }

    return null;
  }

  /**
   * Evaluate else-if conditions
   */
  private async evaluateElseIfConditions(
    block: {
      elseIfBlocks: Array<{ condition: string; content: string }>;
    },
    context: EvaluationContext
  ): Promise<{ output: string; conditionMet: boolean } | null> {
    for (const elseIf of block.elseIfBlocks) {
      const result = await this.evaluateCondition(elseIf.condition, context);
      if (result) {
        return {
          output: await this.processContent(elseIf.content, context),
          conditionMet: true,
        };
      }
    }

    return null;
  }

  /**
   * Evaluate else condition
   */
  private async evaluateElseCondition(
    block: { elseContent?: string },
    context: EvaluationContext
  ): Promise<{ output: string; conditionMet: boolean }> {
    if (block.elseContent !== undefined) {
      return {
        output: await this.processContent(block.elseContent, context),
        conditionMet: false,
      };
    }

    return { output: '', conditionMet: false };
  }

  /**
   * Evaluate a boolean condition using TemplateSandbox
   */
  private async evaluateCondition(
    condition: string,
    context: EvaluationContext
  ): Promise<boolean> {
    try {
      // Use TemplateSandbox.evaluateCondition() for safe evaluation
      const result = await this.sandbox.evaluateCondition(
        condition,
        context.variables,
        'conditional-evaluator'
      );

      context.performanceMetrics.evaluations++;

      return result;
    } catch (error) {
      logger.error({
        msg: 'Condition evaluation failed',
        condition,
        error: (error as Error).message,
      });
      return false; // Fail-safe: return false on error
    }
  }

  /**
   * Process content (may contain nested structures)
   */
  private async processContent(
    content: string,
    context: EvaluationContext
  ): Promise<string> {
    // Create nested context with incremented depth
    const nestedContext: EvaluationContext = {
      ...context,
      nestingDepth: context.nestingDepth + 1,
    };

    // Check for nested conditionals
    if (this.hasConditionals(content)) {
      const result = await this.evaluate(content, nestedContext);
      return result.output;
    }

    return content;
  }

  /**
   * Check if content contains conditional blocks
   */
  private hasConditionals(content: string): boolean {
    return /\{\{#if\s/.test(content);
  }
}
