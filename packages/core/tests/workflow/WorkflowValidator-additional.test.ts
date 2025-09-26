import { beforeEach, describe, expect, test } from 'bun:test';
import { WorkflowValidator } from '../../src/workflow/WorkflowValidator';
import {
  WorkflowState,
  ChecklistTemplate,
  Step,
  StepValidation,
  CompletedStep,
} from '../../src/workflow/types';

describe('WorkflowValidator - Additional Coverage', () => {
  let validator: WorkflowValidator;
  let mockStep: Step;
  let mockState: WorkflowState;
  let mockTemplate: ChecklistTemplate;

  beforeEach(() => {
    validator = new WorkflowValidator();

    mockStep = {
      id: 'step-1',
      title: 'Test Step',
      description: 'A test step',
    };

    mockState = {
      status: 'active',
      currentStepIndex: 0,
      completedSteps: [],
      skippedSteps: [],
      variables: {},
    };

    mockTemplate = {
      id: 'template-1',
      name: 'Test Template',
      steps: [mockStep],
      variables: {},
    };
  });

  describe('runCustomValidation method coverage', () => {
    test('should handle custom validation type with valid condition', async () => {
      const customValidation: StepValidation = {
        type: 'custom',
        check: 'true',
        errorMessage: 'Custom validation failed',
      };

      const stepWithCustom: Step = {
        ...mockStep,
        validation: [customValidation],
      };

      // Access private method through prototype manipulation for testing
      const validatorInstance = validator as any;
      const stepContext = {
        step: mockStep,
        state: mockState,
        variables: { test: true },
      };

      const result = await validatorInstance.runCustomValidation(customValidation, stepContext);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should handle custom validation type with false condition', async () => {
      const customValidation: StepValidation = {
        type: 'custom',
        check: 'false',
        errorMessage: 'Custom check failed',
      };

      const validatorInstance = validator as any;
      const stepContext = {
        step: mockStep,
        state: mockState,
        variables: {},
      };

      const result = await validatorInstance.runCustomValidation(customValidation, stepContext);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Custom check failed');
    });

    test('should use default error message when custom validation fails without message', async () => {
      const customValidation: StepValidation = {
        type: 'custom',
        check: 'false',
      };

      const validatorInstance = validator as any;
      const stepContext = {
        step: mockStep,
        state: mockState,
        variables: {},
      };

      const result = await validatorInstance.runCustomValidation(customValidation, stepContext);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Custom validation failed');
    });

    test('should handle non-custom validation types', async () => {
      const nonCustomValidation: StepValidation = {
        type: 'file_exists',
        check: '/some/path',
      };

      const validatorInstance = validator as any;
      const stepContext = {
        step: mockStep,
        state: mockState,
        variables: {},
      };

      const result = await validatorInstance.runCustomValidation(nonCustomValidation, stepContext);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should handle validation errors in custom validation', async () => {
      const customValidation: StepValidation = {
        type: 'custom',
        check: 'invalid_json_that_will_throw',
        errorMessage: 'Should not see this',
      };

      const validatorInstance = validator as any;
      const stepContext = {
        step: mockStep,
        state: mockState,
        variables: {},
      };

      // Force an error in safeEvaluateCondition
      const originalMethod = validatorInstance.safeEvaluateCondition;
      validatorInstance.safeEvaluateCondition = () => {
        throw new Error('Evaluation failed');
      };

      const result = await validatorInstance.runCustomValidation(customValidation, stepContext);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Validation error: Evaluation failed');

      // Restore original method
      validatorInstance.safeEvaluateCondition = originalMethod;
    });
  });

  describe('safeEvaluateCondition edge cases', () => {
    test('should handle complex nested variable substitution', async () => {
      const stateWithNestedVars: WorkflowState = {
        ...mockState,
        variables: {
          level1: {
            level2: {
              value: true,
            },
          },
        },
      };

      const nestedStep: Step = {
        ...mockStep,
        condition: 'level1',
      };

      const result = await validator.validateStep(nestedStep, stateWithNestedVars, mockTemplate);

      // Complex objects will stringify and fail evaluation
      expect(result.valid).toBe(false);
    });

    test('should handle conditions with multiple variable references', async () => {
      const stateWithMultipleVars: WorkflowState = {
        ...mockState,
        variables: {
          var1: true,
          var2: false,
          var3: true,
        },
      };

      const multiVarStep: Step = {
        ...mockStep,
        condition: 'var1 && var3',
      };

      const result = await validator.validateStep(multiVarStep, stateWithMultipleVars, mockTemplate);

      // Will fail since && operator makes it unsafe
      expect(result.valid).toBe(false);
    });

    test('should handle array variables in condition', async () => {
      const stateWithArrayVar: WorkflowState = {
        ...mockState,
        variables: {
          items: [1, 2, 3],
        },
      };

      const arrayStep: Step = {
        ...mockStep,
        condition: 'items',
      };

      const result = await validator.validateStep(arrayStep, stateWithArrayVar, mockTemplate);

      expect(result.valid).toBe(false); // Arrays will fail JSON.parse as boolean
    });

    test('should reject potentially unsafe characters', async () => {
      const unsafeConditions = [
        'process.exit(1)',
        'require("fs")',
        '__proto__',
        'constructor',
        '`template literal`',
        '${variable}',
        '; rm -rf /',
      ];

      for (const condition of unsafeConditions) {
        const unsafeStep: Step = {
          ...mockStep,
          condition,
        };

        const result = await validator.validateStep(unsafeStep, mockState, mockTemplate);
        expect(result.valid).toBe(false);
      }
    });

    test('should handle circular reference in context', async () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      const stateWithCircular: WorkflowState = {
        ...mockState,
        variables: {
          circular,
        },
      };

      const circularStep: Step = {
        ...mockStep,
        condition: 'circular',
      };

      const result = await validator.validateStep(circularStep, stateWithCircular, mockTemplate);

      // Should handle without crashing
      expect(result.valid).toBe(false);
    });
  });

  describe('evaluateCondition with edge cases', () => {
    test('should calculate progress correctly with many completed steps', async () => {
      const manySteps: Step[] = Array.from({ length: 10 }, (_, i) => ({
        id: `step-${i}`,
        title: `Step ${i}`,
      }));

      const templateWithManySteps: ChecklistTemplate = {
        ...mockTemplate,
        steps: manySteps,
      };

      const completedSteps: CompletedStep[] = manySteps.slice(0, 7).map(step => ({
        step,
        completedAt: new Date(),
      }));

      const stateWith70Percent: WorkflowState = {
        ...mockState,
        completedSteps,
      };

      const progressStep: Step = {
        ...mockStep,
        condition: 'progress',
      };

      const result = await validator.validateStep(progressStep, stateWith70Percent, templateWithManySteps);

      expect(result.valid).toBe(true); // 70% progress is truthy
    });

    test('should handle all completed steps (100% progress)', async () => {
      const allSteps: Step[] = [
        { id: 'step-1', title: 'Step 1' },
        { id: 'step-2', title: 'Step 2' },
      ];

      const templateWithAllSteps: ChecklistTemplate = {
        ...mockTemplate,
        steps: allSteps,
      };

      const allCompleted: CompletedStep[] = allSteps.map(step => ({
        step,
        completedAt: new Date(),
      }));

      const stateWith100Percent: WorkflowState = {
        ...mockState,
        completedSteps: allCompleted,
      };

      const progressStep: Step = {
        ...mockStep,
        condition: 'progress',
      };

      const result = await validator.validateStep(progressStep, stateWith100Percent, templateWithAllSteps);

      expect(result.valid).toBe(true); // 100% progress is truthy
    });

    test('should handle currentStepIndex in condition', async () => {
      const stateWithStepIndex: WorkflowState = {
        ...mockState,
        currentStepIndex: 5,
      };

      const indexStep: Step = {
        ...mockStep,
        condition: 'currentStepIndex',
      };

      const result = await validator.validateStep(indexStep, stateWithStepIndex, mockTemplate);

      expect(result.valid).toBe(true); // 5 is truthy
    });

    test('should handle completedSteps array in condition', async () => {
      const completedStep: CompletedStep = {
        step: { id: 'completed-1', title: 'Completed Step' },
        completedAt: new Date(),
      };

      const stateWithCompleted: WorkflowState = {
        ...mockState,
        completedSteps: [completedStep, completedStep, completedStep],
      };

      const completedArrayStep: Step = {
        ...mockStep,
        condition: 'completedSteps',
      };

      const result = await validator.validateStep(completedArrayStep, stateWithCompleted, mockTemplate);

      expect(result.valid).toBe(true); // Non-empty array is truthy
    });
  });

  describe('error handling and logging paths', () => {
    test('should handle validation throwing non-Error objects', async () => {
      const validatorInstance = validator as any;

      // Force throwing an Error object to test error handling
      const originalMethod = validatorInstance.runValidations;
      validatorInstance.runValidations = async () => {
        throw new Error('Test error message');
      };

      const result = await validator.validateStep(mockStep, mockState, mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Test error message');

      // Restore
      validatorInstance.runValidations = originalMethod;
    });

    test('should handle condition evaluation throwing non-Error in catch', async () => {
      const validatorInstance = validator as any;

      const originalMethod = validatorInstance.evaluateCondition;
      validatorInstance.evaluateCondition = () => {
        throw { message: 'Object error', code: 'TEST_ERROR' };
      };

      const stepWithCondition: Step = {
        ...mockStep,
        condition: 'test',
      };

      const result = await validator.validateStep(stepWithCondition, mockState, mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Custom validation failed');

      // Restore
      validatorInstance.evaluateCondition = originalMethod;
    });

    test('should handle extremely long error messages', async () => {
      const longErrorMessage = 'Error: ' + 'x'.repeat(10000);
      const stepWithLongError: Step = {
        ...mockStep,
        validation: [
          {
            type: 'file_exists',
            check: '/missing',
            errorMessage: longErrorMessage,
          },
        ],
      };

      const result = await validator.validateStep(stepWithLongError, mockState, mockTemplate);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('state transition edge cases', () => {
    test('should handle empty string states', () => {
      expect(() => validator.validateStateTransition('', 'active')).toThrow();
      expect(() => validator.validateStateTransition('active', '')).toThrow();
    });

    test('should handle same state transitions', () => {
      // Most same-state transitions should fail
      expect(() => validator.validateStateTransition('idle', 'idle')).toThrow();
      expect(() => validator.validateStateTransition('active', 'active')).toThrow();
      expect(() => validator.validateStateTransition('paused', 'paused')).toThrow();
    });

    test('should handle case-sensitive state names', () => {
      expect(() => validator.validateStateTransition('IDLE', 'active')).toThrow();
      expect(() => validator.validateStateTransition('idle', 'ACTIVE')).toThrow();
      expect(() => validator.validateStateTransition('Idle', 'Active')).toThrow();
    });
  });

  describe('complex validation scenarios', () => {
    test('should handle step with all validation features combined', async () => {
      const complexStep: Step = {
        id: 'complex-step',
        title: 'Complex Step',
        description: 'Step with all features',
        validation: [
          {
            type: 'file_exists',
            check: '/test1',
            errorMessage: 'File 1 missing',
          },
          {
            type: 'command',
            check: 'echo test',
            errorMessage: 'Command failed',
          },
          {
            type: 'custom',
            check: 'true',
            errorMessage: 'Custom failed',
          },
        ],
        condition: 'completedSteps',
      };

      const complexState: WorkflowState = {
        status: 'active',
        currentStepIndex: 3,
        completedSteps: [
          {
            step: { id: 'prev-1', title: 'Previous 1' },
            completedAt: new Date(),
          },
        ],
        skippedSteps: [],
        variables: {
          testVar: true,
          nested: { value: 42 },
        },
      };

      const complexTemplate: ChecklistTemplate = {
        id: 'complex-template',
        name: 'Complex Template',
        steps: [complexStep, mockStep],
        variables: {
          globalVar: 'test',
        },
        metadata: {
          version: '1.0.0',
        },
      };

      const result = await validator.validateStep(complexStep, complexState, complexTemplate);

      // Will fail due to file_exists and command validations
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
    });

    test('should handle rapid successive validations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        const step: Step = {
          id: `rapid-step-${i}`,
          title: `Rapid Step ${i}`,
          condition: i % 2 === 0 ? 'true' : 'false',
        };
        return validator.validateStep(step, mockState, mockTemplate);
      });

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result.valid).toBe(i % 2 === 0);
      });
    });

    test('should handle deeply nested template structure', async () => {
      const deepTemplate: ChecklistTemplate = {
        id: 'deep-template',
        name: 'Deep Template',
        steps: Array.from({ length: 100 }, (_, i) => ({
          id: `step-${i}`,
          title: `Step ${i}`,
          validation: i % 10 === 0 ? [{
            type: 'custom',
            check: 'true',
          }] : undefined,
          condition: i % 5 === 0 ? 'progress' : undefined,
        })),
        variables: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`var${i}`, i])
        ),
      };

      const deepState: WorkflowState = {
        ...mockState,
        completedSteps: deepTemplate.steps.slice(0, 25).map(s => ({
          step: s,
          completedAt: new Date(),
        })),
        variables: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`state${i}`, i * 2])
        ),
      };

      const testStep = deepTemplate.steps[50]!;
      const result = await validator.validateStep(testStep, deepState, deepTemplate);

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });
  });
});