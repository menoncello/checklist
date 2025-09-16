import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  WorkflowError,
  StateTransitionError,
  ValidationError,
  ConditionEvaluationError,
  TypedEventEmitter,
  type WorkflowEngineEvents,
  type Step,
  type StepContext,
  type WorkflowState,
  type Variables,
  type Progress,
  type Summary,
  type ValidationResult,
  type StepResult,
  type CompletedStep,
  type SkippedStep,
  type ChecklistTemplate,
  type StepValidation,
} from '../../src/workflow/types';

describe('Workflow Types', () => {
  describe('WorkflowError', () => {
    it('should create basic workflow error', () => {
      const error = new WorkflowError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.recoverable).toBe(false);
      expect(error.context).toBeUndefined();
      expect(error.name).toBe('WorkflowError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should create workflow error with all parameters', () => {
      const context = { stepId: 'step-1', userId: 123 };
      const error = new WorkflowError('Test error', 'TEST_CODE', true, context);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.recoverable).toBe(true);
      expect(error.context).toEqual(context);
      expect(error.name).toBe('WorkflowError');
    });

    it('should handle empty context', () => {
      const error = new WorkflowError('Test error', 'TEST_CODE', false, {});

      expect(error.context).toEqual({});
    });

    it('should handle complex context objects', () => {
      const context = {
        step: { id: 'step-1', title: 'Test Step' },
        variables: { count: 5, enabled: true },
        nested: { deep: { value: 'test' } }
      };
      const error = new WorkflowError('Complex error', 'COMPLEX_CODE', true, context);

      expect(error.context).toEqual(context);
    });
  });

  describe('StateTransitionError', () => {
    it('should create state transition error with correct message and context', () => {
      const error = new StateTransitionError('idle', 'completed', 'missing steps');

      expect(error.message).toBe('Invalid state transition from idle to completed: missing steps');
      expect(error.code).toBe('STATE_TRANSITION_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.context).toEqual({
        from: 'idle',
        to: 'completed',
        reason: 'missing steps'
      });
      expect(error).toBeInstanceOf(WorkflowError);
    });

    it('should handle various state combinations', () => {
      const error = new StateTransitionError('active', 'paused', 'user requested');

      expect(error.message).toBe('Invalid state transition from active to paused: user requested');
      expect(error.context?.from).toBe('active');
      expect(error.context?.to).toBe('paused');
      expect(error.context?.reason).toBe('user requested');
    });

    it('should handle empty reason', () => {
      const error = new StateTransitionError('failed', 'idle', '');

      expect(error.message).toBe('Invalid state transition from failed to idle: ');
      expect(error.context?.reason).toBe('');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with correct message and context', () => {
      const error = new ValidationError('step-1', 'file_exists', 'File not found');

      expect(error.message).toBe('Validation failed for step step-1: File not found');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.recoverable).toBe(true);
      expect(error.context).toEqual({
        step: 'step-1',
        validation: 'file_exists',
        details: 'File not found'
      });
      expect(error).toBeInstanceOf(WorkflowError);
    });

    it('should handle command validation errors', () => {
      const error = new ValidationError('step-2', 'command', 'Command failed with exit code 1');

      expect(error.message).toBe('Validation failed for step step-2: Command failed with exit code 1');
      expect(error.context?.validation).toBe('command');
    });

    it('should handle custom validation errors', () => {
      const error = new ValidationError('step-3', 'custom', 'Custom validation logic failed');

      expect(error.context?.validation).toBe('custom');
      expect(error.context?.details).toBe('Custom validation logic failed');
    });
  });

  describe('ConditionEvaluationError', () => {
    it('should create condition evaluation error with original error', () => {
      const originalError = new Error('Syntax error in condition');
      const error = new ConditionEvaluationError('variables.count > 0', originalError);

      expect(error.message).toBe('Failed to evaluate condition: variables.count > 0');
      expect(error.code).toBe('CONDITION_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.context).toEqual({
        condition: 'variables.count > 0',
        originalError: 'Syntax error in condition'
      });
      expect(error).toBeInstanceOf(WorkflowError);
    });

    it('should handle complex conditions', () => {
      const originalError = new Error('Reference error: undefined variable');
      const condition = 'variables.user.role === "admin" && variables.feature.enabled';
      const error = new ConditionEvaluationError(condition, originalError);

      expect(error.context?.condition).toBe(condition);
      expect(error.context?.originalError).toBe('Reference error: undefined variable');
    });

    it('should handle empty error messages', () => {
      const originalError = new Error('');
      const error = new ConditionEvaluationError('test condition', originalError);

      expect(error.context?.originalError).toBe('');
    });
  });

  describe('TypedEventEmitter', () => {
    let emitter: TypedEventEmitter<WorkflowEngineEvents>;

    beforeEach(() => {
      // Create a concrete implementation since TypedEventEmitter is abstract
      class TestEventEmitter extends TypedEventEmitter<WorkflowEngineEvents> {}
      emitter = new TestEventEmitter();
    });

    afterEach(() => {
      emitter.removeAllListeners();
    });

    describe('emit', () => {
      it('should emit events with correct arguments', () => {
        const mockListener = mock(() => {});
        const step: Step = { id: 'step-1', title: 'Test Step' };

        emitter.on('step:completed', mockListener);
        const result = emitter.emit('step:completed', step);

        expect(result).toBe(true);
        expect(mockListener).toHaveBeenCalledWith(step);
      });

      it('should emit progress events', () => {
        const mockListener = mock(() => {});
        const progress: Progress = {
          currentStepIndex: 2,
          totalSteps: 5,
          completedSteps: 2,
          skippedSteps: 0,
          percentComplete: 40
        };

        emitter.on('progress:updated', mockListener);
        emitter.emit('progress:updated', progress);

        expect(mockListener).toHaveBeenCalledWith(progress);
      });

      it('should emit workflow completion events', () => {
        const mockListener = mock(() => {});
        const summary: Summary = {
          templateId: 'template-1',
          instanceId: 'instance-1',
          startedAt: new Date('2023-01-01'),
          completedAt: new Date('2023-01-01'),
          duration: 3600000,
          completedSteps: 5,
          skippedSteps: 1,
          totalSteps: 6,
          status: 'completed'
        };

        emitter.on('workflow:completed', mockListener);
        emitter.emit('workflow:completed', summary);

        expect(mockListener).toHaveBeenCalledWith(summary);
      });

      it('should emit error events', () => {
        const mockListener = mock(() => {});
        const error = new WorkflowError('Test error', 'TEST_CODE');

        emitter.on('error', mockListener);
        emitter.emit('error', error);

        expect(mockListener).toHaveBeenCalledWith(error);
      });

      it('should return false when no listeners', () => {
        const step: Step = { id: 'step-1', title: 'Test Step' };
        const result = emitter.emit('step:completed', step);

        expect(result).toBe(false);
      });
    });

    describe('on', () => {
      it('should register event listeners', () => {
        const mockListener = mock(() => {});
        const step: Step = { id: 'step-1', title: 'Test Step' };

        const result = emitter.on('step:changed', mockListener);
        emitter.emit('step:changed', step);

        expect(result).toBe(emitter);
        expect(mockListener).toHaveBeenCalledWith(step);
      });

      it('should register multiple listeners for same event', () => {
        const mockListener1 = mock(() => {});
        const mockListener2 = mock(() => {});
        const step: Step = { id: 'step-1', title: 'Test Step' };

        emitter.on('step:changed', mockListener1);
        emitter.on('step:changed', mockListener2);
        emitter.emit('step:changed', step);

        expect(mockListener1).toHaveBeenCalledWith(step);
        expect(mockListener2).toHaveBeenCalledWith(step);
      });

      it('should handle recovery events', () => {
        const mockListener = mock(() => {});
        const recoveryData = { type: 'state', timestamp: new Date() };

        emitter.on('recovery:started', mockListener);
        emitter.emit('recovery:started', recoveryData);

        expect(mockListener).toHaveBeenCalledWith(recoveryData);
      });
    });

    describe('once', () => {
      it('should register one-time event listeners', () => {
        const mockListener = mock(() => {});
        const step: Step = { id: 'step-1', title: 'Test Step' };

        const result = emitter.once('step:completed', mockListener);
        emitter.emit('step:completed', step);
        emitter.emit('step:completed', step); // Second emit

        expect(result).toBe(emitter);
        expect(mockListener).toHaveBeenCalledTimes(1);
        expect(mockListener).toHaveBeenCalledWith(step);
      });

      it('should handle validation failed events', () => {
        const mockListener = mock(() => {});
        const step: Step = { id: 'step-1', title: 'Test Step' };
        const error = new ValidationError('step-1', 'file_exists', 'File not found');

        emitter.once('validation:failed', mockListener);
        emitter.emit('validation:failed', step, error);

        expect(mockListener).toHaveBeenCalledWith(step, error);
      });
    });

    describe('off', () => {
      it('should remove specific event listeners', () => {
        const mockListener = mock(() => {});
        const step: Step = { id: 'step-1', title: 'Test Step' };

        emitter.on('step:skipped', mockListener);
        const result = emitter.off('step:skipped', mockListener);
        emitter.emit('step:skipped', step, 'condition not met');

        expect(result).toBe(emitter);
        expect(mockListener).not.toHaveBeenCalled();
      });

      it('should only remove the specified listener', () => {
        const mockListener1 = mock(() => {});
        const mockListener2 = mock(() => {});
        const step: Step = { id: 'step-1', title: 'Test Step' };

        emitter.on('step:changed', mockListener1);
        emitter.on('step:changed', mockListener2);
        emitter.off('step:changed', mockListener1);
        emitter.emit('step:changed', step);

        expect(mockListener1).not.toHaveBeenCalled();
        expect(mockListener2).toHaveBeenCalledWith(step);
      });

      it('should handle removal of non-existent listeners', () => {
        const mockListener = mock(() => {});

        expect(() => {
          emitter.off('step:changed', mockListener);
        }).not.toThrow();
      });
    });

    describe('state change events', () => {
      it('should emit state change events', () => {
        const mockListener = mock(() => {});
        const state: WorkflowState = {
          status: 'active',
          currentStepIndex: 1,
          completedSteps: [],
          skippedSteps: [],
          variables: {}
        };

        emitter.on('state:changed', mockListener);
        emitter.emit('state:changed', state);

        expect(mockListener).toHaveBeenCalledWith(state);
      });

      it('should handle recovery completion events', () => {
        const mockListener = mock(() => {});
        const recoveryData = {
          type: 'backup',
          timestamp: new Date(),
          recoveredCount: 3
        };

        emitter.on('recovery:completed', mockListener);
        emitter.emit('recovery:completed', recoveryData);

        expect(mockListener).toHaveBeenCalledWith(recoveryData);
      });
    });

    describe('event chaining', () => {
      it('should support method chaining', () => {
        const mockListener1 = mock(() => {});
        const mockListener2 = mock(() => {});

        const result = emitter
          .on('step:changed', mockListener1)
          .on('step:completed', mockListener2);

        expect(result).toBe(emitter);
      });

      it('should support removing and adding in chain', () => {
        const mockListener = mock(() => {});
        const step: Step = { id: 'step-1', title: 'Test Step' };

        emitter
          .on('step:changed', mockListener)
          .off('step:changed', mockListener)
          .on('step:changed', mockListener);

        emitter.emit('step:changed', step);
        expect(mockListener).toHaveBeenCalledWith(step);
      });
    });
  });

  describe('Type Interfaces', () => {
    describe('Step interface', () => {
      it('should create step with required fields', () => {
        const step: Step = {
          id: 'step-1',
          title: 'Test Step'
        };

        expect(step.id).toBe('step-1');
        expect(step.title).toBe('Test Step');
        expect(step.description).toBeUndefined();
        expect(step.action).toBeUndefined();
      });

      it('should create step with all fields', () => {
        const validation: StepValidation = {
          type: 'file_exists',
          check: '/path/to/file',
          errorMessage: 'File does not exist'
        };

        const step: Step = {
          id: 'step-1',
          title: 'Test Step',
          description: 'This is a test step',
          action: 'echo "hello"',
          condition: 'variables.enabled === true',
          validation: [validation],
          metadata: { category: 'setup', priority: 1 }
        };

        expect(step.description).toBe('This is a test step');
        expect(step.action).toBe('echo "hello"');
        expect(step.condition).toBe('variables.enabled === true');
        expect(step.validation).toEqual([validation]);
        expect(step.metadata).toEqual({ category: 'setup', priority: 1 });
      });
    });

    describe('StepValidation interface', () => {
      it('should create command validation', () => {
        const validation: StepValidation = {
          type: 'command',
          check: 'which node'
        };

        expect(validation.type).toBe('command');
        expect(validation.check).toBe('which node');
        expect(validation.errorMessage).toBeUndefined();
      });

      it('should create file_exists validation with error message', () => {
        const validation: StepValidation = {
          type: 'file_exists',
          check: './package.json',
          errorMessage: 'package.json not found'
        };

        expect(validation.type).toBe('file_exists');
        expect(validation.errorMessage).toBe('package.json not found');
      });

      it('should create custom validation', () => {
        const validation: StepValidation = {
          type: 'custom',
          check: 'customValidator',
          errorMessage: 'Custom validation failed'
        };

        expect(validation.type).toBe('custom');
        expect(validation.check).toBe('customValidator');
      });
    });

    describe('WorkflowState interface', () => {
      it('should create minimal workflow state', () => {
        const state: WorkflowState = {
          status: 'idle',
          currentStepIndex: 0,
          completedSteps: [],
          skippedSteps: [],
          variables: {}
        };

        expect(state.status).toBe('idle');
        expect(state.currentStepIndex).toBe(0);
        expect(state.completedSteps).toEqual([]);
        expect(state.skippedSteps).toEqual([]);
        expect(state.variables).toEqual({});
      });

      it('should create complete workflow state', () => {
        const step: Step = { id: 'step-1', title: 'Test' };
        const completedStep: CompletedStep = {
          step,
          completedAt: new Date(),
          duration: 1000
        };
        const skippedStep: SkippedStep = {
          step,
          reason: 'condition not met',
          timestamp: new Date()
        };

        const state: WorkflowState = {
          status: 'active',
          currentStepIndex: 2,
          currentStep: step,
          completedSteps: [completedStep],
          skippedSteps: [skippedStep],
          variables: { count: 5, enabled: true },
          startedAt: new Date(),
          templateId: 'template-1',
          instanceId: 'instance-1'
        };

        expect(state.currentStep).toEqual(step);
        expect(state.completedSteps).toEqual([completedStep]);
        expect(state.skippedSteps).toEqual([skippedStep]);
        expect(state.variables).toEqual({ count: 5, enabled: true });
        expect(state.templateId).toBe('template-1');
        expect(state.instanceId).toBe('instance-1');
      });
    });

    describe('ChecklistTemplate interface', () => {
      it('should create minimal template', () => {
        const template: ChecklistTemplate = {
          id: 'template-1',
          name: 'Test Template',
          steps: []
        };

        expect(template.id).toBe('template-1');
        expect(template.name).toBe('Test Template');
        expect(template.steps).toEqual([]);
      });

      it('should create complete template', () => {
        const steps: Step[] = [
          { id: 'step-1', title: 'First Step' },
          { id: 'step-2', title: 'Second Step' }
        ];

        const template: ChecklistTemplate = {
          id: 'template-1',
          name: 'Test Template',
          description: 'A test template',
          version: '1.0.0',
          steps,
          variables: { defaultCount: 0 },
          metadata: { author: 'test', created: '2023-01-01' }
        };

        expect(template.description).toBe('A test template');
        expect(template.version).toBe('1.0.0');
        expect(template.steps).toEqual(steps);
        expect(template.variables).toEqual({ defaultCount: 0 });
        expect(template.metadata).toEqual({ author: 'test', created: '2023-01-01' });
      });
    });

    describe('Result interfaces', () => {
      it('should create validation result', () => {
        const validResult: ValidationResult = {
          valid: true
        };

        const invalidResult: ValidationResult = {
          valid: false,
          error: 'Validation failed'
        };

        expect(validResult.valid).toBe(true);
        expect(validResult.error).toBeUndefined();
        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.error).toBe('Validation failed');
      });

      it('should create step result', () => {
        const step: Step = { id: 'step-1', title: 'Test' };

        const successResult: StepResult = {
          success: true,
          step
        };

        const failureResult: StepResult = {
          success: false,
          step: null,
          error: 'Step execution failed'
        };

        expect(successResult.success).toBe(true);
        expect(successResult.step).toEqual(step);
        expect(failureResult.success).toBe(false);
        expect(failureResult.step).toBeNull();
        expect(failureResult.error).toBe('Step execution failed');
      });
    });

    describe('Progress and Summary interfaces', () => {
      it('should create progress object', () => {
        const progress: Progress = {
          currentStepIndex: 3,
          totalSteps: 10,
          completedSteps: 3,
          skippedSteps: 1,
          percentComplete: 30,
          estimatedTimeRemaining: 1200
        };

        expect(progress.currentStepIndex).toBe(3);
        expect(progress.totalSteps).toBe(10);
        expect(progress.percentComplete).toBe(30);
        expect(progress.estimatedTimeRemaining).toBe(1200);
      });

      it('should create summary object', () => {
        const summary: Summary = {
          templateId: 'template-1',
          instanceId: 'instance-1',
          startedAt: new Date('2023-01-01T10:00:00Z'),
          completedAt: new Date('2023-01-01T11:00:00Z'),
          duration: 3600000,
          completedSteps: 8,
          skippedSteps: 2,
          totalSteps: 10,
          status: 'completed'
        };

        expect(summary.templateId).toBe('template-1');
        expect(summary.duration).toBe(3600000);
        expect(summary.status).toBe('completed');
      });
    });
  });
});