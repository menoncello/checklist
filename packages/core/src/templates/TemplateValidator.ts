/**
 * TemplateValidator - Validates template schema and content
 * Uses Ajv for JSON schema validation
 */

import Ajv, { type ValidateFunction } from 'ajv';
import { TemplateValidationError } from './errors';
import { TEMPLATE_SCHEMA } from './schema';
import type {
  ChecklistTemplate,
  TemplateValidationResult,
} from './types';

/**
 * TemplateValidator validates template structure and content
 */
export class TemplateValidator {
  private readonly ajv: Ajv;
  private readonly validateFn: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    this.validateFn = this.ajv.compile(TEMPLATE_SCHEMA);
  }

  /**
   * Validate template against schema
   */
  validate(template: unknown): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Schema validation
    const schemaValid = this.validateFn(template);
    if (!schemaValid && this.validateFn.errors !== null) {
      for (const error of this.validateFn.errors) {
        const path =
          error.instancePath !== '' ? error.instancePath : 'root';
        errors.push(`${path}: ${error.message ?? 'validation error'}`);
      }
    }

    if (!schemaValid) {
      return { valid: false, errors, warnings };
    }

    // Additional content validation
    const typedTemplate = template as ChecklistTemplate;
    this.validateContent(typedTemplate, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate template content beyond schema
   */
  private validateContent(
    template: ChecklistTemplate,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate variable defaults match their types
    this.validateVariableDefaults(template, errors);

    // Validate step dependencies exist
    this.validateStepDependencies(template, errors);

    // Validate no circular dependencies
    this.validateNoCircularDependencies(template, errors);

    // Validate condition syntax
    this.validateConditions(template, warnings);

    // Validate variable substitutions
    this.validateVariableSubstitutions(template, warnings);
  }

  /**
   * Validate variable defaults match declared types
   */
  private validateVariableDefaults(
    template: ChecklistTemplate,
    errors: string[]
  ): void {
    for (const variable of template.variables) {
      if (variable.default === undefined) {
        if (variable.required) {
          // Required variables should not have undefined defaults
          continue;
        }
        continue;
      }

      const defaultType = typeof variable.default;
      const isArray = Array.isArray(variable.default);

      if (variable.type === 'array' && !isArray) {
        errors.push(
          `Variable "${variable.name}": default value must be an array`
        );
      } else if (
        variable.type !== 'array' &&
        defaultType !== variable.type
      ) {
        errors.push(
          `Variable "${variable.name}": default value type "${defaultType}" does not match declared type "${variable.type}"`
        );
      }
    }
  }

  /**
   * Validate step dependencies exist
   */
  private validateStepDependencies(
    template: ChecklistTemplate,
    errors: string[]
  ): void {
    const stepIds = new Set(template.steps.map((s) => s.id));

    for (const step of template.steps) {
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          errors.push(
            `Step "${step.id}": dependency "${depId}" does not exist`
          );
        }
      }
    }
  }

  /**
   * Validate no circular dependencies
   */
  private validateNoCircularDependencies(
    template: ChecklistTemplate,
    errors: string[]
  ): void {
    const context = {
      visited: new Set<string>(),
      recursionStack: new Set<string>(),
      template,
      errors,
    };

    for (const step of template.steps) {
      if (!context.visited.has(step.id)) {
        this.detectCycleDFS(step.id, [], context);
      }
    }
  }

  /**
   * Detect cycle using depth-first search
   */
  private detectCycleDFS(
    stepId: string,
    path: string[],
    context: {
      visited: Set<string>;
      recursionStack: Set<string>;
      template: ChecklistTemplate;
      errors: string[];
    }
  ): boolean {
    if (context.recursionStack.has(stepId)) {
      context.errors.push(
        `Circular dependency detected: ${path.join(' → ')} → ${stepId}`
      );
      return true;
    }

    if (context.visited.has(stepId)) {
      return false;
    }

    context.visited.add(stepId);
    context.recursionStack.add(stepId);

    const step = context.template.steps.find((s) => s.id === stepId);
    if (step !== undefined) {
      for (const depId of step.dependencies) {
        this.detectCycleDFS(depId, [...path, stepId], context);
      }
    }

    context.recursionStack.delete(stepId);
    return false;
  }

  /**
   * Validate condition syntax
   */
  private validateConditions(
    template: ChecklistTemplate,
    warnings: string[]
  ): void {
    for (const step of template.steps) {
      if (step.condition !== undefined && step.condition !== '') {
        this.validateStepCondition(step, template.variables, warnings);
      }
    }
  }

  /**
   * Validate a single step condition
   */
  private validateStepCondition(
    step: { id: string; condition: string },
    variables: Array<{ name: string }>,
    warnings: string[]
  ): void {
    const varPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const matches = Array.from(step.condition.matchAll(varPattern));

    for (const match of matches) {
      const varName = match[1];
      const varExists = variables.some((v) => v.name === varName);

      if (!varExists) {
        warnings.push(
          `Step "${step.id}": condition references undefined variable "${varName}"`
        );
      }
    }
  }

  /**
   * Validate variable substitutions in commands
   */
  private validateVariableSubstitutions(
    template: ChecklistTemplate,
    warnings: string[]
  ): void {
    const varNames = new Set(template.variables.map((v) => v.name));

    for (const step of template.steps) {
      this.validateStepCommands(step, varNames, warnings);
    }
  }

  /**
   * Validate commands in a step
   */
  private validateStepCommands(
    step: { id: string; commands: Array<{ id: string; content: string }> },
    varNames: Set<string>,
    warnings: string[]
  ): void {
    for (const command of step.commands) {
      this.validateCommandVariables(step.id, command, varNames, warnings);
    }
  }

  /**
   * Validate variables in a command
   */
  private validateCommandVariables(
    stepId: string,
    command: { id: string; content: string },
    varNames: Set<string>,
    warnings: string[]
  ): void {
    const varPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const matches = Array.from(command.content.matchAll(varPattern));

    for (const match of matches) {
      const varName = match[1];
      if (!varNames.has(varName)) {
        warnings.push(
          `Step "${stepId}", command "${command.id}": references undefined variable "${varName}"`
        );
      }
    }
  }

  /**
   * Validate and throw if template is invalid
   */
  validateOrThrow(template: unknown, templateId: string): void {
    const result = this.validate(template);

    if (!result.valid) {
      throw new TemplateValidationError(
        templateId,
        result.errors,
        { warnings: result.warnings }
      );
    }
  }
}
