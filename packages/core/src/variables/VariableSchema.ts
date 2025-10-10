/**
 * Variable Management System - Schema Validation
 * Ajv-based schema validation for variable definitions
 */

import Ajv from 'ajv';
import { VariableValidationError } from './errors';
import type { VariableDefinition } from './types';

/**
 * JSON Schema for VariableDefinition
 * Note: Using 'any' for default as it can be string | number | boolean | unknown[] | undefined
 */
const variableDefinitionSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: ['string', 'number', 'boolean', 'array'] },
    required: { type: 'boolean' },
    default: { nullable: true },
    description: { type: 'string' },
    validation: {
      type: 'object',
      nullable: true,
      properties: {
        pattern: { type: 'string', nullable: true },
        min: { type: 'number', nullable: true },
        max: { type: 'number', nullable: true },
        enum: { type: 'array', nullable: true, items: {} },
      },
      required: [],
      additionalProperties: false,
    },
    computed: {
      type: 'object',
      nullable: true,
      properties: {
        expression: { type: 'string' },
        dependencies: { type: 'array', items: { type: 'string' } },
      },
      required: ['expression', 'dependencies'],
      additionalProperties: false,
    },
    scope: {
      type: 'string',
      enum: ['global', 'step'],
      nullable: true,
    },
  },
  required: ['name', 'type', 'required', 'description'],
  additionalProperties: false,
};

/**
 * Schema validator for variable definitions
 */
export class VariableSchema {
  private readonly ajv: Ajv;
  private readonly validateDefinition: ReturnType<Ajv['compile']>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: true });
    this.validateDefinition = this.ajv.compile(variableDefinitionSchema);
  }

  /**
   * Validate a variable definition against schema
   */
  validate(definition: unknown): definition is VariableDefinition {
    return this.validateDefinition(definition) as boolean;
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow(
    definition: unknown,
    name?: string
  ): asserts definition is VariableDefinition {
    if (!this.validate(definition)) {
      const errors = this.ajv.errorsText(
        this.validateDefinition.errors ?? undefined
      );
      throw new VariableValidationError(
        name ?? 'unknown',
        `Schema validation failed: ${errors}`,
        { errors: this.validateDefinition.errors ?? [] }
      );
    }
  }

  /**
   * Validate array of variable definitions
   */
  validateAll(definitions: unknown[]): definitions is VariableDefinition[] {
    return definitions.every((def) => this.validate(def));
  }

  /**
   * Get validation errors as string
   */
  getErrors(): string {
    return this.ajv.errorsText(this.validateDefinition.errors ?? undefined);
  }
}
