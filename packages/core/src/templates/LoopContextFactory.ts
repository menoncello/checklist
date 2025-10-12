/**
 * Loop Context Factory - Creates loop contexts and variables
 */

import type { EvaluationContext, LoopContext } from './advanced-types';

/**
 * Factory for creating loop contexts and variables
 */
export class LoopContextFactory {
  /**
   * Create loop context
   */
  createLoopContext(
    items: unknown[],
    index: number,
    context: EvaluationContext
  ): LoopContext {
    return {
      items,
      index,
      first: index === 0,
      last: index === items.length - 1,
      parent: context.loopContext,
    };
  }

  /**
   * Create loop variables
   */
  createLoopVariables(
    item: unknown,
    index: number,
    loopContext: LoopContext,
    context: EvaluationContext
  ): Record<string, unknown> {
    const loopVars: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context.variables)) {
      if (!['this', '@index', '@first', '@last'].includes(key)) {
        loopVars[key] = value;
      }
    }

    loopVars.this = item;
    loopVars['@index'] = index;
    loopVars['@first'] = loopContext.first;
    loopVars['@last'] = loopContext.last;

    return loopVars;
  }

  /**
   * Create loop evaluation context
   */
  createLoopEvalContext(
    context: EvaluationContext,
    loopVars: Record<string, unknown>,
    loopContext: LoopContext
  ): EvaluationContext {
    return {
      ...context,
      variables: loopVars,
      loopContext,
      nestingDepth: context.nestingDepth + 1,
    };
  }
}
