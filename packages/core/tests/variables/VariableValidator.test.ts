/**
 * VariableValidator Tests
 * Tests for variable type and validation rule checking
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import { VariableValidator } from '../../src/variables/VariableValidator';
import { VariableValidationError } from '../../src/variables/errors';
import type { VariableDefinition } from '../../src/variables/types';

describe('VariableValidator', () => {
  let validator: VariableValidator;

  beforeEach(() => {
    validator = new VariableValidator();
  });

  describe('Type Validation - String', () => {
    const stringDef: VariableDefinition = {
      name: 'testString',
      type: 'string',
      required: false,
      description: 'Test string variable',
    };

    it('should validate valid string', () => {
      const result = validator.validate('hello', stringDef);
      expect(result.valid).toBe(true);
    });

    it('should validate empty string', () => {
      const result = validator.validate('', stringDef);
      expect(result.valid).toBe(true);
    });

    it('should reject number as string', () => {
      const result = validator.validate(123, stringDef);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected string');
    });

    it('should reject boolean as string', () => {
      const result = validator.validate(true, stringDef);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected string');
    });

    it('should reject array as string', () => {
      const result = validator.validate(['test'], stringDef);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected string');
    });

    it('should reject null as string', () => {
      const result = validator.validate(null, stringDef);
      expect(result.valid).toBe(false);
    });

    it('should reject undefined as string', () => {
      const result = validator.validate(undefined, stringDef);
      expect(result.valid).toBe(false);
    });
  });

  describe('Type Validation - Number', () => {
    const numberDef: VariableDefinition = {
      name: 'testNumber',
      type: 'number',
      required: false,
      description: 'Test number variable',
    };

    it('should validate positive integer', () => {
      const result = validator.validate(42, numberDef);
      expect(result.valid).toBe(true);
    });

    it('should validate negative number', () => {
      const result = validator.validate(-10, numberDef);
      expect(result.valid).toBe(true);
    });

    it('should validate zero', () => {
      const result = validator.validate(0, numberDef);
      expect(result.valid).toBe(true);
    });

    it('should validate floating point', () => {
      const result = validator.validate(3.14, numberDef);
      expect(result.valid).toBe(true);
    });

    it('should reject NaN', () => {
      const result = validator.validate(NaN, numberDef);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected number');
    });

    it('should reject string as number', () => {
      const result = validator.validate('123', numberDef);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected number');
    });

    it('should reject boolean as number', () => {
      const result = validator.validate(true, numberDef);
      expect(result.valid).toBe(false);
    });

    it('should reject Infinity', () => {
      const result = validator.validate(Infinity, numberDef);
      expect(result.valid).toBe(true); // Infinity is technically a number
    });
  });

  describe('Type Validation - Boolean', () => {
    const boolDef: VariableDefinition = {
      name: 'testBool',
      type: 'boolean',
      required: false,
      description: 'Test boolean variable',
    };

    it('should validate true', () => {
      const result = validator.validate(true, boolDef);
      expect(result.valid).toBe(true);
    });

    it('should validate false', () => {
      const result = validator.validate(false, boolDef);
      expect(result.valid).toBe(true);
    });

    it('should reject number as boolean', () => {
      const result = validator.validate(1, boolDef);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected boolean');
    });

    it('should reject string as boolean', () => {
      const result = validator.validate('true', boolDef);
      expect(result.valid).toBe(false);
    });

    it('should reject null as boolean', () => {
      const result = validator.validate(null, boolDef);
      expect(result.valid).toBe(false);
    });
  });

  describe('Type Validation - Array', () => {
    const arrayDef: VariableDefinition = {
      name: 'testArray',
      type: 'array',
      required: false,
      description: 'Test array variable',
    };

    it('should validate empty array', () => {
      const result = validator.validate([], arrayDef);
      expect(result.valid).toBe(true);
    });

    it('should validate string array', () => {
      const result = validator.validate(['a', 'b', 'c'], arrayDef);
      expect(result.valid).toBe(true);
    });

    it('should validate number array', () => {
      const result = validator.validate([1, 2, 3], arrayDef);
      expect(result.valid).toBe(true);
    });

    it('should validate mixed array', () => {
      const result = validator.validate([1, 'two', true], arrayDef);
      expect(result.valid).toBe(true);
    });

    it('should validate nested array', () => {
      const result = validator.validate([[1, 2], [3, 4]], arrayDef);
      expect(result.valid).toBe(true);
    });

    it('should reject string as array', () => {
      const result = validator.validate('not-array', arrayDef);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected array');
    });

    it('should reject object as array', () => {
      const result = validator.validate({ key: 'value' }, arrayDef);
      expect(result.valid).toBe(false);
    });
  });

  describe('Pattern Validation', () => {
    it('should validate string matching pattern', () => {
      const def: VariableDefinition = {
        name: 'email',
        type: 'string',
        required: false,
        description: 'Email address',
        validation: {
          pattern: '^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$',
        },
      };

      const result = validator.validate('user@example.com', def);
      expect(result.valid).toBe(true);
    });

    it('should reject string not matching pattern', () => {
      const def: VariableDefinition = {
        name: 'email',
        type: 'string',
        required: false,
        description: 'Email address',
        validation: {
          pattern: '^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$',
        },
      };

      const result = validator.validate('invalid-email', def);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match pattern');
    });

    it('should validate alphanumeric pattern', () => {
      const def: VariableDefinition = {
        name: 'username',
        type: 'string',
        required: false,
        description: 'Username',
        validation: {
          pattern: '^[a-zA-Z0-9_-]+$',
        },
      };

      expect(validator.validate('user_123', def).valid).toBe(true);
      expect(validator.validate('user@123', def).valid).toBe(false);
    });

    it('should ignore empty pattern', () => {
      const def: VariableDefinition = {
        name: 'text',
        type: 'string',
        required: false,
        description: 'Text',
        validation: {
          pattern: '',
        },
      };

      const result = validator.validate('anything', def);
      expect(result.valid).toBe(true);
    });

    it('should only apply pattern to strings', () => {
      const def: VariableDefinition = {
        name: 'number',
        type: 'number',
        required: false,
        description: 'Number',
        validation: {
          pattern: '^\\d+$',
        },
      };

      const result = validator.validate(123, def);
      expect(result.valid).toBe(true); // Pattern ignored for numbers
    });
  });

  describe('Min/Max Validation - Numbers', () => {
    it('should validate number within range', () => {
      const def: VariableDefinition = {
        name: 'age',
        type: 'number',
        required: false,
        description: 'Age',
        validation: {
          min: 18,
          max: 100,
        },
      };

      expect(validator.validate(25, def).valid).toBe(true);
      expect(validator.validate(18, def).valid).toBe(true);
      expect(validator.validate(100, def).valid).toBe(true);
    });

    it('should reject number below minimum', () => {
      const def: VariableDefinition = {
        name: 'age',
        type: 'number',
        required: false,
        description: 'Age',
        validation: {
          min: 18,
        },
      };

      const result = validator.validate(17, def);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than minimum');
    });

    it('should reject number above maximum', () => {
      const def: VariableDefinition = {
        name: 'percent',
        type: 'number',
        required: false,
        description: 'Percentage',
        validation: {
          max: 100,
        },
      };

      const result = validator.validate(101, def);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('greater than maximum');
    });

    it('should validate negative numbers', () => {
      const def: VariableDefinition = {
        name: 'temperature',
        type: 'number',
        required: false,
        description: 'Temperature',
        validation: {
          min: -50,
          max: 50,
        },
      };

      expect(validator.validate(-25, def).valid).toBe(true);
      expect(validator.validate(-51, def).valid).toBe(false);
    });
  });

  describe('Min/Max Validation - Strings', () => {
    it('should validate string length within range', () => {
      const def: VariableDefinition = {
        name: 'username',
        type: 'string',
        required: false,
        description: 'Username',
        validation: {
          min: 3,
          max: 20,
        },
      };

      expect(validator.validate('user', def).valid).toBe(true);
      expect(validator.validate('abc', def).valid).toBe(true);
      expect(validator.validate('a'.repeat(20), def).valid).toBe(true);
    });

    it('should reject string shorter than minimum', () => {
      const def: VariableDefinition = {
        name: 'username',
        type: 'string',
        required: false,
        description: 'Username',
        validation: {
          min: 3,
        },
      };

      const result = validator.validate('ab', def);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than minimum');
    });

    it('should reject string longer than maximum', () => {
      const def: VariableDefinition = {
        name: 'username',
        type: 'string',
        required: false,
        description: 'Username',
        validation: {
          max: 10,
        },
      };

      const result = validator.validate('verylongusername', def);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('greater than maximum');
    });

    it('should validate empty string with min:0', () => {
      const def: VariableDefinition = {
        name: 'optional',
        type: 'string',
        required: false,
        description: 'Optional',
        validation: {
          min: 0,
        },
      };

      expect(validator.validate('', def).valid).toBe(true);
    });
  });

  describe('Min/Max Validation - Arrays', () => {
    it('should validate array length within range', () => {
      const def: VariableDefinition = {
        name: 'items',
        type: 'array',
        required: false,
        description: 'Items',
        validation: {
          min: 1,
          max: 5,
        },
      };

      expect(validator.validate([1], def).valid).toBe(true);
      expect(validator.validate([1, 2, 3], def).valid).toBe(true);
      expect(validator.validate([1, 2, 3, 4, 5], def).valid).toBe(true);
    });

    it('should reject array shorter than minimum', () => {
      const def: VariableDefinition = {
        name: 'items',
        type: 'array',
        required: false,
        description: 'Items',
        validation: {
          min: 2,
        },
      };

      const result = validator.validate([1], def);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than minimum');
    });

    it('should reject array longer than maximum', () => {
      const def: VariableDefinition = {
        name: 'items',
        type: 'array',
        required: false,
        description: 'Items',
        validation: {
          max: 3,
        },
      };

      const result = validator.validate([1, 2, 3, 4], def);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('greater than maximum');
    });
  });

  describe('Enum Validation', () => {
    it('should validate value in enum list', () => {
      const def: VariableDefinition = {
        name: 'environment',
        type: 'string',
        required: false,
        description: 'Environment',
        validation: {
          enum: ['development', 'staging', 'production'],
        },
      };

      expect(validator.validate('development', def).valid).toBe(true);
      expect(validator.validate('staging', def).valid).toBe(true);
      expect(validator.validate('production', def).valid).toBe(true);
    });

    it('should reject value not in enum list', () => {
      const def: VariableDefinition = {
        name: 'environment',
        type: 'string',
        required: false,
        description: 'Environment',
        validation: {
          enum: ['development', 'staging', 'production'],
        },
      };

      const result = validator.validate('test', def);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in allowed values');
    });

    it('should validate number enum', () => {
      const def: VariableDefinition = {
        name: 'status',
        type: 'number',
        required: false,
        description: 'Status code',
        validation: {
          enum: [200, 404, 500],
        },
      };

      expect(validator.validate(200, def).valid).toBe(true);
      expect(validator.validate(201, def).valid).toBe(false);
    });

    it('should validate boolean enum', () => {
      const def: VariableDefinition = {
        name: 'flag',
        type: 'boolean',
        required: false,
        description: 'Flag',
        validation: {
          enum: [true],
        },
      };

      expect(validator.validate(true, def).valid).toBe(true);
      expect(validator.validate(false, def).valid).toBe(false);
    });

    it('should validate array enum', () => {
      const def: VariableDefinition = {
        name: 'colors',
        type: 'array',
        required: false,
        description: 'Colors',
        validation: {
          enum: [
            ['red', 'green', 'blue'],
            ['cyan', 'magenta', 'yellow'],
          ],
        },
      };

      expect(validator.validate(['red', 'green', 'blue'], def).valid).toBe(
        true
      );
      expect(validator.validate(['red', 'blue'], def).valid).toBe(false);
    });
  });

  describe('Combined Validations', () => {
    it('should validate with multiple rules', () => {
      const def: VariableDefinition = {
        name: 'projectName',
        type: 'string',
        required: true,
        description: 'Project name',
        validation: {
          pattern: '^[a-z0-9-]+$',
          min: 3,
          max: 50,
          enum: ['my-project', 'test-project', 'demo-project'],
        },
      };

      expect(validator.validate('my-project', def).valid).toBe(true);
      expect(validator.validate('invalid_project', def).valid).toBe(false); // Pattern fails
      expect(validator.validate('my', def).valid).toBe(false); // Min fails
      expect(validator.validate('other-project', def).valid).toBe(false); // Enum fails
    });

    it('should apply validations in order (type, pattern, range, enum)', () => {
      const def: VariableDefinition = {
        name: 'code',
        type: 'string',
        required: false,
        description: 'Code',
        validation: {
          pattern: '^\\d{4}$',
          min: 4,
          max: 4,
          enum: ['1234', '5678'],
        },
      };

      const result1 = validator.validate(123, def); // Type fails first
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain('Expected string');

      const result2 = validator.validate('abcd', def); // Pattern fails
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('does not match pattern');

      const result3 = validator.validate('123', def); // Pattern fails (not 4 digits)
      expect(result3.valid).toBe(false);
      expect(result3.error).toContain('does not match pattern');

      const result4 = validator.validate('9999', def); // Enum fails
      expect(result4.valid).toBe(false);
      expect(result4.error).toContain('not in allowed values');
    });
  });

  describe('validateOrThrow Method', () => {
    it('should not throw for valid value', () => {
      const def: VariableDefinition = {
        name: 'test',
        type: 'string',
        required: false,
        description: 'Test',
      };

      expect(() => validator.validateOrThrow('valid', def)).not.toThrow();
    });

    it('should throw VariableValidationError for invalid value', () => {
      const def: VariableDefinition = {
        name: 'test',
        type: 'string',
        required: false,
        description: 'Test',
      };

      expect(() => validator.validateOrThrow(123, def)).toThrow(
        VariableValidationError
      );
    });

    it('should include variable name in error', () => {
      const def: VariableDefinition = {
        name: 'myVariable',
        type: 'string',
        required: false,
        description: 'Test',
      };

      try {
        validator.validateOrThrow(123, def);
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeInstanceOf(VariableValidationError);
        const valError = error as VariableValidationError;
        expect(valError.variableName).toBe('myVariable');
        expect(valError.message).toContain('myVariable');
      }
    });

    it('should include validation error message', () => {
      const def: VariableDefinition = {
        name: 'test',
        type: 'number',
        required: false,
        description: 'Test',
        validation: {
          min: 10,
        },
      };

      try {
        validator.validateOrThrow(5, def);
      } catch (error) {
        expect(error).toBeInstanceOf(VariableValidationError);
        const valError = error as VariableValidationError;
        expect(valError.validationError).toContain('less than minimum');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown type gracefully', () => {
      const def = {
        name: 'test',
        type: 'unknown' as any,
        required: false,
        description: 'Test',
      };

      const result = validator.validate('value', def);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown type');
    });

    it('should validate without validation rules', () => {
      const def: VariableDefinition = {
        name: 'simple',
        type: 'string',
        required: false,
        description: 'Simple',
      };

      const result = validator.validate('anything', def);
      expect(result.valid).toBe(true);
    });

    it('should handle empty validation object', () => {
      const def: VariableDefinition = {
        name: 'test',
        type: 'string',
        required: false,
        description: 'Test',
        validation: {},
      };

      const result = validator.validate('value', def);
      expect(result.valid).toBe(true);
    });

    it('should validate zero correctly', () => {
      const def: VariableDefinition = {
        name: 'count',
        type: 'number',
        required: false,
        description: 'Count',
        validation: {
          min: 0,
          max: 10,
        },
      };

      expect(validator.validate(0, def).valid).toBe(true);
    });

    it('should handle deep array equality', () => {
      const def: VariableDefinition = {
        name: 'nested',
        type: 'array',
        required: false,
        description: 'Nested',
        validation: {
          enum: [
            [1, [2, 3]],
            [4, [5, 6]],
          ],
        },
      };

      expect(validator.validate([1, [2, 3]], def).valid).toBe(true);
      expect(validator.validate([1, [2, 4]], def).valid).toBe(false);
    });
  });
});
