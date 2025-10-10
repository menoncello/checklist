// @ts-nocheck - TODO: Create MockWorkflowEngineService implementation
import { describe, it, expect, beforeEach } from 'bun:test';
import type { WorkflowDefinition, WorkflowStep, WorkflowEvent, WorkflowEventHandler } from '../../src/interfaces/IWorkflowEngine';

describe('MockWorkflowEngineService', () => {
  let mockEngine: MockWorkflowEngineService;
  let testWorkflow: WorkflowDefinition;

  beforeEach(() => {
    mockEngine = new MockWorkflowEngineService();
    testWorkflow = mockEngine.createTestWorkflow();
  });

  describe('workflow management', () => {
    it('should load a workflow', async () => {
      await mockEngine.loadWorkflow(testWorkflow);

      expect(mockEngine.wasCalled('loadWorkflow')).toBe(true);
      expect(mockEngine.getCallCount('loadWorkflow')).toBe(1);
    });

    it('should fail loading workflow when configured to fail', async () => {
      mockEngine.failNextCall('loadWorkflow');

      await expect(mockEngine.loadWorkflow(testWorkflow)).rejects.toThrow('Mock error: loadWorkflow failed');
      expect(mockEngine.shouldFailNext).toBeNull();
    });

    it('should start a workflow and create instance', async () => {
      await mockEngine.loadWorkflow(testWorkflow);
      const instance = await mockEngine.startWorkflow(testWorkflow.id);

      expect(instance).toBeDefined();
      expect(instance.workflowId).toBe(testWorkflow.id);
      expect(instance.currentStepId).toBe('step-1');
      expect(instance.status).toBe('active');
      expect(instance.startedAt).toBeInstanceOf(Date);
      expect(instance.updatedAt).toBeInstanceOf(Date);
      expect(mockEngine.wasCalled('startWorkflow')).toBe(true);
    });

    it('should fail starting non-existent workflow', async () => {
      await expect(mockEngine.startWorkflow('non-existent')).rejects.toThrow('Workflow not found: non-existent');
    });

    it('should fail starting workflow when configured to fail', async () => {
      await mockEngine.loadWorkflow(testWorkflow);
      mockEngine.failNextCall('startWorkflow');

      await expect(mockEngine.startWorkflow(testWorkflow.id)).rejects.toThrow('Mock error: startWorkflow failed');
    });

    it('should emit workflow-started event when starting', async () => {
      await mockEngine.loadWorkflow(testWorkflow);
      const instance = await mockEngine.startWorkflow(testWorkflow.id);

      const events = mockEngine.getEmittedEvents('workflow-started');
      expect(events).toHaveLength(1);
      expect(events[0].workflowId).toBe(testWorkflow.id);
      expect(events[0].instanceId).toBe(instance.id);
    });

    it('should set status to running when workflow starts', async () => {
      await mockEngine.loadWorkflow(testWorkflow);
      await mockEngine.startWorkflow(testWorkflow.id);

      expect(mockEngine.getStatus()).toBe('running');
    });

    it('should handle workflow with no steps', async () => {
      const emptyWorkflow: WorkflowDefinition = {
        id: 'empty',
        name: 'Empty Workflow',
        version: '1.0.0',
        steps: [],
      };

      await mockEngine.loadWorkflow(emptyWorkflow);
      const instance = await mockEngine.startWorkflow(emptyWorkflow.id);

      expect(instance.currentStepId).toBe('step-1');
      expect(mockEngine.getCurrentStep()).toBeNull();
    });
  });

  describe('step navigation', () => {
    beforeEach(async () => {
      await mockEngine.loadWorkflow(testWorkflow);
      await mockEngine.startWorkflow(testWorkflow.id);
    });

    it('should get current step', () => {
      const currentStep = mockEngine.getCurrentStep();

      expect(currentStep).not.toBeNull();
      expect(currentStep?.id).toBe('step-1');
      expect(currentStep?.name).toBe('First Step');
      expect(mockEngine.wasCalled('getCurrentStep')).toBe(true);
    });

    it('should advance to next step', async () => {
      await mockEngine.advance();

      const currentStep = mockEngine.getCurrentStep();
      expect(currentStep?.id).toBe('step-2');

      const events = mockEngine.getEmittedEvents('step-completed');
      expect(events).toHaveLength(1);
      expect(events[0].stepId).toBe('step-1');
    });

    it('should complete workflow when advancing from last step', async () => {
      // Move to last step
      await mockEngine.advance(); // step-1 -> step-2
      await mockEngine.advance(); // step-2 -> step-3
      await mockEngine.advance(); // step-3 -> completed

      expect(mockEngine.getStatus()).toBe('completed');
      const instance = mockEngine.getInstance();
      expect(instance?.status).toBe('completed');

      const events = mockEngine.getEmittedEvents('workflow-completed');
      expect(events).toHaveLength(1);
    });

    it('should fail advancing when configured to fail', async () => {
      mockEngine.failNextCall('advance');

      await expect(mockEngine.advance()).rejects.toThrow('Mock error: advance failed');
    });

    it('should fail advancing when no active workflow', async () => {
      await mockEngine.reset();

      await expect(mockEngine.advance()).rejects.toThrow('No active workflow');
    });

    it('should go back to previous step', async () => {
      await mockEngine.advance(); // Go to step-2
      await mockEngine.goBack(); // Back to step-1

      const currentStep = mockEngine.getCurrentStep();
      expect(currentStep?.id).toBe('step-1');
      expect(mockEngine.wasCalled('goBack')).toBe(true);
    });

    it('should not go back when at first step', async () => {
      const initialStep = mockEngine.getCurrentStep();
      await mockEngine.goBack();

      const currentStep = mockEngine.getCurrentStep();
      expect(currentStep?.id).toBe(initialStep?.id);
    });

    it('should fail going back when configured to fail', async () => {
      mockEngine.failNextCall('goBack');

      await expect(mockEngine.goBack()).rejects.toThrow('Mock error: goBack failed');
    });

    it('should fail going back when no active workflow', async () => {
      await mockEngine.reset();

      await expect(mockEngine.goBack()).rejects.toThrow('No active workflow');
    });

    it('should skip current step', async () => {
      await mockEngine.skip();

      const currentStep = mockEngine.getCurrentStep();
      expect(currentStep?.id).toBe('step-2');

      const skippedEvents = mockEngine.getEmittedEvents('step-skipped');
      expect(skippedEvents).toHaveLength(1);
      expect(skippedEvents[0].stepId).toBe('step-1');

      const completedEvents = mockEngine.getEmittedEvents('step-completed');
      expect(completedEvents).toHaveLength(1);
    });

    it('should fail skipping when configured to fail', async () => {
      mockEngine.failNextCall('skip');

      await expect(mockEngine.skip()).rejects.toThrow('Mock error: skip failed');
    });

    it('should handle skip when no current step', async () => {
      mockEngine.setCurrentStep(null);

      await mockEngine.skip();

      const skippedEvents = mockEngine.getEmittedEvents('step-skipped');
      expect(skippedEvents).toHaveLength(0);
    });
  });

  describe('workflow control', () => {
    beforeEach(async () => {
      await mockEngine.loadWorkflow(testWorkflow);
      await mockEngine.startWorkflow(testWorkflow.id);
    });

    it('should pause workflow', async () => {
      await mockEngine.pause();

      expect(mockEngine.getStatus()).toBe('paused');
      const instance = mockEngine.getInstance();
      expect(instance?.status).toBe('paused');

      const events = mockEngine.getEmittedEvents('workflow-paused');
      expect(events).toHaveLength(1);
      expect(mockEngine.wasCalled('pause')).toBe(true);
    });

    it('should fail pausing when configured to fail', async () => {
      mockEngine.failNextCall('pause');

      await expect(mockEngine.pause()).rejects.toThrow('Mock error: pause failed');
    });

    it('should pause when no current instance', async () => {
      mockEngine.setCurrentInstance(null);

      await mockEngine.pause();

      expect(mockEngine.getStatus()).toBe('paused');
      const events = mockEngine.getEmittedEvents('workflow-paused');
      expect(events).toHaveLength(0);
    });

    it('should resume workflow', async () => {
      await mockEngine.pause();
      await mockEngine.resume();

      expect(mockEngine.getStatus()).toBe('running');
      const instance = mockEngine.getInstance();
      expect(instance?.status).toBe('active');
      expect(mockEngine.wasCalled('resume')).toBe(true);
    });

    it('should fail resuming when configured to fail', async () => {
      mockEngine.failNextCall('resume');

      await expect(mockEngine.resume()).rejects.toThrow('Mock error: resume failed');
    });

    it('should resume when no current instance', async () => {
      mockEngine.setCurrentInstance(null);

      await mockEngine.resume();

      expect(mockEngine.getStatus()).toBe('running');
    });

    it('should reset workflow', async () => {
      await mockEngine.reset();

      expect(mockEngine.getInstance()).toBeNull();
      expect(mockEngine.getCurrentStep()).toBeNull();
      expect(mockEngine.getStatus()).toBe('idle');
      expect(mockEngine.wasCalled('reset')).toBe(true);
    });

    it('should fail resetting when configured to fail', async () => {
      mockEngine.failNextCall('reset');

      await expect(mockEngine.reset()).rejects.toThrow('Mock error: reset failed');
    });
  });

  describe('state getters', () => {
    it('should get status', () => {
      const status = mockEngine.getStatus();

      expect(status).toBe('idle');
      expect(mockEngine.wasCalled('getStatus')).toBe(true);
    });

    it('should get instance', () => {
      const instance = mockEngine.getInstance();

      expect(instance).toBeNull();
      expect(mockEngine.wasCalled('getInstance')).toBe(true);
    });

    it('should return current instance when workflow is running', async () => {
      await mockEngine.loadWorkflow(testWorkflow);
      const startedInstance = await mockEngine.startWorkflow(testWorkflow.id);
      const instance = mockEngine.getInstance();

      expect(instance).toEqual(startedInstance);
    });
  });

  describe('event handling', () => {
    let eventHandler: WorkflowEventHandler;
    let receivedEvents: WorkflowEvent[];

    beforeEach(() => {
      receivedEvents = [];
      eventHandler = (event: WorkflowEvent) => {
        receivedEvents.push(event);
        return Promise.resolve();
      };
    });

    it('should register event handler', () => {
      mockEngine.on('workflow-started', eventHandler);

      expect(mockEngine.wasCalled('on')).toBe(true);
      expect(mockEngine.getCallCount('on')).toBe(1);
    });

    it('should call event handler when event is emitted', async () => {
      mockEngine.on('workflow-started', eventHandler);

      const event: WorkflowEvent = {
        type: 'workflow-started',
        workflowId: 'test',
        instanceId: 'instance',
        timestamp: new Date(),
      };

      await mockEngine.emit(event);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(event);
    });

    it('should track emitted events', async () => {
      const event: WorkflowEvent = {
        type: 'step-completed',
        workflowId: 'test',
        instanceId: 'instance',
        stepId: 'step-1',
        timestamp: new Date(),
      };

      await mockEngine.emit(event);

      expect(mockEngine.emittedEvents).toContain(event);
      expect(mockEngine.wasCalled('emit')).toBe(true);
    });

    it('should remove event handler', () => {
      mockEngine.on('workflow-started', eventHandler);
      mockEngine.off('workflow-started', eventHandler);

      expect(mockEngine.wasCalled('off')).toBe(true);
    });

    it('should not call removed event handler', async () => {
      mockEngine.on('workflow-started', eventHandler);
      mockEngine.off('workflow-started', eventHandler);

      const event: WorkflowEvent = {
        type: 'workflow-started',
        workflowId: 'test',
        instanceId: 'instance',
        timestamp: new Date(),
      };

      await mockEngine.emit(event);

      expect(receivedEvents).toHaveLength(0);
    });

    it('should handle multiple handlers for same event', async () => {
      const receivedEvents2: WorkflowEvent[] = [];
      const eventHandler2: WorkflowEventHandler = (event: WorkflowEvent) => {
        receivedEvents2.push(event);
        return Promise.resolve();
      };

      mockEngine.on('workflow-started', eventHandler);
      mockEngine.on('workflow-started', eventHandler2);

      const event: WorkflowEvent = {
        type: 'workflow-started',
        workflowId: 'test',
        instanceId: 'instance',
        timestamp: new Date(),
      };

      await mockEngine.emit(event);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents2).toHaveLength(1);
    });

    it('should not fail when removing non-existent handler', () => {
      expect(() => mockEngine.off('workflow-started', eventHandler)).not.toThrow();
    });

    it('should not fail when emitting event with no handlers', async () => {
      const event: WorkflowEvent = {
        type: 'workflow-started',
        workflowId: 'test',
        instanceId: 'instance',
        timestamp: new Date(),
      };

      // Should not throw
      await expect(mockEngine.emit(event)).resolves.toBeUndefined();
    });
  });

  describe('test utilities', () => {
    it('should set status', () => {
      mockEngine.setStatus('completed');

      expect(mockEngine.getStatus()).toBe('completed');
    });

    it('should set current step', () => {
      const step: WorkflowStep = {
        id: 'custom-step',
        name: 'Custom Step',
        type: 'task',
      };

      mockEngine.setCurrentStep(step);

      expect(mockEngine.getCurrentStep()).toEqual(step);
    });

    it('should set current instance', () => {
      const instance = {
        id: 'custom-instance',
        workflowId: 'custom-workflow',
        currentStepId: 'step-1',
        startedAt: new Date(),
        updatedAt: new Date(),
        status: 'active' as const,
        stepStates: {},
      };

      mockEngine.setCurrentInstance(instance);

      expect(mockEngine.getInstance()).toEqual(instance);
    });

    it('should clear history', () => {
      mockEngine.getStatus(); // Make a call
      const event: WorkflowEvent = {
        type: 'workflow-started',
        workflowId: 'test',
        instanceId: 'instance',
        timestamp: new Date(),
      };
      mockEngine.emit(event);
      mockEngine.on('workflow-started', () => Promise.resolve());

      mockEngine.clearHistory();

      expect(mockEngine.methodCalls.size).toBe(0);
      expect(mockEngine.emittedEvents).toHaveLength(0);
      expect(mockEngine.getCallCount('getStatus')).toBe(0);
    });

    it('should get call count for specific method', () => {
      mockEngine.getStatus();
      mockEngine.getStatus();

      expect(mockEngine.getCallCount('getStatus')).toBe(2);
    });

    it('should return 0 for non-called method', () => {
      expect(mockEngine.getCallCount('nonExistentMethod')).toBe(0);
    });

    it('should check if method was called', () => {
      expect(mockEngine.wasCalled('getStatus')).toBe(false);

      mockEngine.getStatus();

      expect(mockEngine.wasCalled('getStatus')).toBe(true);
    });

    it('should get emitted events by type', async () => {
      const event1: WorkflowEvent = {
        type: 'workflow-started',
        workflowId: 'test',
        instanceId: 'instance',
        timestamp: new Date(),
      };

      const event2: WorkflowEvent = {
        type: 'step-completed',
        workflowId: 'test',
        instanceId: 'instance',
        stepId: 'step-1',
        timestamp: new Date(),
      };

      await mockEngine.emit(event1);
      await mockEngine.emit(event2);

      const startedEvents = mockEngine.getEmittedEvents('workflow-started');
      expect(startedEvents).toHaveLength(1);
      expect(startedEvents[0]).toEqual(event1);

      const allEvents = mockEngine.getEmittedEvents();
      expect(allEvents).toHaveLength(2);
    });

    it('should create test workflow with default id', () => {
      const workflow = mockEngine.createTestWorkflow();

      expect(workflow.id).toBe('test-workflow');
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.version).toBe('1.0.0');
      expect(workflow.steps).toHaveLength(3);
      expect(workflow.steps[0].id).toBe('step-1');
      expect(workflow.steps[1].id).toBe('step-2');
      expect(workflow.steps[2].id).toBe('step-3');
    });

    it('should create test workflow with custom id', () => {
      const workflow = mockEngine.createTestWorkflow('custom-workflow');

      expect(workflow.id).toBe('custom-workflow');
      expect(workflow.name).toBe('Test Workflow');
    });
  });

  describe('advanced navigation scenarios', () => {
    it('should handle step with array of next steps', async () => {
      const workflowWithBranching: WorkflowDefinition = {
        id: 'branching-workflow',
        name: 'Branching Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step-1',
            name: 'First Step',
            type: 'task',
            next: ['step-2a', 'step-2b'], // Multiple next steps
          },
          {
            id: 'step-2a',
            name: 'Branch A',
            type: 'task',
          },
          {
            id: 'step-2b',
            name: 'Branch B',
            type: 'task',
          },
        ],
      };

      await mockEngine.loadWorkflow(workflowWithBranching);
      await mockEngine.startWorkflow(workflowWithBranching.id);
      await mockEngine.advance();

      // Should take the first option in the array
      const currentStep = mockEngine.getCurrentStep();
      expect(currentStep?.id).toBe('step-2a');
    });

    it('should handle workflow with non-existent next step', async () => {
      const workflowWithBadNext: WorkflowDefinition = {
        id: 'bad-next-workflow',
        name: 'Bad Next Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step-1',
            name: 'First Step',
            type: 'task',
            next: 'non-existent-step',
          },
        ],
      };

      await mockEngine.loadWorkflow(workflowWithBadNext);
      await mockEngine.startWorkflow(workflowWithBadNext.id);
      await mockEngine.advance();

      // Should set current step to null when next step doesn't exist
      const currentStep = mockEngine.getCurrentStep();
      expect(currentStep).toBeNull();
    });

    it('should handle going back when workflow or current step not found', async () => {
      await mockEngine.loadWorkflow(testWorkflow);
      await mockEngine.startWorkflow(testWorkflow.id);

      // Manually set a non-existent workflow ID
      const instance = mockEngine.getInstance();
      if (instance) {
        instance.workflowId = 'non-existent';
      }

      await mockEngine.goBack();

      // Should not crash, step should remain unchanged
      const currentStep = mockEngine.getCurrentStep();
      expect(currentStep?.id).toBe('step-1');
    });

    it('should handle going back when current step not found in workflow', async () => {
      await mockEngine.loadWorkflow(testWorkflow);
      await mockEngine.startWorkflow(testWorkflow.id);

      // Set a step that doesn't exist in the workflow
      mockEngine.setCurrentStep({
        id: 'non-existent-step',
        name: 'Non-existent',
        type: 'task',
      });

      await mockEngine.goBack();

      // Should not crash, step should remain unchanged
      const currentStep = mockEngine.getCurrentStep();
      expect(currentStep?.id).toBe('non-existent-step');
    });
  });

  describe('edge cases', () => {
    it('should handle workflow with single step', async () => {
      const singleStepWorkflow: WorkflowDefinition = {
        id: 'single-step',
        name: 'Single Step Workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'only-step',
            name: 'Only Step',
            type: 'task',
          },
        ],
      };

      await mockEngine.loadWorkflow(singleStepWorkflow);
      await mockEngine.startWorkflow(singleStepWorkflow.id);
      await mockEngine.advance();

      expect(mockEngine.getStatus()).toBe('completed');
    });

    it('should handle empty instance ID and workflow ID in skip', async () => {
      // Set up a minimal workflow and instance to avoid "No active workflow" error
      await mockEngine.loadWorkflow(testWorkflow);
      await mockEngine.startWorkflow(testWorkflow.id);

      // Now clear the instance to test the empty ID scenario
      const currentStep = mockEngine.getCurrentStep();
      mockEngine.setCurrentInstance(null);
      mockEngine.setCurrentStep(currentStep);

      await expect(mockEngine.skip()).rejects.toThrow('No active workflow');

      // Alternative: test the scenario by checking if skip emits proper events with empty IDs
      // by setting up a partial instance
      const partialInstance = {
        id: '',
        workflowId: '',
        currentStepId: 'step-1',
        startedAt: new Date(),
        updatedAt: new Date(),
        status: 'active' as const,
        stepStates: {},
      };

      mockEngine.setCurrentInstance(partialInstance);
      mockEngine.setCurrentStep({
        id: 'test-step',
        name: 'Test Step',
        type: 'task',
      });

      await mockEngine.skip();

      const skippedEvents = mockEngine.getEmittedEvents('step-skipped');
      // Should have at least one skipped event (from the skip call)
      expect(skippedEvents.length).toBeGreaterThan(0);
      const lastSkippedEvent = skippedEvents[skippedEvents.length - 1];
      expect(lastSkippedEvent.workflowId).toBe('');
      expect(lastSkippedEvent.instanceId).toBe('');
    });

    it('should track method calls with arguments', async () => {
      const workflow = mockEngine.createTestWorkflow('test-id');
      await mockEngine.loadWorkflow(workflow);

      const calls = mockEngine.methodCalls.get('loadWorkflow');
      expect(calls).toHaveLength(1);
      expect(calls?.[0]).toEqual([workflow]);
    });

    it('should handle async event handlers', async () => {
      let handlerCompleted = false;
      const asyncHandler: WorkflowEventHandler = async (event: WorkflowEvent) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        handlerCompleted = true;
      };

      mockEngine.on('workflow-started', asyncHandler);

      const event: WorkflowEvent = {
        type: 'workflow-started',
        workflowId: 'test',
        instanceId: 'instance',
        timestamp: new Date(),
      };

      await mockEngine.emit(event);

      expect(handlerCompleted).toBe(true);
    });
  });
});