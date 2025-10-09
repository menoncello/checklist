import { describe, expect, test, beforeEach } from 'bun:test';
import { TemplateValidator } from '../../src/templates/TemplateValidator';
import type { ChecklistTemplate } from '../../src/templates/types';
import { TemplateValidationError } from '../../src/templates/errors';

const createValidTemplate = (): ChecklistTemplate => ({
  id: 'test-template',
  name: 'Test Template',
  version: '1.0.0',
  description: 'A test template',
  variables: [
    {
      name: 'projectName',
      type: 'string',
      required: true,
      description: 'Name of the project',
    },
  ],
  steps: [
    {
      id: 'step-1',
      title: 'First Step',
      description: 'Description',
      type: 'automated',
      commands: [
        {
          id: 'cmd-1',
          type: 'bash',
          content: 'echo "test"',
          dangerous: false,
          requiresConfirmation: false,
        },
      ],
      dependencies: [],
      executionMode: 'sequential',
    },
  ],
  metadata: {
    author: 'test',
    tags: ['test'],
    visibility: 'public',
    created: '2025-01-01T00:00:00Z',
    updated: '2025-01-01T00:00:00Z',
  },
});

describe('TemplateValidator', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  describe('Schema Validation', () => {
    test('should validate a correct template', () => {
      const template = createValidTemplate();
      const result = validator.validate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject template missing required id', () => {
      const template = createValidTemplate();
      delete (template as Partial<ChecklistTemplate>).id;

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('id');
    });

    test('should reject template missing required name', () => {
      const template = createValidTemplate();
      delete (template as Partial<ChecklistTemplate>).name;

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
    });

    test('should reject template missing required version', () => {
      const template = createValidTemplate();
      delete (template as Partial<ChecklistTemplate>).version;

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
    });

    test('should reject template with invalid version format', () => {
      const template = createValidTemplate();
      template.version = 'invalid-version';

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('version'))).toBe(
        true
      );
    });

    test('should accept valid semantic version', () => {
      const template = createValidTemplate();
      template.version = '2.5.3';

      const result = validator.validate(template);

      expect(result.valid).toBe(true);
    });

    test('should reject template with empty steps array', () => {
      const template = createValidTemplate();
      template.steps = [];

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
    });
  });

  describe('Variable Validation', () => {
    test('should validate variable with correct default type', () => {
      const template = createValidTemplate();
      template.variables[0].default = 'test-value';

      const result = validator.validate(template);

      expect(result.valid).toBe(true);
    });

    test('should reject variable with incorrect default type', () => {
      const template = createValidTemplate();
      template.variables[0].default = 123; // Should be string

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('projectName'))
      ).toBe(true);
    });

    test('should validate array variable with array default', () => {
      const template = createValidTemplate();
      template.variables.push({
        name: 'items',
        type: 'array',
        required: false,
        default: [1, 2, 3],
        description: 'List of items',
      });

      const result = validator.validate(template);

      expect(result.valid).toBe(true);
    });

    test('should reject array variable with non-array default', () => {
      const template = createValidTemplate();
      template.variables.push({
        name: 'items',
        type: 'array',
        required: false,
        default: 'not-an-array',
        description: 'List of items',
      });

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
    });

    test('should validate variable name pattern', () => {
      const template = createValidTemplate();
      const result = validator.validate(template);

      expect(result.valid).toBe(true);
    });

    test('should reject invalid variable name', () => {
      const template = createValidTemplate();
      (template.variables[0] as { name: string }).name = '123invalid';

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
    });
  });

  describe('Step Dependencies', () => {
    test('should validate steps with valid dependencies', () => {
      const template = createValidTemplate();
      template.steps.push({
        id: 'step-2',
        title: 'Second Step',
        description: 'Depends on step-1',
        type: 'automated',
        commands: [],
        dependencies: ['step-1'],
        executionMode: 'sequential',
      });

      const result = validator.validate(template);

      expect(result.valid).toBe(true);
    });

    test('should reject steps with non-existent dependencies', () => {
      const template = createValidTemplate();
      template.steps[0].dependencies = ['non-existent-step'];

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('non-existent-step'))
      ).toBe(true);
    });

    test('should detect circular dependencies', () => {
      const template = createValidTemplate();
      template.steps = [
        {
          id: 'step-1',
          title: 'Step 1',
          description: '',
          type: 'automated',
          commands: [],
          dependencies: ['step-2'],
          executionMode: 'sequential',
        },
        {
          id: 'step-2',
          title: 'Step 2',
          description: '',
          type: 'automated',
          commands: [],
          dependencies: ['step-1'],
          executionMode: 'sequential',
        },
      ];

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('Circular dependency'))
      ).toBe(true);
    });

    test('should detect multi-level circular dependencies', () => {
      const template = createValidTemplate();
      template.steps = [
        {
          id: 'step-1',
          title: 'Step 1',
          description: '',
          type: 'automated',
          commands: [],
          dependencies: ['step-2'],
          executionMode: 'sequential',
        },
        {
          id: 'step-2',
          title: 'Step 2',
          description: '',
          type: 'automated',
          commands: [],
          dependencies: ['step-3'],
          executionMode: 'sequential',
        },
        {
          id: 'step-3',
          title: 'Step 3',
          description: '',
          type: 'automated',
          commands: [],
          dependencies: ['step-1'],
          executionMode: 'sequential',
        },
      ];

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('Circular dependency'))
      ).toBe(true);
    });
  });

  describe('Condition Validation', () => {
    test('should warn about undefined variables in conditions', () => {
      const template = createValidTemplate();
      template.steps[0].condition = '${undefinedVar}';

      const result = validator.validate(template);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some((w) => w.includes('undefinedVar'))
      ).toBe(true);
    });

    test('should accept valid variable references in conditions', () => {
      const template = createValidTemplate();
      template.steps[0].condition = '${projectName}';

      const result = validator.validate(template);

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some((w) => w.includes('projectName'))
      ).toBe(false);
    });
  });

  describe('Variable Substitution Validation', () => {
    test('should warn about undefined variables in commands', () => {
      const template = createValidTemplate();
      template.steps[0].commands[0].content =
        'echo ${undefinedVariable}';

      const result = validator.validate(template);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some((w) => w.includes('undefinedVariable'))
      ).toBe(true);
    });

    test('should accept valid variable substitutions', () => {
      const template = createValidTemplate();
      template.steps[0].commands[0].content = 'echo ${projectName}';

      const result = validator.validate(template);

      expect(result.valid).toBe(true);
      expect(
        result.warnings.some((w) => w.includes('projectName'))
      ).toBe(false);
    });
  });

  describe('validateOrThrow', () => {
    test('should not throw for valid template', () => {
      const template = createValidTemplate();

      expect(() =>
        validator.validateOrThrow(template, 'test-template')
      ).not.toThrow();
    });

    test('should throw TemplateValidationError for invalid template', () => {
      const template = createValidTemplate();
      delete (template as Partial<ChecklistTemplate>).id;

      expect(() =>
        validator.validateOrThrow(template, 'test-template')
      ).toThrow(TemplateValidationError);
    });

    test('should include validation errors in exception', () => {
      const template = createValidTemplate();
      delete (template as Partial<ChecklistTemplate>).id;

      try {
        validator.validateOrThrow(template, 'test-template');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateValidationError);
        expect((error as TemplateValidationError).message).toContain(
          'validation failed'
        );
      }
    });
  });

  describe('Command Validation', () => {
    test('should validate command structure', () => {
      const template = createValidTemplate();
      const result = validator.validate(template);

      expect(result.valid).toBe(true);
    });

    test('should reject command with invalid type', () => {
      const template = createValidTemplate();
      (template.steps[0].commands[0] as { type: string }).type =
        'invalid-type';

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
    });
  });

  describe('Metadata Validation', () => {
    test('should validate complete metadata', () => {
      const template = createValidTemplate();
      const result = validator.validate(template);

      expect(result.valid).toBe(true);
    });

    test('should reject invalid visibility value', () => {
      const template = createValidTemplate();
      (template.metadata as { visibility: string }).visibility =
        'invalid';

      const result = validator.validate(template);

      expect(result.valid).toBe(false);
    });
  });
});
