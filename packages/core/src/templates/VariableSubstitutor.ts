/**
 * Variable Substitution System - Core Substitution Engine
 * Handles ${variable} substitution with nesting, defaults, and escaping
 */

import { createLogger } from '../utils/logger';
import type { VariableStore } from '../variables/VariableStore';
import type { VariableValue } from '../variables/types';
import { NestingDepthExceededError } from './errors';
import type {
  SubstitutionConfig,
  SubstitutionError,
  SubstitutionResult,
} from './substitution-types';

const logger = createLogger('checklist:templates:substitutor');

/**
 * Default configuration for substitution
 */
const DEFAULT_CONFIG: SubstitutionConfig = {
  maxNestingDepth: 5,
  allowUndefinedVariables: false,
  useDefaultValues: true,
  enableCaching: true,
  escapePattern: '\\',
};

/**
 * Handles variable substitution in templates
 */
export class VariableSubstitutor {
  // Regex patterns (compiled once for performance)
  private static readonly VARIABLE_PATTERN =
    /\$\{([a-zA-Z0-9_.-]+)(?::-(.*?))?\}/g;
  private static readonly INVALID_VARIABLE_PATTERN = /\$\{([^}]+)\}/g;
  private static readonly ESCAPE_PATTERN = /\\(\$\{[^}]+\})/g;
  private static readonly NESTED_PATTERN = /\$\{([^}]*\$\{[^}]+\}[^}]*)\}/;
  private static readonly VARIABLE_NAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

  private config: SubstitutionConfig;

  constructor(
    private readonly variableStore: VariableStore,
    config?: Partial<SubstitutionConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Substitute variables in template
   */
  substitute(template: string, stepId?: string): SubstitutionResult {
    const startTime = performance.now();
    const variablesUsed: string[] = [];
    const errors: SubstitutionError[] = [];

    try {
      const { processed: unescaped, escapes } =
        this.processEscapes(template);

      const { output, nestingDepth } = this.resolveNested(
        unescaped,
        stepId,
        variablesUsed,
        errors
      );

      const finalOutput = this.restoreEscapes(output, escapes);
      const duration = performance.now() - startTime;

      this.logSuccess(duration, variablesUsed.length, nestingDepth, errors.length);

      return this.buildResult(finalOutput, variablesUsed, errors, {
        duration,
        nestingDepth,
      });
    } catch (error) {
      this.logError(error as Error, performance.now() - startTime);
      throw error;
    }
  }

  /**
   * Resolve nested variables up to max depth
   */
  private resolveNested(
    text: string,
    stepId: string | undefined,
    variablesUsed: string[],
    errors: SubstitutionError[]
  ): { output: string; nestingDepth: number } {
    let output = text;
    let nestingDepth = 0;

    while (
      VariableSubstitutor.NESTED_PATTERN.test(output) &&
      nestingDepth < this.config.maxNestingDepth
    ) {
      output = this.resolveVariables(output, stepId, variablesUsed, errors);
      nestingDepth++;
    }

    if (VariableSubstitutor.NESTED_PATTERN.test(output)) {
      throw new NestingDepthExceededError(
        this.config.maxNestingDepth,
        nestingDepth
      );
    }

    output = this.resolveVariables(output, stepId, variablesUsed, errors);

    return { output, nestingDepth };
  }

  /**
   * Build substitution result
   */
  private buildResult(
    output: string,
    variablesUsed: string[],
    errors: SubstitutionError[],
    metadata: { duration: number; nestingDepth: number }
  ): SubstitutionResult {
    return {
      output,
      variablesUsed: Array.from(new Set(variablesUsed)),
      errors,
      metadata: {
        duration: metadata.duration,
        variableCount: variablesUsed.length,
        nestingDepth: metadata.nestingDepth,
      },
    };
  }

  /**
   * Log successful substitution
   */
  private logSuccess(
    duration: number,
    variableCount: number,
    nestingDepth: number,
    errorCount: number
  ): void {
    logger.debug({
      msg: 'Variable substitution completed',
      duration,
      variableCount,
      nestingDepth,
      errorCount,
    });
  }

  /**
   * Log substitution error
   */
  private logError(error: Error, duration: number): void {
    logger.error({
      msg: 'Variable substitution failed',
      error: error.message,
      duration,
    });
  }

  /**
   * Resolve variables in text
   */
  private resolveVariables(
    text: string,
    stepId: string | undefined,
    variablesUsed: string[],
    errors: SubstitutionError[]
  ): string {
    return text.replace(
      VariableSubstitutor.VARIABLE_PATTERN,
      (match, varName, defaultValue) =>
        this.replaceVariable({
          match,
          varName,
          defaultValue,
          stepId,
          variablesUsed,
          errors,
        })
    );
  }

  /**
   * Replace a single variable reference
   */
  private replaceVariable(params: {
    match: string;
    varName: string;
    defaultValue?: string;
    stepId?: string;
    variablesUsed: string[];
    errors: SubstitutionError[];
  }): string {
    const { match, varName, defaultValue, stepId, variablesUsed, errors } =
      params;

    if (!this.validateVariableName(varName)) {
      errors.push({
        variableName: varName,
        message: `Invalid variable name: ${varName}`,
        suggestions: [],
      });
      return match;
    }

    variablesUsed.push(varName);
    const value = this.variableStore.get(varName, stepId);

    return value !== undefined
      ? this.formatValue(value)
      : this.handleMissingVariable({ match, varName, defaultValue, stepId, errors });
  }

  /**
   * Handle missing variable with default or error
   */
  private handleMissingVariable(params: {
    match: string;
    varName: string;
    defaultValue?: string;
    stepId?: string;
    errors: SubstitutionError[];
  }): string {
    const { match, varName, defaultValue, stepId, errors } = params;
    if (defaultValue !== undefined && this.config.useDefaultValues) {
      return defaultValue;
    }

    if (!this.config.allowUndefinedVariables) {
      errors.push(this.createUndefinedVariableError(varName, stepId));
      return match;
    }

    return '';
  }

  /**
   * Validate variable name against allowed pattern
   */
  private validateVariableName(name: string): boolean {
    return VariableSubstitutor.VARIABLE_NAME_PATTERN.test(name);
  }

  /**
   * Format variable value to string
   */
  private formatValue(value: VariableValue): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    if (Array.isArray(value)) {
      return value.map((v) => this.formatValue(v)).join(', ');
    }
    return String(value);
  }

  /**
   * Process escape sequences
   */
  private processEscapes(text: string): {
    processed: string;
    escapes: Map<string, string>;
  } {
    const escapes = new Map<string, string>();
    let index = 0;

    const processed = text.replace(
      VariableSubstitutor.ESCAPE_PATTERN,
      (match, escaped) => {
        const placeholder = `__ESCAPED_${index}__`;
        escapes.set(placeholder, escaped);
        index++;
        return placeholder;
      }
    );

    return { processed, escapes };
  }

  /**
   * Restore escaped sequences
   */
  private restoreEscapes(
    text: string,
    escapes: Map<string, string>
  ): string {
    let result = text;
    for (const [placeholder, original] of escapes) {
      result = result.replace(placeholder, original);
    }
    return result;
  }

  /**
   * Create error for undefined variable
   */
  private createUndefinedVariableError(
    varName: string,
    stepId?: string
  ): SubstitutionError {
    // Get all available variables for suggestions
    const availableVars = Object.keys(this.variableStore.getAll(stepId));
    const suggestions = this.fuzzyMatch(varName, availableVars);

    return {
      variableName: varName,
      message: `Variable '${varName}' is not defined`,
      suggestions,
    };
  }

  /**
   * Find similar variable names using fuzzy matching
   */
  private fuzzyMatch(target: string, candidates: string[]): string[] {
    return candidates
      .map((candidate) => ({
        candidate,
        distance: this.levenshteinDistance(target, candidate),
      }))
      .filter((item) => item.distance <= 3)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((item) => item.candidate);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
