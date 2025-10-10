/**
 * Variable Management System - Variable Prompter
 * Prompts users for required variables (console-based)
 */

import { createLogger } from '../utils/logger';
import { EnvironmentVariableResolver } from './EnvironmentVariableResolver';
import { VariableStore } from './VariableStore';
import { VariableValidator } from './VariableValidator';
import type { VariableDefinition, VariableValue } from './types';

const logger = createLogger('checklist:variables:prompter');

/**
 * Prompts users for required variables
 * Note: This is a simplified console-based implementation.
 * TUI-based prompting will be added in a future story.
 */
export class VariablePrompter {
  private readonly validator: VariableValidator;
  private readonly envResolver: EnvironmentVariableResolver;
  private readonly maxAttempts = 3;

  constructor(envResolver?: EnvironmentVariableResolver) {
    this.validator = new VariableValidator();
    this.envResolver = envResolver ?? new EnvironmentVariableResolver();
  }

  /**
   * Prompt for all required variables
   */
  async promptRequired(
    definitions: VariableDefinition[],
    store: VariableStore
  ): Promise<void> {
    const required = this.getRequiredVariables(definitions, store);

    if (required.length === 0) {
      logger.info({
        msg: 'No required variables to prompt',
      });
      return;
    }

    logger.info({
      msg: 'Prompting for required variables',
      count: required.length,
    });

    for (const def of required) {
      await this.promptSingle(def, store);
    }

    // Persist after all prompts
    await store.persist();
  }

  /**
   * Get list of required variables that need prompting
   */
  private getRequiredVariables(
    definitions: VariableDefinition[],
    store: VariableStore
  ): VariableDefinition[] {
    return definitions.filter((def) => {
      // Skip if not required
      if (!def.required) return false;

      // Skip if already has value
      if (store.has(def.name)) return false;

      // Skip if computed (will be evaluated automatically)
      if (def.computed !== undefined) return false;

      return true;
    });
  }

  /**
   * Prompt for single variable
   */
  private async promptSingle(
    definition: VariableDefinition,
    store: VariableStore
  ): Promise<void> {
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      try {
        const value = await this.getValueForVariable(definition);
        this.validator.validateOrThrow(value, definition);
        store.set(definition.name, value);

        logger.info({
          msg: 'Variable value stored',
          name: definition.name,
        });

        return;
      } catch (error) {
        attempts++;
        this.handleValidationError(definition.name, attempts, error as Error);
      }
    }
  }

  /**
   * Handle validation error and throw if max attempts reached
   */
  private handleValidationError(
    variableName: string,
    attempts: number,
    error: Error
  ): void {
    logger.warn({
      msg: 'Variable validation failed',
      name: variableName,
      attempt: attempts,
      error: error.message,
    });

    if (attempts >= this.maxAttempts) {
      throw new Error(
        `Failed to get valid value for required variable '${variableName}' after ${this.maxAttempts} attempts`
      );
    }
  }

  /**
   * Get value for variable (from default or environment)
   */
  private async getValueForVariable(
    definition: VariableDefinition
  ): Promise<VariableValue> {
    // Try environment variable default
    const envValue = this.tryResolveEnvDefault(definition);
    if (envValue !== undefined) {
      return envValue;
    }

    // Use regular default if available
    if (definition.default !== undefined) {
      return definition.default;
    }

    // For testing/CLI mode, throw error if no default
    throw new Error(
      `No default value available for required variable '${definition.name}'. ` +
        `Interactive prompting will be implemented in TUI story.`
    );
  }

  /**
   * Try to resolve environment variable default value
   */
  private tryResolveEnvDefault(
    definition: VariableDefinition
  ): VariableValue | undefined {
    if (
      definition.default !== undefined &&
      typeof definition.default === 'string' &&
      definition.default.startsWith('$ENV:')
    ) {
      try {
        const envValue = this.envResolver.resolve(definition.default);
        if (envValue !== undefined) {
          logger.debug({
            msg: 'Using environment variable as default',
            name: definition.name,
            envVar: definition.default,
          });
          return envValue;
        }
      } catch (error) {
        logger.warn({
          msg: 'Failed to resolve environment variable default',
          name: definition.name,
          error: (error as Error).message,
        });
      }
    }
    return undefined;
  }

  /**
   * Validate variable value without storing
   */
  validateValue(definition: VariableDefinition, value: unknown): boolean {
    const result = this.validator.validate(value, definition);
    return result.valid;
  }
}
