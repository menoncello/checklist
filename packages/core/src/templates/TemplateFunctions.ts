/**
 * Template Functions - Built-in template functions
 * Supports ${fn:functionName(args)} syntax
 */

import { createLogger } from '../utils/logger';
import { FunctionRegistryImpl } from './FunctionRegistry';
import type {
  EvaluationContext,
  TemplateFunction,
  FunctionRegistry,
} from './advanced-types';

const logger = createLogger('checklist:templates:functions');

/**
 * Template functions evaluator
 */
export class TemplateFunctions {
  private static readonly FUNCTION_PATTERN =
    /\$\{fn:([a-zA-Z0-9_]+)\(([^)]*)\)\}/g;
  private registry: FunctionRegistry;

  constructor() {
    this.registry = new FunctionRegistryImpl();
    this.registry.registerAllBuiltIn();
  }

  /**
   * Evaluate template functions
   */
  evaluate(template: string, context: EvaluationContext): string {
    return template.replace(
      TemplateFunctions.FUNCTION_PATTERN,
      (match, fnName, argsStr) =>
        this.evaluateFunction(match, fnName, argsStr, context)
    );
  }

  /**
   * Evaluate single function
   */
  private evaluateFunction(
    match: string,
    fnName: string,
    argsStr: string,
    context: EvaluationContext
  ): string {
    const fn = this.registry.get(fnName);

    if (fn === undefined) {
      return this.handleUnknownFunction(fnName, match);
    }

    if (!fn.safe) {
      return this.handleUnsafeFunction(fnName, match);
    }

    const args = this.parseArgs(argsStr, context);

    if (!fn.validate(args)) {
      return this.handleInvalidArgs(fnName, args, match);
    }

    return this.execFunc({ fn, args, fnName, context, match });
  }

  /**
   * Handle unknown function
   */
  private handleUnknownFunction(fnName: string, match: string): string {
    logger.warn({ msg: 'Unknown template function', fnName });
    return match;
  }

  /**
   * Handle unsafe function
   */
  private handleUnsafeFunction(fnName: string, match: string): string {
    logger.error({ msg: 'Unsafe function attempted', fnName });
    return match;
  }

  /**
   * Handle invalid arguments
   */
  private handleInvalidArgs(
    fnName: string,
    args: unknown[],
    match: string
  ): string {
    logger.error({ msg: 'Invalid function arguments', fnName, args });
    return match;
  }

  /**
   * Execute function
   */
  private execFunc(params: {
    fn: TemplateFunction;
    args: unknown[];
    fnName: string;
    context: EvaluationContext;
    match: string;
  }): string {
    try {
      const result = params.fn.execute(params.args, params.context);
      return String(result ?? '');
    } catch (error) {
      logger.error({
        msg: 'Function execution failed',
        fnName: params.fnName,
        error: (error as Error).message,
      });
      return params.match;
    }
  }

  /**
   * Parse function arguments
   */
  private parseArgs(argsStr: string, context: EvaluationContext): unknown[] {
    if (argsStr.trim() === '') return [];

    const tokens = this.tokenizeArgs(argsStr);
    return tokens.map((token) => this.parseArg(token.trim(), context));
  }

  /**
   * Tokenize arguments by commas (not inside quotes)
   */
  private tokenizeArgs(argsStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      const result = this.processArgChar(char, inQuotes, quoteChar, current);

      if (result.addArg) {
        args.push(current.trim());
        current = '';
        inQuotes = result.inQuotes;
        quoteChar = result.quoteChar;
      } else {
        current = result.current;
        inQuotes = result.inQuotes;
        quoteChar = result.quoteChar;
      }
    }

    if (current.trim() !== '') {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Process single argument character
   */
  private processArgChar(
    char: string,
    inQuotes: boolean,
    quoteChar: string,
    current: string
  ): {
    current: string;
    inQuotes: boolean;
    quoteChar: string;
    addArg: boolean;
  } {
    const isQuote = char === '"' || char === "'";

    if (isQuote && !inQuotes) {
      return this.handleQuoteStart(char, current);
    }

    if (char === quoteChar && inQuotes) {
      return this.handleQuoteEnd(current, char);
    }

    if (char === ',' && !inQuotes) {
      return this.handleComma(current, inQuotes, quoteChar);
    }

    return this.handleRegularChar(char, current, inQuotes, quoteChar);
  }

  private handleQuoteStart(
    char: string,
    current: string
  ): {
    current: string;
    inQuotes: boolean;
    quoteChar: string;
    addArg: boolean;
  } {
    return {
      current: current + char,
      inQuotes: true,
      quoteChar: char,
      addArg: false,
    };
  }

  private handleQuoteEnd(
    current: string,
    closeChar: string
  ): {
    current: string;
    inQuotes: boolean;
    quoteChar: string;
    addArg: boolean;
  } {
    return {
      current: current + closeChar,
      inQuotes: false,
      quoteChar: '',
      addArg: false,
    };
  }

  private handleComma(
    current: string,
    inQuotes: boolean,
    quoteChar: string
  ): {
    current: string;
    inQuotes: boolean;
    quoteChar: string;
    addArg: boolean;
  } {
    return {
      current,
      inQuotes,
      quoteChar,
      addArg: true,
    };
  }

  private handleRegularChar(
    char: string,
    current: string,
    inQuotes: boolean,
    quoteChar: string
  ): {
    current: string;
    inQuotes: boolean;
    quoteChar: string;
    addArg: boolean;
  } {
    return {
      current: current + char,
      inQuotes,
      quoteChar,
      addArg: false,
    };
  }

  /**
   * Parse a single argument
   */
  private parseArg(arg: string, context: EvaluationContext): unknown {
    // String literal
    if (
      (arg.startsWith('"') && arg.endsWith('"')) ||
      (arg.startsWith("'") && arg.endsWith("'"))
    ) {
      return arg.slice(1, -1);
    }

    // Number
    const num = Number(arg);
    if (!isNaN(num)) {
      return num;
    }

    // Boolean
    if (arg === 'true') return true;
    if (arg === 'false') return false;

    // Variable reference
    return context.variables[arg];
  }

  /**
   * Register custom function
   */
  registerFunction(name: string, fn: TemplateFunction): void {
    this.registry.register(name, fn);
  }

  /**
   * Get function registry
   */
  getRegistry(): FunctionRegistry {
    return this.registry;
  }
}
