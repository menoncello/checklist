import { describe, it, expect } from 'bun:test';
import {
  WorkflowError,
  StateTransitionError,
  ValidationError,
  ConditionEvaluationError,
  StateCorruptionError,
  TemplateLoadError
} from '../../src/workflow/errors';

describe('Workflow Errors', () => {
  describe('WorkflowError', () => {
    it('should create error with all properties', () => {
      const message = 'Test workflow error';
      const code = 'TEST_ERROR';
      const recoverable = true;
      const context = { test: 'value', number: 42 };

      const error = new WorkflowError(message, code, recoverable, context);

      expect(error.message).toBe(message);
      expect(error.name).toBe('WorkflowError');
      expect(error.code).toBe(code);
      expect(error.recoverable).toBe(recoverable);
      expect(error.context).toEqual(context);
      expect(error instanceof Error).toBe(true);
      expect(error instanceof WorkflowError).toBe(true);
    });

    it('should create error with minimal properties', () => {
      const message = 'Simple error';
      const code = 'SIMPLE_ERROR';

      const error = new WorkflowError(message, code);

      expect(error.message).toBe(message);
      expect(error.name).toBe('WorkflowError');
      expect(error.code).toBe(code);
      expect(error.recoverable).toBe(false); // Default value
      expect(error.context).toBeUndefined();
    });

    it('should create error with recoverable flag only', () => {
      const message = 'Recoverable error';
      const code = 'RECOVERABLE_ERROR';
      const recoverable = true;

      const error = new WorkflowError(message, code, recoverable);

      expect(error.message).toBe(message);
      expect(error.code).toBe(code);
      expect(error.recoverable).toBe(recoverable);
      expect(error.context).toBeUndefined();
    });

    it('should handle empty context', () => {
      const error = new WorkflowError('Test', 'CODE', false, {});

      expect(error.context).toEqual({});
    });

    it('should handle complex context data', () => {
      const context = {
        nested: { data: 'value' },
        array: [1, 2, 3],
        boolean: true,
        null: null,
        number: 123.45
      };

      const error = new WorkflowError('Test', 'CODE', true, context);

      expect(error.context).toEqual(context);
    });
  });

  describe('StateTransitionError', () => {
    it('should create state transition error correctly', () => {
      const from = 'idle';
      const to = 'running';
      const reason = 'Missing prerequisites';

      const error = new StateTransitionError(from, to, reason);

      expect(error.message).toBe(`Invalid state transition from ${from} to ${to}: ${reason}`);
      expect(error.name).toBe('WorkflowError');
      expect(error.code).toBe('STATE_TRANSITION_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.context).toEqual({ from, to, reason });
      expect(error instanceof WorkflowError).toBe(true);
      expect(error instanceof StateTransitionError).toBe(true);
    });

    it('should handle different state names', () => {
      const from = 'pending';
      const to = 'completed';
      const reason = 'Validation failed';

      const error = new StateTransitionError(from, to, reason);

      expect(error.message).toContain(from);
      expect(error.message).toContain(to);
      expect(error.message).toContain(reason);
      expect(error.context?.from).toBe(from);
      expect(error.context?.to).toBe(to);
      expect(error.context?.reason).toBe(reason);
    });

    it('should handle empty strings', () => {
      const error = new StateTransitionError('', '', '');

      expect(error.message).toBe('Invalid state transition from  to : ');
      expect(error.context).toEqual({ from: '', to: '', reason: '' });
    });

    it('should handle special characters in states', () => {
      const from = 'state-with-dashes';
      const to = 'state_with_underscores';
      const reason = 'Special chars & symbols!';

      const error = new StateTransitionError(from, to, reason);

      expect(error.context?.from).toBe(from);
      expect(error.context?.to).toBe(to);
      expect(error.context?.reason).toBe(reason);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error correctly', () => {
      const step = 'input-validation';
      const validation = 'required-field';
      const details = 'Email field is required';

      const error = new ValidationError(step, validation, details);

      expect(error.message).toBe(`Validation failed for step ${step}: ${details}`);
      expect(error.name).toBe('WorkflowError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.recoverable).toBe(true);
      expect(error.context).toEqual({ step, validation, details });
      expect(error instanceof WorkflowError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });

    it('should handle different validation scenarios', () => {
      const step = 'data-processing';
      const validation = 'format-check';
      const details = 'Invalid JSON format in configuration';

      const error = new ValidationError(step, validation, details);

      expect(error.message).toContain(step);
      expect(error.message).toContain(details);
      expect(error.context?.step).toBe(step);
      expect(error.context?.validation).toBe(validation);
      expect(error.context?.details).toBe(details);
    });

    it('should handle empty validation details', () => {
      const error = new ValidationError('step', 'validation', '');

      expect(error.message).toBe('Validation failed for step step: ');
      expect(error.context?.details).toBe('');
    });

    it('should handle long validation messages', () => {
      const longDetails = 'A'.repeat(1000);
      const error = new ValidationError('step', 'validation', longDetails);

      expect(error.context?.details).toBe(longDetails);
      expect(error.message).toContain(longDetails);
    });
  });

  describe('ConditionEvaluationError', () => {
    it('should create condition error correctly', () => {
      const condition = 'user.role === "admin"';
      const originalError = new Error('Reference error: user is not defined');

      const error = new ConditionEvaluationError(condition, originalError);

      expect(error.message).toBe(`Failed to evaluate condition: ${condition}`);
      expect(error.name).toBe('WorkflowError');
      expect(error.code).toBe('CONDITION_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.context).toEqual({
        condition,
        originalError: originalError.message
      });
      expect(error instanceof WorkflowError).toBe(true);
      expect(error instanceof ConditionEvaluationError).toBe(true);
    });

    it('should handle different error types', () => {
      const condition = 'complex.expression.check()';
      const originalError = new TypeError('Cannot read property of undefined');

      const error = new ConditionEvaluationError(condition, originalError);

      expect(error.context?.condition).toBe(condition);
      expect(error.context?.originalError).toBe(originalError.message);
    });

    it('should handle empty condition', () => {
      const originalError = new Error('Syntax error');
      const error = new ConditionEvaluationError('', originalError);

      expect(error.message).toBe('Failed to evaluate condition: ');
      expect(error.context?.condition).toBe('');
    });

    it('should handle error without message', () => {
      const condition = 'test condition';
      const originalError = new Error(); // Empty message

      const error = new ConditionEvaluationError(condition, originalError);

      expect(error.context?.originalError).toBe('');
    });

    it('should handle complex condition expressions', () => {
      const condition = 'data.items.filter(x => x.active).length > 0 && permissions.canAccess("resource")';
      const originalError = new Error('Complex evaluation failed');

      const error = new ConditionEvaluationError(condition, originalError);

      expect(error.context?.condition).toBe(condition);
      expect(error.message).toContain(condition);
    });
  });

  describe('StateCorruptionError', () => {
    it('should create state corruption error correctly', () => {
      const details = 'Checksum mismatch detected';

      const error = new StateCorruptionError(details);

      expect(error.message).toBe(`State corruption detected: ${details}`);
      expect(error.name).toBe('WorkflowError');
      expect(error.code).toBe('STATE_CORRUPTION');
      expect(error.recoverable).toBe(true);
      expect(error.context).toEqual({ details });
      expect(error instanceof WorkflowError).toBe(true);
      expect(error instanceof StateCorruptionError).toBe(true);
    });

    it('should handle different corruption scenarios', () => {
      const details = 'Invalid state structure: missing required fields';

      const error = new StateCorruptionError(details);

      expect(error.message).toContain(details);
      expect(error.context?.details).toBe(details);
    });

    it('should handle empty details', () => {
      const error = new StateCorruptionError('');

      expect(error.message).toBe('State corruption detected: ');
      expect(error.context?.details).toBe('');
    });

    it('should handle detailed corruption info', () => {
      const details = 'Schema version mismatch: expected 2.0.0, found 1.5.3. Migration required.';

      const error = new StateCorruptionError(details);

      expect(error.context?.details).toBe(details);
      expect(error.recoverable).toBe(true);
    });
  });

  describe('TemplateLoadError', () => {
    it('should create template load error correctly', () => {
      const templateId = 'user-onboarding-v2';
      const originalError = new Error('File not found');

      const error = new TemplateLoadError(templateId, originalError);

      expect(error.message).toBe(`Failed to load template ${templateId}: ${originalError.message}`);
      expect(error.name).toBe('WorkflowError');
      expect(error.code).toBe('TEMPLATE_LOAD_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.context).toEqual({
        templateId,
        originalError: originalError.message
      });
      expect(error instanceof WorkflowError).toBe(true);
      expect(error instanceof TemplateLoadError).toBe(true);
    });

    it('should handle different template IDs', () => {
      const templateId = 'complex-workflow-template-123';
      const originalError = new Error('Parse error: invalid YAML syntax');

      const error = new TemplateLoadError(templateId, originalError);

      expect(error.message).toContain(templateId);
      expect(error.context?.templateId).toBe(templateId);
      expect(error.context?.originalError).toBe(originalError.message);
    });

    it('should handle empty template ID', () => {
      const originalError = new Error('No template specified');
      const error = new TemplateLoadError('', originalError);

      expect(error.message).toBe(`Failed to load template : ${originalError.message}`);
      expect(error.context?.templateId).toBe('');
    });

    it('should handle different error types', () => {
      const templateId = 'test-template';
      const originalError = new SyntaxError('Unexpected token in JSON');

      const error = new TemplateLoadError(templateId, originalError);

      expect(error.context?.originalError).toBe(originalError.message);
    });

    it('should handle error without message', () => {
      const templateId = 'template-id';
      const originalError = new Error(); // Empty message

      const error = new TemplateLoadError(templateId, originalError);

      expect(error.context?.originalError).toBe('');
    });
  });

  describe('Error inheritance and types', () => {
    it('should maintain proper inheritance chain', () => {
      const workflowError = new WorkflowError('test', 'CODE');
      const stateError = new StateTransitionError('from', 'to', 'reason');
      const validationError = new ValidationError('step', 'validation', 'details');
      const conditionError = new ConditionEvaluationError('condition', new Error('test'));
      const corruptionError = new StateCorruptionError('details');
      const templateError = new TemplateLoadError('template', new Error('test'));

      // All should be instances of Error
      expect(workflowError instanceof Error).toBe(true);
      expect(stateError instanceof Error).toBe(true);
      expect(validationError instanceof Error).toBe(true);
      expect(conditionError instanceof Error).toBe(true);
      expect(corruptionError instanceof Error).toBe(true);
      expect(templateError instanceof Error).toBe(true);

      // All should be instances of WorkflowError
      expect(workflowError instanceof WorkflowError).toBe(true);
      expect(stateError instanceof WorkflowError).toBe(true);
      expect(validationError instanceof WorkflowError).toBe(true);
      expect(conditionError instanceof WorkflowError).toBe(true);
      expect(corruptionError instanceof WorkflowError).toBe(true);
      expect(templateError instanceof WorkflowError).toBe(true);

      // Specific type checks
      expect(stateError instanceof StateTransitionError).toBe(true);
      expect(validationError instanceof ValidationError).toBe(true);
      expect(conditionError instanceof ConditionEvaluationError).toBe(true);
      expect(corruptionError instanceof StateCorruptionError).toBe(true);
      expect(templateError instanceof TemplateLoadError).toBe(true);
    });

    it('should have correct error names', () => {
      const errors = [
        new WorkflowError('test', 'CODE'),
        new StateTransitionError('from', 'to', 'reason'),
        new ValidationError('step', 'validation', 'details'),
        new ConditionEvaluationError('condition', new Error('test')),
        new StateCorruptionError('details'),
        new TemplateLoadError('template', new Error('test'))
      ];

      // All derived errors should have 'WorkflowError' as their name
      errors.forEach(error => {
        expect(error.name).toBe('WorkflowError');
      });
    });

    it('should have correct error codes', () => {
      const errorCodePairs: [WorkflowError, string][] = [
        [new WorkflowError('test', 'CUSTOM_CODE'), 'CUSTOM_CODE'],
        [new StateTransitionError('from', 'to', 'reason'), 'STATE_TRANSITION_ERROR'],
        [new ValidationError('step', 'validation', 'details'), 'VALIDATION_ERROR'],
        [new ConditionEvaluationError('condition', new Error('test')), 'CONDITION_ERROR'],
        [new StateCorruptionError('details'), 'STATE_CORRUPTION'],
        [new TemplateLoadError('template', new Error('test')), 'TEMPLATE_LOAD_ERROR']
      ];

      errorCodePairs.forEach(([error, expectedCode]) => {
        expect(error.code).toBe(expectedCode);
      });
    });

    it('should have correct recoverable flags', () => {
      const recoverableErrors = [
        new ValidationError('step', 'validation', 'details'), // true
        new StateCorruptionError('details') // true
      ];

      const nonRecoverableErrors = [
        new WorkflowError('test', 'CODE'), // false (default)
        new StateTransitionError('from', 'to', 'reason'), // false
        new ConditionEvaluationError('condition', new Error('test')), // false
        new TemplateLoadError('template', new Error('test')) // false
      ];

      recoverableErrors.forEach(error => {
        expect(error.recoverable).toBe(true);
      });

      nonRecoverableErrors.forEach(error => {
        expect(error.recoverable).toBe(false);
      });
    });
  });

  describe('Error serialization', () => {
    it('should handle JSON serialization', () => {
      const error = new WorkflowError('test message', 'TEST_CODE', true, { key: 'value' });

      // Convert to plain object for serialization
      const serializable = {
        name: error.name,
        message: error.message,
        code: error.code,
        recoverable: error.recoverable,
        context: error.context
      };

      expect(() => JSON.stringify(serializable)).not.toThrow();
      const parsed = JSON.parse(JSON.stringify(serializable));

      expect(parsed.name).toBe('WorkflowError');
      expect(parsed.message).toBe('test message');
      expect(parsed.code).toBe('TEST_CODE');
      expect(parsed.recoverable).toBe(true);
      expect(parsed.context).toEqual({ key: 'value' });
    });
  });
});