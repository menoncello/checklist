/**
 * Variable Management System - Variable Validator
 * Validates variable values against their definitions
 */

import { VariableValidationError } from './errors';
import type {
  VariableDefinition,
  VariableType,
  VariableValue,
  VariableValidation,
  ValidationResult,
} from './types';

/**
 * Validates variable values against their definitions
 */
export class VariableValidator {
  /**
   * Validate a value against a variable definition
   */
  validate(value: unknown, definition: VariableDefinition): ValidationResult {
    // Type validation
    const typeResult = this.validateType(value, definition.type);
    if (!typeResult.valid) {
      return typeResult;
    }

    // Custom validation rules
    if (definition.validation !== undefined) {
      return this.validateRules(
        value as VariableValue,
        definition.validation,
        definition.type
      );
    }

    return { valid: true };
  }

  /**
   * Validate type of value
   */
  private validateType(value: unknown, type: VariableType): ValidationResult {
    switch (type) {
      case 'string':
        return this.validateString(value);
      case 'number':
        return this.validateNumber(value);
      case 'boolean':
        return this.validateBoolean(value);
      case 'array':
        return this.validateArray(value);
      default:
        return {
          valid: false,
          error: `Unknown type: ${type}`,
        };
    }
  }

  /**
   * Validate string type
   */
  private validateString(value: unknown): ValidationResult {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `Expected string, got ${typeof value}`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate number type
   */
  private validateNumber(value: unknown): ValidationResult {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        valid: false,
        error: `Expected number, got ${typeof value}`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate boolean type
   */
  private validateBoolean(value: unknown): ValidationResult {
    if (typeof value !== 'boolean') {
      return {
        valid: false,
        error: `Expected boolean, got ${typeof value}`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate array type
   */
  private validateArray(value: unknown): ValidationResult {
    if (!Array.isArray(value)) {
      return {
        valid: false,
        error: `Expected array, got ${typeof value}`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate value against validation rules
   */
  private validateRules(
    value: VariableValue,
    validation: VariableValidation,
    type: VariableType
  ): ValidationResult {
    const patternResult = this.checkPattern(value, validation, type);
    if (!patternResult.valid) return patternResult;

    const rangeResult = this.checkRange(value, validation, type);
    if (!rangeResult.valid) return rangeResult;

    const enumResult = this.checkEnum(value, validation);
    if (!enumResult.valid) return enumResult;

    return { valid: true };
  }

  /**
   * Check pattern validation
   */
  private checkPattern(
    value: VariableValue,
    validation: VariableValidation,
    type: VariableType
  ): ValidationResult {
    if (
      validation.pattern !== undefined &&
      validation.pattern !== '' &&
      type === 'string'
    ) {
      return this.validatePattern(value as string, validation.pattern);
    }
    return { valid: true };
  }

  /**
   * Check range validation (min/max)
   */
  private checkRange(
    value: VariableValue,
    validation: VariableValidation,
    type: VariableType
  ): ValidationResult {
    if (validation.min !== undefined) {
      const result = this.validateMin(value, validation.min, type);
      if (!result.valid) return result;
    }

    if (validation.max !== undefined) {
      return this.validateMax(value, validation.max, type);
    }

    return { valid: true };
  }

  /**
   * Check enum validation
   */
  private checkEnum(
    value: VariableValue,
    validation: VariableValidation
  ): ValidationResult {
    if (validation.enum !== undefined) {
      return this.validateEnum(value, validation.enum);
    }
    return { valid: true };
  }

  /**
   * Validate pattern for strings
   */
  private validatePattern(value: string, pattern: string): ValidationResult {
    const regex = new RegExp(pattern);
    if (!regex.test(value)) {
      return {
        valid: false,
        error: `Value does not match pattern: ${pattern}`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate minimum value/length
   */
  private validateMin(
    value: VariableValue,
    min: number,
    type: VariableType
  ): ValidationResult {
    if (type === 'number' && (value as number) < min) {
      return {
        valid: false,
        error: `Value ${value} is less than minimum ${min}`,
      };
    }

    if (
      (type === 'string' || type === 'array') &&
      (value as string | unknown[]).length < min
    ) {
      return {
        valid: false,
        error: `Length ${(value as string | unknown[]).length} is less than minimum ${min}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate maximum value/length
   */
  private validateMax(
    value: VariableValue,
    max: number,
    type: VariableType
  ): ValidationResult {
    if (type === 'number' && (value as number) > max) {
      return {
        valid: false,
        error: `Value ${value} is greater than maximum ${max}`,
      };
    }

    if (
      (type === 'string' || type === 'array') &&
      (value as string | unknown[]).length > max
    ) {
      return {
        valid: false,
        error: `Length ${(value as string | unknown[]).length} is greater than maximum ${max}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate enum values
   */
  private validateEnum(
    value: VariableValue,
    enumValues: VariableValue[]
  ): ValidationResult {
    const isValid = enumValues.some((enumVal) =>
      this.deepEquals(value, enumVal)
    );

    if (!isValid) {
      return {
        valid: false,
        error: `Value not in allowed values: ${JSON.stringify(enumValues)}`,
      };
    }

    return { valid: true };
  }

  /**
   * Deep equality check for values
   */
  private deepEquals(a: VariableValue, b: VariableValue): boolean {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, idx) => this.deepEquals(val, b[idx]));
    }
    return false;
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow(value: unknown, definition: VariableDefinition): void {
    const result = this.validate(value, definition);
    if (!result.valid) {
      throw new VariableValidationError(
        definition.name,
        result.error ?? 'Unknown validation error',
        result.details
      );
    }
  }
}
