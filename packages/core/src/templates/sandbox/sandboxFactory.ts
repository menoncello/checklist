/**
 * Sandbox creation and configuration
 * Factory functions for creating secure execution contexts
 */

import { NetworkAccessError } from '../errors';
import type { SandboxContext } from '../types';
import { NETWORK_GLOBALS } from './sandboxConstants';

/**
 * Create sandboxed execution context
 * @param context - User-provided variables
 * @param log - Logging function
 * @returns Frozen sandbox context
 */
export function createSandboxContext(
  context: Record<string, unknown>,
  log: (level: string, args: unknown[]) => void
): SandboxContext {
  const sandbox: SandboxContext = {
    variables: context,
    console: {
      log: (...args: unknown[]) => log('info', args),
      error: (...args: unknown[]) => log('error', args),
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

  // Block network globals by defining error-throwing getters
  blockNetworkGlobals(sandbox);

  // Freeze the sandbox to prevent modifications
  return Object.freeze(sandbox);
}

/**
 * Block network-related globals in sandbox
 * @param sandbox - Sandbox context to modify
 */
export function blockNetworkGlobals(sandbox: SandboxContext): void {
  for (const global of NETWORK_GLOBALS) {
    Object.defineProperty(sandbox, global, {
      get() {
        throw new NetworkAccessError(
          'unknown',
          `Network access via '${global}' is blocked in templates`
        );
      },
      configurable: false,
      enumerable: false,
    });
  }
}

/**
 * Evaluate expression safely using Function constructor
 * @param expression - Expression to evaluate
 * @param sandbox - Sandbox context
 * @returns Evaluation result
 */
export function evaluateExpressionSafely(
  expression: string,
  sandbox: SandboxContext
): unknown {
  // Use Function constructor with limited scope for safe evaluation
  // This is safer than eval() because we control the scope
  try {
    // Create function parameters from sandbox variables
    const varNames = Object.keys(sandbox.variables);
    const varValues = Object.values(sandbox.variables);

    // Also include Math object
    varNames.push('Math');
    varValues.push(sandbox.Math ?? Math);

    // Create a function that evaluates the expression with available variables
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      ...varNames,
      `'use strict'; return (${expression});`
    );

    // Execute the function with the variable values
    return fn(...varValues);
  } catch (error) {
    throw new Error(
      `Expression evaluation failed: ${(error as Error).message}`
    );
  }
}
